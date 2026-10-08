"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Star, X } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import {
  cancelReviewReminder,
  fetchReviewReminder,
  type ReviewReminder as Reminder,
} from "@/lib/api/reviews";
import {
  canShowReminderOn,
  isOrderRated,
  markOrderRated,
  markReminderSeen,
  reminderSeenThisSession,
} from "@/lib/reviews/review-state";
import { showTabBar } from "@/lib/tab-bar";
import { cn } from "@/lib/cn";
import { RateOrderSheet } from "./rate-order-sheet";

/** Let the page the customer opened settle before anything slides in. */
const SHOW_DELAY_MS = 1500;

/**
 * Once per visit, asks a signed-in customer to rate their last delivered
 * order if they haven't. The backend picks the order (review-reminder)
 * and stops offering it once an item on it is reviewed or the customer
 * says not to ask again.
 */
export function ReviewReminder() {
  const pathname = usePathname();
  const token = useAuth((s) => s.token);
  const hydrated = useAuth((s) => s.hydrated);
  const [reminder, setReminder] = useState<Reminder | null>(null);
  const [visible, setVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!hydrated || !token) return;
    if (!canShowReminderOn(pathname) || reminderSeenThisSession()) return;

    // The visit only counts as reminded once the prompt is on screen, or the
    // server says there is nothing to ask. Marking it earlier would let a
    // remount or a quick page change swallow the reminder for the visit.
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    void fetchReviewReminder().then((found) => {
      if (cancelled) return;
      if (!found || isOrderRated(found.orderId)) {
        markReminderSeen();
        return;
      }
      timer = setTimeout(() => {
        markReminderSeen();
        setReminder(found);
        setVisible(true);
      }, SHOW_DELAY_MS);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [hydrated, token, pathname]);

  // Signing out mid-visit takes the prompt with it.
  if (!reminder || !token) return null;

  const dismiss = () => setVisible(false);
  const stopAsking = () => {
    markOrderRated(reminder.orderId);
    void cancelReviewReminder(reminder.orderId);
    setVisible(false);
  };

  return (
    <>
      {visible && !sheetOpen && canShowReminderOn(pathname) && (
        <div
          className={cn(
            "fixed inset-x-0 z-30 flex justify-center px-4 md:bottom-6 md:left-auto md:right-6 md:px-0",
            // Above the floating tab bar on phones; same gap the bar uses.
            showTabBar(pathname)
              ? "bottom-[calc(max(0.875rem,calc(env(safe-area-inset-bottom)_-_0.375rem))_+_4.5rem)]"
              : "bottom-[max(1rem,env(safe-area-inset-bottom))]",
          )}
        >
          <section
            aria-labelledby="review-reminder-title"
            className="sheet-up w-full max-w-[23rem] rounded-3xl border border-ink-200 bg-white p-4 shadow-floating"
          >
            <div className="flex items-start gap-3">
              <Thumbs images={reminder.images} />
              <div className="min-w-0 flex-1">
                <h2 id="review-reminder-title" className="text-sm font-semibold text-ink-900">
                  How was order #{reminder.orderId}?
                </h2>
                <p className="mt-0.5 text-sm text-ink-600">
                  Rate the store and your rider. It takes a few seconds.
                </p>
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Not now"
                className="-mr-2 -mt-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="btn-flame inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-pill text-sm font-medium text-white"
              >
                <Star size={15} className="fill-white" />
                Rate order
              </button>
              <button
                type="button"
                onClick={stopAsking}
                className="inline-flex h-11 items-center justify-center rounded-pill px-4 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900"
              >
                Don&apos;t ask again
              </button>
            </div>
          </section>
        </div>
      )}

      <RateOrderSheet
        orderId={reminder.orderId}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onRated={() => setVisible(false)}
      />
    </>
  );
}

function Thumbs({ images }: { images: string[] }) {
  const shown = images.slice(0, 2);
  if (shown.length === 0) {
    return (
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-canvas-sunken text-brand-orange">
        <Star size={20} className="fill-brand-orange" />
      </span>
    );
  }
  return (
    <div className="relative h-11 w-11 shrink-0">
      {shown.map((src, i) => (
        <span
          key={src}
          className={cn(
            "absolute overflow-hidden rounded-xl bg-canvas-sunken ring-2 ring-white",
            shown.length === 1 ? "inset-0" : "h-8 w-8",
            shown.length > 1 && (i === 0 ? "left-0 top-0" : "bottom-0 right-0"),
          )}
        >
          <Image src={src} alt="" fill sizes="44px" className="object-cover" />
        </span>
      ))}
    </div>
  );
}
