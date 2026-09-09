"use client";

import { api } from "@/lib/api-client";
import { ACCEPT_AMOUNT_UNREADABLE } from "@/lib/price-check/accept-outcome";
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

/**
 * POST /api/v1/customer/order/price-check/accept
 *
 * Turns a quote into a payable order server-side: the excluded lines are
 * deleted, the survivors are rewritten to the quoted values and the total
 * is recomputed. It has to return before any gateway opens, because the
 * gateway is checked against the total this call leaves on the order.
 *
 * Every refusal rolls the whole thing back, so the caller can leave the
 * customer's choices untouched and let them try again.
 */

export type AcceptQuoteResult =
  | { ok: true; orderId: number; orderAmount: number; lineCount: number }
  | { ok: false; status: number; code: string | null; message: string };

type AcceptQuoteResponse = {
  message?: string;
  order_id?: number;
  order_amount?: number;
  line_count?: number;
};

export async function acceptQuote(
  payload: Record<string, unknown>,
): Promise<AcceptQuoteResult> {
  const res = await api<AcceptQuoteResponse>(
    "/api/v1/customer/order/price-check/accept",
    { method: "POST", body: payload },
  );

  if (res.ok) {
    const orderId = res.data.order_id;
    const orderAmount = Number(res.data.order_amount);
    // Paying against a total we did not actually receive is the one
    // failure mode this whole screen exists to prevent, so a success
    // body without a usable amount is treated as a refusal.
    if (typeof orderId === "number" && Number.isFinite(orderAmount)) {
      return {
        ok: true,
        orderId,
        orderAmount,
        lineCount: Number(res.data.line_count ?? 0),
      };
    }
    // The accept landed. Only the amount is unreadable, so this carries a
    // code of its own: the screen must reload rather than accept again.
    return {
      ok: false,
      status: 200,
      code: ACCEPT_AMOUNT_UNREADABLE,
      message:
        "Your prices were accepted, but we could not read the total to charge. Open the order to see what to pay.",
    };
  }

  if ("skipped" in res) {
    return {
      ok: false,
      status: 0,
      code: null,
      message: "Backend not configured.",
    };
  }

  // parseErrorBody keys `errors` by the backend's error code, so the
  // first key is the code the screen branches on.
  const code = res.errors ? (Object.keys(res.errors)[0] ?? null) : null;
  return { ok: false, status: res.status, code, message: res.message };
}
