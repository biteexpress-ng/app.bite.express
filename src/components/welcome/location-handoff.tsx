"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { hasGoogleMapsKey, useGoogleMaps } from "@/lib/maps";
import { useLocation, type DeliveryLocation } from "@/lib/location-store";
import { reverseGeocode } from "@/lib/use-current-location";
import { parseHandoff, type ParsedHandoff } from "@/lib/location-handoff";

type LocationHandoffProps = {
  /** Called when a handed-off query couldn't be resolved to exactly
   *  one confident place. The caller should pre-fill and focus the
   *  AddressPicker with this text so the customer can pick from
   *  suggestions instead of typing it again. */
  onNeedsInput: (query: string) => void;
};

/**
 * Receives the location the marketing site (bite.express) hands off
 * in the URL ("Use my current location" -> ?lat&lng, or a typed
 * address -> ?q) and resolves it into the location store, so a
 * customer doesn't have to enter their address twice.
 *
 * useSearchParams needs a Suspense boundary to keep the page
 * statically rendered, so the actual work lives in the inner
 * component.
 */
export function LocationHandoff(props: LocationHandoffProps) {
  return (
    <Suspense fallback={null}>
      <LocationHandoffInner {...props} />
    </Suspense>
  );
}

function LocationHandoffInner({ onNeedsInput }: LocationHandoffProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isLoaded, loadError } = useGoogleMaps();
  const hasKey = hasGoogleMapsKey();
  const setLocation = useLocation((s) => s.set);

  // Parsed once, from whatever search params are present on first
  // render. A lazy initializer rather than an effect, so there's no
  // setState-in-effect and no risk of re-parsing after the URL below
  // is scrubbed.
  const [pending, setPending] = useState<ParsedHandoff>(() =>
    parseHandoff(searchParams),
  );
  const [resolving, setResolving] = useState(pending !== null);
  const scrubbedRef = useRef(false);

  // Scrub the handoff params from the address bar once, so a refresh
  // doesn't repeat it. This only touches browser history, not React
  // state, so it belongs in an effect body.
  useEffect(() => {
    if (scrubbedRef.current) return;
    if (!pending) return;
    scrubbedRef.current = true;
    router.replace("/", { scroll: false });
    // Runs once on mount, acting on the params claimed above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve the claimed handoff once the Maps loader has settled
  // (loaded, errored, or simply absent).
  useEffect(() => {
    if (!pending) return;
    if (hasKey && !isLoaded && !loadError) return;

    let cancelled = false;
    const canGeocode = hasKey && isLoaded;
    const target = pending;

    async function run() {
      if (target.kind === "coords") {
        const { lat, lng } = target;
        let formattedAddress = "Your current location";
        if (canGeocode) {
          const address = await reverseGeocode(lat, lng);
          if (address) formattedAddress = address;
        }
        if (cancelled) return;
        // setLocation and setResolving land in the same synchronous
        // continuation (no await between them) so React batches them
        // into one render. Otherwise ZoneResult (which reacts to the
        // store) can paint a frame before "Finding your address…"
        // clears, flashing the loading line underneath it.
        setLocation({ formattedAddress, lat, lng });
        setResolving(false);
        return;
      }

      const { q } = target;
      const resolved = canGeocode ? await geocodeQuery(q) : null;
      if (cancelled) return;
      if (resolved) {
        setLocation(resolved);
      } else {
        onNeedsInput(q);
      }
      setResolving(false);
    }

    run().finally(() => {
      if (!cancelled) setPending(null);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, isLoaded, loadError, hasKey]);

  if (!resolving) return null;

  return (
    <div className="mt-3 flex items-center justify-center gap-2 text-xs text-white/60">
      <Loader2 size={13} className="animate-spin" />
      Finding your address…
    </div>
  );
}

/**
 * Geocodes a customer's typed text to a single Nigerian address. Only
 * a confident, unambiguous match counts: a lone result that Google
 * isn't merely guessing at (partial_match). Anything else (zero,
 * several, partial, or an error) returns null so the caller falls
 * back to letting the customer pick from Places suggestions.
 */
async function geocodeQuery(q: string): Promise<DeliveryLocation | null> {
  if (typeof google === "undefined") return null;
  try {
    const geocoder = new google.maps.Geocoder();
    const { results } = await geocoder.geocode({
      address: q,
      componentRestrictions: { country: "ng" },
    });
    if (results?.length !== 1) return null;
    const [result] = results;
    if (result.partial_match) return null;
    if (!result.geometry?.location) return null;

    return {
      formattedAddress: result.formatted_address ?? q,
      lat: result.geometry.location.lat(),
      lng: result.geometry.location.lng(),
      placeId: result.place_id,
    };
  } catch {
    return null;
  }
}
