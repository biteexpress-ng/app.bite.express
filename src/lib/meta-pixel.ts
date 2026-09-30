/**
 * Meta Pixel helpers. The pixel script itself is loaded by
 * components/analytics/meta-pixel.tsx, gated on NEXT_PUBLIC_META_PIXEL_ID,
 * so every call here is a no-op until that is set in the environment.
 *
 * Event names are Meta's standard events, which is what lets an ads
 * campaign optimise for Purchase. The same pixel id runs on bite.express,
 * and the click cookie is set on the shared parent domain, so an ad click
 * on the marketing site is still attributed when the order completes here.
 */

export type PixelEvent =
  | "PageView"
  | "ViewContent"
  | "AddToCart"
  | "InitiateCheckout"
  | "Purchase"
  | "CompleteRegistration";

export type PixelParams = Record<string, string | number | boolean | string[]>;

type Fbq = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

export const META_PIXEL_ID =
  (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "").trim() || null;

export const PIXEL_CURRENCY = "NGN";

/**
 * Sends a standard event. Returns false when the pixel is not on the
 * page (no id configured, script blocked, or server render), so callers
 * never have to check for it themselves.
 *
 * `eventId` is forwarded as Meta's eventID, which is what the Conversions
 * API later uses to deduplicate a server-sent copy of the same event.
 */
export function trackPixel(
  event: PixelEvent,
  params?: PixelParams,
  eventId?: string,
): boolean {
  if (typeof window === "undefined" || typeof window.fbq !== "function") {
    return false;
  }
  if (eventId) window.fbq("track", event, params ?? {}, { eventID: eventId });
  else window.fbq("track", event, params ?? {});
  return true;
}

/** The eventID for an order's Purchase. The server-side copy must match. */
export function purchaseEventId(orderId: number | string): string {
  return `order-${orderId}`;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

/**
 * Purchase must fire once per order, and the success page can be
 * reloaded or reached again from history. The order id is remembered in
 * session storage; a missing or throwing storage counts as "not yet
 * fired" so the event is never silently lost.
 */
export function claimPurchase(
  orderId: number | string,
  storage: StorageLike | null,
): boolean {
  const key = `biteexpress.pixel.purchase.${orderId}`;
  try {
    if (!storage) return true;
    if (storage.getItem(key)) return false;
    storage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

/** A naira amount from a query string; null when absent or not a number. */
export function parseAmount(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
