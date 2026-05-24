"use client";

import { cn } from "@/lib/cn";

type Tone = "danger" | "default";

type Props = {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Generic brand-aligned confirm dialog — a drop-in replacement for
 * native `confirm()`. Keeps the destructive action red when tone
 * is "danger" (the default for `tone` when undefined falls back to
 * the muted style so callers have to opt in to the scary look).
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-dialog-title"
          className="font-serif text-xl text-ink-900"
        >
          {title}
        </h2>
        {body && <p className="mt-2 text-sm text-ink-600">{body}</p>}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              "inline-flex h-11 flex-1 items-center justify-center rounded-full px-5 text-sm font-medium text-white shadow-sm transition-colors",
              "disabled:cursor-wait disabled:opacity-70",
              tone === "danger"
                ? "bg-error hover:bg-red-700"
                : "bg-brand-red hover:bg-brand-red-600 active:bg-brand-red-700",
            )}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-ink-200 bg-white px-5 text-sm font-medium text-ink-900 hover:bg-ink-50 disabled:opacity-70"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
