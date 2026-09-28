import { describe, expect, it } from "vitest";
import {
  DEFAULT_POLL_MS,
  EN_ROUTE_POLL_MS,
  STALE_FIX_MS,
  isStaleFix,
  newerFix,
  pollIntervalMs,
  riderDistanceLabel,
  riderFixFromTrack,
  subEventsByMilestone,
  trackRider,
} from "./tracking";

describe("pollIntervalMs", () => {
  it("matches the rider's 10s ping while a rider is en route", () => {
    expect(pollIntervalMs("picked_up", true)).toBe(EN_ROUTE_POLL_MS);
    expect(pollIntervalMs("handover", true)).toBe(EN_ROUTE_POLL_MS);
    expect(pollIntervalMs("accepted", true)).toBe(EN_ROUTE_POLL_MS);
  });

  it("uses 20s otherwise", () => {
    expect(pollIntervalMs("picked_up", false)).toBe(DEFAULT_POLL_MS);
    expect(pollIntervalMs("processing", true)).toBe(DEFAULT_POLL_MS);
    expect(pollIntervalMs("pending", false)).toBe(DEFAULT_POLL_MS);
  });
});

describe("riderFixFromTrack", () => {
  it("reads string coordinates and the timestamp", () => {
    expect(
      riderFixFromTrack({ lat: "6.5244", lng: "3.3792", location_updated_at: "2026-09-28T10:00:00+01:00" }),
    ).toEqual({ lat: 6.5244, lng: 3.3792, at: Date.parse("2026-09-28T10:00:00+01:00") });
  });

  it("returns null without coordinates or a usable timestamp", () => {
    expect(riderFixFromTrack(null)).toBeNull();
    expect(riderFixFromTrack({ lat: null, lng: "3.3", location_updated_at: "2026-09-28T10:00:00Z" })).toBeNull();
    expect(riderFixFromTrack({ lat: "", lng: "3.3", location_updated_at: "2026-09-28T10:00:00Z" })).toBeNull();
    expect(riderFixFromTrack({ lat: "6.5", lng: "3.3", location_updated_at: null })).toBeNull();
    expect(riderFixFromTrack({ lat: "6.5", lng: "3.3", location_updated_at: "not a date" })).toBeNull();
  });
});

describe("newerFix", () => {
  const a = { lat: 1, lng: 1, at: 100 };
  const b = { lat: 2, lng: 2, at: 200 };

  it("keeps the later fix from either source", () => {
    expect(newerFix(a, b)).toBe(b);
    expect(newerFix(b, a)).toBe(b);
    expect(newerFix(null, a)).toBe(a);
    expect(newerFix(a, null)).toBe(a);
    expect(newerFix(null, null)).toBeNull();
  });
});

describe("isStaleFix", () => {
  it("flags a fix older than two minutes", () => {
    const fix = { lat: 1, lng: 1, at: 1_000_000 };
    expect(isStaleFix(fix, fix.at + STALE_FIX_MS)).toBe(false);
    expect(isStaleFix(fix, fix.at + STALE_FIX_MS + 1)).toBe(true);
    expect(isStaleFix(null, 5)).toBe(false);
  });
});

describe("riderDistanceLabel", () => {
  it("says how far the rider is from the drop-off", () => {
    const destination = { lat: 6.5244, lng: 3.3792 };
    expect(riderDistanceLabel({ lat: 6.5352, lng: 3.3792 }, destination)).toBe("Your rider is 1.2 km away");
    expect(riderDistanceLabel({ lat: 6.5271, lng: 3.3792 }, destination)).toBe("Your rider is 300 m away");
  });

  it("returns null when either point is missing", () => {
    expect(riderDistanceLabel(null, { lat: 1, lng: 1 })).toBeNull();
    expect(riderDistanceLabel({ lat: 1, lng: 1 }, null)).toBeNull();
  });
});

describe("subEventsByMilestone", () => {
  it("groups known events under their milestone, oldest first", () => {
    const grouped = subEventsByMilestone([
      { event: "arriving_soon", actual_at: "2026-09-28T10:20:00Z" },
      { event: "rider_assigned", actual_at: "2026-09-28T10:02:00Z" },
      { event: "picked_up", actual_at: "2026-09-28T10:10:00Z" },
      { event: "rider_at_store", created_at: "2026-09-28T10:06:00Z" },
    ]);

    expect(grouped.confirmed?.map((s) => s.event)).toEqual(["rider_assigned"]);
    expect(grouped.processing?.map((s) => s.event)).toEqual(["rider_at_store"]);
    expect(grouped.handover?.map((s) => s.event)).toEqual(["picked_up", "arriving_soon"]);
    expect(grouped.handover?.[0].label).toBe("Rider picked up your order");
  });

  it("keeps the first occurrence of a repeated event", () => {
    const grouped = subEventsByMilestone([
      { event: "delivery_delayed", actual_at: "2026-09-28T10:40:00Z" },
      { event: "delivery_delayed", actual_at: "2026-09-28T10:30:00Z" },
    ]);
    expect(grouped.handover).toEqual([
      { event: "delivery_delayed", label: "Running later than expected", at: Date.parse("2026-09-28T10:30:00Z") },
    ]);
  });

  it("ignores milestone events, unknown events and bad times", () => {
    const grouped = subEventsByMilestone([
      { event: "order_placed", actual_at: "2026-09-28T10:00:00Z" },
      { event: "confirmed", actual_at: "2026-09-28T10:01:00Z" },
      { event: "constructor", actual_at: "2026-09-28T10:01:00Z" },
      { event: "rider_assigned", actual_at: null, created_at: null },
    ]);
    expect(grouped).toEqual({});
  });
});

describe("trackRider", () => {
  const rider = { id: 7, f_name: "Ada" };

  it("reads the object shape the track endpoint actually returns", () => {
    expect(trackRider(rider)).toBe(rider);
  });

  it("still reads the array shape", () => {
    expect(trackRider([rider])).toBe(rider);
  });

  it("returns null when there is no rider", () => {
    expect(trackRider(null)).toBeNull();
    expect(trackRider(undefined)).toBeNull();
    expect(trackRider([])).toBeNull();
  });
});
