"use client";

import { cn } from "@/lib/cn";
import type { OfflinePaymentMethod } from "@/lib/offline-payment-rules";

/**
 * The bank/method chips for offline payment. Rendered in two places:
 * the checkout picker (choose before placing) and
 * /checkout/offline/[orderId] (change before submitting). Each caller
 * supplies its own wrapper and heading; only the control lives here so
 * the two can't drift apart.
 */
export function BankChips({
  methods,
  selectedId,
  onSelect,
}: {
  methods: OfflinePaymentMethod[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {methods.map((m) => {
        const checked = m.id === selectedId;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            aria-pressed={checked}
            className={cn(
              "rounded-pill border px-4 py-2 text-xs font-medium transition-colors",
              checked
                ? "border-brand-red bg-brand-red text-white"
                : "border-ink-200 bg-white text-ink-700 hover:border-brand-red/40",
            )}
          >
            {m.method_name}
          </button>
        );
      })}
    </div>
  );
}
