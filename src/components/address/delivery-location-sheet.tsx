"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Briefcase,
  Check,
  Crosshair,
  Home,
  Loader2,
  LogIn,
  MapPin,
  X,
} from "lucide-react";
import { AddressPicker } from "@/components/address/address-picker";
import { useIsAuthenticated } from "@/lib/auth-store";
import { useLocation, type DeliveryLocation } from "@/lib/location-store";
import { fetchAddresses, type SavedAddress } from "@/lib/api/addresses";
import { checkZone } from "@/lib/api/zones";
import { useGoogleMaps } from "@/lib/maps";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";

type SavedState =
  | { kind: "idle" } // nothing fetched yet; renders as loading while authed
  | { kind: "ready"; addresses: SavedAddress[] }
  | { kind: "error"; message: string };

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Delivery-location sheet, opened from the header "Deliver to" chip.
 *
 * Bottom sheet on mobile, centred dialog on desktop. Works for guests
 * and signed-in customers:
 *   - Places search (reuses <AddressPicker/>, persists to the store)
 *   - "Use current location" via geolocation + reverse geocode
 *   - Saved addresses for signed-in users; a sign-in nudge for guests
 *
 * Picking anything writes the location store (which browse / store /
 * checkout screens already subscribe to), closes the sheet, and runs
 * a background zone check so we can warn when we don't deliver there.
 */
export function DeliveryLocationSheet({ open, onClose }: Props) {
  const isAuthed = useIsAuthenticated();
  const stored = useLocation((s) => s.location);
  const setLocation = useLocation((s) => s.set);
  const setZoneCheck = useLocation((s) => s.setZoneCheck);
  const { isLoaded } = useGoogleMaps();

  const [saved, setSaved] = useState<SavedState>({ kind: "idle" });
  const [locating, setLocating] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const verifyZone = useCallback(
    async (loc: DeliveryLocation) => {
      const result = await checkZone(loc.lat, loc.lng);
      const checkedAt = Date.now();
      if (result.kind === "in-zone") {
        setZoneCheck({ status: "in-zone", zoneIds: result.zoneIds, checkedAt });
      } else if (result.kind === "out-of-zone") {
        setZoneCheck({ status: "out-of-zone", checkedAt });
        toast.warn("We don't deliver to that address yet. Try somewhere nearby.");
      } else if (result.kind === "temp-unavailable") {
        setZoneCheck({ status: "temp-unavailable", checkedAt });
        toast.info("Service is briefly paused in that area. Check back soon.");
      }
      // "skipped" / "error" → say nothing; checkout re-validates anyway.
    },
    [setZoneCheck],
  );

  const applyLocation = useCallback(
    (loc: DeliveryLocation, { alreadyStored = false } = {}) => {
      if (!alreadyStored) setLocation(loc);
      onClose();
      void verifyZone(loc);
    },
    [setLocation, onClose, verifyZone],
  );

  // Saved addresses: refetch on each open so edits elsewhere show up.
  // Stale-while-revalidate: previous data stays visible during the
  // refetch; only the very first open shows the spinner (kind "idle").
  useEffect(() => {
    if (!open || !isAuthed) return;
    let cancelled = false;
    fetchAddresses().then((res) => {
      if (cancelled) return;
      setSaved(
        res.ok
          ? { kind: "ready", addresses: res.addresses }
          : { kind: "error", message: res.message },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open, isAuthed]);

  // Escape to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Your browser doesn't support location access.");
      return;
    }
    setLocating(true);
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
        setLocating(false);
        applyLocation({ formattedAddress, lat, lng });
      },
      (err) => {
        setLocating(false);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Location access was blocked. Allow it in your browser settings, or search instead."
            : "Couldn't get your location. Try searching for your address instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  }

  function pickSaved(a: SavedAddress) {
    const lat = Number(a.latitude);
    const lng = Number(a.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error("That saved address is missing its map position. Edit it and try again.");
      return;
    }
    applyLocation({ formattedAddress: a.address, lat, lng });
  }

  if (!open) return null;

  // Portal to <body>: the header's backdrop-blur creates a containing
  // block for fixed descendants, which would clip the overlay to the
  // header's own box.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delivery-location-title"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "sheet-up flex w-full max-h-[88dvh] flex-col overflow-hidden bg-white",
          "rounded-t-3xl shadow-floating md:max-w-lg md:rounded-3xl",
        )}
      >
        {/* Grab handle (mobile) */}
        <div className="flex justify-center pt-3 md:hidden" aria-hidden>
          <span className="h-1 w-10 rounded-pill bg-ink-200" />
        </div>

        <div className="flex items-center justify-between px-6 pb-1 pt-4 md:pt-6">
          <h2
            id="delivery-location-title"
            className="font-serif text-2xl text-ink-900"
          >
            Delivery address
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-ink-600 transition-colors hover:bg-ink-200 hover:text-ink-900"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <p className="mb-4 text-sm text-ink-500">
            Where should we bring your order?
          </p>

          <AddressPicker
            variant="light"
            onPick={(loc) => applyLocation(loc, { alreadyStored: true })}
          />

          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className={cn(
              "mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-pill border border-ink-200 bg-white text-sm font-medium text-ink-900 transition-colors",
              "hover:border-brand-red/30 hover:text-brand-red disabled:cursor-wait disabled:opacity-70",
            )}
          >
            {locating ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Crosshair size={15} className="text-brand-red" />
            )}
            {locating ? "Finding you…" : "Use my current location"}
          </button>

          {stored && (
            <div className="mt-5 flex items-start gap-2.5 rounded-2xl bg-ink-50 px-4 py-3">
              <MapPin size={14} className="mt-0.5 shrink-0 text-brand-red" />
              <div className="min-w-0 text-sm">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
                  Currently delivering to
                </p>
                <p className="mt-0.5 truncate text-ink-900">
                  {stored.formattedAddress}
                </p>
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-sans text-sm font-semibold text-ink-900">
                Saved addresses
              </h3>
              {isAuthed && (
                <Link
                  href="/addresses"
                  onClick={onClose}
                  className="text-xs font-medium text-brand-red hover:text-brand-red-600"
                >
                  Manage
                </Link>
              )}
            </div>

            {!isAuthed && (
              <Link
                href="/signin"
                onClick={onClose}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-ink-300 px-4 py-3.5 text-sm text-ink-600 transition-colors hover:border-brand-red/40 hover:text-brand-red"
              >
                <LogIn size={16} className="shrink-0" />
                <span>
                  <span className="font-medium text-ink-900">Sign in</span> to
                  save your home, office and favourite spots.
                </span>
              </Link>
            )}

            {isAuthed && saved.kind === "idle" && (
              <div className="flex items-center gap-2 py-4 text-sm text-ink-500">
                <Loader2 size={14} className="animate-spin" />
                Loading your addresses…
              </div>
            )}

            {isAuthed && saved.kind === "error" && (
              <p className="rounded-2xl border border-error/30 bg-error-soft px-4 py-3 text-sm text-error">
                {saved.message}
              </p>
            )}

            {isAuthed && saved.kind === "ready" && saved.addresses.length === 0 && (
              <p className="rounded-2xl border border-dashed border-ink-300 px-4 py-3.5 text-sm text-ink-500">
                No saved addresses yet. Pick one above, then save it from{" "}
                <Link
                  href="/addresses"
                  onClick={onClose}
                  className="font-medium text-brand-red hover:text-brand-red-600"
                >
                  your address book
                </Link>
                .
              </p>
            )}

            {isAuthed && saved.kind === "ready" && saved.addresses.length > 0 && (
              <ul className="space-y-2">
                {saved.addresses.map((a) => {
                  const Icon = iconForType(a.address_type);
                  const active = stored?.formattedAddress === a.address;
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => pickSaved(a)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                          active
                            ? "border-brand-red/40 bg-brand-red/[0.04]"
                            : "border-ink-200 bg-white hover:border-brand-red/30 hover:bg-ink-50",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                            active
                              ? "bg-brand-red text-white"
                              : "bg-brand-red/10 text-brand-red",
                          )}
                        >
                          <Icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-ink-900">
                            {a.address_type}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-ink-500">
                            {a.address}
                          </span>
                        </span>
                        {active && (
                          <Check size={16} className="shrink-0 text-brand-red" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function iconForType(type: string) {
  const norm = (type ?? "").toLowerCase();
  if (norm.includes("home")) return Home;
  if (norm.includes("office") || norm.includes("work")) return Briefcase;
  return MapPin;
}
