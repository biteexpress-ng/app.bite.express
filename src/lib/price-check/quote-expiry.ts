import type { OrderStatus } from "@/lib/api/orders";
import { isQuoteExpired } from "@/lib/price-check/quote-line";
import {
  canOfferPayment,
  hasOpenOfflineTransfer,
  paymentAccounting,
  type PendingQuotePayment,
} from "@/lib/price-check/pending-payment";

/** The one wording for an expired quote, shared by the screen and the
 *  order page so the two cannot drift apart. */
export const EXPIRED_QUOTE_MESSAGE =
  "These prices have expired. Send a new price request to get today's prices.";

/**
 * What the quote screen shows, in the order the states outrank each other.
 *
 *  - `charged`: a gateway told us it captured money for this order. Nothing
 *    may offer to pay it or to request fresh prices.
 *  - `offline-pending`: the customer sent a bank transfer that a person has
 *    yet to match. Same rule, for money we have not been told about yet.
 *  - `verifying`: a payment this browser started is unaccounted for. The
 *    expiry sweep cannot see an open gateway session, so the server may
 *    still settle a capture that lands on a cancelled order, and saying
 *    anything about expiry here could tell a charged customer otherwise.
 *  - `not-priced` / `unavailable`: the order is not waiting on an answer.
 *  - `owes-payment`: this browser accepted and the order is still payable.
 *  - `expired`: the hold ran out and nothing above applies.
 *  - `payable`: the ordinary review list.
 */
export type QuoteScreenState =
  | "charged"
  | "offline-pending"
  | "verifying"
  | "not-priced"
  | "unavailable"
  | "owes-payment"
  | "expired"
  | "payable";

type QuoteScreenOrder = {
  order_status: OrderStatus;
  payment_status: string;
  offline_payment?: { data?: { status?: string | null } | null } | null;
};

export function quoteScreenState(input: {
  order: QuoteScreenOrder;
  expiresAt: string | null;
  now: Date;
  /** True once the server has refused the accept as expired. Its deadline
   *  is the authority: a slow browser clock puts the two minutes apart. */
  serverSaidExpired: boolean;
  record: PendingQuotePayment | null;
}): QuoteScreenState {
  const { order, record } = input;
  const accounting = paymentAccounting(record, order, input.now);
  const settled = accounting === "none";

  if (record?.charged && !settled) return "charged";
  if (order.payment_status === "paid") {
    // Paid but still `price_confirmed` is the gap between settlement and
    // the status transition. Nothing here is answerable any more.
    return "unavailable";
  }
  if (hasOpenOfflineTransfer(order)) return "offline-pending";

  const expired =
    input.serverSaidExpired || isQuoteExpired(input.expiresAt, input.now);

  if (
    accounting === "unaccounted" &&
    (expired || order.order_status !== "price_confirmed")
  ) {
    return "verifying";
  }

  if (order.order_status !== "price_confirmed") {
    if (order.order_status === "price_check") return "not-priced";
    // A swept quote is cancelled, which is what an expired quote looks
    // like once the page is reloaded.
    return order.order_status === "canceled" ? "expired" : "unavailable";
  }

  // Once the accept has landed the total is fixed server-side, so what
  // this customer needs is a way to pay it, not an invitation to start
  // again, even past the deadline.
  if (canOfferPayment(record, order)) return "owes-payment";

  return expired ? "expired" : "payable";
}

/**
 * Where "Request again" goes. There is no server endpoint that clones a
 * price request, and repopulating the cart from the cancelled order would
 * carry back the very prices that went stale, so the customer starts from
 * the store's own page.
 */
export function reRequestHref(storeId: number | null | undefined): string {
  return typeof storeId === "number" ? `/store/${storeId}` : "/";
}
