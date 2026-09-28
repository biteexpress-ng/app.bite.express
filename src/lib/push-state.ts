/**
 * Pure decisions behind the web push UI. No browser globals here so the
 * rules can be tested in node; src/lib/push.ts gathers the inputs.
 */

export type PushState =
  /** Server has push switched off, or no VAPID key. Show nothing. */
  | "disabled"
  /** This browser has no Push API. */
  | "unsupported"
  /** iPhone or iPad Safari tab: push only works from the Home Screen app. */
  | "needs-install"
  /** The customer denied notification permission. */
  | "blocked"
  | "off"
  | "on";

export type PushEnvironment = {
  serverEnabled: boolean;
  isIos: boolean;
  isStandalone: boolean;
  hasPushApis: boolean;
  permission: NotificationPermission | "unsupported";
  hasSubscription: boolean;
};

export function resolvePushState(env: PushEnvironment): PushState {
  if (!env.serverEnabled) return "disabled";
  if (env.isIos && !env.isStandalone) return "needs-install";
  if (!env.hasPushApis || env.permission === "unsupported") return "unsupported";
  if (env.permission === "denied") return "blocked";
  if (env.permission === "granted" && env.hasSubscription) return "on";
  return "off";
}

/** iPadOS 13+ reports itself as a Mac, so a touch-capable "Mac" counts too. */
export function isIosDevice(userAgent: string, maxTouchPoints: number): boolean {
  return (
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)
  );
}

export const OPT_IN_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldShowOptInCard(
  state: PushState,
  orderActive: boolean,
  dismissedUntil: number | null,
  now: number,
): boolean {
  if (!orderActive) return false;
  if (state !== "off" && state !== "needs-install") return false;
  return dismissedUntil === null || now >= dismissedUntil;
}

/**
 * Whether a subscription was made with the server's current VAPID key. After
 * a key rotation the old subscription can never be delivered to, so it has to
 * be replaced. A subscription that doesn't report its key can't be trusted.
 */
export function sameServerKey(subscriptionKey: ArrayBuffer | null, publicKey: string): boolean {
  if (!subscriptionKey) return false;
  let expected: Uint8Array;
  try {
    expected = urlBase64ToUint8Array(publicKey);
  } catch {
    return false;
  }
  const actual = new Uint8Array(subscriptionKey);
  return actual.length === expected.length && actual.every((byte, i) => byte === expected[i]);
}

/** VAPID public key (base64url) to the bytes PushManager.subscribe wants. */
export function urlBase64ToUint8Array(base64url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}
