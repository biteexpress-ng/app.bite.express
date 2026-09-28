import { describe, expect, it } from "vitest";
import { siteConfig } from "./site-config";
import {
  DISMISS_MS,
  STORE_TAP_MS,
  bannerHiddenOnPath,
  nextHiddenUntil,
  shouldShowBanner,
  storeLinks,
  storePlatform,
} from "./app-nudge";

describe("storePlatform", () => {
  it("spots iPhones and touch iPads posing as Macs", () => {
    expect(storePlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)", 5)).toBe("ios");
    expect(storePlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe("ios");
  });

  it("spots Android", () => {
    expect(storePlatform("Mozilla/5.0 (Linux; Android 14; Pixel 8)", 5)).toBe("android");
  });

  it("falls back to desktop for anything else, including a non-touch Mac", () => {
    expect(storePlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe("desktop");
    expect(storePlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 0)).toBe("desktop");
  });
});

describe("storeLinks", () => {
  it("gives iOS just the App Store", () => {
    expect(storeLinks("ios")).toEqual([{ label: "App Store", href: siteConfig.appStore.ios }]);
  });

  it("gives Android just Google Play", () => {
    expect(storeLinks("android")).toEqual([{ label: "Google Play", href: siteConfig.appStore.android }]);
  });

  it("gives desktop both", () => {
    expect(storeLinks("desktop")).toEqual([
      { label: "App Store", href: siteConfig.appStore.ios },
      { label: "Google Play", href: siteConfig.appStore.android },
    ]);
  });
});

describe("bannerHiddenOnPath", () => {
  it("hides on checkout and everything under it", () => {
    expect(bannerHiddenOnPath("/checkout")).toBe(true);
    expect(bannerHiddenOnPath("/checkout/success")).toBe(true);
    expect(bannerHiddenOnPath("/checkout/offline/123")).toBe(true);
  });

  it("does not hide on a path that merely starts with the same letters", () => {
    expect(bannerHiddenOnPath("/checkout-foo")).toBe(false);
  });

  it("hides on signin and signup", () => {
    expect(bannerHiddenOnPath("/signin")).toBe(true);
    expect(bannerHiddenOnPath("/signup")).toBe(true);
    expect(bannerHiddenOnPath("/signin-help")).toBe(false);
  });

  it("hides on a single order's tracking page but not the orders list", () => {
    expect(bannerHiddenOnPath("/orders/123")).toBe(true);
    expect(bannerHiddenOnPath("/orders")).toBe(false);
    expect(bannerHiddenOnPath("/orders-foo")).toBe(false);
  });

  it("shows everywhere else", () => {
    expect(bannerHiddenOnPath("/")).toBe(false);
    expect(bannerHiddenOnPath("/browse")).toBe(false);
    expect(bannerHiddenOnPath("/store/9")).toBe(false);
    expect(bannerHiddenOnPath("/profile")).toBe(false);
  });
});

describe("shouldShowBanner", () => {
  const now = 1_700_000_000_000;

  it("never shows in standalone mode, regardless of path or timer", () => {
    expect(
      shouldShowBanner({ pathname: "/browse", standalone: true, hiddenUntil: null, now }),
    ).toBe(false);
  });

  it("hides on a path the banner is never shown on", () => {
    expect(
      shouldShowBanner({ pathname: "/checkout", standalone: false, hiddenUntil: null, now }),
    ).toBe(false);
  });

  it("shows with no stored timer", () => {
    expect(
      shouldShowBanner({ pathname: "/browse", standalone: false, hiddenUntil: null, now }),
    ).toBe(true);
  });

  it("stays hidden until the stored timer elapses", () => {
    expect(
      shouldShowBanner({ pathname: "/browse", standalone: false, hiddenUntil: now + 1, now }),
    ).toBe(false);
    expect(
      shouldShowBanner({ pathname: "/browse", standalone: false, hiddenUntil: now, now }),
    ).toBe(true);
    expect(
      shouldShowBanner({ pathname: "/browse", standalone: false, hiddenUntil: now - 1, now }),
    ).toBe(true);
  });
});

describe("nextHiddenUntil", () => {
  const now = 1_700_000_000_000;

  it("hides for 7 days after a dismiss", () => {
    expect(DISMISS_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(nextHiddenUntil("dismiss", now)).toBe(now + DISMISS_MS);
  });

  it("hides for 30 days after a store tap", () => {
    expect(STORE_TAP_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(nextHiddenUntil("store", now)).toBe(now + STORE_TAP_MS);
  });
});
