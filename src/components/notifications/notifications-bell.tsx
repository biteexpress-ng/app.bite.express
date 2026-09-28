"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { fetchNotifications } from "@/lib/api/notifications";
import { useNotificationsSeen } from "@/lib/notifications-store";
import { onOrderPush } from "@/lib/push-events";
import { cn } from "@/lib/cn";

/**
 * Bell icon for the header. Auth-aware:
 *   - guest -> renders nothing (notifications are user-scoped)
 *   - signed in -> polls /customer/notifications every 90s and on
 *     window focus, compares each item's created_at against the
 *     locally-tracked lastSeenAt to surface an unread count.
 *
 * Refetches when a push lands, otherwise polls.
 */
export function NotificationsBell({ className }: { className?: string }) {
  const token = useAuth((s) => s.token);
  const lastSeenAt = useNotificationsSeen((s) => s.lastSeenAt);
  const hydrate = useNotificationsSeen((s) => s.hydrate);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!token) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    async function refresh() {
      const res = await fetchNotifications();
      if (cancelled) return;
      if (!res.ok) return;
      const count = res.notifications.filter(
        (n) => Date.parse(n.createdAt) > lastSeenAt,
      ).length;
      setUnread(count);
    }
    refresh();
    const interval = setInterval(refresh, 90_000);
    function onFocus() {
      refresh();
    }
    window.addEventListener("focus", onFocus);
    const offPush = onOrderPush(() => {
      void refresh();
    });
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      offPush();
    };
  }, [token, lastSeenAt]);

  if (!token) return null;

  return (
    <Link
      href="/notifications"
      aria-label={
        unread > 0
          ? `Notifications (${unread} unread)`
          : "Notifications"
      }
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink-200 text-ink-900 transition-colors hover:bg-ink-50 hover:text-brand-red",
        className,
      )}
    >
      <Bell size={17} strokeWidth={1.8} />
      {unread > 0 && (
        <span className="pointer-events-none absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-semibold leading-none text-white shadow">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
