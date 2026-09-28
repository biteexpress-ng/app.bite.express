/*
 * BiteExpress web app service worker.
 *
 * Push only: `push` and `notificationclick`, plus `install` and `activate` to
 * take control of open tabs. There is no fetch handler and no
 * caching, so this file can never serve a stale copy of the app. Keep it that way.
 */

// Take control of open tabs straight away. Without this the tab that turned
// alerts on stays uncontrolled (Next.js navigates client-side), and
// WindowClient.navigate() rejects on a tab this worker does not control.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function orderIdFrom(url) {
  const match = /^\/orders\/(\d+)/.exec(url || "");
  return match ? Number(match[1]) : null;
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // Non-JSON payload: fall through to the defaults below.
  }

  const url = payload.url || "/orders";
  const title = payload.title || "BiteExpress";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || undefined,
    // A newer update for the same order replaces the old one but still alerts.
    renotify: Boolean(payload.tag),
    data: { url },
  };

  // Open tabs refetch at once, which covers for Reverb being down.
  const tellTabs = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((windows) => {
      for (const client of windows) {
        client.postMessage({ type: "order-updated", orderId: orderIdFrom(url) });
      }
    });

  event.waitUntil(Promise.all([self.registration.showNotification(title, options), tellTabs]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = (event.notification.data && event.notification.data.url) || "/orders";
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        const exact = windows.find((client) => client.url === target);
        if (exact && "focus" in exact) return exact.focus();

        // Only reuse a tab that is already on the orders pages. A tab
        // anywhere else (mid-checkout, say) is left alone.
        const onOrders = windows.find((client) => {
          const path = new URL(client.url).pathname;
          return (path === "/orders" || path.startsWith("/orders/")) && "navigate" in client;
        });
        if (onOrders) {
          return onOrders
            .navigate(target)
            .then((client) => (client || onOrders).focus())
            .catch(() => self.clients.openWindow(target));
        }
        return self.clients.openWindow(target);
      }),
  );
});
