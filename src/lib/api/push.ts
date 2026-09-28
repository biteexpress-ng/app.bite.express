"use client";

import { api } from "@/lib/api-client";

export type PushConfig = { enabled: boolean; public_key: string | null };

export type PushSubscriptionBody = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

/** GET /api/v1/customer/push/config. Any failure reads as "disabled". */
export async function fetchPushConfig(): Promise<PushConfig> {
  const res = await api<PushConfig>("/api/v1/customer/push/config");
  if (!res.ok) return { enabled: false, public_key: null };
  return {
    enabled: Boolean(res.data.enabled),
    public_key: res.data.public_key ?? null,
  };
}

export async function subscribePush(body: PushSubscriptionBody): Promise<boolean> {
  const res = await api<{ subscribed?: boolean }>("/api/v1/customer/push/subscribe", {
    method: "POST",
    body,
  });
  return res.ok;
}

/** Pass `token` when the auth store has already been cleared (sign-out). */
export async function unsubscribePush(endpoint: string, token?: string): Promise<boolean> {
  const res = await api<{ subscribed?: boolean }>("/api/v1/customer/push/unsubscribe", {
    method: "POST",
    body: { endpoint },
    ...(token ? { token } : {}),
  });
  return res.ok;
}
