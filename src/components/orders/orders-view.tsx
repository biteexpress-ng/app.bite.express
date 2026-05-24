"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Clock, Loader2, Package, ShoppingBag } from "lucide-react";
import {
  fetchOrderHistory,
  fetchRunningOrders,
  type OrderSummary,
} from "@/lib/api/orders";
import { OrderStatusPill } from "./order-status-pill";
import { cn } from "@/lib/cn";

type Tab = "running" | "history";
type State =
  | { kind: "loading" }
  | { kind: "ready"; orders: OrderSummary[]; total: number }
  | { kind: "error"; message: string };

/**
 * /orders — split into Running / History tabs.
 *
 * Running: not delivered/canceled — typically what the customer
 *          is most interested in seeing.
 * History: delivered, canceled, refunded etc.
 *
 * Both pull from the backend's paginated endpoints. We render the
 * first 10 only in v0; pagination + "load more" are a follow-up
 * (most customers only care about the latest order, surfaced at
 * the top of Running).
 */
export function OrdersView() {
  const search = useSearchParams();
  const router = useRouter();
  const tab: Tab = search.get("tab") === "history" ? "history" : "running";

  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    const fn = tab === "running" ? fetchRunningOrders : fetchOrderHistory;
    fn(1, 10).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setState({
          kind: "ready",
          orders: res.data.orders,
          total: res.data.total_size,
        });
      } else {
        setState({ kind: "error", message: res.message });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  function setTab(next: Tab) {
    const params = new URLSearchParams(search.toString());
    if (next === "running") params.delete("tab");
    else params.set("tab", next);
    router.replace(`/orders?${params.toString()}`);
  }

  return (
    <>
      <Tabs tab={tab} onChange={setTab} />

      {state.kind === "loading" && <CenterSpinner label="Loading orders…" />}

      {state.kind === "error" && (
        <div className="rounded-2xl border border-error/30 bg-error/5 p-4 text-sm text-error">
          {state.message}
        </div>
      )}

      {state.kind === "ready" && state.orders.length === 0 && (
        <EmptyState tab={tab} />
      )}

      {state.kind === "ready" && state.orders.length > 0 && (
        <ul className="space-y-3">
          {state.orders.map((o) => (
            <li key={o.id}>
              <OrderCard order={o} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* -------------------------------------------------------------- */

function Tabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="mb-6 inline-flex rounded-full border border-ink-200 bg-white p-1">
      <button
        type="button"
        onClick={() => onChange("running")}
        className={cn(
          "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors",
          tab === "running"
            ? "bg-brand-red text-white shadow-sm"
            : "text-ink-700 hover:bg-ink-50",
        )}
      >
        Running
      </button>
      <button
        type="button"
        onClick={() => onChange("history")}
        className={cn(
          "inline-flex h-9 items-center rounded-full px-4 text-sm font-medium transition-colors",
          tab === "history"
            ? "bg-brand-red text-white shadow-sm"
            : "text-ink-700 hover:bg-ink-50",
        )}
      >
        History
      </button>
    </div>
  );
}

function OrderCard({ order }: { order: OrderSummary }) {
  const logo = order.store?.logo_full_url ?? null;
  const storeName = order.store?.name ?? "Unknown shop";
  const placed = new Date(order.created_at);

  return (
    <Link
      href={`/orders/${order.id}`}
      className="group flex items-center gap-4 rounded-2xl border border-ink-200 bg-white p-4 shadow-soft transition-shadow hover:shadow-elevated"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-ink-100">
        {logo ? (
          <Image src={logo} alt="" fill sizes="56px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-400">
            <Package size={20} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-ink-900">
            {storeName}
          </p>
          <OrderStatusPill status={order.order_status} />
        </div>
        <p className="mt-1 flex items-center gap-2 text-xs text-ink-500">
          <span>Order #{order.id}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Clock size={11} />
            {placed.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          {typeof order.details_count === "number" && (
            <>
              <span>·</span>
              <span>
                {order.details_count} item
                {order.details_count === 1 ? "" : "s"}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-ink-900">
          ₦{Math.round(order.order_amount).toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-ink-500">
          {order.payment_status === "paid" ? "Paid" : "Pay on delivery"}
        </p>
      </div>
    </Link>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="rounded-3xl border border-ink-200 bg-white p-8 text-center shadow-soft">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-600">
        <ShoppingBag size={20} />
      </div>
      <h2 className="mt-4 font-serif text-xl text-ink-900">
        {tab === "running" ? "Nothing in progress" : "No past orders"}
      </h2>
      <p className="mt-2 text-sm text-ink-600">
        {tab === "running"
          ? "When you place an order it'll show here so you can track it."
          : "Orders you've completed (or cancelled) will live here."}
      </p>
      <Link
        href="/browse"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-brand-red px-6 text-sm font-medium text-white shadow-sm hover:bg-brand-red-600"
      >
        Browse shops
      </Link>
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
