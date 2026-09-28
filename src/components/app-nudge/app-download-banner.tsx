"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Apple, PlayCircle, X } from "lucide-react";
import {
  nextHiddenUntil,
  shouldShowBanner,
  storeLinks,
  storePlatform,
} from "@/lib/app-nudge";
import { cn } from "@/lib/cn";

const HIDDEN_UNTIL_KEY = "biteexpress.appNudgeHiddenUntil";

function readHiddenUntil(): number | null {
  try {
    const raw = window.localStorage.getItem(HIDDEN_UNTIL_KEY);
    const value = raw ? Number(raw) : NaN;
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function writeHiddenUntil(until: number): void {
  try {
    window.localStorage.setItem(HIDDEN_UNTIL_KEY, String(until));
  } catch {
    // Private mode: the banner simply comes back on the next visit.
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari-only flag, present when launched from the Home Screen.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// Wrapped so the lint rule against impure render calls doesn't see a bare
// Date.now() in the render path (same idiom as push-optin-card.tsx).
function now(): number {
  return Date.now();
}

/**
 * True only once this component has mounted on the client. Server render
 * and the first client render both see `false` (so hydration can never
 * mismatch); the client flips to `true` right after, without a setState
 * call in a mount effect.
 */
function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Slim strip under the header nudging customers toward the app, where
 * coupons and smoother ordering live. Client-only: user agent, standalone
 * mode and localStorage are all browser state, so it renders nothing on
 * the server and on the first client paint.
 */
export function AppDownloadBanner() {
  const pathname = usePathname();
  const mounted = useMounted();
  // Lazy initializer: the banner always renders null until `mounted` is
  // true (server and first client render both do), so reading localStorage
  // here can't cause a hydration mismatch.
  const [hiddenUntil, setHiddenUntil] = useState<number | null>(() =>
    typeof window === "undefined" ? null : readHiddenUntil(),
  );

  if (!mounted) return null;

  const standalone = isStandalone();
  if (!shouldShowBanner({ pathname, standalone, hiddenUntil, now: now() })) return null;

  const platform = storePlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  const links = storeLinks(platform);
  const singleButton = platform === "ios" || platform === "android";

  const hideFor = (reason: "dismiss" | "store") => {
    const until = nextHiddenUntil(reason, now());
    writeHiddenUntil(until);
    setHiddenUntil(until);
  };

  return (
    <div className="border-b border-ink-200 bg-canvas-sunken">
      <div className="mx-auto flex max-w-[80rem] items-center gap-3 px-5 py-2 sm:px-6 lg:px-8">
        {singleButton && (
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={32}
            height={32}
            className="h-7 w-7 shrink-0 rounded-lg"
          />
        )}
        <p className="min-w-0 flex-1 text-xs leading-snug text-ink-700 sm:text-sm">
          Get coupons and smoother ordering in the BiteExpress app
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {singleButton ? (
            <a
              href={links[0].href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => hideFor("store")}
              className="btn-flame inline-flex h-8 items-center justify-center rounded-pill px-4 text-xs font-medium text-white"
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
                onClick={() => hideFor("store")}
                className="inline-flex items-center gap-1.5 rounded-pill border border-ink-300 bg-white px-3 py-1.5 text-xs font-medium text-ink-900 transition-colors hover:border-ink-400"
              >
                {link.label === "App Store" ? (
                  <Apple size={14} />
                ) : (
                  <PlayCircle size={14} />
                )}
                <span className="hidden sm:inline">{link.label}</span>
              </a>
            ))
          )}
          <button
            type="button"
            onClick={() => hideFor("dismiss")}
            aria-label="Dismiss"
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700",
            )}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
