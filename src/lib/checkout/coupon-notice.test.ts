import { describe, expect, it } from "vitest";
import { couponNotice } from "./coupon-notice";
import { parseCoupon } from "@/lib/api/coupon";
import type { OrderQuote } from "@/lib/api/order-quote";

function quote(over: Partial<OrderQuote> = {}): OrderQuote {
  return {
    subtotal: 3000,
    productDiscount: 0,
    couponDiscount: 0,
    deliveryCharge: 0,
    freeDeliveryBy: "admin",
    additionalCharge: 0,
    extraPackaging: 0,
    taxAmount: 0,
    taxIncluded: false,
    dmTips: 0,
    total: 3000,
    ...over,
  };
}

const freeDelivery = parseCoupon(
  { code: "AREWA", coupon_type: "free_delivery", min_purchase: "0" },
  "arewa",
);

describe("couponNotice", () => {
  it("says nothing until the order is priced", () => {
    expect(couponNotice(freeDelivery, null)).toBeNull();
  });

  it("confirms free delivery when the priced delivery charge is zero", () => {
    expect(couponNotice(freeDelivery, quote())).toEqual({
      tone: "success",
      message: "Free delivery applied.",
    });
  });

  it("warns when a free-delivery code was accepted but delivery still costs", () => {
    expect(couponNotice(freeDelivery, quote({ deliveryCharge: 800, freeDeliveryBy: null }))).toEqual({
      tone: "warn",
      message: "AREWA was accepted but delivery isn't free on this order.",
    });
  });

  it("tells the customer how far below the minimum order they are", () => {
    const withMin = { ...freeDelivery, minPurchase: 5000 };
    const n = couponNotice(withMin, quote({ subtotal: 4200, deliveryCharge: 800 }));
    expect(n?.tone).toBe("warn");
    expect(n?.message).toContain("Add ₦800 more");
    expect(n?.message).toContain("₦5,000");
  });

  it("measures the minimum after item discounts, as the backend does", () => {
    const withMin = { ...freeDelivery, minPurchase: 3000 };
    expect(couponNotice(withMin, quote({ subtotal: 3200, productDiscount: 500 }))?.tone).toBe("warn");
    expect(couponNotice(withMin, quote({ subtotal: 3200, productDiscount: 100 }))?.tone).toBe("success");
  });

  it("reports the saving for an amount or percentage coupon", () => {
    const amount = parseCoupon({ code: "SAVE5", coupon_type: "default" }, "SAVE5");
    expect(couponNotice(amount, quote({ couponDiscount: 500 }))).toEqual({
      tone: "success",
      message: "You save ₦500.",
    });
    expect(couponNotice(amount, quote())?.tone).toBe("warn");
  });
});

describe("parseCoupon", () => {
  it("keeps the server's spelling of the code and reads a string minimum", () => {
    expect(parseCoupon({ code: "AREWA", coupon_type: "free_delivery", min_purchase: "1500" }, "arewa")).toEqual({
      code: "AREWA",
      title: null,
      couponType: "free_delivery",
      minPurchase: 1500,
    });
  });

  it("falls back to what was typed and treats a missing minimum as none", () => {
    expect(parseCoupon({}, "AREWA")).toEqual({
      code: "AREWA",
      title: null,
      couponType: "default",
      minPurchase: 0,
    });
  });
});
