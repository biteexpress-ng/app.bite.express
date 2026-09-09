import { describe, expect, it } from "vitest";
import {
  PAYMENT_ACCOUNTING_WINDOW_MS,
  canOfferPayment,
  parsePendingPayment,
  paymentAccounting,
  pendingPaymentKey,
  pendingPaymentResolved,
  type PendingQuotePayment,
} from "./pending-payment";
import type { OrderStatus } from "@/lib/api/orders";

const START = new Date("2026-09-09T10:00:00.000Z").getTime();

function record(over: Partial<PendingQuotePayment> = {}): PendingQuotePayment {
  return {
    orderId: 7,
    orderAmount: 5000,
    method: "digital_payment",
    startedAt: START,
    charged: false,
    ...over,
  };
}

function read(order_status: OrderStatus, payment_status: string) {
  return { order_status, payment_status };
}

describe("parsePendingPayment", () => {
  it("reads back a record it wrote for the same order", () => {
    const parsed = parsePendingPayment(JSON.stringify(record()), 7);
    expect(parsed).toEqual(record());
  });

  it("refuses a record stored against a different order", () => {
    expect(parsePendingPayment(JSON.stringify(record()), 8)).toBeNull();
  });

  it("refuses malformed or absent storage rather than guessing", () => {
    expect(parsePendingPayment(null, 7)).toBeNull();
    expect(parsePendingPayment("not json", 7)).toBeNull();
    expect(parsePendingPayment("[]", 7)).toBeNull();
    expect(
      parsePendingPayment(JSON.stringify({ ...record(), orderAmount: "5000" }), 7),
    ).toBeNull();
  });

  it("treats a missing charged flag as not charged", () => {
    const stored = JSON.stringify({ ...record(), charged: undefined });
    expect(parsePendingPayment(stored, 7)?.charged).toBe(false);
  });

  it("keys storage by order so two orders cannot overwrite each other", () => {
    expect(pendingPaymentKey(7)).not.toBe(pendingPaymentKey(8));
  });
});

describe("pendingPaymentResolved", () => {
  it("counts a paid read as accounting for the payment", () => {
    expect(pendingPaymentResolved(read("price_confirmed", "paid"))).toBe(true);
  });

  it("counts settlement past price_confirmed, which is how cash on delivery ends", () => {
    expect(pendingPaymentResolved(read("pending", "unpaid"))).toBe(true);
  });

  it("never counts a cancelled order, which is what the expiry sweep leaves", () => {
    // The sweep cannot see an open gateway session, so a capture can still
    // land here and the server will settle it.
    expect(pendingPaymentResolved(read("canceled", "unpaid"))).toBe(false);
  });

  it("does not count an accepted order still waiting to be paid", () => {
    expect(pendingPaymentResolved(read("price_confirmed", "unpaid"))).toBe(false);
  });
});

describe("paymentAccounting", () => {
  it("is none when this browser started no payment", () => {
    expect(paymentAccounting(null, read("canceled", "unpaid"), new Date(START))).toBe(
      "none",
    );
  });

  it("is unaccounted while a started payment could still land on a cancelled order", () => {
    expect(
      paymentAccounting(
        record(),
        read("canceled", "unpaid"),
        new Date(START + PAYMENT_ACCOUNTING_WINDOW_MS),
      ),
    ).toBe("unaccounted");
  });

  it("goes stale once the window passes with no settlement", () => {
    expect(
      paymentAccounting(
        record(),
        read("canceled", "unpaid"),
        new Date(START + PAYMENT_ACCOUNTING_WINDOW_MS + 1),
      ),
    ).toBe("stale");
  });

  it("is none again once the read accounts for the payment", () => {
    expect(
      paymentAccounting(record(), read("confirmed", "paid"), new Date(START + 1000)),
    ).toBe("none");
  });
});

describe("canOfferPayment", () => {
  it("offers payment for an accepted order that is still unpaid", () => {
    expect(canOfferPayment(record(), read("price_confirmed", "unpaid"))).toBe(true);
  });

  it("never offers payment once a gateway told us it captured money", () => {
    expect(
      canOfferPayment(record({ charged: true }), read("price_confirmed", "unpaid")),
    ).toBe(false);
  });

  it("stops offering payment once the order is paid or has moved on", () => {
    expect(canOfferPayment(record(), read("price_confirmed", "paid"))).toBe(false);
    expect(canOfferPayment(record(), read("pending", "unpaid"))).toBe(false);
  });

  it("offers nothing without a record: no accept of ours, no total to charge", () => {
    expect(canOfferPayment(null, read("price_confirmed", "unpaid"))).toBe(false);
  });
});
