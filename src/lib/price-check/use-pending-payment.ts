"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  parsePendingPayment,
  readPendingPaymentRaw,
  subscribePendingPayment,
  type PendingQuotePayment,
} from "@/lib/price-check/pending-payment";

/**
 * The accept-and-pay record for one order, kept in step with storage.
 *
 * Storage is an external store, so it is read through useSyncExternalStore
 * rather than copied into state on mount: the server has no record to
 * render, and a write on the quote screen reaches the order page (and any
 * other tab) without either of them re-reading by hand.
 */
export function usePendingPayment(orderId: number): PendingQuotePayment | null {
  const raw = useSyncExternalStore(
    subscribePendingPayment,
    () => readPendingPaymentRaw(orderId),
    () => null,
  );
  return useMemo(() => parsePendingPayment(raw, orderId), [raw, orderId]);
}
