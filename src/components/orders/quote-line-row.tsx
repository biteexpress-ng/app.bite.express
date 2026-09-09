"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { QuoteLine } from "@/lib/price-check/quote-line";

function naira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString()}`;
}

/**
 * One quoted line on the review screen.
 *
 * An unavailable line has no tick at all rather than a disabled one:
 * the customer cannot keep it whatever they do, and a control that
 * refuses every click only invites them to keep clicking.
 */
export function QuoteLineRow({
  line,
  included,
  onToggle,
}: {
  line: QuoteLine;
  included: boolean;
  onToggle: (detailId: number) => void;
}) {
  const supplied = line.availableQuantity ?? 0;
  const unitPrice = line.quotedPrice ?? line.requestedPrice;
  const priceChanged =
    line.quotedPrice !== null && line.quotedPrice !== line.requestedPrice;
  const lineTotal = unitPrice * supplied;

  const body = (
    <>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium",
            line.isAvailable ? "text-ink-900" : "text-ink-500 line-through",
          )}
        >
          {line.name}
        </p>
        <p className="mt-1 text-sm">
          {priceChanged && (
            <span className="mr-2 text-ink-400 line-through">
              {naira(line.requestedPrice)}
            </span>
          )}
          <span
            className={cn(
              "font-medium",
              line.isAvailable ? "text-ink-900" : "text-ink-500",
            )}
          >
            {naira(unitPrice)}
          </span>
          <span className="text-ink-500"> each</span>
        </p>
        <p className="mt-1 text-xs text-ink-500">
          You asked for {line.requestedQty} · store can supply {supplied}
        </p>
        {line.note && (
          <p className="mt-1 text-xs text-ink-500">Your note: {line.note}</p>
        )}
      </div>
      {line.isAvailable && (
        <span className="shrink-0 text-sm font-semibold text-ink-900">
          {naira(lineTotal)}
        </span>
      )}
    </>
  );

  if (!line.isAvailable) {
    return (
      <li className="flex items-start gap-3 py-4">
        <span
          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center"
          aria-hidden="true"
        />
        {body}
      </li>
    );
  }

  return (
    <li>
      <label className="flex cursor-pointer items-start gap-3 py-4">
        <span
          className={cn(
            "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
            included
              ? "border-brand-red bg-brand-red text-white"
              : "border-ink-300 bg-white",
          )}
          aria-hidden="true"
        >
          {included && <Check size={13} strokeWidth={3} />}
        </span>
        {body}
        <input
          type="checkbox"
          checked={included}
          onChange={() => onToggle(line.detailId)}
          className="sr-only"
        />
      </label>
    </li>
  );
}
