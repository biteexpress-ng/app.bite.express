"use client";

import { useState } from "react";
import { usePush } from "@/lib/push";
import type { PushState } from "@/lib/push-state";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";

const COPY: Record<Exclude<PushState, "disabled">, string> = {
  unsupported: "This browser can't show order alerts. Try Chrome, Edge or Firefox, or the BiteExpress app.",
  "needs-install":
    "On iPhone, add BiteExpress to your Home Screen (Share, then Add to Home Screen) and open it from there to turn alerts on.",
  blocked: "Alerts are blocked for this site. Allow notifications for app.bite.express in your browser settings, then come back here.",
  off: "Get an alert on this device when your order moves along.",
  on: "You'll get an alert on this device when your order moves along.",
};

export function PushSettingsCard() {
  const state = usePush((s) => s.state);
  const enable = usePush((s) => s.enable);
  const disable = usePush((s) => s.disable);
  const [busy, setBusy] = useState(false);

  if (state === "loading" || state === "disabled") return null;

  const canToggle = state === "on" || state === "off";

  const toggle = async () => {
    setBusy(true);
    try {
      if (state === "on") {
        await disable();
        toast.info("Order alerts are off for this device.");
      } else {
        await enable();
        const next = usePush.getState().state;
        if (next === "on") toast.success("Order alerts are on for this device.");
        if (next === "blocked") toast.info("Alerts are blocked in your browser settings.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't change order alerts. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 rounded-3xl border border-ink-200 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-ink-900">Order alerts on this device</h2>
          <p className="mt-1 text-sm text-ink-600">{COPY[state]}</p>
        </div>
        {canToggle && (
          <button
            type="button"
            role="switch"
            aria-checked={state === "on"}
            aria-label="Order alerts on this device"
            disabled={busy}
            onClick={toggle}
            className={cn(
              "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
              state === "on" ? "bg-brand-red" : "bg-ink-200",
            )}
          >
            <span
              className={cn(
                "inline-block h-5 w-5 rounded-full bg-white shadow transition-transform",
                state === "on" ? "translate-x-6" : "translate-x-1",
              )}
            />
          </button>
        )}
      </div>
    </div>
  );
}
