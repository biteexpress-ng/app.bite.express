import { describe, expect, it } from "vitest";
import type { OrderSummary } from "@/lib/api/orders";
import {
  addressCards,
  isParcelOrder,
  mapPoints,
  milestoneIndex,
  milestonesFor,
  orderHeading,
  receiverName,
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
