"use client";

import { api } from "@/lib/api-client";
import { distanceKm } from "@/lib/geo";

type LatLng = { lat: number; lng: number };

/**
 * GET /api/v1/config/direction-api (ConfigController@direction_api)
 * proxies Google's Routes API. It answers HTTP 200 even when the
 * upstream call fails: a cURL failure comes back as {"error": "..."},
 * "no route" as an empty array and an empty upstream body as null. So
 * the distance is read defensively and anything unusable is null.
 */
export function roadDistanceKm(body: unknown): number | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const routes = (body as { routes?: unknown }).routes;
  if (!Array.isArray(routes) || routes.length === 0) return null;
  const first = routes[0] as { distanceMeters?: unknown } | null;
  const metres = Number(first?.distanceMeters);
  if (!Number.isFinite(metres) || metres <= 0) return null;
  return metres / 1000;
}

/**
 * Kilometres a parcel is priced on: the road distance when the proxy
 * gave one, otherwise the straight line. Rounded to the metre so the
 * number the preview is sent and the number the order is sent are the
 * same value.
 */
export function parcelDistanceKm(
  roadKm: number | null,
  from: LatLng,
  to: LatLng,
): number {
  const km = roadKm ?? distanceKm(from.lat, from.lng, to.lat, to.lng);
  return Math.round(km * 1000) / 1000;
}

/** Road distance in km, or null on any failure. Never throws. */
export async function fetchRoadDistanceKm(
  from: LatLng,
  to: LatLng,
): Promise<number | null> {
  const query = new URLSearchParams({
    origin_lat: String(from.lat),
    origin_lng: String(from.lng),
    destination_lat: String(to.lat),
    destination_lng: String(to.lng),
  });
  const res = await api<unknown>(
    `/api/v1/config/direction-api?${query.toString()}`,
    { unauth: true, timeoutMs: 8000 },
  );
  return res.ok ? roadDistanceKm(res.data) : null;
}
