"use client";

import { getEcho } from "./reverb";

/**
 * Live order-status updates over Laravel Reverb.
 *
 * Backend (app/Events/OrderStatusUpdated.php):
 *   - Public channel: `order_tracking_{orderId}`
 *   - Event name:     `order_status_updated` (no namespace prefix)
 *   - Payload:        { order_id, status, timeline_event, timestamp }
 *
 * The Pusher protocol prefixes user-defined event names with a "."
 * to distinguish them from internal Pusher events, so we listen for
 * `.order_status_updated`.
 */

export type OrderStatusEvent = {
  order_id: number;
  status: string;
  timeline_event: string;
  timestamp: string;
};

/**
 * Subscribe to live status events for one order.
 *
 * Returns an unsubscribe function. Safe to call even when Reverb
 * isn't configured (returns a no-op cleanup) — the caller should
 * pair this with an HTTP polling fallback for non-Reverb env.
 */
export function subscribeOrderStatus(
  orderId: number,
  handler: (event: OrderStatusEvent) => void,
): () => void {
  const echo = getEcho();
  if (!echo) return () => {};

  const channelName = `order_tracking_${orderId}`;
  const channel = echo.channel(channelName);
  channel.listen(".order_status_updated", handler);

  return () => {
    try {
      channel.stopListening(".order_status_updated");
      echo.leave(channelName);
    } catch {
      /* socket closed mid-cleanup — ignore */
    }
  };
}
