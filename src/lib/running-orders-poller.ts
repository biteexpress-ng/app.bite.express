/**
 * Ref-counted polling core for the "running orders" count. Framework and
 * network agnostic on purpose, so it can be unit tested without React or
 * a DOM: the first subscriber starts the interval (and, in the browser,
 * a window focus listener), the last one to unsubscribe stops it.
 *
 * Several UI surfaces (header badge, hamburger inline count, mobile tab
 * bar dot) used to each run their own interval + focus listener + fetch.
 * Sharing one poller means a signed-in user triggers exactly one fetch
 * per tick, no matter how many of those surfaces are mounted at once.
 */

export type RunningOrdersFetcher = () => Promise<number | null>;

export type RunningOrdersPoller = {
  /** Subscribe to count changes. Returns an unsubscribe function.
   *  Matches React's useSyncExternalStore subscribe contract. */
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => number;
  /** Active subscriber count right now. */
  subscriberCount: () => number;
  /** Force an immediate refetch, independent of the interval. */
  refetch: () => Promise<void>;
  /** Zero the count immediately, without a fetch (e.g. on sign-out). */
  reset: () => void;
};

export function createRunningOrdersPoller(
  fetchCount: RunningOrdersFetcher,
  intervalMs = 60_000,
): RunningOrdersPoller {
  let count = 0;
  let subscribers = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((listener) => listener());
  }

  async function refresh() {
    const next = await fetchCount();
    // null means "the fetch failed, keep the last known count". This is
    // the same behaviour every call site had before this was centralised.
    if (next === null || next === count) return;
    count = next;
    notify();
  }

  function onFocus() {
    void refresh();
  }

  function start() {
    if (intervalId !== null) return;
    void refresh();
    intervalId = setInterval(() => void refresh(), intervalMs);
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onFocus);
    }
  }

  function stop() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", onFocus);
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      subscribers += 1;
      if (subscribers === 1) start();
      return () => {
        if (!listeners.has(listener)) return;
        listeners.delete(listener);
        subscribers = Math.max(0, subscribers - 1);
        if (subscribers === 0) stop();
      };
    },
    getSnapshot: () => count,
    subscriberCount: () => subscribers,
    refetch: refresh,
    reset() {
      if (count === 0) return;
      count = 0;
      notify();
    },
  };
}
