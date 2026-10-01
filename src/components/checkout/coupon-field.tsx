"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, TicketPercent, X } from "lucide-react";
import type { AppliedCoupon } from "@/lib/api/coupon";
import type { CouponNotice } from "@/lib/checkout/coupon-notice";
import { cn } from "@/lib/cn";

type Props = {
  applied: AppliedCoupon | null;
  /** Read off the priced quote; null while it is being worked out. */
  notice: CouponNotice;
  /** Resolves to an error message, or null when the code was accepted. */
  onApply: (code: string) => Promise<string | null>;
  onRemove: () => void;
  disabled?: boolean;
};

/**
 * Coupon entry for /checkout. Validation and pricing both happen on the
 * server; this only collects the code and shows what the priced total
 * says the code did.
 */
export function CouponField({ applied, notice, onApply, onRemove, disabled = false }: Props) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (checking || disabled) return;
    const typed = code.trim();
    if (!typed) {
      setError("Enter a coupon code.");
      return;
    }
    setChecking(true);
    setError(null);
    const message = await onApply(typed);
    setChecking(false);
    if (message) setError(message);
    else setCode("");
  }

  if (applied) {
    return (
      <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-card">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
            <TicketPercent size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm font-semibold tracking-wide text-ink-900">
              {applied.code}
            </p>
            {applied.title && (
              <p className="line-clamp-1 text-xs text-ink-500">{applied.title}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="inline-flex h-9 items-center gap-1 rounded-pill border border-ink-200 px-3 text-xs font-medium text-ink-700 transition-colors hover:border-brand-red/30 hover:text-brand-red disabled:opacity-50"
          >
            <X size={13} />
            Remove
          </button>
        </div>

        {notice === null ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-ink-500">
            <Loader2 size={12} className="animate-spin" />
            Updating your total
          </p>
        ) : (
          <p
            className={cn(
              "mt-3 flex items-start gap-2 rounded-2xl px-3 py-2 text-xs leading-relaxed text-ink-900",
              notice.tone === "success" ? "bg-success-soft" : "bg-warning-soft",
            )}
          >
            {notice.tone === "success" ? (
              <CheckCircle2 size={14} className="mt-px shrink-0 text-success" />
            ) : (
              <AlertTriangle size={14} className="mt-px shrink-0 text-warning" />
            )}
            {notice.message}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleApply}
      className="rounded-3xl border border-ink-200 bg-white p-5 shadow-card"
    >
      <label htmlFor="coupon-code" className="mb-2 block text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-500">
        Coupon code
      </label>
      <div className="flex gap-2">
        <input
          id="coupon-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g. AREWA"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          disabled={disabled || checking}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "coupon-code-error" : undefined}
          className={cn(
            "min-w-0 flex-1 rounded-2xl border bg-white px-4 py-3 font-mono text-sm uppercase tracking-wide text-ink-900 placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-400 shadow-soft transition-all focus:outline-none focus:ring-4 disabled:opacity-60",
            error
              ? "border-error focus:border-error focus:ring-error/15"
              : "border-ink-200 focus:border-brand-red/40 focus:ring-brand-red/10",
          )}
        />
        <button
          type="submit"
          disabled={disabled || checking}
          className="inline-flex h-[2.875rem] shrink-0 items-center justify-center gap-1.5 rounded-pill bg-ink-900 px-5 text-sm font-medium text-white transition-all hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
        >
          {checking ? <Loader2 size={14} className="animate-spin" /> : null}
          Apply
        </button>
      </div>
      {error && (
        <p id="coupon-code-error" className="mt-1.5 text-xs text-error">
          {error}
        </p>
      )}
    </form>
  );
}
