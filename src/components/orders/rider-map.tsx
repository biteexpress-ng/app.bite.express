"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, Marker } from "@react-google-maps/api";
import { Bike, MapPin, Loader2, WifiOff } from "lucide-react";
import { useGoogleMaps, DEFAULT_MAP_OPTIONS } from "@/lib/maps";
import {
  subscribeRiderLocation,
  type RiderLocationEvent,
} from "@/lib/order-channel";
import { isStaleFix, newerFix, type RiderFix } from "@/lib/tracking";
import { cn } from "@/lib/cn";

type LatLng = { lat: number; lng: number };

type Props = {
  deliverymanId: number;
  destination: LatLng;
  /** Optional store/pickup point — when provided we drop a third
   *  marker for it and frame all three in view. */
  pickup?: LatLng | null;
  /** Latest position from the track poll, if any. */
  fix: RiderFix | null;
  className?: string;
};

/**
 * Live GPS map for /orders/[id]. Subscribes to the rider's
 * `dm_location_{id}` Reverb channel and drops a bike-icon marker
 * at every update.
 *
 * Empty / fallback states:
 *   - Google Maps API key missing
 *       → degrade silently; the rest of the order page still works.
 *   - Reverb env missing OR no event yet
 *       → "Waiting for rider's location…" overlay on a static map
 *         centred on the delivery address.
 *
 * The rider position comes from the track poll (`fix`) and from Reverb
 * when it is running; whichever is newer wins. After two minutes without
 * a new position the footer says the location is not updating.
 */
export function RiderMap({
  deliverymanId,
  destination,
  pickup,
  fix,
  className,
}: Props) {
  const { isLoaded, loadError } = useGoogleMaps();
  const hasKey = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);

  const [liveFix, setLiveFix] = useState<RiderFix | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const current = newerFix(fix, liveFix);
  const rider: LatLng | null = current ? { lat: current.lat, lng: current.lng } : null;
  const mapRef = useRef<google.maps.Map | null>(null);

  // Keeps "Updated Xs ago" and the stale check moving between polls.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  // Subscribe to live rider location.
  useEffect(() => {
    const unsubscribe = subscribeRiderLocation(deliverymanId, (evt) => {
      const lat = Number(evt.latitude);
      const lng = Number(evt.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      setLiveFix({ lat, lng, at: Date.now() });
    });
    return unsubscribe;
  }, [deliverymanId]);

  // Auto-fit bounds whenever the set of pinned points changes.
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    const points: LatLng[] = [destination];
    if (current) points.push({ lat: current.lat, lng: current.lng });
    if (pickup) points.push(pickup);
    if (points.length < 2) return;
    const bounds = new google.maps.LatLngBounds();
    for (const p of points) bounds.extend(p);
    mapRef.current.fitBounds(bounds, 64);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.lat, current?.lng, destination.lat, destination.lng, pickup?.lat, pickup?.lng, isLoaded]);

  const initialCenter = useMemo<LatLng>(
    () => rider ?? pickup ?? destination,
    // We only want the very first center to settle once; subsequent
    // re-centering is handled by fitBounds() above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!hasKey || loadError) {
    return (
      <Card className={className}>
        <Fallback
          icon={<WifiOff size={16} />}
          title="Live rider map unavailable"
          body="The map needs a Google Maps API key. The rest of the order keeps updating below."
        />
      </Card>
    );
  }

  if (!isLoaded) {
    return (
      <Card className={className}>
        <div className="flex h-64 items-center justify-center gap-2 text-sm text-ink-500">
          <Loader2 size={16} className="animate-spin" />
          Loading map…
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="relative h-64 w-full overflow-hidden rounded-2xl sm:h-72">
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={initialCenter}
          zoom={14}
          options={DEFAULT_MAP_OPTIONS}
          onLoad={(m) => {
            mapRef.current = m;
          }}
          onUnmount={() => {
            mapRef.current = null;
          }}
        >
          {/* Delivery address — red home pin */}
          <Marker
            position={destination}
            icon={pinIcon("#de1600")}
            title="Delivery address"
          />

          {/* Pickup point — orange */}
          {pickup && (
            <Marker
              position={pickup}
              icon={pinIcon("#ff6b4a")}
              title="Shop"
            />
          )}

          {/* Rider — dark dot once we know where they are */}
          {rider && (
            <Marker
              position={rider}
              icon={riderIcon()}
              title="Your rider"
              zIndex={3}
            />
          )}
        </GoogleMap>

        {!rider && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-full bg-ink-900/85 px-3 py-2 text-xs text-white shadow">
            <Loader2 size={12} className="animate-spin" />
            Waiting for your rider's location…
          </div>
        )}
      </div>

      <Footer fix={current} now={now} hasPickup={!!pickup} />
    </Card>
  );
}

/* -------------------------------------------------------------- */

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border border-ink-200 bg-white p-2 shadow-soft sm:p-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Footer({
  fix,
  now,
  hasPickup,
}: {
  fix: RiderFix | null;
  now: number;
  hasPickup: boolean;
}) {
  const stale = isStaleFix(fix, now);
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-3 text-xs text-ink-600">
      <LegendDot color="#de1600" label="Delivery" icon={<MapPin size={11} />} />
      {hasPickup && (
        <LegendDot color="#ff6b4a" label="Shop" icon={<MapPin size={11} />} />
      )}
      <LegendDot color="#111111" label="Rider" icon={<Bike size={11} />} />
      <span className={cn("ml-auto text-[11px]", stale ? "font-medium text-ink-900" : "text-ink-500")}>
        {!fix
          ? "No update yet"
          : stale
            ? `Location not updating (last ${formatRelative(new Date(fix.at))})`
            : `Updated ${formatRelative(new Date(fix.at))}`}
      </span>
    </div>
  );
}

function LegendDot({
  color,
  label,
  icon,
}: {
  color: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: color }}
      >
        {icon}
      </span>
      {label}
    </span>
  );
}

function Fallback({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex h-64 flex-col items-center justify-center px-4 text-center">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-ink-600">
        {icon}
      </span>
      <p className="mt-3 text-sm font-medium text-ink-900">{title}</p>
      <p className="mt-1 text-xs text-ink-500">{body}</p>
    </div>
  );
}

/* -------------------------------------------------------------- */
/* Marker icons — built as data-URI SVGs so we don't ship images. */

function pinIcon(color: string): google.maps.Icon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24c0-8.84-7.16-16-16-16z"
            fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="15" r="5" fill="white"/>
    </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(28, 36),
    anchor: new google.maps.Point(14, 36),
  };
}

function riderIcon(): google.maps.Icon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="14" fill="#111111" stroke="white" stroke-width="3"/>
      <circle cx="20" cy="20" r="18" fill="#111111" fill-opacity="0.15"/>
    </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(32, 32),
    anchor: new google.maps.Point(16, 16),
  };
}

/* -------------------------------------------------------------- */

function formatRelative(date: Date): string {
  const secs = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}
