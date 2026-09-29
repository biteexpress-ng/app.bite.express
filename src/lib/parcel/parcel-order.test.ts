import { describe, expect, it } from "vitest";
import type { OrderSummary } from "@/lib/api/orders";
import {
  addressCards,
  isParcelOrder,
  mapPoints,
  milestoneIndex,
  milestonesFor,
  orderHeading,
  orderListPaymentLabel,
  orderListTitle,
  receiverName,
  receiverOf,
  toLatLng,
} from "./parcel-order";

function order(over: Partial<OrderSummary>): OrderSummary {
  return {
    id: 100231,
    order_amount: 1300,
    order_status: "pending",
    payment_status: "unpaid",
    created_at: "2026-09-29T10:00:00Z",
    ...over,
  };
}

const sender = {
  address: "12 Allen Avenue, Ikeja",
  contact_person_name: "Ada Obi",
  contact_person_number: "+2348012345678",
  latitude: "6.6018",
  longitude: "3.3515",
};

const parcel = order({
  order_type: "parcel",
  store: null,
  delivery_address: sender,
  receiver_details: {
    address: "5 Awolowo Road, Ikoyi",
    latitude: "6.4541",
    longitude: "3.4218",
    contact_person_name: "Bola Ade",
    contact_person_number: "+2348098765432",
  },
});

const food = order({
  order_type: "delivery",
  store: { name: "Mama Put", latitude: "6.5", longitude: "3.3" },
  delivery_address: sender,
});

const receiverObj = {
  address: "5 Awolowo Road, Ikoyi",
  latitude: "6.4541",
  longitude: "3.4218",
  contact_person_name: "Bola Ade",
  contact_person_number: "+2348098765432",
};

/** Same receiver, but as the JSON string the receiver_details column
 *  actually stores (some endpoint could return it unparsed). */
const parcelJsonReceiver = order({
  order_type: "parcel",
  store: null,
  delivery_address: sender,
  receiver_details: JSON.stringify(receiverObj),
});

const parcelMalformedReceiver = order({
  order_type: "parcel",
  store: null,
  delivery_address: sender,
  receiver_details: "{not valid json",
});

const parcelNonObjectReceiver = order({
  order_type: "parcel",
  store: null,
  delivery_address: sender,
  receiver_details: "[1,2,3]",
});

describe("toLatLng", () => {
  it("reads string coordinates and rejects missing or zero ones", () => {
    expect(toLatLng("6.4541", "3.4218")).toEqual({ lat: 6.4541, lng: 3.4218 });
    expect(toLatLng(6.5, 3.3)).toEqual({ lat: 6.5, lng: 3.3 });
    expect(toLatLng(undefined, "3.3")).toBeNull();
    expect(toLatLng("", "3.3")).toBeNull();
    expect(toLatLng("abc", "3.3")).toBeNull();
    expect(toLatLng("0", "0")).toBeNull();
  });
});

describe("isParcelOrder and receiverName", () => {
  it("tells parcels from shop orders", () => {
    expect(isParcelOrder(parcel)).toBe(true);
    expect(isParcelOrder(food)).toBe(false);
    expect(isParcelOrder(order({}))).toBe(false);
  });

  it("reads the receiver's name, trimmed", () => {
    expect(receiverName(parcel)).toBe("Bola Ade");
    expect(receiverName(order({ receiver_details: { contact_person_name: "  " } }))).toBeNull();
    expect(receiverName(food)).toBeNull();
  });

  it("reads the receiver's name from a JSON-string receiver_details the same as from the object", () => {
    expect(receiverName(parcelJsonReceiver)).toBe("Bola Ade");
  });

  it("reads no name from malformed or non-object JSON, without crashing", () => {
    expect(receiverName(parcelMalformedReceiver)).toBeNull();
    expect(receiverName(parcelNonObjectReceiver)).toBeNull();
  });
});

describe("receiverOf", () => {
  it("returns the object as is", () => {
    expect(receiverOf(parcel)).toEqual(receiverObj);
  });

  it("parses a JSON-string receiver_details into the same object", () => {
    expect(receiverOf(parcelJsonReceiver)).toEqual(receiverObj);
  });

  it("returns null for null, undefined, malformed JSON, or a non-object JSON value", () => {
    expect(receiverOf(order({ receiver_details: null }))).toBeNull();
    expect(receiverOf(order({}))).toBeNull();
    expect(receiverOf(parcelMalformedReceiver)).toBeNull();
    expect(receiverOf(parcelNonObjectReceiver)).toBeNull();
    expect(receiverOf(order({ receiver_details: "42" }))).toBeNull();
  });
});

describe("orderHeading", () => {
  it("names the receiver for a parcel", () => {
    expect(orderHeading(parcel)).toBe("Parcel to Bola Ade");
    expect(orderHeading(order({ order_type: "parcel", receiver_details: null }))).toBe("Your parcel");
  });

  it("keeps the shop name for a shop order", () => {
    expect(orderHeading(food)).toBe("Mama Put");
    expect(orderHeading(order({ store: null }))).toBe("Your order");
  });

  it("names the receiver the same way from a JSON-string receiver_details", () => {
    expect(orderHeading(parcelJsonReceiver)).toBe("Parcel to Bola Ade");
  });

  it("falls back to 'Your parcel' when receiver_details is malformed or non-object JSON", () => {
    expect(orderHeading(parcelMalformedReceiver)).toBe("Your parcel");
    expect(orderHeading(parcelNonObjectReceiver)).toBe("Your parcel");
  });
});

describe("orderListTitle", () => {
  it("names the receiver for a parcel instead of an unknown shop", () => {
    expect(orderListTitle(parcel)).toBe("Parcel to Bola Ade");
    expect(orderListTitle(order({ order_type: "parcel", receiver_details: null }))).toBe("Parcel");
  });

  it("keeps the shop name, or the old fallback, for shop orders", () => {
    expect(orderListTitle(food)).toBe("Mama Put");
    expect(orderListTitle(order({ store: null }))).toBe("Unknown shop");
  });
});

describe("orderListPaymentLabel", () => {
  it("never offers payment on delivery: there is no cash on delivery", () => {
    for (const payment_method of ["wallet", "digital_payment", "offline_payment", null, undefined]) {
      expect(orderListPaymentLabel(order({ payment_method }))).not.toMatch(/deliver/i);
    }
  });

  it("reads paid, transfer being checked, or not paid", () => {
    expect(orderListPaymentLabel(order({ payment_status: "paid", payment_method: "wallet" }))).toBe("Paid");
    expect(orderListPaymentLabel(order({ payment_status: "paid", payment_method: "offline_payment" }))).toBe("Paid");
    expect(orderListPaymentLabel(order({ payment_method: "offline_payment" }))).toBe("Transfer being checked");
    expect(orderListPaymentLabel(order({ payment_method: "digital_payment" }))).toBe("Not paid");
    expect(orderListPaymentLabel(order({}))).toBe("Not paid");
  });
});

describe("mapPoints", () => {
  it("sends a parcel's rider to the drop-off, with the pickup as the second pin", () => {
    expect(mapPoints(parcel)).toEqual({
      destination: { lat: 6.4541, lng: 3.4218 },
      pickup: { lat: 6.6018, lng: 3.3515 },
    });
  });

  it("keeps a shop order on the delivery address and the store", () => {
    expect(mapPoints(food)).toEqual({
      destination: { lat: 6.6018, lng: 3.3515 },
      pickup: { lat: 6.5, lng: 3.3 },
    });
  });

  it("reads the same destination from a JSON-string receiver_details", () => {
    expect(mapPoints(parcelJsonReceiver)).toEqual({
      destination: { lat: 6.4541, lng: 3.4218 },
      pickup: { lat: 6.6018, lng: 3.3515 },
    });
  });

  it("has no destination when receiver_details is malformed or non-object JSON", () => {
    expect(mapPoints(parcelMalformedReceiver).destination).toBeNull();
    expect(mapPoints(parcelNonObjectReceiver).destination).toBeNull();
  });
});

describe("addressCards", () => {
  it("labels a parcel's sender Pickup and its receiver Drop-off", () => {
    expect(addressCards(parcel)).toEqual([
      { label: "Pickup", address: "12 Allen Avenue, Ikeja", name: "Ada Obi", phone: "+2348012345678" },
      { label: "Drop-off", address: "5 Awolowo Road, Ikoyi", name: "Bola Ade", phone: "+2348098765432" },
    ]);
  });

  it("keeps a shop order's single Delivery card, or none without an address", () => {
    expect(addressCards(food)).toEqual([
      { label: "Delivery", address: "12 Allen Avenue, Ikeja", name: "Ada Obi", phone: "+2348012345678" },
    ]);
    expect(addressCards(order({ delivery_address: null }))).toEqual([]);
  });

  it("labels the same Drop-off card from a JSON-string receiver_details", () => {
    expect(addressCards(parcelJsonReceiver)).toEqual([
      { label: "Pickup", address: "12 Allen Avenue, Ikeja", name: "Ada Obi", phone: "+2348012345678" },
      { label: "Drop-off", address: "5 Awolowo Road, Ikoyi", name: "Bola Ade", phone: "+2348098765432" },
    ]);
  });

  it("omits the Drop-off card when receiver_details is malformed or non-object JSON", () => {
    expect(addressCards(parcelMalformedReceiver)).toEqual([
      { label: "Pickup", address: "12 Allen Avenue, Ikeja", name: "Ada Obi", phone: "+2348012345678" },
    ]);
    expect(addressCards(parcelNonObjectReceiver)).toEqual([
      { label: "Pickup", address: "12 Allen Avenue, Ikeja", name: "Ada Obi", phone: "+2348012345678" },
    ]);
  });
});

describe("milestonesFor and milestoneIndex", () => {
  it("drops the shop steps for a parcel", () => {
    expect(milestonesFor(parcel).map((m) => m.label)).toEqual([
      "Order placed",
      "Confirmed",
      "Out for delivery",
      "Delivered",
    ]);
  });

  it("keeps the shop timeline for a shop order", () => {
    expect(milestonesFor(food).map((m) => m.label)).toEqual([
      "Order placed",
      "Confirmed by shop",
      "Being prepared",
      "Out for delivery",
      "Delivered",
    ]);
  });

  it("places statuses with no row of their own", () => {
    const p = milestonesFor(parcel);
    expect(milestoneIndex(p, "processing")).toBe(1);
    expect(milestoneIndex(p, "picked_up")).toBe(2);
    expect(milestoneIndex(p, "accepted")).toBe(2);
    expect(milestoneIndex(p, "delivered")).toBe(3);
    const f = milestonesFor(food);
    expect(milestoneIndex(f, "processing")).toBe(2);
    expect(milestoneIndex(f, "picked_up")).toBe(3);
    expect(milestoneIndex(f, "price_check")).toBe(0);
  });
});
