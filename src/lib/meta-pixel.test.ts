import { afterEach, describe, expect, it, vi } from "vitest";
import {
  claimPurchase,
  parseAmount,
  purchaseEventId,
  trackPixel,
} from "./meta-pixel";

type G = { window?: { fbq?: unknown } };

afterEach(() => {
  delete (globalThis as unknown as G).window;
});

describe("trackPixel", () => {
  it("is a no-op without a window (server render)", () => {
    expect(trackPixel("PageView")).toBe(false);
  });

  it("is a no-op when the pixel script is not on the page", () => {
    (globalThis as unknown as G).window = {};
    expect(trackPixel("AddToCart", { value: 1500, currency: "NGN" })).toBe(false);
  });

  it("forwards the event and params to fbq", () => {
    const fbq = vi.fn();
    (globalThis as unknown as G).window = { fbq };
    expect(trackPixel("AddToCart", { value: 1500, currency: "NGN" })).toBe(true);
    expect(fbq).toHaveBeenCalledWith("track", "AddToCart", { value: 1500, currency: "NGN" });
  });

  it("sends the eventID in the options argument so CAPI can deduplicate", () => {
    const fbq = vi.fn();
    (globalThis as unknown as G).window = { fbq };
    trackPixel("Purchase", { value: 4200, currency: "NGN" }, purchaseEventId(77));
    expect(fbq).toHaveBeenCalledWith(
      "track",
      "Purchase",
      { value: 4200, currency: "NGN" },
      { eventID: "order-77" },
    );
  });
});

describe("claimPurchase", () => {
  function memoryStorage() {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    };
  }

  it("allows the first claim and refuses a repeat for the same order", () => {
    const s = memoryStorage();
    expect(claimPurchase(77, s)).toBe(true);
    expect(claimPurchase(77, s)).toBe(false);
    expect(claimPurchase(78, s)).toBe(true);
  });

  it("allows the event when storage is missing or broken", () => {
    expect(claimPurchase(77, null)).toBe(true);
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
    };
    expect(claimPurchase(77, broken)).toBe(true);
  });
});

describe("parseAmount", () => {
  it("reads a numeric query value and rejects the rest", () => {
    expect(parseAmount("4200")).toBe(4200);
    expect(parseAmount("4200.5")).toBe(4200.5);
    expect(parseAmount("0")).toBe(0);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
  });
});
