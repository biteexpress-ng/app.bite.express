"use client";

import { create } from "zustand";

/**
 * Customer cart — client-only for v0.
 *
 * The 6amMart backend also has a server-side cart (gated by
 * apiGuestCheck middleware), but the existing biteexpress-user-app
 * does most of its cart math client-side and only sends the final
 * payload at checkout. We follow that pattern.
 *
 * SINGLE-STORE INVARIANT (6amMart standard): a customer cart can
 * only hold items from one store at a time. Attempting to add an
 * item from a different store while the cart is non-empty surfaces
 * a conflict (caller's responsibility to show the "clear cart?"
 * dialog before retrying with `force: true`).
 *
 * Variations / food_variations / add_ons are NOT modelled yet.
 * Items added in v0 are the default config — slice 5c will add the
 * choice UI.
 */

export type CartLine = {
  /** Stable key — itemId on its own is enough until variations exist. */
  key: string;
  itemId: number;
  storeId: number;
  name: string;
  imageUrl?: string | null;
  /** Final unit price after discount, in NGN. */
  unitPrice: number;
  qty: number;
};

export type AddLineInput = {
  itemId: number;
  storeId: number;
  name: string;
  imageUrl?: string | null;
  unitPrice: number;
  qty?: number;
};

export type AddResult =
  | { ok: true; merged: boolean }
  | { ok: false; reason: "store-conflict"; currentStoreId: number };

const STORAGE_KEY = "biteexpress.cart";

type Persisted = { storeId: number | null; lines: CartLine[] };

function readPersisted(): Persisted {
  if (typeof window === "undefined") return { storeId: null, lines: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { storeId: null, lines: [] };
    const parsed = JSON.parse(raw) as Persisted;
    return {
      storeId: typeof parsed.storeId === "number" ? parsed.storeId : null,
      lines: Array.isArray(parsed.lines) ? parsed.lines : [],
    };
  } catch {
    return { storeId: null, lines: [] };
  }
}

function writePersisted(p: Persisted) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* quota / disabled — accept */
  }
}

type CartState = {
  storeId: number | null;
  lines: CartLine[];
  hydrated: boolean;

  hydrate: () => void;
  add: (input: AddLineInput, opts?: { force?: boolean }) => AddResult;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;

  /** Derived: total item count (sum of qty). */
  count: () => number;
  /** Derived: subtotal in NGN (sum of unit * qty). */
  subtotal: () => number;
};

export const useCart = create<CartState>((set, get) => ({
  storeId: null,
  lines: [],
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const p = readPersisted();
    set({ ...p, hydrated: true });
  },

  add: (input, opts) => {
    const state = get();
    const force = opts?.force === true;

    if (
      state.storeId !== null &&
      state.storeId !== input.storeId &&
      state.lines.length > 0 &&
      !force
    ) {
      return {
        ok: false,
        reason: "store-conflict",
        currentStoreId: state.storeId,
      };
    }

    const qty = Math.max(1, input.qty ?? 1);
    const key = String(input.itemId);

    let nextLines: CartLine[];
    let merged = false;
    const newStoreId = input.storeId;

    // Conflict with force=true → start a fresh cart for this store.
    const resetting = state.storeId !== null && state.storeId !== input.storeId;
    const baseLines = resetting ? [] : state.lines;

    const existing = baseLines.find((l) => l.key === key);
    if (existing) {
      merged = true;
      nextLines = baseLines.map((l) =>
        l.key === key ? { ...l, qty: l.qty + qty } : l,
      );
    } else {
      nextLines = [
        ...baseLines,
        {
          key,
          itemId: input.itemId,
          storeId: input.storeId,
          name: input.name,
          imageUrl: input.imageUrl ?? null,
          unitPrice: input.unitPrice,
          qty,
        },
      ];
    }

    const next: Persisted = { storeId: newStoreId, lines: nextLines };
    writePersisted(next);
    set({ ...next, hydrated: true });
    return { ok: true, merged };
  },

  setQty: (key, qty) => {
    if (qty <= 0) {
      get().remove(key);
      return;
    }
    const nextLines = get().lines.map((l) =>
      l.key === key ? { ...l, qty } : l,
    );
    const next: Persisted = { storeId: get().storeId, lines: nextLines };
    writePersisted(next);
    set(next);
  },

  remove: (key) => {
    const nextLines = get().lines.filter((l) => l.key !== key);
    const next: Persisted = {
      storeId: nextLines.length === 0 ? null : get().storeId,
      lines: nextLines,
    };
    writePersisted(next);
    set(next);
  },

  clear: () => {
    const next: Persisted = { storeId: null, lines: [] };
    writePersisted(next);
    set(next);
  },

  count: () => get().lines.reduce((sum, l) => sum + l.qty, 0),
  subtotal: () => get().lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),
}));

/** Convenience selectors — keeps subscribers from re-rendering on
 *  unrelated changes. */
export const useCartCount = () =>
  useCart((s) => s.lines.reduce((sum, l) => sum + l.qty, 0));
export const useCartSubtotal = () =>
  useCart((s) => s.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0));
