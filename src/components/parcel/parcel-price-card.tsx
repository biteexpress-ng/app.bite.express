"use client";

import { Loader2, RotateCw } from "lucide-react";
import type { ParcelQuoteView } from "@/lib/parcel/parcel-payment";

type Props = {
  quote: ParcelQuoteView;
  onRetry: () => void;
};

/**
 * Every figure here is read from the get-Tax preview; the web adds
 * nothing up. The delivery row already includes any surge.
 */
export function ParcelPriceCard({ quote, onRetry }: Props) {
  return (
    <div className="overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-card">
      <div className="border-b border-ink-200/70 px-5 pb-3 pt-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-500">
          Price
        </p>
      </div>
      <div className="bg-canvas-sunken/50 p-5 text-sm">
        {quote.kind === "ready" && (
          <dl className="space-y-2.5">
            <Row label="Delivery" value={quote.quote.deliveryCharge} free={quote.quote.deliveryCharge === 0} />
            {quote.quote.additionalCharge > 0 && (
              <Row label="Service charge" value={quote.quote.additionalCharge} />
            )}
            {quote.quote.taxAmount > 0 && <Row label="VAT" value={quote.quote.taxAmount} />}
            {quote.quote.dmTips > 0 && <Row label="Rider tip" value={quote.quote.dmTips} />}
            <div className="flex items-center justify-between border-t border-ink-200/70 pt-3 text-base font-semibold text-ink-900">
              <dt>Total to pay</dt>
              <dd>₦{Math.round(quote.quote.total).toLocaleString()}</dd>
            </div>
          </dl>
        )}
        {quote.kind === "loading" && (
          <p className="flex items-center gap-2 text-ink-500">
            <Loader2 size={13} className="animate-spin" />
            Working out the price
          </p>
        )}
        {quote.kind === "error" && (
          <div className="space-y-3">
            <p role="alert" className="text-error">{quote.message}</p>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-10 items-center gap-2 rounded-pill border border-ink-200 bg-white px-4 text-sm font-medium text-ink-900 transition-colors hover:border-brand-red/30 hover:text-brand-red"
            >
              <RotateCw size={14} />
              Try again
            </button>
          </div>
        )}
        {quote.kind === "idle" && (
          <p className="text-ink-500">Finish the steps to see the price.</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, free = false }: { label: string; value: number; free?: boolean }) {
  return (
    <div className="flex items-center justify-between text-ink-700">
      <dt>{label}</dt>
      <dd className="font-medium text-ink-900">
        {free ? "Free" : `₦${Math.round(value).toLocaleString()}`}
      </dd>
    </div>
  );
}
