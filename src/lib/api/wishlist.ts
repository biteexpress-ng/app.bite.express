"use client";

import { api } from "@/lib/api-client";
import type { StoreItem } from "@/lib/api/store-detail";
import type { Store } from "@/lib/api/stores";

/**
 * Wishlist API. Requires bearer auth.
 *
 *   GET    /customer/wish-list (with zoneId header)
 *     -> { items: Item[], stores: Store[] }  (already grouped server-
 *        side via Helpers::wishlist_data_formatting, and the eager
 *        loads drop items/stores that fall outside the customer's
 *        zone — Item or Store may be null on a row)
 *
 *   POST   /customer/wish-list/add    { item_id? OR store_id? }
 *     409 if already in wishlist
 *
 *   DELETE /customer/wish-list/remove { item_id? OR store_id? }
 *     404 if not in wishlist
 *
 * Both add and remove accept EITHER item_id OR store_id, not both.
 */

export type WishlistFetchResult =
  | { ok: true; items: StoreItem[]; stores: Store[] }
  | { ok: false; message: string };

export type WishlistMutationResult =
  | { ok: true }
  | { ok: false; reason: "duplicate" | "not-found" | "other"; message: string };

type WishlistResponse = {
  items?: StoreItem[];
  stores?: Store[];
};

export async function fetchWishlist(
  zoneIds: number[],
): Promise<WishlistFetchResult> {
  const res = await api<WishlistResponse>("/api/v1/customer/wish-list", {
    zoneId: zoneIds.length > 0 ? zoneIds : [0],
  });
  if (res.ok) {
    return {
      ok: true,
      items: res.data.items ?? [],
      stores: res.data.stores ?? [],
    };
  }
  if ("skipped" in res) {
    return { ok: false, message: "Backend not configured." };
  }
  return { ok: false, message: res.message };
}

export async function addToWishlist(
  target: { itemId: number } | { storeId: number },
): Promise<WishlistMutationResult> {
  const body =
    "itemId" in target
      ? { item_id: target.itemId }
      : { store_id: target.storeId };
  const res = await api<{ message?: string }>(
    "/api/v1/customer/wish-list/add",
    { method: "POST", body },
  );
  if (res.ok) return { ok: true };
  if ("skipped" in res) {
    return { ok: false, reason: "other", message: "Backend not configured." };
  }
  if (res.status === 409) {
    // Server thinks it's already wishlisted — treat as a soft success
    // so the UI's optimistic "added" state stays consistent.
    return { ok: false, reason: "duplicate", message: res.message };
  }
  return { ok: false, reason: "other", message: res.message };
}

export async function removeFromWishlist(
  target: { itemId: number } | { storeId: number },
): Promise<WishlistMutationResult> {
  const body =
    "itemId" in target
      ? { item_id: target.itemId }
      : { store_id: target.storeId };
  const res = await api<{ message?: string }>(
    "/api/v1/customer/wish-list/remove",
    { method: "DELETE", body },
  );
  if (res.ok) return { ok: true };
  if ("skipped" in res) {
    return { ok: false, reason: "other", message: "Backend not configured." };
  }
  if (res.status === 404) {
    return { ok: false, reason: "not-found", message: res.message };
  }
  return { ok: false, reason: "other", message: res.message };
}
