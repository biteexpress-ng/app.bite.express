"use client";

import { api } from "@/lib/api-client";

/**
 * Lightweight newsletter subscribe for the customer app. Used by the
 * out-of-zone "notify me when you launch here" capture on the welcome
 * page.
 *
 * Hits the same backend endpoint the marketing site uses
 * (/api/v1/newsletter/subscribe) so ops only has one subscribers
 * table to manage. Unlike the marketing-site server action this is
 * called CLIENT-SIDE and does NOT send a confirmation email — the
 * backend has the lead and that's enough for v0.
 *
 * The 403 "already subscribed" branch is treated as a soft success
 * to mirror the marketing-site behaviour.
 */

type SubscribeResponse = { message?: string };

export type NewsletterSubscribeResult =
  | { ok: true; alreadySubscribed?: boolean }
  | { ok: false; message: string };

export async function subscribeNewsletter(
  email: string,
): Promise<NewsletterSubscribeResult> {
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes("@")) {
    return { ok: false, message: "Enter a valid email." };
  }

  const res = await api<SubscribeResponse>("/api/v1/newsletter/subscribe", {
    method: "POST",
    body: { email: trimmed },
    unauth: true,
  });

  if (res.ok) return { ok: true };

  if ("skipped" in res) {
    return {
      ok: false,
      message: "Backend not configured yet — we saved your interest locally.",
    };
  }

  if (res.status === 403) return { ok: true, alreadySubscribed: true };

  return {
    ok: false,
    message: res.message || "Something went wrong. Please try again.",
  };
}
