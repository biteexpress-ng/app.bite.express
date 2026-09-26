import { describe, expect, it } from "vitest";
import { toWireCart } from "./orders";
import { cartKeyFor } from "@/lib/food-variations";
import type { CartLine } from "@/lib/cart-store";

function line(over: Partial<CartLine>): CartLine {
  return {
    key: "1", itemId: 1, storeId: 280, name: "Peak Powdered Milk", unitPrice: 7500,
    qty: 2, selections: [], addOns: [], ...over,
  };
}

describe("toWireCart with a legacy size", () => {
  it("sends the size the way PlaceNewOrder reads it: variation[0].type", () => {
    const [wire] = toWireCart([line({ variant: { type: "400gtin", label: "400g tin" } })]);
    expect(wire.variation).toEqual([{ type: "400gtin" }]);
    expect(wire.variant).toBe("400gtin");
  });

  it("leaves food lines exactly as before", () => {
    const [wire] = toWireCart([
      line({ selections: [{ name: "Choice", values: ["Jollof Rice"] }] }),
    ]);
    expect(wire.variation).toEqual([{ name: "Choice", values: { label: ["Jollof Rice"] } }]);
    expect(wire.variant).toBe("");
  });

  it("sends an empty variation list for a plain item", () => {
    const [wire] = toWireCart([line({})]);
    expect(wire.variation).toEqual([]);
    expect(wire.variant).toBe("");
  });
});

describe("cartKeyFor with a legacy size", () => {
  it("keeps two sizes of the same product as separate lines", () => {
    expect(cartKeyFor(1, [], [], "400gtin")).not.toBe(cartKeyFor(1, [], [], "850gtin"));
  });

  it("merges repeat adds of the same size", () => {
    expect(cartKeyFor(1, [], [], "400gtin")).toBe(cartKeyFor(1, [], [], "400gtin"));
  });

  it("does not change keys for lines without a size", () => {
    expect(cartKeyFor(7, [])).toBe("7");
    expect(cartKeyFor(7, [{ name: "Choice", values: ["A"] }])).toBe("7|Choice=A");
  });
});
