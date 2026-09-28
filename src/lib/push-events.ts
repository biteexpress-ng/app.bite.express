"use client";

/** What public/sw.js posts to open tabs when a push lands. */
type OrderPushMessage = { type: "order-updated"; orderId: number | null };

/**
 * Calls `listener` whenever a push arrives while this tab is open, with the
 * order id when the push was about an order. Returns an unsubscribe function.
 */
export function onOrderPush(listener: (orderId: number | null) => void): () => void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return () => {};
  }
  const container = navigator.serviceWorker;
  const handler = (event: MessageEvent) => {
    const data = event.data as Partial<OrderPushMessage> | null;
    if (data?.type !== "order-updated") return;
    listener(typeof data.orderId === "number" ? data.orderId : null);
  };
  container.addEventListener("message", handler);
  // addEventListener (unlike onmessage) does not start the message queue.
  container.startMessages();
  return () => container.removeEventListener("message", handler);
}
