import type { AppliedCoupon } from "@/lib/api/coupon";
import type { OrderQuote } from "@/lib/api/order-quote";

/**
 * What the coupon box says under an accepted code, read off the priced
 * quote rather than predicted. The backend accepts a code whose minimum
 * order isn't met and quietly grants nothing, so "applied" alone would
 * let the customer believe delivery is free when the total says not.
 */
export type CouponNotice =
  | { tone: "success"; message: string }
  | { tone: "warn"; message: string }
  | null;

function naira(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

export function couponNotice(coupon: AppliedCoupon, quote: OrderQuote | null): CouponNotice {
  if (!quote) return null;

  // Same base CouponLogic measures min_purchase against.
  const base = Math.max(quote.subtotal - quote.productDiscount, 0);
  if (coupon.minPurchase > 0 && base < coupon.minPurchase) {
    return {
      tone: "warn",
      message: `Add ${naira(coupon.minPurchase - base)} more to use ${coupon.code}. It needs an order of ${naira(coupon.minPurchase)} or more.`,
    };
  }

  if (coupon.couponType === "free_delivery") {
    if (quote.deliveryCharge === 0) {
      return { tone: "success", message: "Free delivery applied." };
    }
    return {
      tone: "warn",
      message: `${coupon.code} was accepted but delivery isn't free on this order.`,
    };
  }

  if (quote.couponDiscount > 0) {
    return { tone: "success", message: `You save ${naira(quote.couponDiscount)}.` };
  }
  return {
    tone: "warn",
    message: `${coupon.code} was accepted but gives no discount on this order.`,
  };
}
