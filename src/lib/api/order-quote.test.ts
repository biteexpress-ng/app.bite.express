import { describe, expect, it } from "vitest";
import { parseQuote } from "./order-quote";

/**
 * get-Tax returns the fee figures across three different nesting
 * levels (top-level, pricing_breakdown.normalized_inputs and
 * pricing_breakdown.breakdown). Reading one from the wrong place
 * silently yields 0, which the summary renders as "Free" — so the
 * mapping is pinned here.
 */
describe("parseQuote", () => {
  const response = {
    tax_amount: 235,
    tax_included: false,
    order_amount: 6135,
    delivery_charge: 900,
    original_delivery_charge: 900,
    additional_charge: 100,
    coupon_discount_amount: 0,
    pricing_breakdown: {
      normalized_inputs: {
        merchandise_subtotal: 4700,
        extra_packaging_amount: 0,
        dm_tips: 200,
      },
      breakdown: {
        product_discount_total: 0,
        free_delivery_by: null,
      },
    },
  };

  it("maps every fee row off the response", () => {
    expect(parseQuote(response)).toEqual({
      subtotal: 4700,
      productDiscount: 0,
      couponDiscount: 0,
      deliveryCharge: 900,
      freeDeliveryBy: null,
      additionalCharge: 100,
      extraPackaging: 0,
      taxAmount: 235,
      taxIncluded: false,
      dmTips: 200,
      total: 6135,
    });
  });

  it("keeps the rows adding up to the total", () => {
    const q = parseQuote(response);
    const sum =
      q.subtotal -
      q.productDiscount -
      q.couponDiscount +
      q.deliveryCharge +
      q.additionalCharge +
      q.extraPackaging +
      q.taxAmount +
      q.dmTips;
    expect(sum).toBe(q.total);
  });

  it("reads numeric strings, which Laravel emits for some columns", () => {
    const q = parseQuote({ order_amount: "6135.00", delivery_charge: "900" });
    expect(q.total).toBe(6135);
    expect(q.deliveryCharge).toBe(900);
  });

  it("defaults to zero rather than NaN on a partial body", () => {
    const q = parseQuote({});
    expect(q.total).toBe(0);
    expect(q.deliveryCharge).toBe(0);
    expect(q.subtotal).toBe(0);
  });

  it("surfaces who granted free delivery so the row can say so", () => {
    const q = parseQuote({
      delivery_charge: 0,
      pricing_breakdown: { breakdown: { free_delivery_by: "admin" } },
    });
    expect(q.deliveryCharge).toBe(0);
    expect(q.freeDeliveryBy).toBe("admin");
  });
});
