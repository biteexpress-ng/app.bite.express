"use client";

import { api } from "@/lib/api-client";

/**
 * GET /api/v1/coupon/apply?code=&store_id=  (CouponController@apply)
 *
 * Validation only: expiry, usage limit, which customers and which
 * stores or zones the coupon is for. It does not price anything. Once a
 * code passes here, checkout sends it as `coupon_code` to get-Tax and to
 * /order/place, which run CouponLogic again and work out the discount
 * or the free delivery themselves.
 *
 * Needs the moduleId header: CouponLogic::is_valide compares the
 * coupon's module with the one ModuleCheckMiddleware sets from it.
 */

export type AppliedCoupon = {
  code: string;
  title: string | null;
  /** "free_delivery", "default", "store_wise", "zone_wise", ... */
  couponType: string;
  /** Merchandise amount (after item discounts) the order must reach.
   *  Below it the code is accepted but grants nothing. */
  minPurchase: number;
};

export type ApplyCouponResult =
  | { ok: true; coupon: AppliedCoupon }
  | { ok: false; message: string };

type CouponResponse = {
  code?: string;
  title?: string | null;
  coupon_type?: string;
  min_purchase?: number | string | null;
};

export function parseCoupon(data: CouponResponse, typed: string): AppliedCoupon {
  const min = Number(data.min_purchase);
  return {
    code: data.code || typed,
    title: data.title?.trim() || null,
    couponType: data.coupon_type ?? "default",
    minPurchase: Number.isFinite(min) && min > 0 ? min : 0,
  };
}

export async function applyCoupon(input: {
  code: string;
  storeId: number;
  moduleId: number;
  zoneIds: number[];
}): Promise<ApplyCouponResult> {
  const code = input.code.trim();
  if (!code) return { ok: false, message: "Enter a coupon code." };

  const params = new URLSearchParams({ code, store_id: String(input.storeId) });
  const res = await api<CouponResponse>(`/api/v1/coupon/apply?${params.toString()}`, {
    zoneId: input.zoneIds,
    moduleId: input.moduleId,
  });

  if (res.ok) return { ok: true, coupon: parseCoupon(res.data, code) };
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  if (res.status === 0) {
    return { ok: false, message: "We couldn't check that code. Check your connection and try again." };
  }
  return { ok: false, message: res.message || "That code isn't valid." };
}
