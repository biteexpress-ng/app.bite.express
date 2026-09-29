"use client";

import { api } from "@/lib/api-client";

/**
 * Zone-detect: given a lat/lng, find out whether BiteExpress delivers
 * to that point.
 *
 * Backend contract — GET /api/v1/config/get-zone-id?lat=&lng=
 *   200 → { zone_id: "[1,2]" (JSON-encoded), zone_data: [{id, status, …}] }
 *         At least one ACTIVE zone covers this point.
 *   404 → { errors: [{ code: "coordinates", message: "…" }] }
 *         No zone covers this point — we don't deliver here at all.
 *   403 → { errors: [{ code: "coordinates", message: "…" }] }
 *         A zone covers it, but every match is currently disabled —
 *         service temporarily paused in this area.
 *   403 → { errors: [{ code: "lat"|"lng", message: "…" }] }
 *         Validation error.
 *
 * We collapse those into a discriminated union the UI can switch on
 * without ever touching HTTP status codes itself.
 */

export type ZoneData = {
  id: number;
  status: number;
  digital_payment: number;
  offline_payment: number;
  /** Loaded via `with('modules')` on the backend. */
  modules?: Array<{ id: number; module_name?: string; module_type?: string }>;
};

export type ZoneCheck =
  | { kind: "in-zone"; zoneIds: number[]; zones: ZoneData[] }
  | { kind: "out-of-zone" }
  | { kind: "temp-unavailable" }
  | { kind: "skipped"; reason: string }
  | { kind: "error"; message: string };

type GetZoneOk = {
  /** JSON-encoded array — e.g. "[1,2]". */
  zone_id: string;
  zone_data: ZoneData[];
};

function parseZoneIds(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(Number).filter(Number.isFinite);
  } catch {
    /* fall through */
  }
  return [];
}

export async function checkZone(lat: number, lng: number): Promise<ZoneCheck> {
  const res = await api<GetZoneOk>(
    `/api/v1/config/get-zone-id?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
    { unauth: true },
  );

  if (res.ok) {
    return {
      kind: "in-zone",
      zoneIds: parseZoneIds(res.data.zone_id),
      zones: res.data.zone_data ?? [],
    };
  }

  if ("skipped" in res) {
    return { kind: "skipped", reason: res.reason };
  }

  if (res.status === 404) return { kind: "out-of-zone" };
  if (res.status === 403) return { kind: "temp-unavailable" };

  return {
    kind: "error",
    message: res.message || "We couldn't check your area right now.",
  };
}
