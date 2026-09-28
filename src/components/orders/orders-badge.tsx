"use client";

import { useRunningOrdersCount } from "@/lib/running-orders-store";

/**
 * Live count of the customer's running orders (i.e. orders whose status
 * is not yet delivered/canceled/refunded/etc). Returns 0 for guests.
 *
 * Re-exported here so existing call sites don't need to change their
 * import path. The polling itself (60s interval, focus refetch, one
 * fetch shared across every mounted consumer) lives in
 * lib/running-orders-store.ts.
 */
export { useRunningOrdersCount };

/** Floating pill badge — sits on top of an icon. */
export function OrdersBadge() {
  const count = useRunningOrdersCount();
  if (count <= 0) return null;
  return (
    <span className="pointer-events-none absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-semibold leading-none text-white shadow">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** Inline pill — sits next to a text label. */
export function OrdersInlineCount() {
  const count = useRunningOrdersCount();
  if (count <= 0) return null;
  return (
    <span className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-red px-1.5 text-[10px] font-semibold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}
