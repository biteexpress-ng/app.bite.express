import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRunningOrdersPoller } from "./running-orders-poller";

describe("createRunningOrdersPoller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches once per tick no matter how many subscribers are listening", async () => {
    const fetchCount = vi.fn().mockResolvedValue(3);
    const poller = createRunningOrdersPoller(fetchCount, 60_000);

    const unsubA = poller.subscribe(() => {});
    const unsubB = poller.subscribe(() => {});
    const unsubC = poller.subscribe(() => {});

    await vi.advanceTimersByTimeAsync(0); // flush the immediate fetch from the first subscribe
    expect(fetchCount).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchCount).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchCount).toHaveBeenCalledTimes(3);

    unsubA();
    unsubB();
    unsubC();
  });

  it("keeps polling while at least one subscriber remains, and stops once the last one unsubscribes", async () => {
    const fetchCount = vi.fn().mockResolvedValue(1);
    const poller = createRunningOrdersPoller(fetchCount, 60_000);

    const unsubA = poller.subscribe(() => {});
    const unsubB = poller.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchCount).toHaveBeenCalledTimes(1);

    unsubA();
    expect(poller.subscriberCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchCount).toHaveBeenCalledTimes(2);

    unsubB();
    expect(poller.subscriberCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(fetchCount).toHaveBeenCalledTimes(2); // no more ticks after the last unsubscribe
  });

  it("restarts with a fresh immediate fetch when a new subscriber arrives after the last one left", async () => {
    const fetchCount = vi.fn().mockResolvedValue(5);
    const poller = createRunningOrdersPoller(fetchCount, 60_000);

    const first = poller.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchCount).toHaveBeenCalledTimes(1);
    first();

    const second = poller.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchCount).toHaveBeenCalledTimes(2);
    second();
  });

  it("notifies listeners only when the fetched count actually changes", async () => {
    const fetchCount = vi.fn().mockResolvedValue(2);
    const poller = createRunningOrdersPoller(fetchCount, 60_000);
    const listener = vi.fn();
    const unsub = poller.subscribe(listener);

    await vi.advanceTimersByTimeAsync(0);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(poller.getSnapshot()).toBe(2);

    await vi.advanceTimersByTimeAsync(60_000); // resolves to 2 again, unchanged
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
  });

  it("skips the update when fetchCount resolves null, keeping the last known count", async () => {
    const fetchCount = vi.fn().mockResolvedValue(null);
    const poller = createRunningOrdersPoller(fetchCount, 60_000);
    const listener = vi.fn();
    const unsub = poller.subscribe(listener);

    await vi.advanceTimersByTimeAsync(0);
    expect(poller.getSnapshot()).toBe(0);
    expect(listener).not.toHaveBeenCalled();

    unsub();
  });

  it("reset() zeroes the count immediately and notifies, without fetching", () => {
    const fetchCount = vi.fn().mockResolvedValue(9);
    const poller = createRunningOrdersPoller(fetchCount, 60_000);
    const listener = vi.fn();
    const unsub = poller.subscribe(listener);

    poller.reset();
    expect(poller.getSnapshot()).toBe(0);

    unsub();
  });
});
