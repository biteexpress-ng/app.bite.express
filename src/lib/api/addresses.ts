"use client";

import { api } from "@/lib/api-client";

/**
 * Customer saved-addresses (auth-only).
 *
 * Backend: app/Http/Controllers/Api/V1/CustomerController.php
 *
 *   GET    /api/v1/customer/address/list          -> paginated list
 *   POST   /api/v1/customer/address/add           -> create (validates zone coverage)
 *   PUT    /api/v1/customer/address/update/{id}   -> edit
 *   DELETE /api/v1/customer/address/delete        -> remove
 *
 * v0 only reads; create / update / delete live in the next slice.
 *
 * Note: `latitude` / `longitude` come back as STRINGS because the
 * trait at app/Traits/PlaceNewOrder.php stores them with (string)
 * casts. Parse with Number() at the call site.
 */

export type SavedAddress = {
  id: number;
  user_id: number;
  contact_person_name: string;
  contact_person_number: string;
  contact_person_email?: string | null;
  address_type: string;
  address: string;
  floor?: string | null;
  road?: string | null;
  house?: string | null;
  latitude: string;
  longitude: string;
  zone_id?: number | null;
  is_default?: 0 | 1;
};

type AddressListResponse = {
  total_size: number;
  limit: number;
  offset: number;
  addresses: SavedAddress[];
};

export type AddressListResult =
  | { ok: true; addresses: SavedAddress[] }
  | { ok: false; message: string };

export async function fetchAddresses(): Promise<AddressListResult> {
  const res = await api<AddressListResponse>(
    "/api/v1/customer/address/list?limit=20&offset=1",
  );
  if (res.ok) return { ok: true, addresses: res.data.addresses ?? [] };
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}
