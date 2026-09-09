import { describe, expect, it } from "vitest";
import { isPriceRequestCart } from "./eligibility";

describe("isPriceRequestCart", () => {
  it("is true only when the server says the store is enabled", () => {
    expect(isPriceRequestCart({ price_check_enabled: true })).toBe(true);
  });

  it("is false when the store is not enabled", () => {
    expect(isPriceRequestCart({ price_check_enabled: false })).toBe(false);
  });

  it("is false when the key is absent, which is every store today", () => {
    expect(isPriceRequestCart({})).toBe(false);
  });

  it("is false when the store has not loaded yet", () => {
    // The cart renders before its fetch resolves. Defaulting to the
    // ordinary checkout means a slow network shows the familiar button
    // rather than flickering into a flow the store may not offer.
    expect(isPriceRequestCart(null)).toBe(false);
    expect(isPriceRequestCart(undefined)).toBe(false);
  });
});
