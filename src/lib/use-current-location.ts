"use client";

import { useCallback, useRef, useState } from "react";
import { useGoogleMaps } from "@/lib/maps";
import type { DeliveryLocation } from "@/lib/location-store";
import { toast } from "@/lib/toast";

/**
 * Reverse-geocodes a point to a human-readable address via the Maps
 * JS API. Returns null when Maps isn't loaded or the geocode fails;
 * callers fall back to a generic label.
 *
 * Shared by useCurrentLocation() below and the location handoff from
 * the marketing site, so the two don't drift apart.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  if (typeof google === "undefined") return null;
  try {
    const geocoder = new google.maps.Geocoder();
    const { results } = await geocoder.geocode({ location: { lat, lng } });
    return results?.[0]?.formatted_address ?? null;
  } catch {
    return null;
  }
}

/**
 * Browser geolocation + Google reverse geocode, shared by every
 * "Use my current location" control (header sheet, home hero).
 *
 * `locate()` resolves to the device's position, or null when the
 * browser can't or won't give one. Failures are already toasted, so
 * callers only need to handle the success path.
 */
export function useCurrentLocation() {
  const { isLoaded } = useGoogleMaps();
  const [locating, setLocating] = useState(false);
  // A second tap while the first request is in flight would stack
  // permission prompts on some browsers.
  const inFlight = useRef(false);

  const locate = useCallback((): Promise<DeliveryLocation | null> => {
    if (inFlight.current) return Promise.resolve(null);
    if (!navigator.geolocation) {
      toast.error("Your browser doesn't support location access.");
      return Promise.resolve(null);
    }
    inFlight.current = true;
    setLocating(true);

    return new Promise((resolve) => {
      const finish = (loc: DeliveryLocation | null) => {
        inFlight.current = false;
        setLocating(false);
        resolve(loc);
      };

      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude: lat, longitude: lng } = pos.coords;
          let formattedAddress = "Your current location";
          if (isLoaded) {
            const address = await reverseGeocode(lat, lng);
            if (address) formattedAddress = address;
          }
          finish({ formattedAddress, lat, lng });
        },
        (err) => {
          toast.error(
            err.code === err.PERMISSION_DENIED
              ? "Location access was blocked. Allow it in your browser settings, or search instead."
              : "Couldn't get your location. Try searching for your address instead.",
          );
          finish(null);
        },
        { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
      );
    });
  }, [isLoaded]);

  return { locating, locate };
}
