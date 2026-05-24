"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { fetchRunningOrders } from "@/lib/api/orders";

/**
 * Live count of the customer's running orders (i.e. orders whose
 * status is not yet delivered/canceled/refunded/etc).
 *
 * Refreshes:
 *   - on first sign-in (token transition)
 *   - every 60s while signed in (auth-aware polling — stops when
 *     signed out)
 *   - when the tab regains focus, so coming back from a banking app
 *     mid-DVA-transfer shows the new "Confirmed" order without a
 *     hard refresh.
 *
 * Returns 0 for guests.
 */
export function useRunningOrdersCount(): number {
  const token = useAuth((s) => s.token);
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    if (!token) {
      setCount(0);
      return;
    }

    let cancelled = false;
    async function refresh() {
      const res = await fetchRunningOrders(1, 1);
      if (cancelled) return;
      if (res.ok) setCount(res.data.total_size);
    }

    refresh();
    const interval = setInterval(refresh, 60_000);

    function onFocus() {
      refresh();
    }
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [token]);

  return count;
}

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
