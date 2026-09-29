import type { OrderStatus, OrderSummary } from "@/lib/api/orders";
import type { MilestoneStatus } from "@/lib/tracking";

/**
 * How an order reads on the tracking page and in the orders list. For a
 * parcel, delivery_address is the SENDER (pickup) and receiver_details
 * is the drop-off, the reverse of what a shop order's fields suggest.
 */

export type LatLng = { lat: number; lng: number };

export function toLatLng(
  lat: string | number | null | undefined,
  lng: string | number | null | undefined,
): LatLng | null {
  if (lat === null || lat === undefined || lat === "") return null;
  if (lng === null || lng === undefined || lng === "") return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  if (nLat === 0 && nLng === 0) return null;
  return { lat: nLat, lng: nLng };
}

export function isParcelOrder(o: Pick<OrderSummary, "order_type">): boolean {
  return o.order_type === "parcel";
}

export function receiverName(o: Pick<OrderSummary, "receiver_details">): string | null {
  const name = o.receiver_details?.contact_person_name?.trim();
  return name ? name : null;
}

export function orderHeading(
  o: Pick<OrderSummary, "order_type" | "receiver_details" | "store">,
): string {
  if (isParcelOrder(o)) {
    const name = receiverName(o);
    return name ? `Parcel to ${name}` : "Your parcel";
  }
  return o.store?.name ?? "Your order";
}

/** Where the rider map points: the drop-off for a parcel, the customer for a shop order. */
export function mapPoints(
  o: Pick<OrderSummary, "order_type" | "receiver_details" | "delivery_address" | "store">,
): { destination: LatLng | null; pickup: LatLng | null } {
  if (isParcelOrder(o)) {
    return {
      destination: toLatLng(o.receiver_details?.latitude, o.receiver_details?.longitude),
      pickup: toLatLng(o.delivery_address?.latitude, o.delivery_address?.longitude),
    };
  }
  return {
    destination: toLatLng(o.delivery_address?.latitude, o.delivery_address?.longitude),
    pickup: toLatLng(o.store?.latitude, o.store?.longitude),
  };
}

export type AddressCard = {
  label: "Pickup" | "Drop-off" | "Delivery";
  address: string;
  name: string | null;
  phone: string | null;
};

export function addressCards(
  o: Pick<OrderSummary, "order_type" | "receiver_details" | "delivery_address">,
): AddressCard[] {
  const from = o.delivery_address;
  if (!isParcelOrder(o)) {
    return from
      ? [
          {
            label: "Delivery",
            address: from.address ?? "",
            name: from.contact_person_name || null,
            phone: from.contact_person_number || null,
          },
        ]
      : [];
  }
  const cards: AddressCard[] = [];
  if (from) {
    cards.push({
      label: "Pickup",
      address: from.address ?? "",
      name: from.contact_person_name || null,
      phone: from.contact_person_number || null,
    });
  }
  const to = o.receiver_details;
  if (to) {
    cards.push({
      label: "Drop-off",
      address: to.address ?? "",
      name: to.contact_person_name || null,
      phone: to.contact_person_number || null,
    });
  }
  return cards;
}

export type Milestone = { status: MilestoneStatus; label: string };

const SHOP_MILESTONES: Milestone[] = [
  { status: "pending", label: "Order placed" },
  { status: "confirmed", label: "Confirmed by shop" },
  { status: "processing", label: "Being prepared" },
  { status: "handover", label: "Out for delivery" },
  { status: "delivered", label: "Delivered" },
];

/** No shop confirms or prepares a parcel. */
const PARCEL_MILESTONES: Milestone[] = [
  { status: "pending", label: "Order placed" },
  { status: "confirmed", label: "Confirmed" },
  { status: "handover", label: "Out for delivery" },
  { status: "delivered", label: "Delivered" },
];

export function milestonesFor(o: Pick<OrderSummary, "order_type">): Milestone[] {
  return isParcelOrder(o) ? PARCEL_MILESTONES : SHOP_MILESTONES;
}

/** The milestone reached. Statuses with no row of their own show as the row they belong to. */
export function milestoneIndex(milestones: readonly Milestone[], status: OrderStatus): number {
  const direct = milestones.findIndex((m) => m.status === status);
  if (direct >= 0) return direct;
  if (status === "picked_up" || status === "accepted") {
    return milestones.findIndex((m) => m.status === "handover");
  }
  if (status === "processing") {
    return milestones.findIndex((m) => m.status === "confirmed");
  }
  return 0;
}
