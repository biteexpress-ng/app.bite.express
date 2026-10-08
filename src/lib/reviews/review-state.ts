/**
 * Pure rating logic, kept free of React and the network so it can be
 * unit tested. Storage access is wrapped so private mode never throws.
 */

import { parseItemDetails } from "@/lib/price-check/item-details";

/** The API exposes no "already rated" flag on an order, so this browser
 *  remembers the orders it rated or waved off. The server still refuses
 *  a duplicate review, so a cleared store only costs a repeat prompt. */
const RATED_KEY = "biteexpress.ratedOrders";
/** Session flag: the reminder shows at most once per visit. */
const REMINDER_SEEN_KEY = "biteexpress.reviewReminderSeen";
/** Cap so the list cannot grow forever. Newest ids are kept. */
const MAX_REMEMBERED = 200;

export type RateableItem = {
  itemId: number;
  name: string;
  imageUrl: string | null;
};

type DetailLineLike = {
  id: number;
  item_id?: number | null;
  item_details?: Record<string, unknown> | string;
};

/**
 * One entry per distinct item. A campaign line or a line with no
 * item_id cannot be reviewed (the endpoint needs a real item id), so it
 * is dropped. Two lines of the same item (different variations) are one
 * review: the backend allows a single review per item per order.
 */
export function rateableItems(lines: readonly DetailLineLike[]): RateableItem[] {
  const seen = new Set<number>();
  const out: RateableItem[] = [];
  for (const line of lines) {
    const itemId = Number(line.item_id);
    if (!Number.isFinite(itemId) || itemId <= 0 || seen.has(itemId)) continue;
    seen.add(itemId);
    const details = parseItemDetails(line.item_details);
    const name = typeof details?.name === "string" ? details.name : `Item #${itemId}`;
    const image =
      typeof details?.image_full_url === "string" ? details.image_full_url : null;
    out.push({ itemId, name, imageUrl: image });
  }
  return out;
}

export function parseRatedOrders(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  } catch {
    return [];
  }
}

export function withRatedOrder(list: readonly number[], orderId: number): number[] {
  const next = list.filter((id) => id !== orderId);
  next.push(orderId);
  return next.slice(-MAX_REMEMBERED);
}

export function isOrderRated(orderId: number): boolean {
  try {
    return parseRatedOrders(window.localStorage.getItem(RATED_KEY)).includes(orderId);
  } catch {
    return false;
  }
}

export function markOrderRated(orderId: number): void {
  try {
    const list = parseRatedOrders(window.localStorage.getItem(RATED_KEY));
    window.localStorage.setItem(RATED_KEY, JSON.stringify(withRatedOrder(list, orderId)));
  } catch {
    // Private mode: the server's duplicate check still holds.
  }
}

export function reminderSeenThisSession(): boolean {
  try {
    return window.sessionStorage.getItem(REMINDER_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markReminderSeen(): void {
  try {
    window.sessionStorage.setItem(REMINDER_SEEN_KEY, "1");
  } catch {
    // Without session storage the reminder can show once per page load.
  }
}

/** Routes where an interrupting prompt would get in the way of paying
 *  or signing in. */
const NO_REMINDER_PREFIXES = ["/checkout", "/signin", "/signup", "/cart"];

export function canShowReminderOn(pathname: string): boolean {
  if (/^\/orders\/\d+/.test(pathname)) return false;
  return !NO_REMINDER_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export const RIDER_TAGS = [
  "On time",
  "Friendly",
  "Handled my order with care",
  "Easy to reach",
  "Arrived late",
  "Hard to reach",
] as const;

/** The rider endpoint requires a comment. Tags and free text are joined so
 *  a customer who only taps tags still sends one. */
export function riderComment(tags: readonly string[], text: string): string {
  const parts = [...tags];
  const typed = text.trim();
  if (typed) parts.push(typed);
  return parts.join(". ");
}

export const STAR_LABELS = ["Terrible", "Bad", "Okay", "Good", "Great"] as const;

export function starLabel(rating: number): string {
  return rating >= 1 && rating <= 5 ? STAR_LABELS[rating - 1] : "";
}
