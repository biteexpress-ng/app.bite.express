"use client";

import { create } from "zustand";
import { fetchPushConfig, subscribePush, unsubscribePush } from "@/lib/api/push";
import {
  isIosDevice,
  resolvePushState,
  urlBase64ToUint8Array,
  type PushState,
} from "@/lib/push-state";

const SW_URL = "/sw.js";

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

async function readState(): Promise<{ state: PushState; publicKey: string | null }> {
  const config = await fetchPushConfig();
  const state = resolvePushState({
    serverEnabled: config.enabled && config.public_key !== null,
    isIos: isIosDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0),
    isStandalone: isStandalone(),
    hasPushApis: hasPushApis(),
    permission: "Notification" in window ? Notification.permission : "unsupported",
    hasSubscription: (await currentSubscription()) !== null,
  });
  return { state, publicKey: config.public_key };
}

type PushStore = {
  state: PushState | "loading";
  publicKey: string | null;
  refresh: () => Promise<void>;
  /** Call only from a tap. Throws an Error with customer-facing text. */
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
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      }));

    const json = sub.toJSON();
    const saved =
      Boolean(json.endpoint && json.keys?.p256dh && json.keys?.auth) &&
      (await subscribePush({
        endpoint: json.endpoint as string,
        keys: { p256dh: json.keys?.p256dh as string, auth: json.keys?.auth as string },
      }));

    if (!saved) {
      await sub.unsubscribe().catch(() => undefined);
      set({ state: "off" });
      throw new Error("Couldn't turn on order alerts. Please try again.");
    }
    set({ state: "on" });
  },

  disable: async () => {
    const sub = await currentSubscription();
    if (sub) {
      await unsubscribePush(sub.endpoint);
      await sub.unsubscribe();
    }
    set({ state: "off" });
  },
}));

/**
 * Drops this browser's subscription on sign-out so the next person to use the
 * browser gets no alerts meant for the last one. The local unsubscribe is what
 * matters; the server call is best effort and is skipped when the token is
 * already dead (auth-expired), since it would only 401.
 */
export async function dropPushOnSignOut(token: string | null): Promise<void> {
  try {
    const sub = await currentSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      if (token) await unsubscribePush(endpoint, token);
    }
  } catch {
    // Sign-out must never fail because of push.
  }
  usePush.setState({ state: "loading", publicKey: null });
}
