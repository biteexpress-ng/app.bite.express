"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, Loader2 } from "lucide-react";
import {
  fetchNotifications,
  type AppNotification,
} from "@/lib/api/notifications";
import { useNotificationsSeen } from "@/lib/notifications-store";
import { cn } from "@/lib/cn";

type State =
  | { kind: "loading" }
  | { kind: "ready"; notifications: AppNotification[] }
  | { kind: "error"; message: string };

/**
 * /notifications — merged broadcast + personal notifications from
 * the last 15 days, newest first.
 *
 * On mount we mark all items as "seen" so the header bell badge
 * clears the moment the customer opens this page (server has no
 * per-row read state).
 */
export function NotificationsList() {
  const markAllSeen = useNotificationsSeen((s) => s.markAllSeen);
  const lastSeenAt = useNotificationsSeen((s) => s.lastSeenAt);
  const hydrate = useNotificationsSeen((s) => s.hydrate);

  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    let cancelled = false;
    fetchNotifications().then((res) => {
      if (cancelled) return;
      if (res.ok) {
        const sorted = [...res.notifications].sort(
          (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
        );
        setState({ kind: "ready", notifications: sorted });
        markAllSeen();
      } else {
        setState({ kind: "error", message: res.message });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [markAllSeen]);

  if (state.kind === "loading") {
    return <CenterSpinner label="Loading notifications…" />;
  }
  if (state.kind === "error") {
    return (
      <div className="rounded-2xl border border-error/30 bg-error/5 p-4 text-sm text-error">
        {state.message}
      </div>
    );
  }
  if (state.notifications.length === 0) {
    return <EmptyState />;
  }

  return (
    <ul className="space-y-3">
      {state.notifications.map((n) => (
        <li key={n.key}>
          <Item notification={n} isNew={Date.parse(n.createdAt) > lastSeenAt} />
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------- */

function Item({
  notification,
  isNew,
}: {
  notification: AppNotification;
  isNew: boolean;
}) {
  const placed = new Date(notification.createdAt);
  const inner = (
    <div
      className={cn(
        "flex gap-4 rounded-2xl border p-4 shadow-soft transition-colors sm:p-5",
        isNew
          ? "border-brand-red/40 bg-brand-red/5"
          : "border-ink-200 bg-white",
      )}
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-ink-100">
        {notification.imageUrl ? (
          <Image
            src={notification.imageUrl}
            alt=""
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-500">
            <Bell size={18} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="line-clamp-1 flex-1 text-sm font-medium text-ink-900">
            {notification.title || "BiteExpress"}
          </p>
          {isNew && (
            <span className="rounded-full bg-brand-red px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
              New
            </span>
          )}
        </div>
        {notification.description && (
          <p className="mt-1 line-clamp-3 text-sm text-ink-600">
            {notification.description}
          </p>
        )}
        <p className="mt-2 text-xs text-ink-500">
          {placed.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>
    </div>
  );

  // If the notification references an order, make the whole card a
  // link to that order. Otherwise it's a passive announcement.
  if (notification.orderId) {
    return (
      <Link
        href={`/orders/${notification.orderId}`}
        className="block transition-shadow hover:shadow-elevated"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-ink-200 bg-white p-8 text-center shadow-soft">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-600">
        <Bell size={20} />
      </div>
      <h2 className="mt-4 font-serif text-xl text-ink-900">
        Nothing here yet
      </h2>
      <p className="mt-2 text-sm text-ink-600">
        Order updates and announcements from BiteExpress will show up here.
      </p>
    </div>
  );
}

function CenterSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[20vh] items-center justify-center gap-2 text-ink-500">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}
