"use client";

import {
  effectiveMax,
  effectiveMin,
  optionPriceNumber,
  type FoodVariation,
  type VariationSelection,
} from "@/lib/food-variations";
import { cn } from "@/lib/cn";

type Props = {
  variations: FoodVariation[];
  selections: VariationSelection[];
  onChange: (next: VariationSelection[]) => void;
};

/**
 * Renders each food_variations group as either radios (type=single)
 * or checkboxes (type=multi). Required groups carry a "Required"
 * pill in the header; multi groups with a max>0 show the count
 * remaining.
 *
 * Stateless — the parent owns the selections array and gets a fresh
 * copy on every change.
 */
export function VariationPicker({ variations, selections, onChange }: Props) {
  function setGroup(name: string, values: string[]) {
    const next = selections.filter((s) => s.name !== name);
    if (values.length > 0) next.push({ name, values });
    onChange(next);
  }

  return (
    <div className="space-y-5">
      {variations.map((group) => {
        const sel = selections.find((s) => s.name === group.name);
        const selected = new Set(sel?.values ?? []);
        const min = effectiveMin(group);
        const max = effectiveMax(group);
        const remaining = group.type === "multi" ? max - selected.size : 0;

        return (
          <fieldset key={group.name} className="space-y-2">
            <legend className="flex w-full items-center justify-between gap-2 text-sm font-medium text-ink-900">
              <span>{group.name}</span>
              <span className="text-xs font-normal text-ink-500">
                {group.required === "on" ? (
                  <span className="rounded-full bg-brand-red/10 px-2 py-0.5 text-brand-red">
                    Required
                  </span>
                ) : group.type === "multi" && max > 0 ? (
                  <span>Up to {max}</span>
                ) : (
                  <span>Optional</span>
                )}
              </span>
            </legend>

            <div className="space-y-1.5">
              {group.values.map((val) => {
                const checked = selected.has(val.label);
                const price = optionPriceNumber(val);
                const disabled =
                  !checked &&
                  group.type === "multi" &&
                  max > 0 &&
                  selected.size >= max;

                function toggle() {
                  if (disabled) return;
                  if (group.type === "single") {
                    setGroup(group.name, checked ? [] : [val.label]);
                    return;
                  }
                  // multi
                  const nextSet = new Set(selected);
                  if (checked) nextSet.delete(val.label);
                  else nextSet.add(val.label);
                  setGroup(group.name, Array.from(nextSet));
                }

                return (
                  <label
                    key={val.label}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-red",
                      checked
                        ? "border-brand-red bg-brand-red/5"
                        : "border-ink-200 bg-white hover:border-ink-300",
                      disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={cn(
                          "inline-flex h-4 w-4 shrink-0 items-center justify-center border",
                          group.type === "single" ? "rounded-full" : "rounded",
                          checked
                            ? "border-brand-red bg-brand-red text-white"
                            : "border-ink-300 bg-white",
                        )}
                        aria-hidden="true"
                      >
                        {checked && group.type === "single" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                        {checked && group.type === "multi" && (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 10 10"
                            fill="none"
                          >
                            <path
                              d="M2 5l2 2 4-4"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span className="text-ink-900">{val.label}</span>
                    </span>
                    {price > 0 && (
                      <span className="text-xs font-medium text-ink-600">
                        +₦{price.toLocaleString()}
                      </span>
                    )}
                    <input
                      type={group.type === "single" ? "radio" : "checkbox"}
                      name={group.name}
                      value={val.label}
                      checked={checked}
                      onChange={toggle}
                      disabled={disabled}
                      className="sr-only"
                    />
                  </label>
                );
              })}
            </div>

            {min > 1 && (
              <p className="text-xs text-ink-500">
                Choose at least {min}
                {group.type === "multi" && remaining > 0 && (
                  <> · {remaining} more allowed</>
                )}
                .
              </p>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
