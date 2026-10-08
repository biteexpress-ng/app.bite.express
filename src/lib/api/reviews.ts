"use client";

import { api, type ApiResult } from "@/lib/api-client";

/**
 * Customer ratings. The backend has no store review endpoint: a store's
 * rating is rebuilt from the reviews on its items
 * (ItemController@submit_product_review calls StoreLogic::update_store_rating),
 * which is also how the native app rates a store. So "rate the store" here
 * means one item review per distinct item on the order.
 *
 * Both submit endpoints refuse a second review for the same order with a
 * 403 whose error code is "review". That is not a failure for us: the
 * rating exists, so it maps to `already`.
 */

export type ReviewSubmitResult =
  | { ok: true; already: boolean }
  | { ok: false; message: string };

function toSubmitResult(res: ApiResult<unknown>): ReviewSubmitResult {
  if (res.ok) return { ok: true, already: false };
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  if (res.status === 403 && res.errors?.review) return { ok: true, already: true };
  return { ok: false, message: res.message };
}

export async function submitItemReview(input: {
  orderId: number;
  itemId: number;
  rating: number;
  comment?: string;
}): Promise<ReviewSubmitResult> {
  const res = await api<unknown>("/api/v1/items/reviews/submit", {
    method: "POST",
    body: {
      order_id: input.orderId,
      item_id: input.itemId,
      rating: input.rating,
      comment: input.comment?.trim() || undefined,
    },
  });
  return toSubmitResult(res);
}

/** The backend requires `comment` on a rider review (DeliveryManReviewController). */
export async function submitRiderReview(input: {
  orderId: number;
  deliveryManId: number;
  rating: number;
  comment: string;
}): Promise<ReviewSubmitResult> {
  const res = await api<unknown>("/api/v1/delivery-man/reviews/submit", {
    method: "POST",
    body: {
      order_id: input.orderId,
      delivery_man_id: input.deliveryManId,
      rating: input.rating,
      comment: input.comment.trim(),
    },
  });
  return toSubmitResult(res);
}

export type ReviewReminder = { orderId: number; images: string[] };

/**
 * The customer's latest delivered shop order that has neither been rated
 * (order_references.is_reviewed) nor waved off (is_review_canceled).
 * Parcel orders never come back: the query requires order details.
 */
export async function fetchReviewReminder(): Promise<ReviewReminder | null> {
  const res = await api<{ order_id?: number | null; images?: unknown }>(
    "/api/v1/customer/review-reminder",
  );
  if (!res.ok) return null;
  const id = Number(res.data?.order_id);
  if (!Number.isFinite(id) || id <= 0) return null;
  // `images` is a PHP collection after filter(), so it can arrive as an
  // object keyed by index rather than a list.
  const raw = res.data?.images;
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : [];
  return { orderId: id, images: list.filter((u): u is string => typeof u === "string") };
}

/** Stops the reminder for this order on every device. */
export async function cancelReviewReminder(orderId: number): Promise<void> {
  await api<unknown>(`/api/v1/customer/review-reminder-cancel?order_id=${orderId}`);
}
