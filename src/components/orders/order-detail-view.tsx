"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bike,
  Clock,
  Loader2,
  MapPin,
  Phone,
  ShoppingBag,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  fetchOrderDetailLines,
  fetchOrderTrack,
  type OfflinePaymentBlock,
  type OrderDetailLine,
  type OrderStatus,
  type OrderTrack,
} from "@/lib/api/orders";
import { subscribeOrderStatus } from "@/lib/order-channel";
import { parseItemDetails } from "@/lib/price-check/item-details";
import { OrderStatusPill } from "./order-status-pill";
import { RiderMap } from "./rider-map";
import { cn } from "@/lib/cn";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; order: OrderTrack; lines: OrderDetailLine[] }
  | { kind: "error"; message: string };

/** Statuses that mean the order is no longer running — we stop
 *  polling and don't keep the WebSocket open for these. */
const TERMINAL: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  "delivered",
  "canceled",
  "refunded",
  "refund_requested",
  "refund_request_canceled",
  "failed",
  "returned",
]);

/** Ordered list of milestones we light up in the timeline. The
 *  backend's order_status can advance through several of these in
 *  one step (e.g. confirmed → handover), so we walk the array and
 *  mark every one up to AND including the current status. */
const TIMELINE: Array<{
  status: OrderStatus | "paid";
  label: string;
  icon: React.ReactNode;
}> = [
  { status: "pending", label: "Order placed", icon: <ShoppingBag size={14} /> },
  { status: "confirmed", label: "Confirmed by shop", icon: <Clock size={14} /> },
  { status: "processing", label: "Being prepared", icon: <Clock size={14} /> },
  { status: "handover", label: "Out for delivery", icon: <Bike size={14} /> },
  { status: "delivered", label: "Delivered", icon: <ShoppingBag size={14} /> },
];

/**
 * /orders/[id] view.
 *
 * Pulls the order from /customer/order/track + the line items from
 * /customer/order/details on first load. Then keeps the status
 * fresh via two mechanisms:
 *
 *   1. Reverb subscription on `order_tracking_{orderId}` (preferred)
 *   2. HTTP poll every 20s (fallback when Reverb env isn't set, or
 *      when the WebSocket drops)
 *
 * Both stop firing once the order reaches a terminal status.
 */
export function OrderDetailView({ orderId }: { orderId: number }) {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [reverbConnected, setReverbConnected] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });

    Promise.all([fetchOrderTrack(orderId), fetchOrderDetailLines(orderId)]).then(
      ([trackRes, linesRes]) => {
        if (cancelled) return;
        if (!trackRes.ok) {
          setState({ kind: "error", message: trackRes.message });
          return;
        }
        setState({
          kind: "ready",
          order: trackRes.order,
          lines: linesRes.ok ? linesRes.lines : [],
        });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // Live updates — Reverb subscription
  useEffect(() => {
    if (state.kind !== "ready") return;
    if (TERMINAL.has(state.order.order_status)) return;

    const unsubscribe = subscribeOrderStatus(orderId, (evt) => {
      setReverbConnected(true);
      setState((prev) =>
        prev.kind === "ready"
          ? {
              ...prev,
              order: {
                ...prev.order,
                order_status: evt.status as OrderStatus,
                timelines: [
                  ...(prev.order.timelines ?? []),
                  {
                    id: Date.now(),
                    order_id: evt.order_id,
                    event: evt.timeline_event,
                    status: evt.status,
                    created_at: evt.timestamp,
                  },
                ],
              },
            }
          : prev,
      );
    });

    // Set "connected" optimistically — if the env isn't configured,
    // subscribeOrderStatus returns a noop and we silently fall back
    // to polling without the green pip ever showing.
    if (process.env.NEXT_PUBLIC_REVERB_APP_KEY) setReverbConnected(true);

    return () => {
      unsubscribe();
      setReverbConnected(false);
    };
  }, [orderId, state]);

  // HTTP polling fallback — runs in parallel with Reverb so a
  // dropped WebSocket doesn't leave the UI stale.
  useEffect(() => {
    if (state.kind !== "ready") return;
    if (TERMINAL.has(state.order.order_status)) return;

    pollRef.current = setInterval(async () => {
      const res = await fetchOrderTrack(orderId);
      if (res.ok) {
        setState((prev) =>
          prev.kind === "ready" ? { ...prev, order: res.order } : prev,
        );
      }
    }, 20_000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [orderId, state]);

  if (state.kind === "loading") {
    return <CenterSpinner label="Loading order…" />;
  }
  if (state.kind === "error") {
    return (
      <div className="rounded-2xl border border-error/30 bg-error/5 p-4 text-sm text-error">
        {state.message}
      </div>
    );
  }

  const { order, lines } = state;
  const rider = order.delivery_man?.[0] ?? null;

  // Live rider map shows only while the order is in-flight AND we
  // have an assigned rider AND a usable delivery lat/lng. The
  // pickup pin is dropped only when the store has coordinates.
  const showMap =
    rider !== null &&
    (order.order_status === "handover" ||
      order.order_status === "picked_up" ||
      order.order_status === "accepted") &&
    parseLatLng(
      order.delivery_address?.latitude,
      order.delivery_address?.longitude,
    ) !== null;
  const destination = parseLatLng(
    order.delivery_address?.latitude,
    order.delivery_address?.longitude,
  );
  const pickup = parseLatLng(order.store?.latitude, order.store?.longitude);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <header className="rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-ink-500">
                Order #{order.id}
              </p>
              <h1 className="mt-1 font-serif text-2xl text-ink-900 sm:text-3xl">
                {order.store?.name ?? "Your order"}
              </h1>
              <p className="mt-1 text-sm text-ink-500">
                Placed{" "}
                {new Date(order.created_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <OrderStatusPill status={order.order_status} />
          </div>

          <LiveBadge reverbConnected={reverbConnected} status={order.order_status} />

          {order.order_status === "price_confirmed" && (
            <Link
              href={`/orders/${order.id}/quote`}
              className="btn-flame mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-pill px-6 text-sm font-medium text-white"
            >
              Review the store&apos;s prices
              <ArrowRight size={15} strokeWidth={2.2} />
            </Link>
          )}
        </header>

        <Timeline status={order.order_status} />

        {showMap && rider && destination && (
          <RiderMap
            deliverymanId={rider.id}
            destination={destination}
            pickup={pickup}
          />
        )}

        <ItemsCard lines={lines} />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <TotalsCard order={order} />
        {rider && <RiderCard rider={rider} />}
        <DeliveryAddressCard order={order} />
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------- */

function LiveBadge({
  reverbConnected,
  status,
}: {
  reverbConnected: boolean;
  status: OrderStatus;
}) {
  if (TERMINAL.has(status)) return null;
  return (
    <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink-50 px-2.5 py-1 text-[11px] font-medium text-ink-600">
      {reverbConnected ? (
        <>
          <Wifi size={11} className="text-green-600" />
          Live updates on
        </>
      ) : (
        <>
          <WifiOff size={11} className="text-ink-400" />
          Auto-refreshing every 20s
        </>
      )}
    </div>
  );
}

function Timeline({ status }: { status: OrderStatus }) {
  // If the order is cancelled/refunded etc, render a minimal pill
  // saying so rather than the happy-path timeline.
  if (status === "canceled") {
    return (
      <CardLite>
        <p className="text-sm text-ink-700">
          This order was cancelled. If you've been charged, refunds usually
          land in 3–5 business days.
        </p>
      </CardLite>
    );
  }
  if (status === "failed") {
    return (
      <CardLite>
        <p className="text-sm text-ink-700">
          This order failed before being placed with the shop. No charges
          were made.
        </p>
      </CardLite>
    );
  }

  const currentIndex = TIMELINE.findIndex((m) => m.status === status);
  // picked_up / accepted aren't in TIMELINE but map to handover for display
  const effectiveIndex =
    currentIndex >= 0
      ? currentIndex
      : status === "picked_up" || status === "accepted"
        ? TIMELINE.findIndex((m) => m.status === "handover")
        : 0;

  return (
    <CardLite>
      <ol className="space-y-4">
        {TIMELINE.map((m, idx) => {
          const reached = idx <= effectiveIndex;
          const active = idx === effectiveIndex;
          return (
            <li key={m.status} className="flex items-center gap-3">
              <span
                className={cn(
                  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
                  reached
                    ? "border-brand-red bg-brand-red text-white"
                    : "border-ink-200 bg-white text-ink-400",
                )}
              >
                {m.icon}
              </span>
              <span
                className={cn(
                  "text-sm",
                  reached
                    ? "font-medium text-ink-900"
                    : "text-ink-500",
                  active && "text-brand-red",
                )}
              >
                {m.label}
              </span>
            </li>
          );
        })}
      </ol>
    </CardLite>
  );
}

function ItemsCard({ lines }: { lines: OrderDetailLine[] }) {
  if (lines.length === 0) {
    return (
      <CardLite>
        <p className="text-sm text-ink-500">Item details not available.</p>
      </CardLite>
    );
  }
  return (
    <CardLite>
      <h2 className="mb-3 text-sm font-medium text-ink-900">Items</h2>
      <ul className="divide-y divide-ink-200/70">
        {lines.map((l) => {
          const parsed = parseItemDetails(l.item_details);
          const name = parsed?.name ?? `Item #${l.item_id ?? l.id}`;
          return (
            <li key={l.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-medium text-ink-900">
                  {l.quantity} × {String(name)}
                </p>
                {l.variant && (
                  <p className="mt-0.5 text-xs text-ink-500">{l.variant}</p>
                )}
              </div>
              <span className="shrink-0 text-sm font-medium text-ink-900">
                ₦{Math.round(l.price * l.quantity).toLocaleString()}
              </span>
            </li>
          );
        })}
      </ul>
    </CardLite>
  );
}

function TotalsCard({ order }: { order: OrderTrack }) {
  return (
    <CardLite>
      <h2 className="mb-3 text-sm font-medium text-ink-900">Total</h2>
      <dl className="space-y-1 text-sm">
        <div className="flex items-center justify-between text-ink-700">
          <dt>Order total</dt>
          <dd className="font-semibold text-ink-900">
            ₦{Math.round(order.order_amount).toLocaleString()}
          </dd>
        </div>
        <div className="flex items-center justify-between text-ink-500">
          <dt>Payment</dt>
          <dd>
            {order.payment_status === "paid" ? "Paid" : "Unpaid"}
            {order.payment_method ? ` · ${order.payment_method.replace(/_/g, " ")}` : ""}
          </dd>
        </div>
      </dl>
      {order.offline_payment && (
        <div className="mt-4">
          <OfflinePaymentPanel orderId={order.id} block={order.offline_payment} />
        </div>
      )}
    </CardLite>
  );
}

function RiderCard({
  rider,
}: {
  rider: NonNullable<OrderTrack["delivery_man"]>[number];
}) {
  const name = [rider.f_name, rider.l_name].filter(Boolean).join(" ").trim() ||
    "Your rider";
  return (
    <CardLite>
      <h2 className="mb-3 text-sm font-medium text-ink-900">Rider</h2>
      <div className="flex items-center gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-ink-100">
          {rider.image_full_url && (
            <Image
              src={rider.image_full_url}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-900">{name}</p>
          {rider.phone && (
            <a
              href={`tel:${rider.phone}`}
              className="mt-0.5 inline-flex items-center gap-1 text-xs text-brand-red hover:underline"
            >
              <Phone size={11} />
              {rider.phone}
            </a>
          )}
        </div>
      </div>
    </CardLite>
  );
}

function DeliveryAddressCard({ order }: { order: OrderTrack }) {
  const addr = order.delivery_address;
  if (!addr) return null;
  return (
    <CardLite>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-900">
        <MapPin size={14} />
        Delivery
      </h2>
      <p className="text-sm text-ink-700">{addr.address}</p>
      {addr.contact_person_name && (
        <p className="mt-2 text-xs text-ink-500">
          {addr.contact_person_name}
          {addr.contact_person_number ? ` · ${addr.contact_person_number}` : ""}
        </p>
      )}
    </CardLite>
  );
}

function CardLite({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-soft sm:p-6">
      {children}
    </div>
  );
}

function CenterSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[30vh] items-center justify-center gap-2 text-ink-500">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}

function parseLatLng(
  lat: string | number | undefined,
  lng: string | number | undefined,
): { lat: number; lng: number } | null {
  const nLat = lat === undefined ? NaN : Number(lat);
  const nLng = lng === undefined ? NaN : Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  if (nLat === 0 && nLng === 0) return null;
  return { lat: nLat, lng: nLng };
}

/**
 * Offline payment state, from order.offline_payment (emitted by
 * track_order, OrderController.php:74).
 *
 * "denied" is a normal outcome of manual verification, not an edge
 * case: the admin rejects a payment they can't match and the customer
 * has to correct it. So the CTA here must actually work. The DVA
 * transfer flow tells customers to "tap Confirm transfer again" on this
 * page and no such button exists — don't repeat that.
 */
function OfflinePaymentPanel({
  orderId,
  block,
}: {
  orderId: number;
  block: OfflinePaymentBlock;
}) {
  const status = block.data?.status;
  if (!status) return null;

  if (status === "verified") {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-4">
        <p className="text-sm font-medium text-ink-900">Transfer confirmed</p>
        <p className="mt-1 text-xs text-ink-600">
          We matched your payment{" "}
          {block.data?.method_name ? `from ${block.data.method_name}` : ""} and
          your order is on its way.
        </p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="rounded-2xl border border-error/30 bg-error/5 p-4">
        <p className="text-sm font-medium text-error">
          We couldn&apos;t confirm your payment
        </p>
        {block.data?.admin_note && (
          <p className="mt-1 text-xs text-ink-700">{block.data.admin_note}</p>
        )}
        <Link
          href={`/checkout/offline/${orderId}`}
          className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-brand-red px-4 text-sm font-medium text-white hover:bg-brand-red-600"
        >
          Update payment details
        </Link>
      </div>
    );
  }

  // pending
  return (
    <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4">
      <p className="text-sm font-medium text-ink-900">
        Waiting for us to confirm your transfer
      </p>
      <p className="mt-1 text-xs text-ink-600">
        We check transfers by hand, usually within a few minutes.
      </p>
      <Link
        href={`/checkout/offline/${orderId}`}
        className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-ink-200 bg-white px-4 text-sm font-medium text-ink-900 hover:bg-ink-50"
      >
        Edit payment details
      </Link>
    </div>
  );
}
