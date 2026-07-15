"use client";

import { api, type ApiResult } from "@/lib/api-client";
import type { OfflinePaymentMethod } from "@/lib/offline-payment-rules";

export type OfflineMethodsResult =
  | { ok: true; methods: OfflinePaymentMethod[] }
  | { ok: false; message: string };

/**
 * GET /api/v1/offline_payment_method_list
 *
 * No auth, no zone/module headers — it sits outside every auth group
 * (routes/api/v1/api.php:98).
 *
 * IMPORTANT: this returns literal JSON `null`, not `[]`, when there are
 * no active methods (ConfigController.php:1076-1082 does
 * `$data->count() > 0 ? $data : null`). Coerce it, or every consumer
 * has to defend against null separately.
 */
export async function fetchOfflineMethods(): Promise<OfflineMethodsResult> {
  const res = await api<OfflinePaymentMethod[] | null>(
    "/api/v1/offline_payment_method_list",
    { unauth: true },
  );
  if (res.ok) {
    return { ok: true, methods: Array.isArray(res.data) ? res.data : [] };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}

/**
 *   ok:true                    details saved, order flipped to 'pending'
 *   ok:false reason:"disabled" offline payment is switched off globally
 *   ok:false reason:"not-found" order id is wrong
 *   ok:false reason:"other"    generic error with message
 */
export type OfflineSubmitResult =
  | { ok: true }
  | { ok: false; reason: "disabled" | "not-found" | "other"; message: string };

function toSubmitResult(res: ApiResult<{ payment?: string }>): OfflineSubmitResult {
  if (res.ok) return { ok: true };
  if ("skipped" in res) {
    return { ok: false, reason: "other", message: "Backend not configured." };
  }
  if (res.status === 404) {
    return { ok: false, reason: "not-found", message: res.message };
  }
  // The global-flag rejection comes back as
  // 403 {"errors":[{"code":"offline_payment_status", ...}]}
  // (OrderController.php:481-488), which api-client promotes into
  // `errors` keyed by code.
  if (res.errors?.offline_payment_status) {
    return { ok: false, reason: "disabled", message: res.message };
  }
  return { ok: false, reason: "other", message: res.message };
}

/**
 * PUT /api/v1/customer/order/offline-payment
 *
 * This is the call that actually makes the order real. The order was
 * created at order_status='failed' by /order/place (PlaceNewOrder.php
 * :173-179) and only flips to 'pending' here (OrderController.php
 * :515-516). If this never lands, the order is stranded and invisible
 * (Order::scopeFailed hides failed orders with no offline_payments row).
 *
 * `fields` are the dynamic method_informations values and MUST go flat
 * at the top level: the backend harvests them with
 * array_column($method->method_informations, 'customer_input') and
 * copies only keys that already exist (:495-504).
 */
export async function submitOfflinePayment(input: {
  orderId: number;
  methodId: number;
  customerNote?: string;
  fields: Record<string, string>;
}): Promise<OfflineSubmitResult> {
  // Spread fields first: admin-defined labels are slugified server-side
  // (strtolower + underscores), and "Order ID" slugifies to exactly
  // `order_id`. If spread after, customer input overwrites the real ID,
  // causing a 404 and stranding the order in failed state.
  const body: Record<string, unknown> = {
    ...input.fields,
    order_id: input.orderId,
    method_id: input.methodId,
  };
  if (input.customerNote) body.customer_note = input.customerNote;

  const res = await api<{ payment?: string }>(
    "/api/v1/customer/order/offline-payment",
    { method: "PUT", body },
  );
  return toSubmitResult(res);
}

/**
 * PUT /api/v1/customer/order/offline-payment-update
 *
 * Used after an admin denies a payment and the customer corrects it.
 *
 * Two hard rules from OrderController.php:543-610:
 *  1. Do NOT send method_id. The method is re-read from the stored
 *     payment_info (:555-558); it cannot be changed here, and sending
 *     it is silently ignored.
 *  2. Send the FULL form every time. $offline_payment_info is rebuilt
 *     from scratch (:557), so any field omitted here is DELETED.
 *
 * update_payment_info: 1 notifies the customer that their info was
 * updated; a falsy value fires a store order notification instead
 * (:577), which is wrong for a customer-initiated edit.
 */
export async function updateOfflinePayment(input: {
  orderId: number;
  customerNote?: string;
  fields: Record<string, string>;
}): Promise<OfflineSubmitResult> {
  // Spread fields first: same reason as submitOfflinePayment. A field
  // labelled "Update Payment Info" would slugify to `update_payment_info`
  // and flip the notification branch, sending the wrong customer message.
  const body: Record<string, unknown> = {
    ...input.fields,
    order_id: input.orderId,
    update_payment_info: 1,
  };
  if (input.customerNote) body.customer_note = input.customerNote;

  const res = await api<{ payment?: string }>(
    "/api/v1/customer/order/offline-payment-update",
    { method: "PUT", body },
  );
  return toSubmitResult(res);
}
