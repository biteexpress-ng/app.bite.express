"use client";

import { api } from "@/lib/api-client";
import type { FoodVariation } from "@/lib/food-variations";

/** Single optional add-on row (e.g. "Extra cheese — ₦200").
 *  Mirrors App\Models\AddOn fields after Helpers::addon_data_formatting. */
export type AddOn = {
  id: number;
  name: string;
  price: number;
  store_id?: number;
  addon_category_id?: number | null;
  status?: 0 | 1;
};

/** What the customer picked for one cart line's add-ons. */
export type AddOnSelection = {
  id: number;
  name: string;
  price: number;
  qty: number;
};

/**
 * GET /api/v1/stores/details/{id}
 *
 * Returns the store header + a `category_details` array (the store's
 * own active categories). Items themselves are NOT bundled — fetch
 * them per category via fetchStoreCategoryItems().
 *
 * lat/lng headers are optional but enable the `distance` field.
 * zoneId is NOT required (the route is outside module-check).
 */

export type StoreCategory = {
  id: number;
  name: string;
  slug?: string;
  image_full_url?: string | null;
  parent_id?: number;
  position?: number;
  status?: number;
};

export type StoreSchedule = {
  id: number;
  store_id: number;
  day: number;
  opening_time: string;
  closing_time: string;
};

export type StoreDetail = {
  id: number;
  name: string;
  slug?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_full_url?: string | null;
  cover_photo_full_url?: string | null;
  avg_rating?: number;
  rating_count?: number;
  reviews_comments_count?: number;
  delivery_time?: string | null;
  free_delivery?: boolean;
  open?: 0 | 1;
  active?: 0 | 1;
  distance?: number;
  minimum_order?: number;
  delivery?: 0 | 1;
  take_away?: 0 | 1;
  module_id?: number;
  zone_id?: number;
  total_items?: number;
  category_ids?: number[];
  category_details?: StoreCategory[];
  schedules?: StoreSchedule[];
  announcement?: 0 | 1;
  announcement_message?: string | null;
};

export type StoreDetailResult =
  | { ok: true; store: StoreDetail }
  | { ok: false; status: "not-found" | "error"; message: string };

export async function fetchStoreDetail(
  id: number,
  lat?: number,
  lng?: number,
): Promise<StoreDetailResult> {
  const res = await api<StoreDetail>(`/api/v1/stores/details/${id}`, {
    unauth: true,
    latitude: lat,
    longitude: lng,
  });
  if (res.ok) return { ok: true, store: res.data };
  if ("skipped" in res) {
    return { ok: false, status: "error", message: "Backend not configured." };
  }
  if (res.status === 404) {
    return { ok: false, status: "not-found", message: "Store not found." };
  }
  return { ok: false, status: "error", message: res.message };
}

/* ---------------------------------------------------------------- */

/**
 * GET /api/v1/items/latest?store_id=&category_id=&limit=&offset=
 *
 * Returns paginated items for a single store + category combo.
 * The controller validates that store_id, category_id, limit and
 * offset are all present, so we always send them.
 */

export type StoreItem = {
  id: number;
  name: string;
  description?: string | null;
  image?: string | null;
  image_full_url?: string | null;
  store_id: number;
  category_id?: number;
  category_ids?: Array<{ id: number; position?: number }>;
  price: number;
  discount?: number;
  discount_type?: "percent" | "amount" | null;
  avg_rating?: number;
  rating_count?: number;
  available_time_starts?: string | null;
  available_time_ends?: string | null;
  stock?: number;
  maximum_cart_quantity?: number;
  veg?: 0 | 1;
  /** Modern food module variations (groups of required/optional choices). */
  food_variations?: FoodVariation[];
  /** Legacy variation shape — usually empty for new items. */
  variations?: unknown[];
  /** Optional add-ons attached to this item, with full AddOn rows
   *  after Helpers::addon_data_formatting on the backend. */
  add_ons?: AddOn[];
};

export type StoreItemList = {
  products: StoreItem[];
  total_size: number;
  limit: number | string;
  offset: number | string;
};

export type StoreItemsResult =
  | { ok: true; data: StoreItemList }
  | { ok: false; message: string };

export async function fetchStoreCategoryItems({
  storeId,
  categoryId,
  zoneIds,
  moduleId,
  limit = 20,
  offset = 1,
}: {
  storeId: number;
  categoryId: number;
  zoneIds: number[];
  moduleId: number;
  limit?: number;
  offset?: number;
}): Promise<StoreItemsResult> {
  const qs = new URLSearchParams({
    store_id: String(storeId),
    category_id: String(categoryId),
    limit: String(limit),
    offset: String(offset),
  });
  const res = await api<StoreItemList>(`/api/v1/items/latest?${qs}`, {
    unauth: true,
    zoneId: zoneIds,
    moduleId,
  });
  if (res.ok) return { ok: true, data: res.data };
  if ("skipped" in res) {
    return { ok: false, message: "Backend not configured." };
  }
  return { ok: false, message: res.message };
}
