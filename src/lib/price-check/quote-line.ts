import type { OrderDetailLine } from "@/lib/api/orders";
import { parseItemDetails } from "@/lib/price-check/item-details";

export type QuoteLine = {
  detailId: number;
  itemId: number | null;
  name: string;
  requestedQty: number;
  requestedPrice: number;
  quotedPrice: number | null;
  availableQuantity: number | null;
  isAvailable: boolean;
  note: string | null;
  taxAmount: number;
};

/** Charges carried through from the price request unchanged. Discount
 *  revalidation is deliberately excluded, see estimatedQuoteTotal below. */
type CarriedCharges = {
  deliveryCharge: number;
  additionalCharge: number;
  extraPackaging: number;
  dmTips: number;
};

export function toQuoteLines(lines: OrderDetailLine[]): QuoteLine[] {
  return lines.map((line) => {
    const parsed = parseItemDetails(line.item_details);
    const name = parsed?.name ?? `Item #${line.item_id ?? line.id}`;
    return {
      detailId: line.id,
      itemId: line.item_id ?? null,
      name: String(name),
      requestedQty: line.quantity,
      requestedPrice: line.price,
      quotedPrice: line.quoted_price ?? null,
      availableQuantity: line.available_quantity ?? null,
      // Contract 6.1 step 2 deletes a line on accept when EITHER flag says
      // it can't be supplied, so the screen must treat them as one signal.
      isAvailable: line.is_available !== false && line.available_quantity !== 0,
      note: line.customer_note ?? null,
      taxAmount: line.tax_amount ?? 0,
    };
  });
}

/** Order-level, present on the first row only (never a later one). */
export function quoteExpiresAt(lines: OrderDetailLine[]): string | null {
  return lines[0]?.quote_expires_at ?? null;
}

export function isQuoteExpired(expiresAt: string | null, now: Date): boolean {
  if (expiresAt === null) return false;
  const deadline = new Date(expiresAt);
  // An unparseable deadline must not accidentally lock a payable quote.
  if (Number.isNaN(deadline.getTime())) return false;
  return now.getTime() > deadline.getTime();
}

/**
 * Tax scales with the line's own price and quantity change: a store that
 * cuts quantity or adjusts price on a line should not leave that line's
 * tax pinned to the amount computed against the original request.
 */
export function rescaledTax(line: QuoteLine): number {
  const originalTotal = line.requestedPrice * line.requestedQty;
  if (originalTotal === 0) return 0;
  const quotedTotal = (line.quotedPrice ?? 0) * (line.availableQuantity ?? 0);
  return (line.taxAmount * quotedTotal) / originalTotal;
}

export function estimatedQuoteTotal(
  lines: QuoteLine[],
  included: Set<number>,
  charges: CarriedCharges,
): number {
  let total = 0;
  for (const line of lines) {
    if (!line.isAvailable || !included.has(line.detailId)) continue;
    total += (line.quotedPrice ?? 0) * (line.availableQuantity ?? 0);
    total += rescaledTax(line);
  }
  // Discount revalidation (coupon minimum, percentage recompute) is not
  // reproduced here: the server can only ever reduce the true total by
  // that step, so leaving it out makes this estimate err high, the safe
  // direction to show a customer before an irreversible accept.
  return (
    total +
    charges.deliveryCharge +
    charges.additionalCharge +
    charges.extraPackaging +
    charges.dmTips
  );
}

export function buildAcceptPayload(
  orderId: number,
  lines: QuoteLine[],
  included: Set<number>,
  paymentMethod: string | null,
): Record<string, unknown> {
  const excludedDetailIds = lines
    .filter((line) => !line.isAvailable || !included.has(line.detailId))
    .map((line) => line.detailId);
  const payload: Record<string, unknown> = {
    order_id: orderId,
    excluded_detail_ids: excludedDetailIds,
  };
  if (paymentMethod !== null) {
    payload.payment_method = paymentMethod;
  }
  return payload;
}
