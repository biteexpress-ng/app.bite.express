"use client";

import { create } from "zustand";

/**
 * Tracks the customer's "last seen notifications" timestamp so the
 * bell badge can count unread items. Backend has no per-row read
 * state today — this lives purely client-side in localStorage.
 *
 * On hitting /notifications we bump the seen-at to now; the badge
 * disappears until the next notification with a newer created_at.
 */

const STORAGE_KEY = "biteexpress.notifications.lastSeen";

type State = {
  lastSeenAt: number; // unix ms
  hydrated: boolean;
  hydrate: () => void;
  markAllSeen: () => void;
};

function read(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function write(n: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(n));
  } catch {
    /* quota / disabled — accept */
  }
}

export const useNotificationsSeen = create<State>((set, get) => ({
  lastSeenAt: 0,
  hydrated: false,
  hydrate: () => {
    if (get().hydrated) return;
    set({ lastSeenAt: read(), hydrated: true });
  },
  markAllSeen: () => {
    const now = Date.now();
    write(now);
    set({ lastSeenAt: now });
  },
}));
