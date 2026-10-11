import { describe, expect, it } from "vitest";
import type { StoreSchedule } from "@/lib/api/store-detail";
import { isTemporarilyClosed, opensLabel } from "./store-hours";

function row(day: number, opening: string, closing: string): StoreSchedule {
  return { id: day, store_id: 1, day, opening_time: opening, closing_time: closing };
}

/** Every day 16:00 to 20:00:59, the most common shape on production. */
const evenings = [0, 1, 2, 3, 4, 5, 6].map((d) => row(d, "16:00:00", "20:00:59"));

// 2026-10-11 is a Sunday. Lagos is UTC+1 all year, so 14:20Z is 15:20 there.
const sunday = (utc: string) => new Date(`2026-10-11T${utc}Z`);

describe("opensLabel", () => {
  it("counts down in minutes inside the last hour", () => {
    expect(opensLabel({ open: 0, schedules: evenings }, sunday("14:20:00"))).toBe(
      "Opens in 40 min",
    );
    expect(opensLabel({ open: 0, schedules: evenings }, sunday("14:59:00"))).toBe(
      "Opens in 1 min",
    );
  });

  it("gives a clock time for a later opening today", () => {
    const sched = [row(0, "16:15:00", "21:00:00")];
    expect(opensLabel({ open: 0, schedules: sched }, sunday("09:00:00"))).toBe(
      "Opens at 4:15pm",
    );
    expect(opensLabel({ open: 0, schedules: evenings }, sunday("09:00:00"))).toBe(
      "Opens at 4pm",
    );
  });

  it("reads the store's clock, not the browser's or UTC", () => {
    // 14:30Z is 15:30 in Lagos: 30 minutes out, not 90.
    expect(opensLabel({ open: 0, schedules: evenings }, sunday("14:30:00"))).toBe(
      "Opens in 30 min",
    );
  });

  it("says tomorrow once today's hours are over", () => {
    // 21:00 Lagos on Sunday.
    expect(opensLabel({ open: 0, schedules: evenings }, sunday("20:00:00"))).toBe(
      "Opens tomorrow at 4pm",
    );
  });

  it("names the weekday for a store closed on Sundays", () => {
    const weekdays = [1, 2, 3, 4, 5].map((d) => row(d, "09:00:00", "17:00:00"));
    // Saturday 2026-10-10, 12:00 Lagos.
    expect(
      opensLabel({ open: 0, schedules: weekdays }, new Date("2026-10-10T11:00:00Z")),
    ).toBe("Opens Monday at 9am");
  });

  it("wraps to next week when the only day is today and it has passed", () => {
    const sundaysOnly = [row(0, "10:00:00", "14:00:00")];
    expect(opensLabel({ open: 0, schedules: sundaysOnly }, sunday("18:00:00"))).toBe(
      "Opens next Sunday at 10am",
    );
  });

  it("prefers the minute countdown across midnight", () => {
    const early = [row(1, "00:15:00", "06:00:00")];
    // Sunday 23:30 Lagos.
    expect(opensLabel({ open: 0, schedules: early }, sunday("22:30:00"))).toBe(
      "Opens in 45 min",
    );
  });

  it("picks the earlier of two windows on the same day", () => {
    const split = [row(0, "18:00:00", "22:00:00"), row(0, "12:00:00", "15:00:00")];
    expect(opensLabel({ open: 0, schedules: split }, sunday("15:30:00"))).toBe(
      "Opens at 6pm",
    );
  });

  it("is silent when the store is open", () => {
    expect(opensLabel({ open: 1, schedules: evenings }, sunday("09:00:00"))).toBeNull();
    expect(opensLabel({ schedules: evenings }, sunday("09:00:00"))).toBeNull();
  });

  it("is silent when the vendor switched the store off by hand", () => {
    expect(
      opensLabel({ open: 0, active: false, schedules: evenings }, sunday("09:00:00")),
    ).toBeNull();
    expect(
      opensLabel({ open: 0, active: 0, schedules: evenings }, sunday("09:00:00")),
    ).toBeNull();
  });

  it("is silent without a usable schedule", () => {
    expect(opensLabel({ open: 0, schedules: [] }, sunday("09:00:00"))).toBeNull();
    expect(opensLabel({ open: 0 }, sunday("09:00:00"))).toBeNull();
    // Closing at or before opening never opens, matching the API's check.
    expect(
      opensLabel({ open: 0, schedules: [row(0, "18:00:00", "02:00:00")] }, sunday("09:00:00")),
    ).toBeNull();
  });

  it("is silent once the store has opened since the list loaded", () => {
    // 17:00 Lagos is inside 16:00 to 20:00:59, but `open` is still the stale 0.
    expect(opensLabel({ open: 0, schedules: evenings }, sunday("16:00:00"))).toBeNull();
  });
});

describe("isTemporarilyClosed", () => {
  it("follows the vendor's switch, whatever the schedule says", () => {
    // Live shape: `open` comes from the schedule alone, so a switched-off
    // store can still arrive with open: 1.
    expect(isTemporarilyClosed({ open: 1, active: false })).toBe(true);
    expect(isTemporarilyClosed({ open: 0, active: 0 })).toBe(true);
    expect(isTemporarilyClosed({ open: 1, active: true })).toBe(false);
    expect(isTemporarilyClosed({ open: 1, active: 1 })).toBe(false);
  });

  it("treats a missing flag as switched on", () => {
    expect(isTemporarilyClosed({ open: 1 })).toBe(false);
  });
});
