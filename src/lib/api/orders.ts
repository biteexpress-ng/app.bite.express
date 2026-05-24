"use client";

import { api } from "@/lib/api-client";
import type { CartLine } from "@/lib/cart-store";
import type { VariationSelection } from "@/lib/food-variations";

/**
 * Order placement against POST /api/v1/customer/order/place.
 *
 * Backend lives in app/Traits/PlaceNewOrder.php (~line 38). The
 * controller path that uses it is OrderController@place_order.
 *
 * IMPORTANT — single-store invariant:
 *   makeOrderDetails (~line 1071) verifies every cart item's
 *   store_id matches the order's store_id. The client cart-store
 *   already enforces this so we're safe by construction.
 *
 * is_buy_now=1 + cart-in-body path:
 *   When `is_buy_now=1` is sent, the trait reads the cart from the
 *   request body (`$request['cart']`) as a JSON-encoded string
 *   instead of from the DB cart table. We use this path so we
 *   don't have to sync our localStorage cart to the server cart
 *   table beforehand.
 *
 * Cart item wire shape (per Helpers::get_varient + makeOrderDetails):
 *   {
 *     item_id: number,
 *     item_type: "App\\Models\\Item",      // FQCN — not the morph short alias
 *     quantity: number,
 *     variation: [
 *       { name: "Soup Type", values: { label: ["Egusi"] } }    // values.label is itself an array
 *     ],
 *     add_on_ids: number[],
 *     add_on_qtys: number[]
 *   }
 *
 * Required headers for this endpoint:
 *   - Authorization (Bearer)         we send by default
 *   - moduleId       set by caller — must match the store's module
 *   - zoneId         set by caller — must contain the delivery point
 *   - latitude / longitude  the delivery point
 */

export type PlaceOrderInput = {
  storeId: number;
  moduleId: number;
  zoneIds: number[];
  lines: CartLine[];

  /** Delivery point. */
  lat: number;
  lng: number;
  /** Pre-computed line-of-sight distance (km). */
  distance: number;

  /** Free-form address text (shown to the rider). */
  address: string;
  addressType?: string; // "Home" / "Office" / "Other" / "Delivery"

  contactPersonName?: string;
  contactPersonNumber?: string;
  contactPersonEmail?: string | null;

  paymentMethod: "cash_on_delivery" | "digital_payment" | "wallet" | "offline_payment";
  orderType?: "delivery" | "take_away" | "parcel";

  /** Optional rider tip. */
  dmTips?: number;
};

type PlaceOrderResponse = {
  message?: string;
  order_id?: number;
  /** Yes, the backend really does spell it with two m's
   *  (PlaceNewOrder.php line 552). */
  total_ammount?: number;
  status?: string;
};

export type PlaceOrderResult =
  | { ok: true; orderId: number; amount: number }
  | { ok: false; message: string };

function toWireVariation(
  selections: VariationSelection[],
): Array<{ name: string; values: { label: string[] } }> {
  return selections
    .filter((s) => s.values.length > 0)
    .map((s) => ({ name: s.name, values: { label: s.values } }));
}

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const cart = input.lines.map((l) => ({
    item_id: l.itemId,
    item_type: "App\\Models\\Item",
    quantity: l.qty,
    variation: toWireVariation(l.selections),
    add_on_ids: [] as number[],
    add_on_qtys: [] as number[],
  }));

  const body: Record<string, unknown> = {
    is_buy_now: 1,
    cart: JSON.stringify(cart),
    payment_method: input.paymentMethod,
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

  const res = await api<PlaceOrderResponse>("/api/v1/customer/order/place", {
    method: "POST",
    body,
    zoneId: input.zoneIds,
    moduleId: input.moduleId,
    latitude: input.lat,
    longitude: input.lng,
  });

  if (res.ok) {
    if (typeof res.data.order_id === "number") {
      return {
        ok: true,
        orderId: res.data.order_id,
        amount: Number(res.data.total_ammount ?? 0),
      };
    }
    return { ok: false, message: "Order placed but no id returned." };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}

/**
 * POST /api/v1/customer/order/confirm-paystack-payment
 *
 * Called after the Paystack inline popup fires its `callback` with a
 * reference. The backend verifies the reference with Paystack's API
 * (the standard webhook is DVA-only and skips card payments), then
 * flips order.payment_status = "paid".
 *
 * The reference here is the SAME one we passed to the popup as `ref`.
 */
export type ConfirmPaystackResult =
  | { ok: true }
  | { ok: false; message: string };

export async function confirmPaystackPayment(
  orderId: number,
  reference: string,
): Promise<ConfirmPaystackResult> {
  const res = await api<{ message?: string; status?: string }>(
    "/api/v1/customer/order/confirm-paystack-payment",
    {
      method: "POST",
      body: { order_id: orderId, reference },
    },
  );
  if (res.ok) return { ok: true };
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}
