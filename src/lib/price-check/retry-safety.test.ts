import { describe, expect, it } from "vitest";
import { retryDecision } from "./retry-safety";
import type { OrderTrack, OrderTrackResult } from "@/lib/api/orders";

function trackOk(payment_status: string): OrderTrackResult {
  return {
    ok: true,
    order: {
      id: 1,
      order_amount: 5000,
      order_status: "price_confirmed",
      payment_status,
      created_at: "2026-09-09T10:00:00.000000Z",
    } as OrderTrack,
  };
}

describe("retryDecision", () => {
  it("allows another charge only on a completed read that says unpaid", () => {
    expect(retryDecision(trackOk("unpaid"))).toBe("retry");
  });

  it("never offers a retry once the order reads as paid", () => {
    // The popup can report "cancelled" on the bank-transfer and USSD
    // channels while the money is already moving, so this is the read
    // that matters, not the popup's own answer.
    expect(retryDecision(trackOk("paid"))).toBe("paid");
  });

  it("treats a failed read as unknown rather than as not paid", () => {
    expect(retryDecision({ ok: false, message: "Network error" })).toBe(
      "unknown",
    );
  });

  it("treats an unmodelled payment status as unknown", () => {
    expect(retryDecision(trackOk("partially_paid"))).toBe("unknown");
  });
});
