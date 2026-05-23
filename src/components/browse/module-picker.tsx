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
      <div className="mx-auto max-w-md rounded-2xl border border-ink-200 bg-white p-6 text-center shadow-soft">
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      className="group flex flex-col overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-ink-100">
        {m.thumbnail_full_url ? (
          <Image
            src={m.thumbnail_full_url}
            alt={m.module_name}
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-3">
          {m.icon_full_url && (
            <Image
              src={m.icon_full_url}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-md object-contain"
            />
          )}
          <div className="flex-1">
            <h3 className="text-lg font-medium text-ink-900">{m.module_name}</h3>
            <p className="mt-0.5 text-xs text-ink-500">
              {hasStores ? `${count} shops` : "No shops yet"}
            </p>
          </div>
          <ArrowRight
            size={18}
            className="mt-1 text-ink-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-red"
          />
        </div>
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
