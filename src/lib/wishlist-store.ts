"use client";

import { create } from "zustand";
import {
  addToWishlist,
  fetchWishlist,
  removeFromWishlist,
  type WishlistMutationResult,
} from "@/lib/api/wishlist";

/**
 * Client-side cache of which items + stores the customer has
 * favourited. Backed by the server (source of truth) — we hydrate
 * on first need, then apply optimistic updates on toggle so heart
 * icons feel instantaneous.
 *
 * Set storage: we use Record<id, true> instead of JS Set so the
 * shape survives Zustand's structural compare without forcing a
 * re-render for every subscriber on every change.
 */

type IdMap = Record<number, true>;

type State = {
  items: IdMap;
  stores: IdMap;
  /** Whether we've fetched the full list once for this session. */
  hydrated: boolean;
  /** In-flight toggle keys ("item-12", "store-3") — lets heart
   *  buttons show a busy state without each owning local state. */
  pending: Record<string, true>;

  hydrate: (zoneIds: number[]) => Promise<void>;
  /** Reset on sign-out — clears all caches. */
  reset: () => void;
  toggleItem: (itemId: number) => Promise<WishlistMutationResult>;
  toggleStore: (storeId: number) => Promise<WishlistMutationResult>;
  containsItem: (itemId: number) => boolean;
  containsStore: (storeId: number) => boolean;
  isPending: (kind: "item" | "store", id: number) => boolean;
};

export const useWishlist = create<State>((set, get) => ({
  items: {},
  stores: {},
  hydrated: false,
  pending: {},

  hydrate: async (zoneIds) => {
    if (get().hydrated) return;
    const res = await fetchWishlist(zoneIds);
    if (!res.ok) return;
    const itemMap: IdMap = {};
    const storeMap: IdMap = {};
    for (const it of res.items) itemMap[it.id] = true;
    for (const st of res.stores) {
      if (typeof st.id === "number") storeMap[st.id] = true;
    }
    set({ items: itemMap, stores: storeMap, hydrated: true });
  },

  reset: () =>
    set({ items: {}, stores: {}, pending: {}, hydrated: false }),

  toggleItem: async (itemId) => {
    const key = `item-${itemId}`;
    const wasIn = !!get().items[itemId];
    // Optimistic flip
    set((s) => {
      const items = { ...s.items };
      if (wasIn) delete items[itemId];
      else items[itemId] = true;
      return { items, pending: { ...s.pending, [key]: true } };
    });

    const res = wasIn
      ? await removeFromWishlist({ itemId })
      : await addToWishlist({ itemId });

    set((s) => {
      const pending = { ...s.pending };
      delete pending[key];
      return { pending };
    });

    if (res.ok) return res;
    // Soft cases — server says state already matches our intent.
    if (
      (res.reason === "duplicate" && !wasIn) ||
      (res.reason === "not-found" && wasIn)
    ) {
      return { ok: true };
    }
    // Hard fail — roll back.
    set((s) => {
      const items = { ...s.items };
      if (wasIn) items[itemId] = true;
      else delete items[itemId];
      return { items };
    });
    return res;
  },

  toggleStore: async (storeId) => {
    const key = `store-${storeId}`;
    const wasIn = !!get().stores[storeId];
    set((s) => {
      const stores = { ...s.stores };
      if (wasIn) delete stores[storeId];
      else stores[storeId] = true;
      return { stores, pending: { ...s.pending, [key]: true } };
    });

    const res = wasIn
      ? await removeFromWishlist({ storeId })
      : await addToWishlist({ storeId });

    set((s) => {
      const pending = { ...s.pending };
      delete pending[key];
      return { pending };
    });

    if (res.ok) return res;
    if (
      (res.reason === "duplicate" && !wasIn) ||
      (res.reason === "not-found" && wasIn)
    ) {
      return { ok: true };
    }
    set((s) => {
      const stores = { ...s.stores };
      if (wasIn) stores[storeId] = true;
      else delete stores[storeId];
      return { stores };
    });
    return res;
  },

  containsItem: (itemId) => !!get().items[itemId],
  containsStore: (storeId) => !!get().stores[storeId],
  isPending: (kind, id) => !!get().pending[`${kind}-${id}`],
}));
