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

/* -------------------------------------------------------------- */
/* Create / update / delete                                        */
/* -------------------------------------------------------------- */

export type AddressInput = {
  contactPersonName: string;
  contactPersonNumber: string;
  /** "Home" | "Office" | "Other" — free-form on the backend. */
  addressType: string;
  /** Human-readable address (what Google Places returned). */
  address: string;
  latitude: number;
  longitude: number;
  /** Optional extras the customer can add on top of the autocomplete result. */
  floor?: string;
  road?: string;
  house?: string;
};

export type AddressMutationResult =
  | { ok: true }
  | { ok: false; reason: "out-of-zone" | "other"; message: string };

function toWire(input: AddressInput): Record<string, unknown> {
  return {
    contact_person_name: input.contactPersonName,
    contact_person_number: input.contactPersonNumber,
    address_type: input.addressType,
    address: input.address,
    latitude: input.latitude,
    longitude: input.longitude,
    floor: input.floor ?? "",
    road: input.road ?? "",
    house: input.house ?? "",
  };
}

/** POST /customer/address/add — validates zone coverage and rejects
 *  with errors.coordinates when no zone contains the point. */
export async function createAddress(
  input: AddressInput,
): Promise<AddressMutationResult> {
  const res = await api<{ message?: string }>(
    "/api/v1/customer/address/add",
    { method: "POST", body: toWire(input) },
  );
  return mapMutationResult(res);
}

/** PUT /customer/address/update/{id}. Same validation as add. */
export async function updateAddress(
  id: number,
  input: AddressInput,
): Promise<AddressMutationResult> {
  const res = await api<{ message?: string }>(
    `/api/v1/customer/address/update/${id}`,
    { method: "PUT", body: toWire(input) },
  );
  return mapMutationResult(res);
}

/** DELETE /customer/address/delete — body must include address_id. */
export async function deleteAddress(
  id: number,
): Promise<AddressMutationResult> {
  const res = await api<{ message?: string }>(
    "/api/v1/customer/address/delete",
    { method: "DELETE", body: { address_id: id } },
  );
  return mapMutationResult(res);
}

function mapMutationResult(res: {
  ok: boolean;
  status?: number;
  message?: string;
  errors?: Record<string, string[]>;
}): AddressMutationResult {
  if (res.ok) return { ok: true };
  if ("skipped" in res) {
    return { ok: false, reason: "other", message: "Backend not configured." };
  }
  const msg = res.message ?? "Something went wrong.";
  // The backend returns 403 with code:"coordinates" when the lat/lng
  // doesn't fall inside any zone — surface that as a distinct reason
  // so the UI can suggest a different address.
  if (
    res.status === 403 &&
    (res.errors?.coordinates || /area|coverage|zone/i.test(msg))
  ) {
    return { ok: false, reason: "out-of-zone", message: msg };
  }
  return { ok: false, reason: "other", message: msg };
}
