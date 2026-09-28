/**
 * Parses the location the marketing site (bite.express) hands off in
 * the URL when it sends a customer here: either
 * `?lat=<lat>&lng=<lng>` (rounded to 5 decimals, from "Use my current
 * location") or `?q=<typed address>` (from the site's own address
 * field). Pure and framework-free so it's cheap to unit test.
 */

export type ParsedHandoff =
  | { kind: "coords"; lat: number; lng: number }
  | { kind: "query"; q: string }
  | null;

const MAX_QUERY_LENGTH = 200;

export function parseHandoff(params: URLSearchParams): ParsedHandoff {
  const coords = parseCoords(params.get("lat"), params.get("lng"));
  if (coords) return coords;

  return parseQuery(params.get("q"));
}

function parseCoords(
  latRaw: string | null,
  lngRaw: string | null,
): { kind: "coords"; lat: number; lng: number } | null {
  if (latRaw === null || lngRaw === null) return null;

  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;

  return { kind: "coords", lat, lng };
}

function parseQuery(raw: string | null): { kind: "query"; q: string } | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return { kind: "query", q: trimmed.slice(0, MAX_QUERY_LENGTH) };
}
