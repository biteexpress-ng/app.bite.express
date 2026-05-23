"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2, MapPinOff, PauseCircle } from "lucide-react";
import { checkZone, type ZoneCheck } from "@/lib/api/zones";
import {
  useLocation,
  type DeliveryLocation,
  type ZoneCacheEntry,
} from "@/lib/location-store";
import { ButtonLink } from "@/components/ui/button";
import { NotifyMeForm } from "./notify-me-form";

type Phase =
  | { kind: "checking" }
  | { kind: "in-zone"; zoneIds: number[] }
  | { kind: "out-of-zone" }
  | { kind: "temp-unavailable" }
  | { kind: "skipped"; reason: string }
  | { kind: "error"; message: string };

type ZoneResultProps = {
  location: DeliveryLocation;
};

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — long enough to survive a refresh, short enough that a fix on our end recovers fast.

/**
 * Drives the zone-detect flow. Reads any cached `zoneCheck` off the
 * picked location, falls through to /api/v1/config/get-zone-id when
 * the cache is missing or stale, and renders one of four terminal
 * states (in-zone CTA, out-of-zone capture, temp-unavailable
 * capture, soft error with retry).
 */
export function ZoneResult({ location }: ZoneResultProps) {
  const setZoneCheck = useLocation((s) => s.setZoneCheck);
  const cached = freshCache(location.zoneCheck);

  const [phase, setPhase] = useState<Phase>(
    cached ? cacheToPhase(cached) : { kind: "checking" },
  );

  // Re-detect whenever the picked point changes OR the cache misses.
  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    setPhase({ kind: "checking" });

    checkZone(location.lat, location.lng).then((res) => {
      if (cancelled) return;
      setPhase(toPhase(res));
      const cacheEntry = toCacheEntry(res);
      if (cacheEntry) setZoneCheck(cacheEntry);
    });

    return () => {
      cancelled = true;
    };
    // location identity is stable inside the picker callback —
    // re-running on lat/lng is what we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.lat, location.lng]);

  return (
    <div className="mt-4 rounded-2xl border border-white/15 bg-white/[0.05] px-5 py-4 text-left text-sm text-white/90 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.16em] text-white/55">
        Selected
      </p>
      <p className="mt-1 font-medium text-white">{location.formattedAddress}</p>

      <div className="mt-4">
        <PhaseView phase={phase} />
      </div>
    </div>
  );
}

function PhaseView({ phase }: { phase: Phase }) {
  if (phase.kind === "checking") {
    return (
      <div className="flex items-center gap-2 text-white/65">
        <Loader2 size={16} className="animate-spin" />
        Checking your area…
      </div>
    );
  }

  if (phase.kind === "in-zone") {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-white/80">
          Great — we deliver here. Browsing & ordering opens in the next
          release.
        </p>
        <ButtonLink
          href="/browse"
          variant="primary"
          size="sm"
          className="self-start"
        >
          Continue
          <ArrowRight size={14} strokeWidth={2.2} />
        </ButtonLink>
      </div>
    );
  }

  if (phase.kind === "out-of-zone") {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 text-white/80">
          <MapPinOff size={16} className="mt-0.5 shrink-0 text-white/60" />
          <p>
            We're not delivering to this address yet. Leave your email and we'll
            tell you the moment we are.
          </p>
        </div>
        <NotifyMeForm context="out-of-zone" />
      </div>
    );
  }

  if (phase.kind === "temp-unavailable") {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 text-white/80">
          <PauseCircle size={16} className="mt-0.5 shrink-0 text-white/60" />
          <p>
            Service is paused in this area right now. Drop your email and we'll
            ping you when it's back on.
          </p>
        </div>
        <NotifyMeForm context="temp-unavailable" />
      </div>
    );
  }

  if (phase.kind === "skipped") {
    return (
      <p className="text-xs text-white/55">
        Zone check skipped — {phase.reason}
      </p>
    );
  }

  return <p className="text-white/70">{phase.message}</p>;
}

/* ---------- pure helpers ---------------------------------------------- */

function freshCache(entry?: ZoneCacheEntry): ZoneCacheEntry | undefined {
  if (!entry) return undefined;
  if (Date.now() - entry.checkedAt > CACHE_TTL_MS) return undefined;
  return entry;
}

function cacheToPhase(entry: ZoneCacheEntry): Phase {
  if (entry.status === "in-zone")
    return { kind: "in-zone", zoneIds: entry.zoneIds };
  return { kind: entry.status };
}

function toPhase(res: ZoneCheck): Phase {
  switch (res.kind) {
    case "in-zone":
      return { kind: "in-zone", zoneIds: res.zoneIds };
    case "out-of-zone":
      return { kind: "out-of-zone" };
    case "temp-unavailable":
      return { kind: "temp-unavailable" };
    case "skipped":
      return { kind: "skipped", reason: res.reason };
    case "error":
      return { kind: "error", message: res.message };
  }
}

function toCacheEntry(res: ZoneCheck): ZoneCacheEntry | null {
  const checkedAt = Date.now();
  switch (res.kind) {
    case "in-zone":
      return { status: "in-zone", zoneIds: res.zoneIds, checkedAt };
    case "out-of-zone":
      return { status: "out-of-zone", checkedAt };
    case "temp-unavailable":
      return { status: "temp-unavailable", checkedAt };
    default:
      return null;
  }
}
