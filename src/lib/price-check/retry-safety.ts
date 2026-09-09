import type { OrderTrackResult } from "@/lib/api/orders";

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
