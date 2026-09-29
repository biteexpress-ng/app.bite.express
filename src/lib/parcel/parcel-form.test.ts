import { describe, expect, it } from "vitest";
import type { ZoneCheck, ZoneData } from "@/lib/api/zones";
import {
  EMPTY_CONTACT,
  buildReceiverDetails,
  deliveryInstruction,
  dropoffZoneResult,
  furthestStep,
  hasErrors,
  parcelModuleIn,
  pickupZoneResult,
  validateContact,
} from "./parcel-form";

const point = { text: "12 Allen Avenue, Ikeja", lat: 6.6018, lng: 3.3515 };
const contact = { ...EMPTY_CONTACT, name: "Ada Obi", phone: "0801 234 5678" };

function zone(
  id: number,
  modules: Array<{ id: number; module_type: string }>,
): ZoneData {
  return { id, status: 1, digital_payment: 1, offline_payment: 0, modules };
}

describe("validateContact", () => {
  it("accepts a complete contact", () => {
    expect(validateContact(point, contact)).toEqual({});
    expect(hasErrors(validateContact(point, contact))).toBe(false);
  });

  it("flags every missing field", () => {
    expect(validateContact(null, EMPTY_CONTACT)).toEqual({
      address: "Pick an address.",
      name: "Enter a contact name.",
      phone: "Enter a phone number.",
    });
    expect(hasErrors(validateContact(null, EMPTY_CONTACT))).toBe(true);
  });

  it("accepts every phone shape the rest of the app accepts", () => {
    for (const phone of ["08012345678", "8012345678", "2348012345678", "+234 801 234 5678"]) {
      expect(validateContact(point, { ...contact, phone }).phone).toBeUndefined();
    }
  });

  it("rejects a phone that is not Nigerian", () => {
    expect(validateContact(point, { ...contact, phone: "12345" }).phone).toBe(
      "Enter a Nigerian phone number, like 0801 234 5678.",
    );
  });

  it("treats email as optional but checks one that is typed", () => {
    expect(validateContact(point, { ...contact, email: "" }).email).toBeUndefined();
    expect(validateContact(point, { ...contact, email: "ada@example.test" }).email).toBeUndefined();
    expect(validateContact(point, { ...contact, email: "ada@" }).email).toBe(
      "Enter a valid email or leave it blank.",
    );
  });
});

describe("parcelModuleIn", () => {
  it("finds the parcel module and the zones that offer it", () => {
    const zones = [
      zone(7, [{ id: 1, module_type: "food" }]),
      zone(9, [{ id: 6, module_type: "parcel" }]),
      zone(11, [{ id: 1, module_type: "food" }, { id: 6, module_type: "parcel" }]),
    ];
    expect(parcelModuleIn(zones)).toEqual({ moduleId: 6, zoneIds: [9, 11] });
  });

  it("keeps to the first parcel module when zones offer different ones", () => {
    const zones = [zone(9, [{ id: 6, module_type: "parcel" }]), zone(12, [{ id: 13, module_type: "parcel" }])];
    expect(parcelModuleIn(zones)).toEqual({ moduleId: 6, zoneIds: [9] });
  });

  it("returns null when no zone offers parcels", () => {
    expect(parcelModuleIn([zone(7, [{ id: 1, module_type: "food" }])])).toBeNull();
    expect(parcelModuleIn([])).toBeNull();
  });
});

describe("pickupZoneResult", () => {
  it("uses the pickup's own zone ids, not the home location's", () => {
    // A saved pickup address in zones 7 and 9; only 9 has parcels. The
    // header must still carry every zone containing the pickup.
    const check: ZoneCheck = {
      kind: "in-zone",
      zoneIds: [7, 9],
      zones: [zone(7, [{ id: 1, module_type: "food" }]), zone(9, [{ id: 6, module_type: "parcel" }])],
    };
    const result = pickupZoneResult(check, 6);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.zoneIds).toEqual([7, 9]);
      expect(result.zone.id).toBe(9);
    }
  });

  it("refuses a served address whose zones do not offer parcels", () => {
    const check: ZoneCheck = { kind: "in-zone", zoneIds: [7], zones: [zone(7, [{ id: 1, module_type: "food" }])] };
    expect(pickupZoneResult(check, 6)).toEqual({
      ok: false,
      message: "We can't collect parcels from this address yet. Pick another pickup address.",
    });
  });

  it("explains out-of-zone, paused and failed checks", () => {
    expect(pickupZoneResult({ kind: "out-of-zone" }, 6)).toEqual({
      ok: false,
      message: "We don't cover this pickup address yet. Pick another.",
    });
    expect(pickupZoneResult({ kind: "temp-unavailable" }, 6)).toEqual({
      ok: false,
      message: "Pickups are paused in this area right now.",
    });
    expect(pickupZoneResult({ kind: "error", message: "timeout" }, 6)).toEqual({
      ok: false,
      message: "We couldn't check this address. Try again in a moment.",
    });
  });
});

describe("dropoffZoneResult", () => {
  it("takes the first served zone as receiver_details.zone_id", () => {
    const check: ZoneCheck = { kind: "in-zone", zoneIds: [4, 2], zones: [] };
    expect(dropoffZoneResult(check)).toEqual({ ok: true, zoneId: 4 });
  });

  it("refuses an address no zone serves", () => {
    expect(dropoffZoneResult({ kind: "out-of-zone" })).toEqual({
      ok: false,
      message: "We don't deliver to this address yet. Pick another drop-off.",
    });
    expect(dropoffZoneResult({ kind: "in-zone", zoneIds: [], zones: [] }).ok).toBe(false);
    expect(dropoffZoneResult({ kind: "skipped", reason: "no env" }).ok).toBe(false);
  });
});

describe("buildReceiverDetails", () => {
  it("builds the app's address keys with a normalised phone", () => {
    const details = buildReceiverDetails(
      { text: "5 Awolowo Road, Ikoyi", lat: 6.4541, lng: 3.4218 },
      { name: " Bola Ade ", phone: "0809 876 5432", email: "", house: "5", floor: "", road: "Awolowo Road" },
      4,
    );
    expect(details).toEqual({
      address: "5 Awolowo Road, Ikoyi",
      latitude: "6.4541",
      longitude: "3.4218",
      zone_id: 4,
      contact_person_name: "Bola Ade",
      contact_person_number: "+2348098765432",
      contact_person_email: "",
      road: "Awolowo Road",
      house: "5",
      floor: "",
      address_type: "Delivery",
      additional_address: "",
    });
  });
});

describe("deliveryInstruction", () => {
  it("joins a preset and a note the way the app does", () => {
    expect(deliveryInstruction("Fragile", "Call on arrival")).toBe("Fragile (Call on arrival)");
  });

  it("sends either one alone", () => {
    expect(deliveryInstruction("Fragile", "")).toBe("Fragile");
    expect(deliveryInstruction(null, "Call on arrival")).toBe("Call on arrival");
    expect(deliveryInstruction(null, "   ")).toBe("");
  });
});

describe("furthestStep", () => {
  it("unlocks a step only when every step before it is valid", () => {
    expect(furthestStep(false, false)).toBe(1);
    expect(furthestStep(false, true)).toBe(1);
    expect(furthestStep(true, false)).toBe(2);
    expect(furthestStep(true, true)).toBe(3);
  });
});
