"use client";

import { useSyncExternalStore } from "react";

/**
 * The current time floored to the minute, re-rendering subscribers when the
 * minute changes. One interval is shared by every subscriber, so a grid of
 * store cards does not start a timer each.
 *
 * Null during server render and hydration, so time-dependent text never
 * causes a hydration mismatch. Callers render nothing for null.
 */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  timer ??= setInterval(() => listeners.forEach((l) => l()), 15_000);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const getSnapshot = () => Math.floor(Date.now() / 60_000) * 60_000;
const getServerSnapshot = () => null;

export function useMinuteClock(): Date | null {
  const ms = useSyncExternalStore<number | null>(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return ms === null ? null : new Date(ms);
}
