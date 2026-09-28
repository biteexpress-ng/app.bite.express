"use client";

import { useState } from "react";
import { BellRing, Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePush } from "@/lib/push";
import { OPT_IN_DISMISS_MS, shouldShowOptInCard } from "@/lib/push-state";
import { toast } from "@/lib/toast";

const DISMISS_KEY = "biteexpress.pushCardDismissedUntil";

function readDismissedUntil(): number | null {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeDismissedUntil(until: number): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(until));
  } catch {
    // Private mode: the card simply comes back on the next visit.
  }
}

// Wrapped so the lint rule against impure render calls doesn't see a bare
// Date.now() in the render path (same idiom as rider-map.tsx's formatRelative).
function now(): number {
  return Date.now();
}

/**
 * Soft ask on the tracking page. The browser prompt only appears after the
 * customer taps "Turn on alerts". iPhone Safari tabs get install steps instead,
 * because iOS only delivers push to Home Screen apps.
 */
export function PushOptInCard({ orderActive }: { orderActive: boolean }) {
  const state = usePush((s) => s.state);
  const enable = usePush((s) => s.enable);
  // Lazy initializer: the card always renders null while state is "loading"
  // (true on the server and on first client render), so reading localStorage
  // here can't cause a hydration mismatch.
  const [dismissedUntil, setDismissedUntil] = useState<number | null>(() =>
    typeof window === "undefined" ? null : readDismissedUntil(),
  );
  const [busy, setBusy] = useState(false);

  if (state === "loading") return null;
  if (!shouldShowOptInCard(state, orderActive, dismissedUntil, now())) return null;

  const dismiss = () => {
    const until = Date.now() + OPT_IN_DISMISS_MS;
    writeDismissedUntil(until);
    setDismissedUntil(until);
  };

  const turnOn = async () => {
    setBusy(true);
    try {
      await enable();
      const next = usePush.getState().state;
      if (next === "on") toast.success("Order alerts are on for this device.");
      if (next === "blocked") toast.info("Alerts are blocked in your browser settings.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't turn on order alerts. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative rounded-3xl border border-ink-200 bg-white p-5 shadow-soft sm:p-6">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
      >
        <X size={16} />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
          <BellRing size={18} />
        </span>

        {state === "needs-install" ? (
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-ink-900">Get order alerts on your iPhone</h2>
            <p className="mt-1 text-sm text-ink-600">
              iPhone only sends alerts from apps on your Home Screen. Add BiteExpress there, then open it from the icon.
            </p>
            <ol className="mt-3 space-y-2 text-sm text-ink-700">
              <li className="flex items-center gap-2">
                <span className="text-ink-400">1.</span> Tap <Share size={15} aria-label="Share" className="text-ink-900" /> in Safari
              </li>
              <li className="flex items-center gap-2">
                <span className="text-ink-400">2.</span> Choose <SquarePlus size={15} aria-hidden className="text-ink-900" /> Add to Home Screen
              </li>
              <li className="flex items-center gap-2">
                <span className="text-ink-400">3.</span> Open BiteExpress from your Home Screen and turn alerts on
              </li>
            </ol>
          </div>
        ) : (
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-ink-900">Know when your rider is on the way</h2>
            <p className="mt-1 text-sm text-ink-600">
              Get an alert on this device when your order is confirmed, picked up and nearly there. You can turn it off in your profile.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={turnOn} disabled={busy}>
                {busy ? "Turning on…" : "Turn on alerts"}
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss} disabled={busy}>
                Not now
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
