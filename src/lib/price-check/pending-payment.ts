import type { OrderStatus } from "@/lib/api/orders";

/**
 * The record of a quote this browser accepted and then tried to pay for.
 *
 * It exists for two reasons, and both of them outlive a page load:
 *
 *  1. Accept and payment are separate calls. A customer who accepts and
 *     then fails to pay owns an accepted, unpaid order, and reloading the
 *     page must not lose the route back to paying it.
 *  2. The expiry sweep cannot see an open gateway session. A payment
 *     opened a few minutes before the deadline can land on an order the
 *     sweep has already cancelled, and the server settles it: it reopens
 *     the quote and takes the order through normal settlement. So until a
 *     read accounts for that payment, this client may not say the order
 *     expired or was cancelled, and may not offer to start over.
 */
export type PendingQuotePayment = {
  orderId: number;
  /** The total the accept call left on the order. Never recomputed here. */
  orderAmount: number;
  /** The method the last payment attempt used. The customer may pick
   *  another one for the next attempt. */
  method: string;
  /** Epoch ms of the last payment attempt, used to bound how long an
   *  unaccounted payment holds back the expired and cancelled copy. */
  startedAt: number;
  /** True once a gateway told us it captured money, whatever this client
   *  then failed to do with that answer. A charged order is never offered
   *  a "pay" button. */
  charged: boolean;
};

/**
 * How long a payment with no accounting for it keeps the expired and
 * cancelled copy off the screen. Long enough to cover a slow webhook and
 * the server's own settlement of a late capture, short enough that an
 * abandoned popup does not leave the order in limbo for good.
 */
export const PAYMENT_ACCOUNTING_WINDOW_MS = 15 * 60 * 1000;

export function pendingPaymentKey(orderId: number): string {
  return `bx.price-check.payment.${orderId}`;
}

export function parsePendingPayment(
  raw: string | null,
  orderId: number,
): PendingQuotePayment | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  if (record.orderId !== orderId) return null;
  if (typeof record.orderAmount !== "number") return null;
  if (!Number.isFinite(record.orderAmount)) return null;
  if (typeof record.method !== "string") return null;
  if (typeof record.startedAt !== "number") return null;
  return {
    orderId,
    orderAmount: record.orderAmount,
    method: record.method,
    startedAt: record.startedAt,
    charged: record.charged === true,
  };
}

type SettlementRead = {
  order_status: OrderStatus;
  payment_status: string;
  /** Manual bank transfer state, from the same `track` payload. Present on
   *  every order and null on the ones that never used it. */
  offline_payment?: { data?: { status?: string | null } | null } | null;
};

/**
 * Statuses that say nothing about where the money went.
 *
 * `canceled` is the state the sweep leaves behind when it cancels a quote
 * a gateway is about to capture against, and the server may still settle
 * it. `failed` is here for the same reason and not because a path to it is
 * known: an order that never made it is not evidence that a payment this
 * browser opened went nowhere, and the timeline copy for it says outright
 * that no charge was made.
 */
const UNSETTLED: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "price_confirmed",
  "canceled",
  "failed",
]);

/** Whether a read of the order accounts for the payment on record. */
export function pendingPaymentResolved(order: SettlementRead): boolean {
  if (order.payment_status === "paid") return true;
  return !UNSETTLED.has(order.order_status);
}

/**
 * Whether the customer has money with us that a person still has to match.
 *
 * A bank transfer sits `pending` from the moment the customer says they
 * sent it until an admin verifies it, and the order stays `price_confirmed`
 * and `unpaid` for that whole time. Offering a card payment there would
 * take a second payment for one order.
 */
export function hasOpenOfflineTransfer(order: SettlementRead): boolean {
  const status = order.offline_payment?.data?.status;
  return status === "pending" || status === "verified";
}

/** "none" once a read accounts for the payment, or when there is nothing
 *  on record. "unaccounted" while a payment could still land. "stale" once
 *  the window has passed with no settlement. */
export type PaymentAccounting = "none" | "unaccounted" | "stale";

export function paymentAccounting(
  record: PendingQuotePayment | null,
  order: SettlementRead,
  now: Date,
): PaymentAccounting {
  if (!record) return "none";
  if (pendingPaymentResolved(order)) return "none";
  const elapsed = now.getTime() - record.startedAt;
  return elapsed <= PAYMENT_ACCOUNTING_WINDOW_MS ? "unaccounted" : "stale";
}

/**
 * Whether the screens may offer to pay this order.
 *
 * A charged order is excluded even while it reads unpaid: the capture may
 * simply not have been posted yet, and a second charge is the worse of the
 * two mistakes. An open bank transfer is excluded for the same reason,
 * with the money already sent and only the matching outstanding.
 */
export function canOfferPayment(
  record: PendingQuotePayment | null,
  order: SettlementRead,
): boolean {
  if (!record || record.charged) return false;
  if (hasOpenOfflineTransfer(order)) return false;
  return order.order_status === "price_confirmed" && order.payment_status === "unpaid";
}

/* ---------------------------------------------------------------- */
/* Storage. Every access is guarded: a browser with storage blocked   */
/* must fall back to the in-memory path, never throw on render.       */
/* ---------------------------------------------------------------- */

/** The browser's own `storage` event only fires in other tabs, so writes
 *  in this one are announced here for the subscribers to pick up. */
const CHANGE_EVENT = "bx:price-check-payment";

/** The stored text, not the parsed record: subscribers compare snapshots by
 *  identity, and a fresh object every read would never settle. */
export function readPendingPaymentRaw(orderId: number): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(pendingPaymentKey(orderId));
  } catch {
    return null;
  }
}

export function readPendingPayment(orderId: number): PendingQuotePayment | null {
  return parsePendingPayment(readPendingPaymentRaw(orderId), orderId);
}

export function subscribePendingPayment(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function announce(): void {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function writePendingPayment(record: PendingQuotePayment): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      pendingPaymentKey(record.orderId),
      JSON.stringify(record),
    );
  } catch {
    /* storage blocked or full: the in-memory panel still works */
  }
  announce();
}

export function clearPendingPayment(orderId: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(pendingPaymentKey(orderId));
  } catch {
    /* nothing to do: a record we cannot remove is re-checked on next read */
  }
  announce();
}
