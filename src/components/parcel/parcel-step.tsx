"use client";

import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  step: 1 | 2 | 3;
  title: string;
  /** Shown under the title while the step is collapsed. */
  summary?: string | null;
  open: boolean;
  done: boolean;
  locked: boolean;
  onOpen: () => void;
  children: React.ReactNode;
};

/**
 * One collapsible step of /send. A finished step collapses to its
 * summary and reopens when tapped; a locked step cannot open until the
 * steps before it are valid.
 */
export function ParcelStep({
  step,
  title,
  summary,
  open,
  done,
  locked,
  onOpen,
  children,
}: Props) {
  const showCheck = done && !open;
  return (
    <section
      className={cn(
        "rounded-3xl border border-ink-200 bg-white shadow-soft transition-opacity",
        locked && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={locked || open}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-5 text-left disabled:cursor-default sm:p-6"
      >
        <span
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold",
            showCheck ? "bg-brand-red text-white" : "bg-canvas-sunken text-brand-red",
          )}
        >
          {showCheck ? <Check size={16} strokeWidth={2.4} /> : `0${step}`}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-xl tracking-[-0.012em] text-ink-900">
            {title}
          </span>
          {!open && summary && (
            <span className="mt-0.5 block truncate text-sm text-ink-500">{summary}</span>
          )}
        </span>
        {!open && !locked && (
          <ChevronDown size={18} className="shrink-0 text-ink-400" aria-hidden="true" />
        )}
      </button>
      {open && <div className="border-t border-ink-200/70 p-5 sm:p-6">{children}</div>}
    </section>
  );
}
