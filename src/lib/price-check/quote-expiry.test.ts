import { describe, expect, it } from "vitest";
import { quoteScreenState, reRequestHref } from "./quote-expiry";
import type { PendingQuotePayment } from "./pending-payment";
import type { OrderStatus } from "@/lib/api/orders";

const DEADLINE = "2026-09-09T10:02:00.000Z";
const BEFORE = new Date("2026-09-09T10:01:00.000Z");
const AFTER = new Date("2026-09-09T10:03:00.000Z");
/** Later than the window paymentAccounting allows a started payment. */
const LONG_AFTER = new Date("2026-09-09T11:00:00.000Z");

function record(over: Partial<PendingQuotePayment> = {}): PendingQuotePayment {
  return {
    orderId: 7,
    orderAmount: 5000,
    method: "digital_payment",
    startedAt: BEFORE.getTime(),
    charged: false,
    ...over,
  };
}

function order(
  over: {
    order_status?: OrderStatus;
    payment_status?: string;
    offlineStatus?: string;
  } = {},
) {
  return {
    order_status: over.order_status ?? ("price_confirmed" as OrderStatus),
    payment_status: over.payment_status ?? "unpaid",
    offline_payment: over.offlineStatus
      ? { data: { status: over.offlineStatus } }
      : null,
  };
}

function state(over: {
  order?: ReturnType<typeof order>;
  now?: Date;
  serverSaidExpired?: boolean;
  record?: PendingQuotePayment | null;
}) {
  return quoteScreenState({
    order: over.order ?? order(),
    expiresAt: DEADLINE,
    now: over.now ?? BEFORE,
    serverSaidExpired: over.serverSaidExpired ?? false,
    record: over.record ?? null,
  });
}

describe("quoteScreenState", () => {
  it("shows the review list while the deadline is ahead", () => {
    expect(state({})).toBe("payable");
  });

  it("expires once the local clock passes the deadline", () => {
    expect(state({ now: AFTER })).toBe("expired");
  });

  it("takes the server's refusal even while the local clock shows time left", () => {
    // A slow browser clock puts the two apart, and the deadline the server
    // enforces is the only one that decides whether a quote can be paid.
    expect(state({ serverSaidExpired: true })).toBe("expired");
  });

  it("says nothing about expiry while a payment this browser started is unaccounted for", () => {
    // The sweep cannot see an open gateway session. A capture that lands
    // reopens the order server-side, so calling it expired here could tell
    // a charged customer that nothing was charged.
    expect(state({ now: AFTER, record: record() })).toBe("verifying");
  });

  it("holds back the cancelled order too, not just the expired copy", () => {
    expect(
      state({ order: order({ order_status: "canceled" }), record: record() }),
    ).toBe("verifying");
  });

  it("shows the expired copy once a started payment has gone stale", () => {
    // The order the sweep cancelled cannot be paid, so once the window
    // passes with no settlement the customer is told where they stand.
    expect(
      state({
        order: order({ order_status: "canceled" }),
        now: LONG_AFTER,
        record: record(),
      }),
    ).toBe("expired");
  });

  it("never offers a second payment while a bank transfer is waiting to be matched", () => {
    // The customer has already sent the money. Offering a card here takes
    // a second payment for one order and leaves a refund to chase.
    expect(
      state({
        order: order({ offlineStatus: "pending" }),
        record: record(),
      }),
    ).toBe("offline-pending");
  });

  it("holds back on a verified transfer the order has not caught up with", () => {
    expect(
      state({ order: order({ offlineStatus: "verified" }), record: record() }),
    ).toBe("offline-pending");
  });

  it("ignores a transfer that was denied, which is what the customer must fix", () => {
    expect(
      state({ order: order({ offlineStatus: "denied" }), record: record() }),
    ).toBe("owes-payment");
  });

  it("gives a known charge its own state ahead of everything else", () => {
    // Both sides of the same missing state: past the deadline it must not
    // offer to request again, and before it, it must not offer to accept.
    expect(state({ now: AFTER, record: record({ charged: true }) })).toBe(
      "charged",
    );
    expect(state({ record: record({ charged: true }) })).toBe("charged");
    expect(
      state({
        order: order({ order_status: "canceled" }),
        record: record({ charged: true }),
      }),
    ).toBe("charged");
  });

  it("drops the charged state once the order reads paid", () => {
    expect(
      state({
        order: order({ payment_status: "paid" }),
        record: record({ charged: true }),
      }),
    ).toBe("unavailable");
  });

  it("offers payment for an order this browser accepted but did not pay", () => {
    expect(state({ record: record() })).toBe("owes-payment");
  });

  it("offers payment past the deadline too: the accepted total is fixed", () => {
    expect(state({ now: LONG_AFTER, record: record() })).toBe("owes-payment");
  });

  it("separates an unpriced order from one that is no longer answerable", () => {
    expect(state({ order: order({ order_status: "price_check" }) })).toBe(
      "not-priced",
    );
    expect(state({ order: order({ order_status: "delivered" }) })).toBe(
      "unavailable",
    );
  });

  it("reads a cancelled order as the expiry it usually is", () => {
    expect(state({ order: order({ order_status: "canceled" }) })).toBe(
      "expired",
    );
  });

  it("treats a missing deadline as no deadline", () => {
    expect(
      quoteScreenState({
        order: order(),
        expiresAt: null,
        now: AFTER,
        serverSaidExpired: false,
        record: null,
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
