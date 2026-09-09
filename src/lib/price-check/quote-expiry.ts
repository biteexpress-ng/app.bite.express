import { isQuoteExpired } from "@/lib/price-check/quote-line";
import type { PaymentAccounting } from "@/lib/price-check/pending-payment";

/** The one wording for an expired quote, shared by the screen and the
 *  order page so the two cannot drift apart. */
export const EXPIRED_QUOTE_MESSAGE =
  "These prices have expired. Send a new price request to get today's prices.";

export type QuoteAvailability = "payable" | "expired" | "verifying";

/**
 * Whether the quote screen may still be paid, must say the prices expired,
 * or must say nothing yet.
 *
 * The server is the authority on the deadline: a slow browser clock puts
 * the two minutes apart, so a refusal carrying `price_check_quote_expired`
 * counts as expired even while the local clock shows time left.
 *
 * "verifying" exists for one reason: the expiry sweep cannot see an open
 * gateway session, so a payment this browser started can land on an order
 * the sweep has cancelled, and the server settles it at the quoted total.
 * Showing the expired copy before a read accounts for that payment would
 * tell a customer who has been charged that nothing was charged.
 */
export function quoteAvailability(input: {
  expiresAt: string | null;
  now: Date;
  serverSaidExpired: boolean;
  payment: PaymentAccounting;
}): QuoteAvailability {
  const expired =
    input.serverSaidExpired || isQuoteExpired(input.expiresAt, input.now);
  if (!expired) return "payable";
  if (input.payment === "unaccounted") return "verifying";
  return "expired";
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
