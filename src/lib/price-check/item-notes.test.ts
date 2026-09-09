import { describe, expect, it } from "vitest";
import { buildItemNotes } from "./item-notes";
import type { CartLine } from "@/lib/cart-store";

function line(over: Partial<CartLine>): CartLine {
  return {
    key: "1", itemId: 1, storeId: 40, name: "Rice", unitPrice: 100,
    qty: 1, selections: [], addOns: [], ...over,
  };
}

describe("buildItemNotes", () => {
  it("keys by item_id, not by cart key", () => {
    expect(buildItemNotes([line({ key: "8801|large", itemId: 8801, note: "5kg bag" })]))
      .toEqual({ "8801": "5kg bag" });
  });

  it("omits lines with no note", () => {
    expect(buildItemNotes([line({ itemId: 1 }), line({ key: "2", itemId: 2, note: "Ripe" })]))
      .toEqual({ "2": "Ripe" });
  });

  it("omits notes that are only whitespace, and trims the rest", () => {
    expect(buildItemNotes([line({ itemId: 1, note: "   " }), line({ key: "2", itemId: 2, note: "  Ripe  " })]))
      .toEqual({ "2": "Ripe" });
  });

  it("collapses two lines of the same item to one note, last non-empty wins", () => {
    expect(buildItemNotes([
      line({ key: "5|a", itemId: 5, note: "first" }),
      line({ key: "5|b", itemId: 5, note: "second" }),
    ])).toEqual({ "5": "second" });
  });

  it("does not let a later empty note erase an earlier one", () => {
    expect(buildItemNotes([
      line({ key: "5|a", itemId: 5, note: "keep me" }),
      line({ key: "5|b", itemId: 5 }),
    ])).toEqual({ "5": "keep me" });
  });

  it("truncates to the server's 255-character limit", () => {
    const notes = buildItemNotes([line({ itemId: 1, note: "x".repeat(300) })]);
    expect(notes["1"]).toHaveLength(255);
  });

  it("returns an empty object when nothing is noted", () => {
    expect(buildItemNotes([line({}), line({ key: "2", itemId: 2 })])).toEqual({});
  });
});
