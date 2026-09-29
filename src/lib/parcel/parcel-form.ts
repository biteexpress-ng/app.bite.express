import { normalizePhone } from "@/lib/phone";
import type { ZoneCheck, ZoneData } from "@/lib/api/zones";
import type { ReceiverDetails } from "@/lib/api/orders";

/**
 * Pure rules for the /send form. No React and no fetch, so the checks
 * that decide whether a step can complete are tested directly.
 */

export type ParcelContact = {
  name: string;
  phone: string;
  email: string;
  house: string;
  floor: string;
  road: string;
};

export const EMPTY_CONTACT: ParcelContact = {
  name: "",
  phone: "",
  email: "",
  house: "",
  floor: "",
  road: "",
};

export type ParcelPoint = {
  text: string;
  lat: number;
  lng: number;
  addressType?: string;
};

export type ContactErrors = Partial<Record<"address" | "name" | "phone" | "email", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Phones are checked with the same normalizePhone() the sign-in flow uses. */
export function validateContact(
  point: ParcelPoint | null,
  contact: ParcelContact,
): ContactErrors {
  const errors: ContactErrors = {};
  if (!point || !point.text.trim()) errors.address = "Pick an address.";
  if (!contact.name.trim()) errors.name = "Enter a contact name.";
  if (!contact.phone.trim()) {
    errors.phone = "Enter a phone number.";
  } else if (!normalizePhone(contact.phone)) {
    errors.phone = "Enter a Nigerian phone number, like 0801 234 5678.";
  }
  const email = contact.email.trim();
  if (email && !EMAIL.test(email)) {
    errors.email = "Enter a valid email or leave it blank.";
  }
  return errors;
}

export function hasErrors(errors: ContactErrors): boolean {
  return Object.keys(errors).length > 0;
}

export type ParcelModule = { moduleId: number; zoneIds: number[] };

/**
 * The parcel module a set of zones offers, and which of those zones
 * offer it. If zones offer different parcel modules, the first wins so
 * the categories shown and the moduleId header always agree.
 */
export function parcelModuleIn(zones: readonly ZoneData[]): ParcelModule | null {
  let moduleId: number | null = null;
  const zoneIds: number[] = [];
  for (const z of zones) {
    const mod = (z.modules ?? []).find(
      (m) => m.module_type === "parcel" && (moduleId === null || m.id === moduleId),
    );
    if (!mod) continue;
    if (moduleId === null) moduleId = mod.id;
    zoneIds.push(z.id);
  }
  return moduleId === null ? null : { moduleId, zoneIds };
}

export type PickupZone =
  | { ok: true; zoneIds: number[]; zone: ZoneData }
  | { ok: false; message: string };

/**
 * Placement needs a zone in the zoneId header that contains the pickup
 * and offers the parcel module. zoneIds are the pickup's own zones, so
 * a saved address in another zone than the home location still works.
 */
export function pickupZoneResult(check: ZoneCheck, moduleId: number): PickupZone {
  if (check.kind === "in-zone") {
    const z = check.zones.find((candidate) =>
      (candidate.modules ?? []).some((m) => m.id === moduleId),
    );
    if (z) return { ok: true, zoneIds: check.zoneIds, zone: z };
    return {
      ok: false,
      message: "We can't collect parcels from this address yet. Pick another pickup address.",
    };
  }
  if (check.kind === "out-of-zone") {
    return { ok: false, message: "We don't cover this pickup address yet. Pick another." };
  }
  if (check.kind === "temp-unavailable") {
    return { ok: false, message: "Pickups are paused in this area right now." };
  }
  return { ok: false, message: "We couldn't check this address. Try again in a moment." };
}

export type DropoffZone = { ok: true; zoneId: number } | { ok: false; message: string };

/** The drop-off only has to be in a served zone; its id becomes receiver_details.zone_id. */
export function dropoffZoneResult(check: ZoneCheck): DropoffZone {
  if (check.kind === "in-zone" && check.zoneIds.length > 0) {
    return { ok: true, zoneId: check.zoneIds[0] };
  }
  if (check.kind === "in-zone" || check.kind === "out-of-zone") {
    return { ok: false, message: "We don't deliver to this address yet. Pick another drop-off." };
  }
  if (check.kind === "temp-unavailable") {
    return { ok: false, message: "Deliveries are paused in this area right now." };
  }
  return { ok: false, message: "We couldn't check this address. Try again in a moment." };
}

export function buildReceiverDetails(
  point: ParcelPoint,
  contact: ParcelContact,
  zoneId: number,
): ReceiverDetails {
  return {
    address: point.text,
    latitude: String(point.lat),
    longitude: String(point.lng),
    zone_id: zoneId,
    contact_person_name: contact.name.trim(),
    contact_person_number: normalizePhone(contact.phone) ?? contact.phone.trim(),
    contact_person_email: contact.email.trim(),
    road: contact.road.trim(),
    house: contact.house.trim(),
    floor: contact.floor.trim(),
    address_type: point.addressType ?? "Delivery",
    additional_address: "",
  };
}

/** Preset plus note, as the app sends them: "Fragile (Call on arrival)". */
export function deliveryInstruction(selected: string | null, note: string): string {
  const preset = selected?.trim() ?? "";
  const extra = note.trim();
  if (preset && extra) return `${preset} (${extra})`;
  return preset || extra;
}

export type StepNumber = 1 | 2 | 3;

/** The furthest step the customer may open: each needs every step before it to be valid. */
export function furthestStep(categoryChosen: boolean, addressesValid: boolean): StepNumber {
  if (!categoryChosen) return 1;
  if (!addressesValid) return 2;
  return 3;
}
