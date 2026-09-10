"use client";

import { create } from "zustand";
import { cartKeyFor, type VariationSelection } from "@/lib/food-variations";
import type { AddOnSelection } from "@/lib/api/store-detail";
import { applyLineNote } from "@/lib/price-check/item-notes";

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
 * Lines carry the chosen `selections` (food_variations) so two
 * orders of the same item with different soup types become two
 * separate cart lines. `unitPrice` is post-discount + uplifted by
 * the chosen options.
 *
 * Add-ons are still TODO — slice-5d.
 */

export type CartLine = {
  /** Stable key — `${itemId}` alone for plain adds, or
   *  `${itemId}|${sortedSelections}|+aid:qty,aid:qty` when
   *  variations and/or add-ons are picked. */
  key: string;
  itemId: number;
  storeId: number;
  name: string;
  imageUrl?: string | null;
  /** Final unit price (post-discount, including variation uplifts AND
   *  the sum of selected add-ons * their qtys). */
  unitPrice: number;
  qty: number;
  /** Chosen food_variations for this line. Empty array when none. */
  selections: VariationSelection[];
  /** Chosen add-ons for this line, with their qty (default 1 each).
   *  Empty array when the item has no add-ons or the customer
   *  didn't add any. */
  addOns: AddOnSelection[];
  /** Free-text note for the store, used only by the price-request flow.
   *  One note per item id: see buildItemNotes. */
  note?: string;
};

export type AddLineInput = {
  itemId: number;
  storeId: number;
  name: string;
  imageUrl?: string | null;
  unitPrice: number;
  qty?: number;
  selections?: VariationSelection[];
  addOns?: AddOnSelection[];
};

export type AddResult =
  | { ok: true; merged: boolean }
  | { ok: false; reason: "store-conflict"; currentStoreId: number };

// v3 bump — line shape gained `addOns`. v2 carts won't have the
// field; readPersisted() defaults it to [] for safety, but bumping
// the key wipes any in-flight v2 cart so unitPrice numbers can't
// silently drift if a v2 line had an add-on baked into its price
// outside the new field.
// v4 bump — line shape gained `note`. A v3 cart has no notes to lose, so
// this could have migrated in place, but the file's existing convention
// is to bump rather than to branch on shape at read time.
const STORAGE_KEY = "biteexpress.cart.v4";

type Persisted = { storeId: number | null; lines: CartLine[] };

function readPersisted(): Persisted {
  if (typeof window === "undefined") return { storeId: null, lines: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { storeId: null, lines: [] };
    const parsed = JSON.parse(raw) as Persisted;
    return {
      storeId: typeof parsed.storeId === "number" ? parsed.storeId : null,
      lines: Array.isArray(parsed.lines)
        ? parsed.lines.map((l) => ({
            ...l,
            selections: l.selections ?? [],
            addOns: l.addOns ?? [],
          }))
        : [],
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
  setLineNote: (key: string, note: string) => void;
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
    const selections = input.selections ?? [];
    const addOns = input.addOns ?? [];
    const key = cartKeyFor(
      input.itemId,
      selections,
      addOns.map((a) => ({ id: a.id, qty: a.qty })),
    );

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
          selections,
          addOns,
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

  setLineNote: (key, note) => {
    const nextLines = applyLineNote(get().lines, key, note);
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
