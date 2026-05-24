"use client";

import { Minus, Plus } from "lucide-react";
import type { AddOn, AddOnSelection } from "@/lib/api/store-detail";
import { cn } from "@/lib/cn";

type Props = {
  addOns: AddOn[];
  selected: AddOnSelection[];
  onChange: (next: AddOnSelection[]) => void;
};

/**
 * Renders an item's optional add-ons (e.g. "Extra cheese — ₦200")
 * with a per-add-on qty stepper. Each row is independent — no
 * required minimums; customers can leave them all at 0.
 *
 * The parent owns the selection array; we send it back unchanged
 * (minus any rows that drop to qty=0).
 */
export function AddonPicker({ addOns, selected, onChange }: Props) {
  function bump(addon: AddOn, delta: number) {
    const existing = selected.find((s) => s.id === addon.id);
    const currentQty = existing?.qty ?? 0;
    const nextQty = Math.max(0, currentQty + delta);

    const without = selected.filter((s) => s.id !== addon.id);
    if (nextQty === 0) {
      onChange(without);
      return;
    }
    onChange([
      ...without,
      { id: addon.id, name: addon.name, price: addon.price, qty: nextQty },
    ]);
  }

  return (
    <fieldset className="space-y-2">
      <legend className="flex w-full items-center justify-between gap-2 text-sm font-medium text-ink-900">
        <span>Add-ons</span>
        <span className="text-xs font-normal text-ink-500">Optional</span>
      </legend>

      <div className="space-y-1.5">
        {addOns.map((a) => {
          const sel = selected.find((s) => s.id === a.id);
          const qty = sel?.qty ?? 0;
          const active = qty > 0;
          return (
            <div
              key={a.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition-colors",
                active
                  ? "border-brand-red bg-brand-red/5"
                  : "border-ink-200 bg-white",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-ink-900">{a.name}</p>
                {a.price > 0 && (
                  <p className="text-xs text-ink-600">
                    +₦{Math.round(a.price).toLocaleString()} each
                  </p>
                )}
              </div>

              <div className="inline-flex h-9 items-center rounded-full border border-ink-200 bg-white">
                <button
                  type="button"
                  onClick={() => bump(a, -1)}
                  disabled={qty === 0}
                  aria-label={`Decrease ${a.name}`}
                  className="inline-flex h-9 w-9 items-center justify-center text-ink-700 disabled:opacity-40"
                >
                  <Minus size={14} />
                </button>
                <span className="min-w-[1.75rem] text-center text-sm font-medium text-ink-900">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => bump(a, 1)}
                  aria-label={`Increase ${a.name}`}
                  className="inline-flex h-9 w-9 items-center justify-center text-ink-700"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
