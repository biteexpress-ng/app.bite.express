"use client";

import { useJsApiLoader } from "@react-google-maps/api";

/**
 * Google Maps JS API loader — shared across every map / autocomplete
 * surface so we don't accidentally include the script multiple times.
 *
 * Env: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
 *
 * Loaded libraries:
 *   - "places" for the address autocomplete on the home / checkout
 *     screens.
 *   - "geometry" for distance / polygon math (used by zone matching).
 *
 * Returns the standard {isLoaded, loadError} shape from
 * @react-google-maps/api so consumers can render skeletons /
 * fallbacks deterministically.
 */

const LIBRARIES: ("places" | "geometry")[] = ["places", "geometry"];

export function useGoogleMaps() {
  return useJsApiLoader({
    id: "biteexpress-google-maps",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "",
    libraries: LIBRARIES,
  });
}

/** Default map style + viewport options used across the app. */
export const DEFAULT_MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
};

/** Nigeria-ish default — used as a fallback centre before the user
 *  picks their location. Roughly the geographic centroid. */
export const NIGERIA_CENTRE = { lat: 9.082, lng: 8.6753 } as const;
