"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";

/**
 * Post-place confirmation. Pulls the new order id from `?order_id=…`
 * (set by CheckoutFlow on success). For now this is text-only — the
 * order tracking page (next slice) will read order_id from the URL
 * too and show live status.
 */
export function OrderSuccess() {
  const search = useSearchParams();
  const orderId = search.get("order_id");

  return (
    <div className="rounded-3xl border border-ink-200 bg-white p-8 text-center shadow-soft sm:p-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
        <CheckCircle2 size={28} />
      </div>
      <h1 className="mt-5 font-serif text-3xl text-ink-900">Order placed</h1>
      <p className="mt-2 text-sm text-ink-600">
        Thanks — we've sent it to the shop and they'll start preparing it as
        soon as it's confirmed.
      </p>

      {orderId && (
        <p className="mt-6 inline-flex items-center justify-center rounded-full border border-ink-200 bg-ink-50 px-4 py-2 text-sm font-medium text-ink-900">
          Order #{orderId}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/browse"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand-red px-6 text-sm font-medium text-white shadow-sm hover:bg-brand-red-600"
        >
          Browse more shops
          <ArrowRight size={14} />
        </Link>
      </div>

      <p className="mt-6 text-xs text-ink-500">
        Live order tracking lands in the next release. For now, watch your
        email and SMS.
      </p>
    </div>
  );
}
