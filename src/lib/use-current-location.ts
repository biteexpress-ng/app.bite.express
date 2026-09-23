"use client";

import { useCallback, useRef, useState } from "react";
import { useGoogleMaps } from "@/lib/maps";
import type { DeliveryLocation } from "@/lib/location-store";
import { toast } from "@/lib/toast";

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
          if (isLoaded && typeof google !== "undefined") {
            try {
              const geocoder = new google.maps.Geocoder();
              const { results } = await geocoder.geocode({
                location: { lat, lng },
              });
              if (results?.[0]?.formatted_address) {
                formattedAddress = results[0].formatted_address;
              }
            } catch {
              /* keep the generic label */
            }
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
