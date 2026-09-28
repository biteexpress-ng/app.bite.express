"use client";

import { create } from "zustand";
import { fetchPushConfig, subscribePush, unsubscribePush } from "@/lib/api/push";
import {
  isIosDevice,
  resolvePushState,
  sameServerKey,
  urlBase64ToUint8Array,
  type PushState,
} from "@/lib/push-state";

const SW_URL = "/sw.js";

/** Thrown by `enable` with text that is safe to show the customer as is. */
export class PushError extends Error {}

function hasPushApis(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari-only flag, present when launched from the Home Screen.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!hasPushApis()) return null;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  return reg ? reg.pushManager.getSubscription() : null;
}

/** This browser's subscription for `publicKey`, replacing one made with an older key. */
async function subscriptionFor(
  reg: ServiceWorkerRegistration,
  publicKey: string,
): Promise<PushSubscription> {
  const existing = await reg.pushManager.getSubscription();
  if (existing && sameServerKey(existing.options.applicationServerKey, publicKey)) return existing;
  if (existing) await existing.unsubscribe().catch(() => undefined);
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
  });
}

/** Stores the subscription against the signed-in customer (an idempotent upsert). */
async function saveSubscription(sub: PushSubscription): Promise<boolean> {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
  return subscribePush({
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  });
}

/**
 * Brings an existing subscription up to date: onto the current key after a
 * rotation, and back onto this customer's account if the server row drifted
 * (a failed sign-out call, another account on the same browser). Permission
 * is already granted, so no tap is needed. Best effort: on failure the state
 * falls back to whatever the browser has.
 */
async function resyncSubscription(publicKey: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_URL);
    const existing = reg ? await reg.pushManager.getSubscription() : null;
    if (!reg || !existing) return;
    const sub = await subscriptionFor(reg, publicKey);
    const saved = await saveSubscription(sub);
    // A fresh subscription the server doesn't know about would read as "on"
    // while nothing can reach it. Drop it so the customer can turn alerts on.
    if (!saved && sub !== existing) await sub.unsubscribe().catch(() => undefined);
  } catch {
    // Refresh must never fail because of the re-sync.
  }
}

async function readState(): Promise<{ state: PushState; publicKey: string | null }> {
  const config = await fetchPushConfig();
  const serverEnabled = config.enabled && config.public_key !== null;
  const permission = "Notification" in window ? Notification.permission : "unsupported";
  if (serverEnabled && hasPushApis() && permission === "granted") {
    await resyncSubscription(config.public_key as string);
  }
  const state = resolvePushState({
    serverEnabled,
    isIos: isIosDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0),
    isStandalone: isStandalone(),
    hasPushApis: hasPushApis(),
    permission,
    hasSubscription: (await currentSubscription()) !== null,
  });
  return { state, publicKey: config.public_key };
}

type PushStore = {
  state: PushState | "loading";
  publicKey: string | null;
  refresh: () => Promise<void>;
  /** Call only from a tap. Throws a PushError with customer-facing text. */
  enable: () => Promise<void>;
  disable: () => Promise<void>;
};

export const usePush = create<PushStore>((set, get) => ({
  state: "loading",
  publicKey: null,

  refresh: async () => {
    if (typeof window === "undefined") return;
    try {
      set(await readState());
    } catch {
      set({ state: "disabled", publicKey: null });
    }
  },

  enable: async () => {
    const publicKey = get().publicKey;
    if (!publicKey) {
      set({ state: "disabled" });
      return;
    }

    // Ask first. Safari only shows the prompt while the tap is still being
    // handled, so no network call may come before this line.
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      set({ state: permission === "denied" ? "blocked" : "off" });
      return;
    }

    const reg = await navigator.serviceWorker.register(SW_URL);
    await navigator.serviceWorker.ready;
    const sub = await subscriptionFor(reg, publicKey);

    if (!(await saveSubscription(sub))) {
      await sub.unsubscribe().catch(() => undefined);
      set({ state: "off" });
      throw new PushError("Couldn't turn on order alerts. Please try again.");
    }
    set({ state: "on" });
  },

  disable: async () => {
    const sub = await currentSubscription();
    if (sub) {
      await unsubscribePush(sub.endpoint);
      await sub.unsubscribe().catch(() => undefined);
    }
    set({ state: "off" });
  },
}));

/**
 * Drops this browser's subscription on sign-out so the next person to use the
 * browser gets no alerts meant for the last one. The local unsubscribe is what
 * matters; the server call is best effort and is skipped when the token is
 * already dead (auth-expired), since it would only 401. The server call starts
 * first so it is already in flight if sign-out navigates away.
 */
export async function dropPushOnSignOut(token: string | null): Promise<void> {
  try {
    const sub = await currentSubscription();
    if (sub) {
      const serverDrop = token ? unsubscribePush(sub.endpoint, token) : Promise.resolve(false);
      await sub.unsubscribe();
      await serverDrop;
    }
  } catch {
    // Sign-out must never fail because of push.
  }
  usePush.setState({ state: "loading", publicKey: null });
}
