import { describe, expect, it } from "vitest";
import { quoteAvailability, reRequestHref } from "./quote-expiry";

const DEADLINE = "2026-09-09T10:02:00.000Z";
const BEFORE = new Date("2026-09-09T10:01:00.000Z");
const AFTER = new Date("2026-09-09T10:03:00.000Z");

describe("quoteAvailability", () => {
  it("stays payable while the deadline is ahead", () => {
    expect(
      quoteAvailability({
        expiresAt: DEADLINE,
        now: BEFORE,
        serverSaidExpired: false,
        payment: "none",
      }),
    ).toBe("payable");
  });

  it("expires once the local clock passes the deadline", () => {
    expect(
      quoteAvailability({
        expiresAt: DEADLINE,
        now: AFTER,
        serverSaidExpired: false,
        payment: "none",
      }),
    ).toBe("expired");
  });

  it("takes the server's refusal even while the local clock shows time left", () => {
    // A slow browser clock puts the two apart, and the deadline the server
    // enforces is the only one that decides whether a quote can be paid.
    expect(
      quoteAvailability({
        expiresAt: DEADLINE,
        now: BEFORE,
        serverSaidExpired: true,
        payment: "none",
      }),
    ).toBe("expired");
  });

  it("says nothing about expiry while a payment this browser started is unaccounted for", () => {
    // The sweep cannot see an open gateway session. A capture that lands
    // reopens the order server-side, so calling it expired here could tell
    // a charged customer that nothing was charged.
    expect(
      quoteAvailability({
        expiresAt: DEADLINE,
        now: AFTER,
        serverSaidExpired: true,
        payment: "unaccounted",
      }),
    ).toBe("verifying");
  });

  it("shows the expired copy once a started payment has gone stale", () => {
    expect(
      quoteAvailability({
        expiresAt: DEADLINE,
        now: AFTER,
        serverSaidExpired: false,
        payment: "stale",
      }),
    ).toBe("expired");
  });

  it("leaves a payable quote alone even with a payment in flight", () => {
    expect(
      quoteAvailability({
        expiresAt: DEADLINE,
        now: BEFORE,
        serverSaidExpired: false,
        payment: "unaccounted",
      }),
    ).toBe("payable");
  });

  it("treats a missing deadline as no deadline", () => {
    expect(
      quoteAvailability({
        expiresAt: null,
        now: AFTER,
        serverSaidExpired: false,
        payment: "none",
      }),
    ).toBe("payable");
  });
});

describe("reRequestHref", () => {
  it("sends the customer to the store to price a fresh list", () => {
    expect(reRequestHref(42)).toBe("/store/42");
  });

  it("falls back to the home page when the order carries no store", () => {
    expect(reRequestHref(null)).toBe("/");
    expect(reRequestHref(undefined)).toBe("/");
  });
});
