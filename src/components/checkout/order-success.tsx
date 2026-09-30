"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";
import { AppDownloadSuccessCard } from "@/components/app-nudge/app-download-success-card";
import { fetchOrderTrack } from "@/lib/api/orders";
import {
  claimPurchase,
  parseAmount,
  purchaseEventId,
  PIXEL_CURRENCY,
  trackPixel,
} from "@/lib/meta-pixel";

/**
 * Premium post-place confirmation. Pulls the new order id from
 * `?order_id=…`. Cinematic obsidian confetti card, flame CTA.
 *
 * Also the one place the ads pixel sees a Purchase. Every route that
 * lands here appends `&amount=` with the order total; when it is missing
 * the total is read back from /order/track rather than sent as zero.
 */
export function OrderSuccess() {
  const search = useSearchParams();
  const orderId = search.get("order_id");
  const amountParam = search.get("amount");

  useEffect(() => {
    if (!orderId) return;
    const storage = typeof window === "undefined" ? null : window.sessionStorage;
    if (!claimPurchase(orderId, storage)) return;

    const send = (value: number) =>
      trackPixel(
        "Purchase",
        { value, currency: PIXEL_CURRENCY, content_type: "product" },
        purchaseEventId(orderId),
      );

    const known = parseAmount(amountParam);
    if (known !== null) {
      send(known);
      return;
    }
    let cancelled = false;
    fetchOrderTrack(Number(orderId)).then((res) => {
      if (cancelled) return;
      send(res.ok && Number.isFinite(res.order.order_amount) ? res.order.order_amount : 0);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, amountParam]);

  return (
    <>
      <div className="rise relative isolate overflow-hidden rounded-[2rem] border border-ink-200 bg-white p-10 text-center shadow-floating sm:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-90"
          style={{
            background:
              "radial-gradient(36rem 22rem at 50% -10%, rgba(255,107,74,0.16), transparent 60%), radial-gradient(28rem 18rem at 100% 110%, rgba(16,185,129,0.10), transparent 60%)",
          }}
        />

        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(16,185,129,0.30), transparent 70%)",
            }}
          />
          <div className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-success/15 text-success ring-4 ring-success/10">
            <CheckCircle2 size={30} strokeWidth={1.8} />
          </div>
        </div>

        <span className="mt-6 inline-flex items-center gap-1.5 rounded-pill border border-ink-200 bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-700">
          <Sparkles size={11} className="text-brand-orange" />
          Confirmed
        </span>

        <h1 className="mt-4 font-serif text-display-md tracking-[-0.018em] text-ink-900 sm:text-display-lg">
          Order placed
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600 sm:text-base">
          Thanks. We've sent it to the shop and they'll start preparing it as
          soon as it's confirmed.
        </p>

        {orderId && (
          <p className="mt-7 inline-flex items-center justify-center rounded-pill border border-ink-200 bg-canvas-sunken/70 px-4 py-2 font-mono text-sm font-medium tracking-wide text-ink-900">
            Order #{orderId}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {orderId && (
            <Link
              href={`/orders/${orderId}`}
              className="btn-flame inline-flex h-12 items-center justify-center gap-2 rounded-pill px-7 text-sm font-medium text-white"
            >
              Track your order
              <ArrowRight size={14} />
            </Link>
          )}
          <Link
            href="/browse"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-pill border border-ink-200 bg-white px-7 text-sm font-medium text-ink-900 transition-all hover:-translate-y-px hover:border-brand-red/30 hover:text-brand-red hover:shadow-soft"
          >
            Browse more shops
          </Link>
        </div>
      </div>

      <AppDownloadSuccessCard />
    </>
  );
}
