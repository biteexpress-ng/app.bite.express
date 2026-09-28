import type { OrderStatus } from "@/lib/api/orders";
import { distanceKm, formatDistance } from "@/lib/geo";

/** The rider app posts its location every 10s while online. */
export const EN_ROUTE_POLL_MS = 10_000;
export const DEFAULT_POLL_MS = 20_000;
/** Past this, the map says the location is not updating. */
export const STALE_FIX_MS = 120_000;

const EN_ROUTE: ReadonlySet<OrderStatus> = new Set<OrderStatus>(["accepted", "handover", "picked_up"]);

export function pollIntervalMs(status: OrderStatus, hasRider: boolean): number {
  return hasRider && EN_ROUTE.has(status) ? EN_ROUTE_POLL_MS : DEFAULT_POLL_MS;
}

export type LatLng = { lat: number; lng: number };
/** A rider position and when it was recorded (epoch ms). */
export type RiderFix = LatLng & { at: number };

type RiderLocationFields = {
  lat?: number | string | null;
  lng?: number | string | null;
  location_updated_at?: string | null;
};

function toCoord(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** The rider position from /customer/order/track, or null if it can't be trusted. */
export function riderFixFromTrack(rider: RiderLocationFields | null | undefined): RiderFix | null {
  if (!rider) return null;
  const lat = toCoord(rider.lat);
  const lng = toCoord(rider.lng);
  const at = rider.location_updated_at ? Date.parse(rider.location_updated_at) : NaN;
  if (lat === null || lng === null || !Number.isFinite(at)) return null;
  return { lat, lng, at };
}

export function newerFix(a: RiderFix | null, b: RiderFix | null): RiderFix | null {
  if (!a) return b;
  if (!b) return a;
  return b.at > a.at ? b : a;
}

export function isStaleFix(fix: RiderFix | null, now: number): boolean {
  return fix !== null && now - fix.at > STALE_FIX_MS;
}

/** Straight-line distance, which is all we show; routed ETAs cost per call. */
export function riderDistanceLabel(fix: LatLng | null, destination: LatLng | null): string | null {
  if (!fix || !destination) return null;
  const metres = distanceKm(fix.lat, fix.lng, destination.lat, destination.lng) * 1000;
  const label = formatDistance(metres);
  return label ? `Your rider is ${label} away` : null;
}

export type MilestoneStatus = "pending" | "confirmed" | "processing" | "handover" | "delivered";

/** One row of the backend's order_timelines, as the track response returns it. */
export type TimelineRow = {
  event: string;
  actual_at?: string | null;
  created_at?: string | null;
};

export type SubEvent = { event: string; label: string; at: number };

// A Map, not an object literal, so an event named "constructor" can't match.
const SUB_EVENTS = new Map<string, { milestone: MilestoneStatus; label: string }>([
  ["rider_assigned", { milestone: "confirmed", label: "Rider assigned" }],
  ["on_the_way_to_store", { milestone: "processing", label: "Rider heading to the shop" }],
  ["rider_at_store", { milestone: "processing", label: "Rider at the shop" }],
  ["picked_up", { milestone: "handover", label: "Rider picked up your order" }],
  ["arriving_soon", { milestone: "handover", label: "Rider is nearly there" }],
  ["rider_arrived", { milestone: "handover", label: "Rider has arrived" }],
  ["delivery_delayed", { milestone: "handover", label: "Running later than expected" }],
]);

/** Groups timeline rows under the five milestones: first occurrence per event, oldest first. */
export function subEventsByMilestone(
  rows: readonly TimelineRow[],
): Partial<Record<MilestoneStatus, SubEvent[]>> {
  const first = new Map<string, SubEvent & { milestone: MilestoneStatus }>();
  for (const row of rows) {
    const def = SUB_EVENTS.get(row.event);
    if (!def) continue;
    const at = Date.parse(row.actual_at ?? row.created_at ?? "");
    if (!Number.isFinite(at)) continue;
    const seen = first.get(row.event);
    if (!seen || at < seen.at) {
      first.set(row.event, { event: row.event, label: def.label, at, milestone: def.milestone });
    }
  }

  const grouped: Partial<Record<MilestoneStatus, SubEvent[]>> = {};
  for (const { milestone, ...sub } of [...first.values()].sort((a, b) => a.at - b.at)) {
    (grouped[milestone] ??= []).push(sub);
  }
  return grouped;
}
