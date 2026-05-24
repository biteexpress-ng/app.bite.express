"use client";

import Image from "next/image";
import type { CartLine } from "@/lib/cart-store";
import { selectionsSummary } from "@/lib/food-variations";

type Props = {
  lines: CartLine[];
  subtotal: number;
};

/**
 * Read-only order summary for /checkout. Same line shape as /cart
 * minus the qty stepper. Delivery fee + grand total are placeholders
 * until the backend's pricing endpoint is wired (it's a separate
 * call — POST /api/v1/customer/order/get-Tax — and we defer it to
 * slice 6b).
 */
export function OrderSummary({ lines, subtotal }: Props) {
  return (
    <div className="overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-soft">
      <ul className="divide-y divide-ink-200/70">
        {lines.map((l) => (
          <li key={l.key} className="flex items-center gap-3 p-4">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ink-100">
              {l.imageUrl && (
                <Image
                  src={l.imageUrl}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-sm font-medium text-ink-900">
                {l.qty} × {l.name}
              </p>
              {l.selections.length > 0 && (
                <p className="line-clamp-1 text-xs text-ink-500">
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
            <span className="shrink-0 text-sm font-medium text-ink-900">
              ₦{Math.round(l.unitPrice * l.qty).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>

      <dl className="space-y-2 border-t border-ink-200/70 bg-ink-50 p-4 text-sm">
        <div className="flex items-center justify-between text-ink-700">
          <dt>Subtotal</dt>
          <dd>₦{Math.round(subtotal).toLocaleString()}</dd>
        </div>
        <div className="flex items-center justify-between text-ink-500">
          <dt>Delivery & fees</dt>
          <dd>Calculated by your rider</dd>
        </div>
        <div className="flex items-center justify-between border-t border-ink-200/70 pt-2 text-base font-medium text-ink-900">
          <dt>Total to confirm</dt>
          <dd>₦{Math.round(subtotal).toLocaleString()}+</dd>
        </div>
      </dl>
    </div>
  );
}
