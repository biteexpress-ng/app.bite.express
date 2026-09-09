/**
 * What the quote review screen does with a refused accept.
 *
 * The server names its refusals with a code, and two of them arrive on
 * status codes that read like something else: the below-minimum refusal
 * reuses place-order's `order_time` (a 406), and the cash-ceiling refusal
 * reuses `order_amount` (a 203). Branching on the code keeps that
 * mismatch in one place instead of spread through the screen.
 *
 * Every refusal is rolled back server-side, so no action here ever
 * touches the customer's ticks.
 */

/** Client-side sentinel, never sent by the server. `acceptQuote` uses it
 *  when a 200 comes back with no total we could pay against: the accept
 *  itself landed, so the screen must not offer to accept again. */
export const ACCEPT_AMOUNT_UNREADABLE = "price_check_amount_unreadable";

export type AcceptFailureAction = {
  /** The chosen method cannot pay this total. Force a fresh choice. */
  clearPaymentMethod: boolean;
  /** The order is no longer awaiting the customer. Re-read it. */
  reloadOrder: boolean;
  /** The hold ran out. The screen swaps the accept button for the expired
   *  copy and a way to request fresh prices. */
  expired: boolean;
  /** The accept landed even though this call reported a problem. Accepting
   *  again cannot help, so the screen must stop offering it. */
  alreadyAccepted: boolean;
  /** Extra guidance where the server's message alone leaves the
   *  customer without a next step. Null keeps the server's wording. */
  hint: string | null;
};

export function acceptFailureAction(code: string | null): AcceptFailureAction {
  const base: AcceptFailureAction = {
    clearPaymentMethod: false,
    reloadOrder: false,
    expired: false,
    alreadyAccepted: false,
    hint: null,
  };

  switch (code) {
    case "price_check_quote_expired":
      return { ...base, expired: true };
    case "price_check_no_lines":
      return {
        ...base,
        hint: "Keep at least one item to carry on with this order.",
      };
    case "price_check_already_answered":
      return { ...base, reloadOrder: true };
    case "order_amount":
      return {
        ...base,
        clearPaymentMethod: true,
        hint: "Pay by card, wallet or offline transfer instead. Your list is unchanged.",
      };
    case ACCEPT_AMOUNT_UNREADABLE:
      return { ...base, alreadyAccepted: true, reloadOrder: true };
    case "order_time":
      // The store minimum. The server's message carries the figure, and
      // the only lever this app gives the customer is the ticks: it ships
      // without an order-cancel screen, so the hint must not offer one.
      return {
        ...base,
        hint: "Tick more items back on to reach the store's minimum. If they are all ticked already, this order cannot go ahead at these prices.",
      };
    default:
      // Anything unrecognised: the server's message carries the reason,
      // and the customer can re-tick or go back to the order.
      return base;
  }
}
