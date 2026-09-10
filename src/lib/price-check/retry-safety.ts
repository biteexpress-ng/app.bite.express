import type { OrderTrack, OrderTrackResult } from "@/lib/api/orders";

/**
 * Whether it is safe to open a payment again after an accept whose payment
 * leg did not report success.
 *
 * A cancelled Paystack popup is not proof that no money moved. `onClose`
 * fires on the bank-transfer and USSD channels too, where the customer may
 * have already sent funds and the webhook lands afterwards. So the order is
 * re-read first, and only a completed read that says the order is still
 * unpaid allows another charge.
 *
 * A read that did not come back is "unknown", never "not paid": offering to
 * charge again on the strength of a failed read is the same mistake as
 * trusting the popup.
 */
export type RetryDecision = "retry" | "paid" | "unknown";

export function retryDecision(read: OrderTrackResult): RetryDecision {
  if (!read.ok) return "unknown";
  if (read.order.payment_status === "paid") return "paid";
  if (read.order.payment_status === "unpaid") return "retry";
  // Any other value is a payment status this client does not model. It is
  // not a confirmed "unpaid", so it does not earn a second charge.
  return "unknown";
}

/**
 * The decision together with the order it was read from.
 *
 * The caller needs both: the order that decided whether a second charge is
 * safe is also the only trustworthy source for the amount to charge, and
 * reading the decision out of one response while taking the amount from
 * somewhere else is how the two come apart.
 */
export type RetryOutcome = {
  decision: RetryDecision;
  /** Null when the read did not come back, which is also when the decision
   *  is "unknown". */
  order: OrderTrack | null;
};

export function retryOutcome(read: OrderTrackResult): RetryOutcome {
  return { decision: retryDecision(read), order: read.ok ? read.order : null };
}
