"use client";

import { api } from "@/lib/api-client";
import type { CartLine } from "@/lib/cart-store";
import {
  parcelOrderBody,
  toWireCart,
  type PlaceParcelOrderInput,
} from "@/lib/api/orders";

/**
 * POST /api/v1/customer/order/get-Tax  (OrderController@getTaxFromCart)
 *
 * The backend's own pricing preview. It runs the SAME two pieces of
 * code order placement runs — PlaceNewOrder::getDeliveryCharge() and
 * OrderPricingResolver::resolve() — against a cart payload, and
 * returns the resulting totals WITHOUT creating an order.
 *
 * That's why checkout asks the server instead of adding up fees
 * locally: delivery pricing alone has five branches (store
 * self-delivery, distance bands, per-km, fixed, vehicle surcharge)
 * plus three free-delivery overrides, and any drift between a local
 * copy and the server's copy shows up as a customer who tops their
 * wallet up to the number we printed and still gets told the balance
 * is too low.
 *
 * Send it the identical `distance`, cart and tip the order POST will
 * send, or the preview and the charge won't agree.
 */

export type OrderQuote = {
  /** Items + add-ons, before any discount. */
  subtotal: number;
  /** Store + flash-sale discounts already applied to the subtotal. */
  productDiscount: number;
  couponDiscount: number;
  /** What the customer pays for delivery. 0 when delivery is free. */
  deliveryCharge: number;
  /** Non-null when something zeroed the delivery charge: "admin",
   *  "vendor", or a coupon's created_by. */
  freeDeliveryBy: string | null;
  /** Admin-configured service charge (business setting
   *  `additional_charge`, fixed or percentage). */
  additionalCharge: number;
  extraPackaging: number;
  taxAmount: number;
  taxIncluded: boolean;
  dmTips: number;
  /** order_amount — the figure the wallet is debited by and the
   *  figure Paystack is asked to capture. */
  total: number;
};

export type OrderQuoteResult =
  | { ok: true; quote: OrderQuote }
  | { ok: false; message: string };

export type OrderQuoteInput = {
  storeId: number;
  moduleId: number;
  zoneIds: number[];
  lines: CartLine[];
  lat: number;
  lng: number;
  /** Kilometres. Must match what placeOrder() sends. */
  distance: number;
  orderType?: "delivery" | "take_away";
  dmTips?: number;
};

type GetTaxResponse = {
  tax_amount?: number | string;
  tax_included?: boolean | number | null;
  order_amount?: number | string;
  delivery_charge?: number | string;
  additional_charge?: number | string;
  coupon_discount_amount?: number | string;
  pricing_breakdown?: {
    normalized_inputs?: {
      merchandise_subtotal?: number | string;
      extra_packaging_amount?: number | string;
      dm_tips?: number | string;
    };
    breakdown?: {
      product_discount_total?: number | string;
      free_delivery_by?: string | null;
    };
  };
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchOrderQuote(
  input: OrderQuoteInput,
): Promise<OrderQuoteResult> {
  const res = await api<GetTaxResponse>("/api/v1/customer/order/get-Tax", {
    method: "POST",
    body: {
      is_buy_now: 1,
      cart: JSON.stringify(toWireCart(input.lines)),
      order_type: input.orderType ?? "delivery",
      store_id: input.storeId,
      distance: input.distance,
      longitude: String(input.lng),
      latitude: String(input.lat),
      dm_tips: input.dmTips ?? 0,
    },
    zoneId: input.zoneIds,
    moduleId: input.moduleId,
    latitude: input.lat,
    longitude: input.lng,
  });

  if (res.ok) return { ok: true, quote: parseQuote(res.data) };
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}

/** Exported for tests — the field names here are easy to get wrong and
 *  a silent 0 reads as "free delivery" to the customer. */
export function parseQuote(data: GetTaxResponse): OrderQuote {
  const inputs = data.pricing_breakdown?.normalized_inputs ?? {};
  const breakdown = data.pricing_breakdown?.breakdown ?? {};

  return {
    subtotal: num(inputs.merchandise_subtotal),
    productDiscount: num(breakdown.product_discount_total),
    couponDiscount: num(data.coupon_discount_amount),
    deliveryCharge: num(data.delivery_charge),
    freeDeliveryBy: breakdown.free_delivery_by ?? null,
    additionalCharge: num(data.additional_charge),
    extraPackaging: num(inputs.extra_packaging_amount),
    taxAmount: num(data.tax_amount),
    taxIncluded: Boolean(data.tax_included),
    dmTips: num(inputs.dm_tips),
    total: num(data.order_amount),
  };
}

/**
 * A parcel preview is only trusted when it carries the fee. A backend
 * without the parcel preview fix returns delivery_charge 0 with no
 * free-delivery reason and a total that leaves the fee out; showing
 * that would print "Free" delivery and a total below the real charge.
 */
export function parcelQuoteUsable(q: OrderQuote): boolean {
  return q.total > 0 && (q.deliveryCharge > 0 || q.freeDeliveryBy !== null);
}

/**
 * The parcel preview. Sent the exact body placeParcelOrder() sends, with
 * the same zone and module headers, so the backend prices the fee on the
 * same distance and category, adds the pickup zone's surge, and refuses
 * a pickup outside every parcel zone (code "zone") just as placement would.
 */
export async function fetchParcelQuote(
  input: PlaceParcelOrderInput,
): Promise<OrderQuoteResult> {
  const res = await api<GetTaxResponse>("/api/v1/customer/order/get-Tax", {
    method: "POST",
    body: parcelOrderBody(input),
    zoneId: input.zoneIds,
    moduleId: input.moduleId,
    latitude: input.pickup.lat,
    longitude: input.pickup.lng,
  });

  if (res.ok) {
    const quote = parseQuote(res.data);
    if (!parcelQuoteUsable(quote)) {
      return {
        ok: false,
        message: "We couldn't price this delivery just now. Try again in a moment.",
      };
    }
    return { ok: true, quote };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}
