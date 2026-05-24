"use client";

import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, Info, X, AlertCircle } from "lucide-react";
import { useToasts, type Toast } from "@/lib/toast";
import { cn } from "@/lib/cn";

/**
 * Live toast list — mount once in the root layout.
 *
 * Bottom-right on desktop, top-center on mobile (mirrors the iOS/
 * Android in-app pattern customers are used to). Each toast
 * self-dismisses after its `duration` ms; users can dismiss
 * early via the close button.
 */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        "pointer-events-none fixed z-[100] flex flex-col gap-2 px-4",
        // Mobile: top, full width
        "left-0 right-0 top-3 items-center",
        // Desktop: bottom-right, fixed width
        "sm:left-auto sm:right-4 sm:top-auto sm:bottom-4 sm:items-end",
      )}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- */

function ToastItem({
  toast,
  onClose,
}: {
  toast: Toast;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!Number.isFinite(toast.duration)) return;
    const t = setTimeout(onClose, toast.duration);
    return () => clearTimeout(t);
  }, [toast.duration, onClose]);

  const ICONS: Record<typeof toast.kind, React.ReactNode> = {
    success: <CheckCircle2 size={18} />,
    error: <AlertCircle size={18} />,
    warn: <AlertTriangle size={18} />,
    info: <Info size={18} />,
  };

  return (
    <div
      role="status"
      className={cn(
        "toast-enter pointer-events-auto w-full max-w-sm overflow-hidden rounded-2xl border bg-white shadow-elevated",
        TONE[toast.kind].border,
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span
          className={cn(
            "mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white",
            TONE[toast.kind].iconBg,
          )}
        >
          {ICONS[toast.kind]}
        </span>
        <p className="flex-1 text-sm text-ink-900">{toast.message}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

const TONE: Record<
  Toast["kind"],
  { border: string; iconBg: string }
> = {
  success: {
    border: "border-green-200",
    iconBg: "bg-green-600",
  },
  error: {
    border: "border-error/40",
    iconBg: "bg-error",
  },
  warn: {
    border: "border-warning/40",
    iconBg: "bg-warning",
  },
  info: {
    border: "border-ink-200",
    iconBg: "bg-ink-700",
  },
};
