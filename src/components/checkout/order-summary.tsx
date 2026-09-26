"use client";

import Image from "next/image";
import { Loader2 } from "lucide-react";
import type { CartLine } from "@/lib/cart-store";
import type { OrderQuote } from "@/lib/api/order-quote";
import { selectionsSummary } from "@/lib/food-variations";

export type QuoteState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; quote: OrderQuote }
  | { kind: "error"; message: string };

type Props = {
  lines: CartLine[];
  subtotal: number;
  /** True when the cart's store prices on request. Nothing is charged
   *  on this path yet, so the final row reads as an estimate rather
   *  than a total to confirm, matching /cart's wording. */
  priceCheckEnabled?: boolean;
  /** Server-computed charges from POST /order/get-Tax. Before it
   *  resolves (or if it fails) the fee rows fall back to a plain
   *  "worked out at checkout" line rather than guessing a number. */
  quote?: QuoteState;
};

/**
 * Read-only order summary for /checkout. Same line shape as /cart
 * minus the qty stepper.
 *
 * Every fee row comes from the server's own pricing preview, so the
 * total printed here is the exact amount the wallet gets debited by
 * or Paystack gets asked for.
 */
export function OrderSummary({
  lines,
  subtotal,
  priceCheckEnabled = false,
  quote = { kind: "idle" },
}: Props) {
  const q = quote.kind === "ready" ? quote.quote : null;
  // The server's merchandise subtotal is authoritative once it lands
  // (it reprices against the live catalogue), but it's 0 until then.
  const shownSubtotal = q && q.subtotal > 0 ? q.subtotal : subtotal;
  return (
    <div className="overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-card">
      <div className="border-b border-ink-200/70 px-5 pt-5 pb-3">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-500">
          Order summary
        </p>
      </div>
      <ul className="divide-y divide-ink-200/70">
        {lines.map((l) => (
          <li key={l.key} className="flex items-center gap-3 p-4">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-canvas-sunken">
              {l.imageUrl && (
                <Image
                  src={l.imageUrl}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              )}
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink-900 px-1 text-[0.65rem] font-semibold text-white">
                {l.qty}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-semibold tracking-[-0.005em] text-ink-900">
                {l.name}
              </p>
              {l.variant && (
                <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">
                  {l.variant.label}
                </p>
              )}
              {l.selections.length > 0 && (
                <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">
                  {selectionsSummary(l.selections)}
                </p>
              )}
              {l.addOns.length > 0 && (
                <p className="line-clamp-1 text-xs text-ink-500">
                  +{" "}
                  {l.addOns
                    .map((a) => (a.qty > 1 ? `${a.qty} × ${a.name}` : a.name))
                    .join(", ")}
                </p>
              )}
            </div>
            <span className="shrink-0 text-sm font-semibold text-ink-900">
              ₦{Math.round(l.unitPrice * l.qty).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>

      <dl className="space-y-2.5 border-t border-ink-200/70 bg-canvas-sunken/50 p-5 text-sm">
        <Row label="Subtotal" value={shownSubtotal} />

        {q && q.productDiscount > 0 && (
          <Row label="Item discount" value={-q.productDiscount} tone="credit" />
        )}
        {q && q.couponDiscount > 0 && (
          <Row label="Coupon" value={-q.couponDiscount} tone="credit" />
        )}

        {priceCheckEnabled ? (
          <PendingRow label="Delivery & fees" note="Quoted with your prices" />
        ) : quote.kind === "ready" && q ? (
          <>
            <Row
              label="Delivery"
              value={q.deliveryCharge}
              free={q.deliveryCharge === 0}
            />
            {q.additionalCharge > 0 && (
              <Row label="Service charge" value={q.additionalCharge} />
            )}
            {q.extraPackaging > 0 && (
              <Row label="Packaging" value={q.extraPackaging} />
            )}
            {q.taxAmount > 0 && <Row label="VAT" value={q.taxAmount} />}
            {q.dmTips > 0 && <Row label="Rider tip" value={q.dmTips} />}
          </>
        ) : quote.kind === "loading" ? (
          <div className="flex items-center justify-between text-ink-500">
            <dt>Delivery & fees</dt>
            <dd className="inline-flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" />
              Working it out
            </dd>
          </div>
        ) : (
          <PendingRow
            label="Delivery & fees"
            note="Added once your address is set"
          />
        )}

        <div className="flex items-center justify-between border-t border-ink-200/70 pt-3 text-base font-semibold text-ink-900">
          <dt>{priceCheckEnabled ? "Estimated subtotal" : "Total to pay"}</dt>
          <dd>
            ₦{Math.round(q && !priceCheckEnabled ? q.total : shownSubtotal).toLocaleString()}
            {(priceCheckEnabled || !q) && "+"}
          </dd>
        </div>

        {quote.kind === "error" && !priceCheckEnabled && (
          <p className="text-xs leading-relaxed text-ink-500">
            We couldn&apos;t work out delivery just now. You&apos;ll see the
            full total before any money moves.
          </p>
        )}
      </dl>
    </div>
  );
}

function Row({
  label,
  value,
  free = false,
  tone,
}: {
  label: string;
  value: number;
  free?: boolean;
  tone?: "credit";
}) {
  return (
    <div className="flex items-center justify-between text-ink-700">
      <dt>{label}</dt>
      <dd
        className={
          tone === "credit" ? "font-medium text-success" : "font-medium text-ink-900"
        }
      >
        {free
          ? "Free"
          : `${value < 0 ? "−" : ""}₦${Math.round(Math.abs(value)).toLocaleString()}`}
      </dd>
    </div>
  );
}

function PendingRow({ label, note }: { label: string; note: string }) {
  return (
    <div className="flex items-center justify-between text-ink-500">
      <dt>{label}</dt>
      <dd>{note}</dd>
    </div>
  );
}
