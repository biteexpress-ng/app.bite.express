/**
 * Pure decisions behind the app download nudge (the top banner and the
 * order-success card). No browser globals here so the rules can be tested
 * in node; the components gather the inputs (user agent, standalone mode,
 * localStorage) and call in.
 */

import { isIosDevice } from "./push-state";
import { siteConfig } from "./site-config";

export type StorePlatform = "ios" | "android" | "desktop";

export function storePlatform(userAgent: string, maxTouchPoints: number): StorePlatform {
  if (isIosDevice(userAgent, maxTouchPoints)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

export type StoreLink = { label: string; href: string };

const APP_STORE_LINK: StoreLink = { label: "App Store", href: siteConfig.appStore.ios };
const GOOGLE_PLAY_LINK: StoreLink = { label: "Google Play", href: siteConfig.appStore.android };

export function storeLinks(platform: StorePlatform): StoreLink[] {
  if (platform === "ios") return [APP_STORE_LINK];
  if (platform === "android") return [GOOGLE_PLAY_LINK];
  return [APP_STORE_LINK, GOOGLE_PLAY_LINK];
}

const HIDDEN_PREFIXES = ["/checkout", "/signin", "/signup"];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Everywhere the banner never shows: checkout, auth pages, and a single
 *  order's tracking page (where the push opt-in card already lives). The
 *  `/orders` list itself is fine. */
export function bannerHiddenOnPath(pathname: string): boolean {
  if (HIDDEN_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))) return true;
  return pathname.startsWith("/orders/");
}

export function shouldShowBanner(args: {
  pathname: string;
  standalone: boolean;
  hiddenUntil: number | null;
  now: number;
}): boolean {
  if (args.standalone) return false;
  if (bannerHiddenOnPath(args.pathname)) return false;
  return args.hiddenUntil === null || args.now >= args.hiddenUntil;
}

export const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;
export const STORE_TAP_MS = 30 * 24 * 60 * 60 * 1000;

export function nextHiddenUntil(reason: "dismiss" | "store", now: number): number {
  return now + (reason === "dismiss" ? DISMISS_MS : STORE_TAP_MS);
}
