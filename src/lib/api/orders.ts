"use client";

import { api } from "@/lib/api-client";
import type { CartLine } from "@/lib/cart-store";
import type { VariationSelection } from "@/lib/food-variations";

/* -------------------------------------------------------------- */
/* Order list + detail + tracking                                  */
/* -------------------------------------------------------------- */

/** Shared by /order/list (history) and /order/running-orders.
 *  Subset of the full Order shape the backend returns — fields
 *  not used in the UI are dropped from the type for clarity. */
export type OrderSummary = {
  id: number;
  order_amount: number;
  order_status: OrderStatus;
  payment_status: "paid" | "unpaid";
  payment_method?: string | null;
  created_at: string;
  delivery_time?: string | null;
  schedule_at?: string | null;
  details_count?: number;
  delivery_address?: {
    contact_person_name?: string;
    contact_person_number?: string;
    address?: string;
    /** Backend casts these to strings before JSON-encoding
     *  (PlaceNewOrder.php line 152). Parse with Number() at use. */
    latitude?: string;
    longitude?: string;
  } | null;
  store?: {
    id?: number;
    name?: string;
    logo_full_url?: string | null;
    latitude?: number | string;
    longitude?: number | string;
  } | null;
  delivery_man?:
    | Array<{
        id: number;
        f_name?: string;
        l_name?: string;
        phone?: string;
        image_full_url?: string | null;
      }>
    | null;
};

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "handover"
  | "picked_up"
  | "delivered"
  | "canceled"
  | "refund_requested"
  | "refund_request_canceled"
  | "refunded"
  | "failed"
  | "returned"
  | "accepted"
  | "ready_for_handover";

export type OrderListResponse = {
  total_size: number;
  limit: number;
  offset: number;
  orders: OrderSummary[];
};

export type OrderListResult =
  | { ok: true; data: OrderListResponse }
  | { ok: false; message: string };

/** Currently-active orders (status NOT in delivered/canceled/refund*).
 *  offset is 1-based per the backend's paginate('page', $offset). */
export async function fetchRunningOrders(
  page = 1,
  limit = 10,
): Promise<OrderListResult> {
  const res = await api<OrderListResponse>(
    `/api/v1/customer/order/running-orders?limit=${limit}&offset=${page}`,
  );
  if (res.ok) return { ok: true, data: res.data };
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}

/** History orders (delivered, canceled, refunded etc). */
export async function fetchOrderHistory(
  page = 1,
  limit = 10,
): Promise<OrderListResult> {
  const res = await api<OrderListResponse>(
    `/api/v1/customer/order/list?limit=${limit}&offset=${page}`,
  );
  if (res.ok) return { ok: true, data: res.data };
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}

/** Per-line items on a single order. The endpoint returns either an
 *  array of order_detail records OR (for parcel/prescription orders)
 *  the order itself. We normalise to an array. */
export type OrderDetailLine = {
  id: number;
  item_id?: number | null;
  item_campaign_id?: number | null;
  /** The full snapshot of the item at order time, JSON-encoded. */
  item_details?: string;
  price: number;
  discount_on_item?: number;
  total_add_on_price?: number;
  quantity: number;
  variant?: string | null;
  variation?: unknown[];
  add_ons?: unknown[];
  tax_amount?: number;
};

export type OrderDetailLinesResult =
  | { ok: true; lines: OrderDetailLine[] }
  | { ok: false; message: string };

export async function fetchOrderDetailLines(
  orderId: number,
): Promise<OrderDetailLinesResult> {
  const res = await api<OrderDetailLine[] | Record<string, unknown>>(
    `/api/v1/customer/order/details?order_id=${orderId}`,
  );
  if (res.ok) {
    if (Array.isArray(res.data)) return { ok: true, lines: res.data };
    return { ok: true, lines: [] };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}

/** Full order header + timelines, used on the /orders/[id] page. */
export type OrderTimeline = {
  id: number;
  order_id: number;
  event: string;
  status?: string;
  created_at: string;
};

export type OrderTrack = OrderSummary & {
  timelines?: OrderTimeline[];
};

export type OrderTrackResult =
  | { ok: true; order: OrderTrack }
  | { ok: false; message: string };

export async function fetchOrderTrack(
  orderId: number,
): Promise<OrderTrackResult> {
  const res = await api<OrderTrack>(
    `/api/v1/customer/order/track?order_id=${orderId}`,
  );
  if (res.ok) return { ok: true, order: res.data };
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}

/* -------------------------------------------------------------- */
/* Existing helpers below                                          */
/* -------------------------------------------------------------- */

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
    // `variant` is the legacy single-variant string. This app only
    // uses the modern food_variations system (`variation` below), so
    // there's never a legacy variant — but the key must still be
    // present: makeOrderDetails does a bare json_encode($c['variant'])
    // at PlaceNewOrder.php:1175. Omitting it throws "Undefined array
    // key variant" (PHP 8), which the controller catches and returns
    // as a 403 — the real cause of checkout failing on the web app.
    // The Flutter app sends "" here for food-variation items too.
    variant: "",
    variation: toWireVariation(l.selections),
    add_on_ids: l.addOns.map((a) => a.id),
    add_on_qtys: l.addOns.map((a) => a.qty),
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

/**
 * POST /api/v1/customer/order/wallet-payment
 *
 * Deducts the order total from the customer's wallet_balance.
 * Used both for the immediate "Wallet balance" payment method and
 * for the DVA bank-transfer flow (after the customer transfers and
 * the webhook credits their wallet).
 *
 * Returns:
 *   ok:true                      payment posted (or already paid)
 *   ok:false reason:"insufficient" wallet balance below order total
 *   ok:false reason:"not-found"  order id is wrong
 *   ok:false reason:"other"      generic error with message
 */
export type WalletPayResult =
  | { ok: true }
  | { ok: false; reason: "insufficient" | "not-found" | "other"; message: string };

export async function walletPayOrder(
  orderId: number,
): Promise<WalletPayResult> {
  const res = await api<{ message?: string }>(
    "/api/v1/customer/order/wallet-payment",
    { method: "POST", body: { order_id: orderId } },
  );
  if (res.ok) return { ok: true };
  if ("skipped" in res) {
    return { ok: false, reason: "other", message: "Backend not configured." };
  }
  if (res.status === 404) {
    return { ok: false, reason: "not-found", message: res.message };
  }
  // Backend uses 400 for the "insufficient_balance" path inside
  // walletPayment(); also surfaces "insufficient" in the message text.
  const msg = res.message ?? "";
  if (
    res.status === 400 &&
    /insufficient|wallet|balance/i.test(msg)
  ) {
    return { ok: false, reason: "insufficient", message: msg };
  }
  return { ok: false, reason: "other", message: msg };
}

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
