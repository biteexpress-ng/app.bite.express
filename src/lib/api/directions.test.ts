import { describe, expect, it } from "vitest";
import { distanceKm } from "@/lib/geo";
import { parcelDistanceKm, roadDistanceKm } from "./directions";

const ikeja = { lat: 6.6018, lng: 3.3515 };
const ikoyi = { lat: 6.4541, lng: 3.4218 };

describe("roadDistanceKm", () => {
  it("reads the first route's distanceMeters as kilometres", () => {
    expect(roadDistanceKm({ routes: [{ distanceMeters: 18450, duration: "1500s" }] })).toBe(18.45);
  });

  it("accepts a numeric string", () => {
    expect(roadDistanceKm({ routes: [{ distanceMeters: "9000" }] })).toBe(9);
  });

  it("returns null for every shape the proxy sends when Google has no answer", () => {
    // cURL failure: the proxy returns ['error' => ...] with HTTP 200.
    expect(roadDistanceKm({ error: "Could not resolve host: routes.googleapis.com" })).toBeNull();
    // No route: json_decode('{}', true) re-encodes as [].
    expect(roadDistanceKm([])).toBeNull();
    // Empty upstream body.
    expect(roadDistanceKm(null)).toBeNull();
    expect(roadDistanceKm({})).toBeNull();
    expect(roadDistanceKm({ routes: [] })).toBeNull();
    expect(roadDistanceKm({ routes: [{}] })).toBeNull();
    expect(roadDistanceKm({ routes: [{ distanceMeters: 0 }] })).toBeNull();
    expect(roadDistanceKm({ routes: [{ distanceMeters: "abc" }] })).toBeNull();
  });
});

describe("parcelDistanceKm", () => {
  it("prices on the road distance when there is one", () => {
    expect(parcelDistanceKm(18.45, ikeja, ikoyi)).toBe(18.45);
  });

  it("falls back to the straight line, never to zero", () => {
    const straight = distanceKm(ikeja.lat, ikeja.lng, ikoyi.lat, ikoyi.lng);
    expect(parcelDistanceKm(null, ikeja, ikoyi)).toBe(Math.round(straight * 1000) / 1000);
    expect(parcelDistanceKm(null, ikeja, ikoyi)).toBeGreaterThan(15);
  });

  it("rounds to the metre so the preview and the order send the same figure", () => {
    expect(parcelDistanceKm(18.4567891, ikeja, ikoyi)).toBe(18.457);
  });
});
