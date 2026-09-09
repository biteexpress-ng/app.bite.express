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

export type AcceptFailureAction = {
  /** The chosen method cannot pay this total. Force a fresh choice. */
  clearPaymentMethod: boolean;
  /** The order is no longer awaiting the customer. Re-read it. */
  reloadOrder: boolean;
  /** The hold ran out. The full expired screen is a later task. */
  expired: boolean;
  /** Extra guidance where the server's message alone leaves the
   *  customer without a next step. Null keeps the server's wording. */
  hint: string | null;
};

export function acceptFailureAction(code: string | null): AcceptFailureAction {
  const base: AcceptFailureAction = {
    clearPaymentMethod: false,
    reloadOrder: false,
    expired: false,
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
        hint: "Pay by card, wallet or bank transfer instead. Your list is unchanged.",
      };
    default:
      // `order_time` and anything unrecognised: the server's message
      // carries the reason, and the customer can re-tick or go back.
      return base;
  }
}
