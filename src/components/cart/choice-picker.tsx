"use client";

import {
  variantKey,
  type ChoiceOption,
  type ChoicePicks,
  type LegacyVariation,
} from "@/lib/legacy-variations";
import { cn } from "@/lib/cn";

type Props = {
  choices: ChoiceOption[];
  variations: LegacyVariation[];
  picks: ChoicePicks;
  onChange: (next: ChoicePicks) => void;
  /** Applies the item's discount to a size's full price. */
  priceOf: (fullPrice: number) => number;
};

/**
 * Size picker for the legacy variation system (grocery, pharmacy,
 * ecommerce). Same rows as <VariationPicker />, but each option shows
 * its full price rather than a "+" uplift, because a legacy size
 * replaces the item price instead of adding to it.
 *
 * Every choice is required: the server has no base price to fall back
 * on once an item has sizes.
 */
export function ChoicePicker({ choices, variations, picks, onChange, priceOf }: Props) {
  // A per-option price only makes sense when one attribute decides the row.
  const priceFor = (option: string): number | null => {
    if (choices.length !== 1) return null;
    const row = variations.find((v) => v.type === variantKey([option]));
    return row ? priceOf(Number(row.price)) : null;
  };

  return (
    <div className="space-y-5">
      {choices.map((choice) => (
        <fieldset key={choice.name} className="space-y-2">
          <legend className="flex w-full items-center justify-between gap-2 text-sm font-medium text-ink-900">
            <span>{choice.title}</span>
            <span className="rounded-full bg-brand-red/10 px-2 py-0.5 text-xs font-normal text-brand-red">
              Required
            </span>
          </legend>

          <div className="space-y-1.5">
            {choice.options.map((option) => {
              const checked = picks[choice.name] === option;
              const price = priceFor(option);
              return (
                <label
                  key={option}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-red",
                    checked
                      ? "border-brand-red bg-brand-red/5"
                      : "border-ink-200 bg-white hover:border-ink-300",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        checked
                          ? "border-brand-red bg-brand-red text-white"
                          : "border-ink-300 bg-white",
                      )}
                      aria-hidden="true"
                    >
                      {checked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    <span className="text-ink-900">{option}</span>
                  </span>
                  {price !== null && (
                    <span className="text-xs font-medium text-ink-600">
                      ₦{Math.round(price).toLocaleString()}
                    </span>
                  )}
                  <input
                    type="radio"
                    name={choice.name}
                    value={option}
                    checked={checked}
                    onChange={() => onChange({ ...picks, [choice.name]: option })}
                    className="sr-only"
                  />
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
