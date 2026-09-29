import { describe, expect, it } from "vitest";
import type { OrderQuote } from "@/lib/api/order-quote";
import { recheckPrice } from "./price-recheck";

function quote(total: number): OrderQuote {
  return {
    subtotal: 5000,
    productDiscount: 0,
    couponDiscount: 0,
    deliveryCharge: total - 5000,
    freeDeliveryBy: null,
    additionalCharge: 0,
    extraPackaging: 0,
    taxAmount: 0,
    taxIncluded: false,
    dmTips: 0,
    total,
  };
}

describe("recheckPrice", () => {
  it("places when the fresh total matches the one on screen", () => {
    expect(recheckPrice(6200, { ok: true, quote: quote(6200) })).toEqual({ kind: "place" });
  });

  it("ignores kobo-level drift that the screen rounds away", () => {
    expect(recheckPrice(6200.4, { ok: true, quote: quote(6199.6) })).toEqual({ kind: "place" });
  });

  it("stops and shows the new total when a surge started after the screen priced it", () => {
    const d = recheckPrice(6200, { ok: true, quote: quote(6900) });
    expect(d.kind).toBe("changed");
    if (d.kind !== "changed") return;
    expect(d.quote.total).toBe(6900);
    expect(d.message).toBe(
      "The total went up from ₦6,200 to ₦6,900 while you were checking out. Check the new total, then place your order again.",
    );
  });

  it("also stops when the total went down, so the screen never shows a stale figure", () => {
    const d = recheckPrice(6900, { ok: true, quote: quote(6200) });
    expect(d.kind).toBe("changed");
    if (d.kind !== "changed") return;
    expect(d.message).toBe(
      "The total went down from ₦6,900 to ₦6,200 while you were checking out. Check the new total, then place your order again.",
    );
  });

  it("stops when no total was on screen, so nothing is charged unseen", () => {
    const d = recheckPrice(null, { ok: true, quote: quote(6200) });
    expect(d.kind).toBe("changed");
    if (d.kind !== "changed") return;
    expect(d.message).toBe("Your total is ₦6,200. Check it, then place your order again.");
  });

  it("refuses to place when the price could not be confirmed", () => {
    expect(recheckPrice(6200, { ok: false, message: "We couldn't reach BiteExpress." })).toEqual({
      kind: "failed",
      message: "We couldn't reach BiteExpress.",
    });
  });

  it("never shows an empty failure message", () => {
    const d = recheckPrice(6200, { ok: false, message: "" });
    expect(d).toEqual({
      kind: "failed",
      message: "We couldn't confirm the latest price. Please try again.",
    });
  });
});
