"use client";

import { api } from "@/lib/api-client";

/**
 * GET /api/v1/parcel-category (ParcelCategoryController@index).
 *
 * The route sits behind the module-check middleware, which rejects the
 * call without a moduleId header, and the controller scopes the list to
 * that module. So the parcel module id is required.
 */
export type ParcelCategory = {
  id: number;
  name: string;
  description?: string | null;
  image_full_url?: string | null;
  parcel_per_km_shipping_charge?: number | null;
  parcel_minimum_shipping_charge?: number | null;
};

export type ParcelCategoriesResult =
  | { ok: true; categories: ParcelCategory[] }
  | { ok: false; message: string };

export async function fetchParcelCategories(
  moduleId: number,
): Promise<ParcelCategoriesResult> {
  const res = await api<ParcelCategory[]>("/api/v1/parcel-category", {
    moduleId,
  });
  if (res.ok) {
    return { ok: true, categories: Array.isArray(res.data) ? res.data : [] };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}

/**
 * GET /api/v1/customer/order/parcel-instructions
 * (OrderController@parcel_instructions). Paginated as
 * {total_size, limit, offset, data}; `offset` is the 1-based page.
 */
export type ParcelInstruction = { id: number; instruction: string };

type InstructionPage = { data?: ParcelInstruction[] };

export type ParcelInstructionsResult =
  | { ok: true; instructions: ParcelInstruction[] }
  | { ok: false; message: string };

export async function fetchParcelInstructions(): Promise<ParcelInstructionsResult> {
  const res = await api<InstructionPage>(
    "/api/v1/customer/order/parcel-instructions?limit=50&offset=1",
  );
  if (res.ok) {
    return {
      ok: true,
      instructions: Array.isArray(res.data?.data) ? res.data.data : [],
    };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}
