import type { OrderStatus } from "@/lib/api/orders";
import { cn } from "@/lib/cn";

const STATUS_COPY: Record<string, { label: string; tone: ToneKey }> = {
  price_check: { label: "Awaiting price", tone: "warn" },
  price_confirmed: { label: "Quote ready", tone: "warn" },
  pending: { label: "Pending", tone: "neutral" },
  confirmed: { label: "Confirmed", tone: "info" },
  accepted: { label: "Accepted", tone: "info" },
  processing: { label: "Being prepared", tone: "warn" },
  ready_for_handover: { label: "Ready for pickup", tone: "warn" },
  handover: { label: "Out for delivery", tone: "warn" },
  picked_up: { label: "Out for delivery", tone: "warn" },
  delivered: { label: "Delivered", tone: "success" },
  canceled: { label: "Cancelled", tone: "error" },
  refund_requested: { label: "Refund requested", tone: "error" },
  refund_request_canceled: { label: "Refund cancelled", tone: "neutral" },
  refunded: { label: "Refunded", tone: "neutral" },
  failed: { label: "Failed", tone: "error" },
  returned: { label: "Returned", tone: "neutral" },
};

type ToneKey = "neutral" | "info" | "warn" | "success" | "error";

const TONE_CLASSES: Record<ToneKey, string> = {
  neutral: "border-ink-200 bg-canvas-sunken text-ink-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  error: "border-red-200 bg-red-50 text-red-700",
};

export function OrderStatusPill({
  status,
  className,
}: {
  status: OrderStatus | string;
  className?: string;
}) {
  const cfg = STATUS_COPY[status] ?? {
    label: status.replace(/_/g, " "),
    tone: "neutral" as ToneKey,
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-[0.7rem] font-semibold tracking-[-0.005em] capitalize",
        TONE_CLASSES[cfg.tone],
        className,
      )}
    >
      {cfg.tone === "warn" && <span className="live-dot !bg-amber-500" />}
      {cfg.tone === "success" && (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
      )}
      {cfg.label}
    </span>
  );
}
