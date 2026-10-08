"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  value: number;
  onChange: (value: number) => void;
  /** Names the thing being rated for screen readers, e.g. "the rider". */
  label: string;
  size?: "lg" | "sm";
  disabled?: boolean;
};

/**
 * Five-star input as a radio group: arrow keys move between stars, and
 * each star is a 44px target even in the compact size.
 */
export function StarRating({ value, onChange, label, size = "lg", disabled = false }: Props) {
  const iconSize = size === "lg" ? 34 : 20;

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(5, value + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(1, value - 1));
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={`Rate ${label}`}
      onKeyDown={onKeyDown}
      className={cn("flex items-center", size === "lg" ? "gap-1" : "-mx-2.5")}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        // Roving tab stop: only the chosen star (or the first) is tabbable.
        const tabbable = value === 0 ? n === 1 : n === value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            tabIndex={tabbable ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(n)}
            className={cn(
              "inline-flex items-center justify-center rounded-full outline-none transition-transform duration-150",
              "focus-visible:ring-2 focus-visible:ring-brand-red/50 active:scale-90 disabled:cursor-default",
              "[-webkit-tap-highlight-color:transparent]",
              size === "lg" ? "h-12 w-12" : "h-11 w-9",
            )}
          >
            <Star
              size={iconSize}
              strokeWidth={1.6}
              className={cn(
                "transition-colors duration-150",
                filled ? "fill-brand-orange text-brand-orange" : "fill-transparent text-ink-400",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
