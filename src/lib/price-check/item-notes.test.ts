import { describe, expect, it } from "vitest";
import { applyLineNote, buildItemNotes } from "./item-notes";
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

describe("applyLineNote", () => {
  const lineA = line({ key: "5|a", itemId: 5, note: "No onions" });
  const lineB = line({ key: "5|b", itemId: 5, note: "No onions" });
  const other = line({ key: "9", itemId: 9, note: "Ripe" });

  it("clears the note from every line of the item, not just the keyed one", () => {
    // The cart shows one note per item on all of that item's lines, so a
    // note left behind on a sibling would re-render into the field the
    // customer just emptied.
    const next = applyLineNote([lineA, lineB, other], "5|b", "");
    expect(buildItemNotes(next)).toEqual({ "9": "Ripe" });
  });

  it("writes a note to every line of the item", () => {
    const next = applyLineNote([lineA, lineB, other], "5|a", "Extra ice");
    expect(next.filter((l) => l.itemId === 5).map((l) => l.note)).toEqual([
      "Extra ice",
      "Extra ice",
    ]);
  });

  it("leaves other items alone", () => {
    const next = applyLineNote([lineA, other], "5|a", "");
    expect(next.find((l) => l.itemId === 9)?.note).toBe("Ripe");
  });

  it("trims and truncates the same way the request payload does", () => {
    const next = applyLineNote([lineA], "5|a", "  " + "x".repeat(300) + "  ");
    expect(next[0].note).toBe("x".repeat(255));
  });

  it("does nothing when the key names no line", () => {
    const lines = [lineA, other];
    expect(applyLineNote(lines, "nope", "")).toBe(lines);
  });
});
