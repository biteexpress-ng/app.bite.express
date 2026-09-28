"use client";

import { useState, useSyncExternalStore } from "react";
import { Apple, PlayCircle, Sparkles, X } from "lucide-react";
import { storeLinks, storePlatform } from "@/lib/app-nudge";

/** Same mounted-flag idiom as app-download-banner.tsx: false on the server
 *  and the first client render, true right after, no mount-effect setState. */
function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Shown once on the order success page. Dismissible for that view only:
 * nothing is stored, so it comes back on the next order. Client-only
 * (user agent), so it renders nothing until mounted.
 */
export function AppDownloadSuccessCard() {
  const mounted = useMounted();
  const [dismissed, setDismissed] = useState(false);

  if (!mounted || dismissed) return null;

  const platform = storePlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  const links = storeLinks(platform);
  const singleButton = platform === "ios" || platform === "android";

  return (
    <div className="fade-up relative mt-6 rounded-3xl border border-ink-200 bg-white p-5 text-left shadow-soft sm:p-6">
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
      >
        <X size={16} />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
          <Sparkles size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-ink-900">Save on your next order</h2>
          <p className="mt-1 text-sm text-ink-600">
            Coupons are only available in the BiteExpress app.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {singleButton ? (
              <a
                href={links[0].href}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-flame inline-flex h-10 items-center justify-center rounded-pill px-4 text-sm font-medium text-white"
              >
                Get the app
              </a>
            ) : (
              links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-ink-300 bg-white px-4 text-sm font-medium text-ink-900 transition-colors hover:border-ink-400"
                >
                  {link.label === "App Store" ? (
                    <Apple size={15} />
                  ) : (
                    <PlayCircle size={15} />
                  )}
                  {link.label}
                </a>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
