import { describe, expect, it } from "vitest";
import {
  canShowReminderOn,
  parseRatedOrders,
  rateableItems,
  riderComment,
  starLabel,
  withRatedOrder,
} from "./review-state";

describe("rateableItems", () => {
  it("keeps one entry per item and drops lines without an item id", () => {
    const items = rateableItems([
      { id: 1, item_id: 10, item_details: { name: "Jollof", image_full_url: "a.png" } },
      { id: 2, item_id: 10, item_details: { name: "Jollof" } },
      { id: 3, item_id: null, item_details: { name: "Campaign deal" } },
      { id: 4, item_id: 11, item_details: '{"name":"Plantain"}' },
    ]);
    expect(items).toEqual([
      { itemId: 10, name: "Jollof", imageUrl: "a.png" },
      { itemId: 11, name: "Plantain", imageUrl: null },
    ]);
  });

  it("falls back to a placeholder name when the snapshot is unreadable", () => {
    expect(rateableItems([{ id: 1, item_id: 5, item_details: "{bad" }])[0].name).toBe("Item #5");
  });
});

describe("rated order memory", () => {
  it("tolerates junk in storage", () => {
    expect(parseRatedOrders(null)).toEqual([]);
    expect(parseRatedOrders("nope")).toEqual([]);
    expect(parseRatedOrders('{"a":1}')).toEqual([]);
    expect(parseRatedOrders('[1,"2",-3,"x"]')).toEqual([1, 2]);
  });

  it("dedupes and caps the list, keeping the newest", () => {
    expect(withRatedOrder([1, 2, 3], 2)).toEqual([1, 3, 2]);
    const long = Array.from({ length: 200 }, (_, i) => i + 1);
    const next = withRatedOrder(long, 999);
    expect(next).toHaveLength(200);
    expect(next[0]).toBe(2);
    expect(next.at(-1)).toBe(999);
  });
});

describe("canShowReminderOn", () => {
  it("stays off checkout, auth, cart and an open order", () => {
    expect(canShowReminderOn("/checkout")).toBe(false);
    expect(canShowReminderOn("/checkout/success")).toBe(false);
    expect(canShowReminderOn("/signin")).toBe(false);
    expect(canShowReminderOn("/cart")).toBe(false);
    expect(canShowReminderOn("/orders/12")).toBe(false);
  });

  it("shows on browsing pages", () => {
    expect(canShowReminderOn("/")).toBe(true);
    expect(canShowReminderOn("/browse")).toBe(true);
    expect(canShowReminderOn("/orders")).toBe(true);
    expect(canShowReminderOn("/cartography")).toBe(true);
  });
});

describe("riderComment", () => {
  it("joins tags and typed text", () => {
    expect(riderComment(["On time", "Friendly"], "  Thanks!  ")).toBe("On time. Friendly. Thanks!");
    expect(riderComment([], "")).toBe("");
  });
});

describe("starLabel", () => {
  it("labels 1 to 5 and nothing else", () => {
    expect(starLabel(0)).toBe("");
    expect(starLabel(1)).toBe("Terrible");
    expect(starLabel(5)).toBe("Great");
  });
});
