"use client";

import { api } from "@/lib/api-client";

/**
 * GET /api/v1/customer/notifications  (auth + zoneId header required)
 *
 * Returns a MERGED array of two row shapes — both end up with the
 * same `data` object on top:
 *
 *   broadcast (App\Models\Notification, admin-pushed announcements)
 *     id, title, description, image, image_full_url, status, tergat,
 *     zone_id, created_at, updated_at,
 *     data: { title, description, order_id: "", image, type: "push_notification" }
 *
 *   personal (App\Models\UserNotification, per-customer events)
 *     id, user_id, data (JSON-decoded), created_at, updated_at,
 *     data: { title, description, order_id?, image?, type? }
 *
 * Both auto-increment id sequences live in separate tables so we
 * composite-key in the UI ("broadcast-12", "personal-3") to avoid
 * React reconcile collisions.
 *
 * Window: only items from the last 15 days come back.
 */

type RawBroadcast = {
  id: number;
  title?: string;
  description?: string;
  image_full_url?: string | null;
  created_at: string;
  data?: NotificationData;
  zone_id?: number | null;
  // No user_id on this shape.
};

type RawPersonal = {
  id: number;
  user_id: number;
  data: NotificationData | string;
  created_at: string;
};

type NotificationData = {
  title?: string;
  description?: string;
  image?: string | null;
  order_id?: number | string | null;
  type?: string;
};

export type AppNotification = {
  /** "broadcast-12" or "personal-3" — stable React key. */
  key: string;
  id: number;
  source: "broadcast" | "personal";
  title: string;
  description: string;
  imageUrl: string | null;
  type: string;
  orderId: number | null;
  createdAt: string;
};

export type NotificationsResult =
  | { ok: true; notifications: AppNotification[] }
  | { ok: false; message: string };

export async function fetchNotifications(): Promise<NotificationsResult> {
  // Backend requires a zoneId header. We don't carry zones in the
  // bearer-token session, so we send a permissive `[0]` to get every
  // un-zoned broadcast (the SQL is `whereNull('zone_id') OR
  // whereIn('zone_id', ...)`). Personal notifications aren't zone-
  // filtered, so they come back regardless.
  const res = await api<Array<RawBroadcast | RawPersonal>>(
    "/api/v1/customer/notifications",
    { zoneId: [0] },
  );
  if (res.ok) {
    return { ok: true, notifications: res.data.map(normalize).filter(Boolean) as AppNotification[] };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}

function normalize(
  raw: RawBroadcast | RawPersonal,
): AppNotification | null {
  const isPersonal = "user_id" in raw;
  const dataRaw =
    typeof raw.data === "string" ? safeJson(raw.data) : raw.data;
  const data: NotificationData = dataRaw ?? {};

  const title = data.title ?? (raw as RawBroadcast).title ?? "";
  const description =
    data.description ?? (raw as RawBroadcast).description ?? "";

  // Skip rows that are entirely empty after merging.
  if (!title && !description) return null;

  const imageUrl =
    (raw as RawBroadcast).image_full_url ?? data.image ?? null;
  const orderRaw = data.order_id;
  const orderId =
    typeof orderRaw === "number"
      ? orderRaw
      : typeof orderRaw === "string" && orderRaw && !isNaN(Number(orderRaw))
        ? Number(orderRaw)
        : null;

  return {
    key: `${isPersonal ? "personal" : "broadcast"}-${raw.id}`,
    id: raw.id,
    source: isPersonal ? "personal" : "broadcast",
    title,
    description,
    imageUrl,
    type: data.type ?? "info",
    orderId,
    createdAt: raw.created_at,
  };
}

function safeJson(raw: string): NotificationData | null {
  try {
    return JSON.parse(raw) as NotificationData;
  } catch {
    return null;
  }
}
