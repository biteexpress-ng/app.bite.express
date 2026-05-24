"use client";

import { api } from "@/lib/api-client";

/**
 * GET /api/v1/stores/get-stores/{filter_data}
 *
 * Requires headers:
 *   zoneId    JSON-encoded array, e.g. "[1,2]"
 *   moduleId  single number
 *   latitude  customer lat (for distance sort)
 *   longitude customer lng
 *
 * Query params:
 *   type       all | delivery | take_away  (default all)
 *   store_type all | restaurant | grocery | …
 *   limit      page size (default ~10)
 *   offset     1-BASED PAGE NUMBER (NOT a skip count) — backend
 *              does `paginate($limit, ['*'], 'page', $offset)` so
 *              the first page is 1, the second is 2, etc.
 *   featured   1 to filter featured only
 *
 * Response: { stores: Store[], total_size: number, limit, offset }
 *
 * Store fields below are the subset we actually render — the API
 * returns a lot more (translations, schedules, attributes …) that
 * we ignore for v0. Add fields here as we wire up store detail.
 */

export type Store = {
  id: number;
  name: string;
  slug?: string | null;
  address?: string | null;
  logo?: string | null;
  logo_full_url?: string | null;
  cover_photo?: string | null;
  cover_photo_full_url?: string | null;
  avg_rating?: number;
  rating_count?: number;
  delivery_time?: string | null;
  free_delivery?: boolean;
  discount?: { discount?: number; discount_type?: string } | null;
  open?: 0 | 1;
  active?: 0 | 1;
  distance?: number;
  module_id?: number;
};

export type StoreList = {
  stores: Store[];
  total_size: number;
  limit: number;
  offset: number;
};

type FetchStoresParams = {
  zoneIds: number[];
  moduleId: number;
  lat: number;
  lng: number;
  filter?: "all" | "popular" | "latest";
  type?: "all" | "delivery" | "take_away";
  limit?: number;
  offset?: number;
};

export type StoresResult =
  | { ok: true; data: StoreList }
  | { ok: false; message: string };

export async function fetchStores({
  zoneIds,
  moduleId,
  lat,
  lng,
  filter = "all",
  type = "all",
  limit = 12,
  offset = 1,
}: FetchStoresParams): Promise<StoresResult> {
  const path =
    `/api/v1/stores/get-stores/${encodeURIComponent(filter)}` +
    `?type=${encodeURIComponent(type)}&limit=${limit}&offset=${offset}`;

  const res = await api<StoreList>(path, {
    unauth: true,
    zoneId: zoneIds,
    moduleId,
    latitude: lat,
    longitude: lng,
  });

  if (res.ok) return { ok: true, data: res.data };
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}
