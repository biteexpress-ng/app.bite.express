import type { OrderQuote, OrderQuoteResult } from "@/lib/api/order-quote";

/**
 * The last check before an order is placed. The total on screen was
 * priced when the customer reached the page; a surge window can open, or
 * a fee setting change, while they sit on it. Placement charges whatever
 * the server computes at that moment, so the page asks get-Tax again
 * right before placing and only goes ahead when the answer matches what
 * the customer was shown.
 *
 * Compared in whole naira because that is what the screen prints.
 */
export type RecheckDecision =
  | { kind: "place" }
  | { kind: "changed"; quote: OrderQuote; message: string }
  | { kind: "failed"; message: string };

function naira(n: number): string {
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

export function recheckPrice(
  shownTotal: number | null,
  fresh: OrderQuoteResult,
): RecheckDecision {
  if (!fresh.ok) {
    return {
      kind: "failed",
      message: fresh.message || "We couldn't confirm the latest price. Please try again.",
    };
  }

  const next = fresh.quote.total;
  if (shownTotal === null) {
    return {
      kind: "changed",
      quote: fresh.quote,
      message: `Your total is ${naira(next)}. Check it, then place your order again.`,
    };
  }
  if (Math.round(next) === Math.round(shownTotal)) return { kind: "place" };

  const direction = next > shownTotal ? "up" : "down";
  return {
    kind: "changed",
    quote: fresh.quote,
    message: `The total went ${direction} from ${naira(shownTotal)} to ${naira(next)} while you were checking out. Check the new total, then place your order again.`,
  };
}
