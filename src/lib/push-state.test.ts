import { describe, expect, it } from "vitest";
import {
  OPT_IN_DISMISS_MS,
  isIosDevice,
  resolvePushState,
  shouldShowOptInCard,
  urlBase64ToUint8Array,
  type PushEnvironment,
} from "./push-state";

const base: PushEnvironment = {
  serverEnabled: true,
  isIos: false,
  isStandalone: false,
  hasPushApis: true,
  permission: "default",
  hasSubscription: false,
};

describe("resolvePushState", () => {
  it("is disabled when the server has push off or no key", () => {
    expect(resolvePushState({ ...base, serverEnabled: false, permission: "granted", hasSubscription: true })).toBe("disabled");
  });

  it("asks iPhone Safari tabs to install first", () => {
    expect(resolvePushState({ ...base, isIos: true, hasPushApis: false })).toBe("needs-install");
  });

  it("lets an installed iPhone app subscribe", () => {
    expect(resolvePushState({ ...base, isIos: true, isStandalone: true })).toBe("off");
  });

  it("is unsupported without the Push API", () => {
    expect(resolvePushState({ ...base, hasPushApis: false })).toBe("unsupported");
    expect(resolvePushState({ ...base, permission: "unsupported" })).toBe("unsupported");
  });

  it("is blocked after a denial", () => {
    expect(resolvePushState({ ...base, permission: "denied" })).toBe("blocked");
  });

  it("is on only with permission and a live subscription", () => {
    expect(resolvePushState({ ...base, permission: "granted", hasSubscription: true })).toBe("on");
    expect(resolvePushState({ ...base, permission: "granted", hasSubscription: false })).toBe("off");
  });
});

describe("isIosDevice", () => {
  it("spots iPhones and touch iPads posing as Macs", () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
    expect(isIosDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8)", 5)).toBe(false);
  });
});

describe("shouldShowOptInCard", () => {
  const now = 1_700_000_000_000;

  it("shows for off and needs-install on an active order", () => {
    expect(shouldShowOptInCard("off", true, null, now)).toBe(true);
    expect(shouldShowOptInCard("needs-install", true, null, now)).toBe(true);
  });

  it("hides for every other state", () => {
    for (const state of ["disabled", "unsupported", "blocked", "on"] as const) {
      expect(shouldShowOptInCard(state, true, null, now)).toBe(false);
    }
  });

  it("hides on finished orders", () => {
    expect(shouldShowOptInCard("off", false, null, now)).toBe(false);
  });

  it("stays hidden for seven days after Not now", () => {
    expect(shouldShowOptInCard("off", true, now + 1, now)).toBe(false);
    expect(shouldShowOptInCard("off", true, now - 1, now)).toBe(true);
    expect(OPT_IN_DISMISS_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe("urlBase64ToUint8Array", () => {
  it("decodes unpadded base64url", () => {
    expect(Array.from(urlBase64ToUint8Array("AQID_-8"))).toEqual([1, 2, 3, 255, 239]);
  });
});
