"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";

/**
 * Shared empty state for any /browse/* page when we don't have an
 * in-zone address picked. Customers can land here from a stale
 * shared link or by clearing their localStorage. We bounce them
 * back to the welcome flow instead of showing an empty grid.
 */
export function NoLocation({
  reason = "out-of-zone",
}: {
  reason?: "no-pick" | "out-of-zone" | "temp-unavailable";
}) {
  const copy = MESSAGES[reason];
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-ink-200 bg-white p-8 text-center shadow-soft">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-600">
        <MapPin size={20} strokeWidth={1.8} />
      </div>
      <h2 className="mt-4 font-serif text-2xl text-ink-900">{copy.title}</h2>
      <p className="mt-2 text-sm text-ink-600">{copy.body}</p>
      <Link
        href="/"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-brand-red px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-red-600"
      >
        Pick an address
      </Link>
    </div>
  );
}

const MESSAGES = {
  "no-pick": {
    title: "Tell us where to deliver",
    body: "We need a delivery address before we can show you what's nearby.",
  },
  "out-of-zone": {
    title: "We don't deliver here yet",
    body: "Your last address isn't in any of our delivery zones. Pick another and we'll try again.",
  },
  "temp-unavailable": {
    title: "Service is paused here",
    body: "We're temporarily unavailable in your area. Pick a different address or check back soon.",
  },
} as const;
