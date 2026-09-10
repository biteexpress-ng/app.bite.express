import { describe, expect, it } from "vitest";
import {
  buildAcceptPayload, estimatedQuoteTotal, isQuoteExpired,
  quoteExpiresAt, rescaledTax, toQuoteLines, type QuoteLine,
} from "./quote-line";

const CHARGES = { deliveryCharge: 500, additionalCharge: 300, extraPackaging: 0, dmTips: 0 };

function ql(over: Partial<QuoteLine>): QuoteLine {
  return {
    detailId: 1, itemId: 10, name: "Chick Egg", requestedQty: 1,
    requestedPrice: 7000, quotedPrice: 9500, availableQuantity: 1,
    isAvailable: true, note: null, taxAmount: 0, ...over,
  };
}

describe("toQuoteLines", () => {
  it("reads the quote fields off each line", () => {
    const [line] = toQuoteLines([{
      id: 55301, item_id: 8801, price: 9000, quantity: 2,
      quoted_price: 9750, available_quantity: 2, is_available: true,
      customer_note: "5kg bag", tax_amount: 100,
      item_details: JSON.stringify({ name: "Rice" }),
    }]);
    expect(line.detailId).toBe(55301);
    expect(line.requestedPrice).toBe(9000);
    expect(line.quotedPrice).toBe(9750);
    expect(line.availableQuantity).toBe(2);
    expect(line.note).toBe("5kg bag");
    expect(line.name).toBe("Rice");
  });

  it("treats a line the store marked unavailable as unavailable", () => {
    const [line] = toQuoteLines([{
      id: 1, price: 100, quantity: 1, quoted_price: 100,
      available_quantity: 0, is_available: false,
    }]);
    expect(line.isAvailable).toBe(false);
  });

  it("treats available_quantity 0 as unavailable even when is_available is true", () => {
    // Contract 6.1 step 2 deletes both on accept, so the screen must
    // present them the same way.
    const [line] = toQuoteLines([{
      id: 1, price: 100, quantity: 1, quoted_price: 100,
      available_quantity: 0, is_available: true,
    }]);
    expect(line.isAvailable).toBe(false);
  });
});

describe("quoteExpiresAt", () => {
  it("reads it from the first row only", () => {
    expect(quoteExpiresAt([
      { id: 1, price: 1, quantity: 1, quote_expires_at: "2026-09-09T16:25:55.000000Z" },
      { id: 2, price: 1, quantity: 1, quote_expires_at: "2026-01-01T00:00:00.000000Z" },
    ])).toBe("2026-09-09T16:25:55.000000Z");
  });

  it("is null on an empty list and when the key is absent", () => {
    expect(quoteExpiresAt([])).toBeNull();
    expect(quoteExpiresAt([{ id: 1, price: 1, quantity: 1 }])).toBeNull();
  });
});

describe("isQuoteExpired", () => {
  it("is false before the deadline and true after it", () => {
    const at = "2026-09-09T16:00:00.000000Z";
    expect(isQuoteExpired(at, new Date("2026-09-09T15:59:00Z"))).toBe(false);
    expect(isQuoteExpired(at, new Date("2026-09-09T16:01:00Z"))).toBe(true);
  });

  it("is false when there is no deadline", () => {
    expect(isQuoteExpired(null, new Date())).toBe(false);
  });

  it("is false when the deadline is unparseable, so a bad string cannot lock a payable quote", () => {
    expect(isQuoteExpired("not a date", new Date())).toBe(false);
  });
});

describe("rescaledTax", () => {
  it("scales tax by the line's own price and quantity change", () => {
    // 3 at 100 taxed 30, cut to 2 at 150: 300 -> 300, so tax holds at 30.
    expect(rescaledTax(ql({
      requestedQty: 3, requestedPrice: 100, quotedPrice: 150,
      availableQuantity: 2, taxAmount: 30,
    }))).toBeCloseTo(30);
  });

  it("returns 0 when the original line total was zero", () => {
    expect(rescaledTax(ql({ requestedPrice: 0, taxAmount: 5 }))).toBe(0);
  });
});

describe("estimatedQuoteTotal", () => {
  it("sums the ticked lines and adds the carried charges", () => {
    const lines = [
      ql({ detailId: 1, quotedPrice: 9500, availableQuantity: 2 }),
      ql({ detailId: 2, quotedPrice: 4200, availableQuantity: 1 }),
    ];
    expect(estimatedQuoteTotal(lines, new Set([1, 2]), CHARGES)).toBe(24000);
  });

  it("drops an unticked line by exactly its line value", () => {
    const lines = [
      ql({ detailId: 1, quotedPrice: 9500, availableQuantity: 2 }),
      ql({ detailId: 2, quotedPrice: 4200, availableQuantity: 1 }),
    ];
    expect(estimatedQuoteTotal(lines, new Set([1]), CHARGES)).toBe(19800);
  });

  it("never counts a line the store cannot supply, ticked or not", () => {
    const lines = [
      ql({ detailId: 1, quotedPrice: 9500, availableQuantity: 2 }),
      ql({ detailId: 2, quotedPrice: 4200, availableQuantity: 0, isAvailable: false }),
    ];
    expect(estimatedQuoteTotal(lines, new Set([1, 2]), CHARGES)).toBe(19800);
  });

  it("still charges delivery when every line is dropped", () => {
    // The screen blocks this before accept, but the arithmetic must not
    // silently produce a negative or a zero that reads as "free".
    expect(estimatedQuoteTotal([ql({})], new Set(), CHARGES)).toBe(800);
  });

  it("adds the tax term when the quote leaves price and quantity unchanged", () => {
    // requestedQty 2 * requestedPrice 500 = 1000, quotedPrice 500 *
    // availableQuantity 2 = 1000: rescale factor is exactly 1, so the
    // tax of 80 passes through untouched.
    // Line value: 500 * 2 + 80 = 1080. Total: 1080 + 800 (CHARGES) = 1880.
    // A mutant that drops `total += rescaledTax(line)` would compute 1800.
    const line = ql({
      detailId: 1, requestedQty: 2, requestedPrice: 500,
      quotedPrice: 500, availableQuantity: 2, taxAmount: 80,
    });
    expect(estimatedQuoteTotal([line], new Set([1]), CHARGES)).toBe(1880);
  });

  it("rescales the tax term when the quote changes price or quantity", () => {
    // requestedQty 4 * requestedPrice 200 = 800 (original total), quotedPrice
    // 200 * availableQuantity 2 = 400 (quoted total): rescale factor 1/2, so
    // taxAmount 100 becomes 100 * 400 / 800 = 50.
    // Line value: 200 * 2 + 50 = 450. Total: 450 + 800 (CHARGES) = 1250.
    // A mutant that drops the tax term entirely would compute 1200; one that
    // passes taxAmount through unscaled would compute 400 + 100 + 800 = 1300.
    const line = ql({
      detailId: 1, requestedQty: 4, requestedPrice: 200,
      quotedPrice: 200, availableQuantity: 2, taxAmount: 100,
    });
    expect(estimatedQuoteTotal([line], new Set([1]), CHARGES)).toBe(1250);
  });

  it("contributes no tax for a line the store cannot supply, even with a large tax amount", () => {
    const lines = [
      ql({ detailId: 1, quotedPrice: 1000, availableQuantity: 1, taxAmount: 0 }),
      ql({
        detailId: 2, quotedPrice: 500, availableQuantity: 0,
        isAvailable: false, taxAmount: 999,
      }),
    ];
    // Line 1 alone: 1000 + 0 = 1000. Plus CHARGES 800 = 1800. Line 2's
    // tax of 999 must not leak into the total despite being ticked.
    expect(estimatedQuoteTotal(lines, new Set([1, 2]), CHARGES)).toBe(1800);
  });
});

describe("buildAcceptPayload", () => {
  it("sends the unticked detail ids, not item ids", () => {
    const lines = [ql({ detailId: 55301, itemId: 8801 }), ql({ detailId: 55302, itemId: 8815 })];
    const payload = buildAcceptPayload(90211, lines, new Set([55301]), "cash_on_delivery");
    expect(payload.order_id).toBe(90211);
    expect(payload.excluded_detail_ids).toEqual([55302]);
    expect(payload.payment_method).toBe("cash_on_delivery");
  });

  it("also excludes lines the store cannot supply", () => {
    const lines = [ql({ detailId: 1 }), ql({ detailId: 2, isAvailable: false, availableQuantity: 0 })];
    const payload = buildAcceptPayload(1, lines, new Set([1]), "wallet");
    expect(payload.excluded_detail_ids).toEqual([2]);
  });

  it("omits payment_method when the customer has not chosen one", () => {
    const payload = buildAcceptPayload(1, [ql({ detailId: 1 })], new Set([1]), null);
    expect("payment_method" in payload).toBe(false);
  });
});
