"use client";

import { api } from "@/lib/api-client";

/**
 * GET /api/v1/items/item-or-store-search
 *
 * Required headers:
 *   zoneId    JSON-encoded array, e.g. "[1,2]"
 *   moduleId  single number — endpoint filters by
 *             config('module.current_module_data')['id']
 *   latitude  customer lat
 *   longitude customer lng
 *
 * Required query: ?name=...
 *
 * Response shape (from ItemController@item_or_store_search):
 *   {
 *     items:  [{ id, name, image }],   // image is JUST the filename
 *     stores: [{ id, name, logo  }],   // logo is JUST the filename
 *   }
 *
 * Note: this endpoint deliberately returns minimal columns
 * (`get(['id','name','image'])`) for fast autocomplete. Items
 * notably don't carry store_id, so we can't link a clicked item
 * directly to its store — for v0 we surface a count and let
 * customers click into the store result instead.
 */

export type SearchHitStore = {
  id: number;
  name: string;
  logo?: string | null;
};

export type SearchHitItem = {
  id: number;
  name: string;
  image?: string | null;
};

export type SearchResult =
  | { ok: true; stores: SearchHitStore[]; items: SearchHitItem[] }
  | { ok: false; message: string };

type SearchInput = {
  query: string;
  zoneIds: number[];
  moduleId: number;
  lat: number;
  lng: number;
};

export async function searchStoresAndItems(
  input: SearchInput,
): Promise<SearchResult> {
  const trimmed = input.query.trim();
  if (trimmed.length < 2) {
    return { ok: true, stores: [], items: [] };
  }

  const res = await api<{
    items?: SearchHitItem[];
    stores?: SearchHitStore[];
  }>(`/api/v1/items/item-or-store-search?name=${encodeURIComponent(trimmed)}`, {
    unauth: true,
    zoneId: input.zoneIds,
    moduleId: input.moduleId,
    latitude: input.lat,
    longitude: input.lng,
  });

  if (res.ok) {
    return {
      ok: true,
      stores: res.data.stores ?? [],
      items: res.data.items ?? [],
    };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}
