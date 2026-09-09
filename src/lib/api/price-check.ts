"use client";

import { api } from "@/lib/api-client";
import { toWireCart, type PlaceOrderInput } from "@/lib/api/orders";

/**
 * POST /api/v1/customer/order/price-check
 *
 * Same request shape as placeOrder, minus `payment_method` (the store
 * hasn't quoted yet, so there's nothing to pay), plus `item_notes`
 * keyed by item id (see buildItemNotes). The order lands parked at
 * order_status = "price_check" with no money moved.
 */

export type PriceRequestResult =
  | { ok: true; orderId: number; requestedAmount: number }
  | { ok: false; message: string };

type PriceRequestResponse = {
  message?: string;
  order_id?: number;
  /** Two m's, unchanged from place-order (PlaceNewOrder.php line 552).
   *  At this point it is the requested total from stale catalogue
   *  prices, not a price the store has agreed to. */
  total_ammount?: number;
  status?: string;
};

export async function sendPriceRequest(
  input: Omit<PlaceOrderInput, "paymentMethod"> & {
    itemNotes: Record<string, string>;
  },
): Promise<PriceRequestResult> {
  const cart = toWireCart(input.lines);

  const body: Record<string, unknown> = {
    is_buy_now: 1,
    cart: JSON.stringify(cart),
    order_type: input.orderType ?? "delivery",
    store_id: input.storeId,
    distance: input.distance,
    address: input.address,
    address_type: input.addressType ?? "Delivery",
    longitude: String(input.lng),
    latitude: String(input.lat),
    dm_tips: input.dmTips ?? 0,
  };

  if (input.contactPersonName) body.contact_person_name = input.contactPersonName;
  if (input.contactPersonNumber)
    body.contact_person_number = input.contactPersonNumber;
  if (input.contactPersonEmail)
    body.contact_person_email = input.contactPersonEmail;
  if (Object.keys(input.itemNotes).length > 0) body.item_notes = input.itemNotes;

  const res = await api<PriceRequestResponse>(
    "/api/v1/customer/order/price-check",
    {
      method: "POST",
      body,
      zoneId: input.zoneIds,
      moduleId: input.moduleId,
      latitude: input.lat,
      longitude: input.lng,
    },
  );

  if (res.ok) {
    if (typeof res.data.order_id === "number") {
      return {
        ok: true,
        orderId: res.data.order_id,
        requestedAmount: Number(res.data.total_ammount ?? 0),
      };
    }
    return { ok: false, message: "Request sent but no order id came back." };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}
