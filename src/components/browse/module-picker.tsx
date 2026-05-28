"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, ArrowRight } from "lucide-react";
import { useLocation } from "@/lib/location-store";
import { fetchModules, type Module } from "@/lib/api/modules";
import { NoLocation } from "./no-location";

type State =
  | { kind: "hydrating" }
  | { kind: "loading" }
  | { kind: "ready"; modules: Module[] }
  | { kind: "error"; message: string };

/**
 * /browse landing — pick a category of stores to shop from (Food,
 * Grocery, Pharmacy …) scoped to the user's zone.
 *
 * Reads zoneCheck off the persisted location so a refresh doesn't
 * re-fire the network call. If we don't have an in-zone location
 * yet, bounces back to the welcome flow via <NoLocation />.
 */
export function ModulePicker() {
  const stored = useLocation((s) => s.location);
  const hydrated = useLocation((s) => s.hydrated);
  const hydrate = useLocation((s) => s.hydrate);
  const [state, setState] = useState<State>({ kind: "hydrating" });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    const zoneCheck = stored?.zoneCheck;
    if (!stored || !zoneCheck) {
      setState({ kind: "ready", modules: [] });
      return;
    }
    if (zoneCheck.status !== "in-zone") return;

    setState({ kind: "loading" });
    fetchModules(zoneCheck.zoneIds).then((res) => {
      if (res.ok) {
        setState({ kind: "ready", modules: res.modules });
      } else {
        setState({ kind: "error", message: res.message });
      }
    });
  }, [hydrated, stored]);

  if (!hydrated || state.kind === "hydrating") {
    return <CenterSpinner label="Loading…" />;
  }

  if (!stored) return <NoLocation reason="no-pick" />;
  if (stored.zoneCheck?.status === "out-of-zone")
    return <NoLocation reason="out-of-zone" />;
  if (stored.zoneCheck?.status === "temp-unavailable")
    return <NoLocation reason="temp-unavailable" />;
  if (!stored.zoneCheck) return <NoLocation reason="no-pick" />;

  if (state.kind === "loading") return <CenterSpinner label="Loading shops…" />;
  if (state.kind === "error") {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-ink-200 bg-white p-6 text-center shadow-card">
        <p className="text-ink-900">{state.message}</p>
      </div>
    );
  }

  if (state.modules.length === 0) {
    return (
      <p className="mx-auto max-w-md text-center text-ink-600">
        No shops live in your area yet — we're adding new vendors every week.
      </p>
    );
  }

  return (
    <div className="fade-up grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {state.modules.map((m) => (
        <ModuleCard key={m.id} module={m} />
      ))}
    </div>
  );
}

function ModuleCard({ module: m }: { module: Module }) {
  const count = m.stores_count ?? 0;
  const hasStores = count > 0;
  return (
    <Link
      href={`/browse/${m.id}`}
      className="card-luxe group relative flex flex-col overflow-hidden rounded-3xl"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-canvas-sunken">
        {m.thumbnail_full_url ? (
          <Image
            src={m.thumbnail_full_url}
            alt={m.module_name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          />
        ) : null}
        <div className="image-scrim absolute inset-0" />
        {m.icon_full_url && (
          <div className="absolute left-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/95 shadow-card backdrop-blur">
            <Image
              src={m.icon_full_url}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
          </div>
        )}
        {hasStores && (
          <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-pill bg-black/55 px-2.5 py-1 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-white backdrop-blur">
            {count} shops
          </span>
        )}
      </div>
      <div className="flex flex-1 items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-medium tracking-[-0.005em] text-ink-900">
            {m.module_name}
          </h3>
          <p className="mt-0.5 text-xs text-ink-500">
            {hasStores ? `Explore ${count} shops` : "Coming soon"}
          </p>
        </div>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-700 transition-all group-hover:border-brand-red/40 group-hover:bg-brand-red group-hover:text-white">
          <ArrowRight size={16} strokeWidth={2.1} />
        </span>
      </div>
    </Link>
  );
}

function CenterSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[30vh] items-center justify-center gap-2 text-ink-500">
      <Loader2 size={18} className="animate-spin" />
      {label}
    </div>
  );
}
