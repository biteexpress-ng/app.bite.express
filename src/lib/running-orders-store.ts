"use client";

import { useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth-store";
import { fetchRunningOrders } from "@/lib/api/orders";
import { createRunningOrdersPoller } from "@/lib/running-orders-poller";

async function fetchCount(): Promise<number | null> {
  const token = useAuth.getState().token;
  if (!token) return 0;
  const res = await fetchRunningOrders(1, 1);
  // A failed request keeps whatever count was last known instead of
  // flashing the badge to 0.
  return res.ok ? res.data.total_size : null;
}

const poller = createRunningOrdersPoller(fetchCount);

// Sign-in / sign-out should update the count immediately rather than
// waiting for the next 60s tick: zero it the moment the token clears,
// and refetch right away once a token appears, but only if something
// is actually subscribed (an idle poller has nothing to refresh yet;
// the next mount's subscribe() already triggers the initial fetch).
useAuth.subscribe((state, prevState) => {
  if (state.token === prevState.token) return;
  if (!state.token) {
    poller.reset();
  } else if (poller.subscriberCount() > 0) {
    void poller.refetch();
  }
});

/**
 * Live count of the customer's running orders (i.e. orders whose status
 * is not yet delivered/canceled/refunded/etc). Returns 0 for guests.
 *
 * Backed by one shared poller (see running-orders-poller.ts) so the
 * header badge, the hamburger menu's inline count, and the mobile tab
 * bar dot don't each run their own interval and fetch. The first
 * mounted consumer starts the 60s interval and focus refetch; the last
 * one to unmount stops them.
 */
export function useRunningOrdersCount(): number {
  return useSyncExternalStore(poller.subscribe, poller.getSnapshot, () => 0);
}
