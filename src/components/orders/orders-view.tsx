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
import { isParcelOrder, orderListPaymentLabel, orderListTitle } from "@/lib/parcel/parcel-order";
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
    <div className="mb-7 inline-flex rounded-pill border border-ink-200 bg-white p-1 shadow-soft">
      <button
        type="button"
        onClick={() => onChange("running")}
        className={cn(
          "inline-flex h-10 items-center rounded-pill px-5 text-sm font-medium transition-all duration-200",
          tab === "running"
            ? "bg-ink-900 text-white shadow-[0_8px_22px_-8px_rgba(13,13,15,0.55)]"
            : "text-ink-700 hover:text-ink-900",
        )}
      >
        Running
      </button>
      <button
        type="button"
        onClick={() => onChange("history")}
        className={cn(
          "inline-flex h-10 items-center rounded-pill px-5 text-sm font-medium transition-all duration-200",
          tab === "history"
            ? "bg-ink-900 text-white shadow-[0_8px_22px_-8px_rgba(13,13,15,0.55)]"
            : "text-ink-700 hover:text-ink-900",
        )}
      >
        History
      </button>
    </div>
  );
}

function OrderCard({ order }: { order: OrderSummary }) {
  const logo = order.store?.logo_full_url ?? null;
  // A parcel has no store, so its row shows the package icon below and
  // names the receiver instead.
  const storeName = orderListTitle(order);
  const parcel = isParcelOrder(order);
  const placed = new Date(order.created_at);

  return (
    <Link
      href={`/orders/${order.id}`}
      className="card-luxe group flex items-center gap-4 rounded-2xl p-4 sm:p-5"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-canvas-sunken">
        {logo ? (
          <Image src={logo} alt="" fill sizes="64px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-400">
            <Package size={22} />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold tracking-[-0.005em] text-ink-900">
            {storeName}
          </p>
          <OrderStatusPill status={order.order_status} />
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
          <span className="font-mono font-medium text-ink-700">
            #{order.id}
          </span>
          <span className="text-ink-300">·</span>
          <span className="inline-flex items-center gap-1">
            <Clock size={11} />
            {placed.toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          {!parcel && typeof order.details_count === "number" && (
            <>
              <span className="text-ink-300">·</span>
              <span>
                {order.details_count} item
                {order.details_count === 1 ? "" : "s"}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-base font-semibold tracking-[-0.005em] text-ink-900">
          ₦{Math.round(order.order_amount).toLocaleString()}
        </p>
        <p className="mt-1 text-xs text-ink-500">
          {orderListPaymentLabel(order)}
        </p>
      </div>
    </Link>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="rounded-3xl border border-ink-200 bg-white p-10 text-center shadow-card">
      <div
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-brand-red"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,107,74,0.18), rgba(222,22,0,0.06))",
        }}
      >
        <ShoppingBag size={22} />
      </div>
      <h2 className="mt-5 font-serif text-display-sm text-ink-900">
        {tab === "running" ? "Nothing in progress" : "No past orders"}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">
        {tab === "running"
          ? "When you place an order it'll show here so you can track it."
          : "Orders you've completed (or cancelled) will live here."}
      </p>
      <Link
        href="/browse"
        className="btn-flame mt-7 inline-flex h-12 items-center justify-center rounded-pill px-7 text-sm font-medium text-white"
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
