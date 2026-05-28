"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Search, X } from "lucide-react";
import { useLocation } from "@/lib/location-store";
import { fetchModules, type Module } from "@/lib/api/modules";
import {
  searchStoresAndItems,
  type SearchHitItem,
  type SearchHitStore,
} from "@/lib/api/search";
import { cn } from "@/lib/cn";

type GroupHit = {
  module: Module;
  stores: SearchHitStore[];
  items: SearchHitItem[];
};

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "results"; groups: GroupHit[]; totalStores: number; totalItems: number }
  | { kind: "error"; message: string };

type Props = {
  className?: string;
};

/**
 * Cross-module search for the /browse landing page.
 *
 * Backend's /items/item-or-store-search filters by a single moduleId
 * (via config('module.current_module_data')['id']), so to surface
 * results from Food + Grocery + Pharmacy etc in one go we fan out
 * across every module in the customer's zone in parallel and merge
 * the responses.
 *
 * Modules list is fetched once on mount (same call ModulePicker
 * makes; small payload, no shared state worth the refactor for v0).
 * Results group by module name so the customer can see which
 * category each shop came from.
 */
export function CrossModuleSearch({ className }: Props) {
  const stored = useLocation((s) => s.location);
  const hydrated = useLocation((s) => s.hydrated);
  const hydrate = useLocation((s) => s.hydrate);

  const [modules, setModules] = useState<Module[] | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Hydrate location + load modules once the customer has a zone.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    const zc = stored?.zoneCheck;
    if (!stored || !zc || zc.status !== "in-zone") {
      setModules(null);
      return;
    }
    let cancelled = false;
    fetchModules(zc.zoneIds).then((res) => {
      if (cancelled) return;
      setModules(res.ok ? res.modules : []);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, stored]);

  // Debounce the input.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Fan out the search across modules whenever the debounced value changes.
  useEffect(() => {
    if (debounced.length < 2) {
      setPhase({ kind: "idle" });
      return;
    }
    const zc = stored?.zoneCheck;
    if (!stored || !zc || zc.status !== "in-zone") {
      setPhase({
        kind: "error",
        message: "Pick a delivery address first to search shops near you.",
      });
      return;
    }
    if (!modules || modules.length === 0) {
      setPhase({
        kind: "error",
        message: "No categories are live in your area yet.",
      });
      return;
    }

    let cancelled = false;
    setPhase({ kind: "loading" });

    Promise.all(
      modules.map((m) =>
        searchStoresAndItems({
          query: debounced,
          zoneIds: zc.zoneIds,
          moduleId: m.id,
          lat: stored.lat,
          lng: stored.lng,
        }).then((r) => ({ module: m, result: r })),
      ),
    ).then((all) => {
      if (cancelled) return;
      const groups: GroupHit[] = [];
      let totalStores = 0;
      let totalItems = 0;
      for (const { module, result } of all) {
        if (!result.ok) continue;
        if (result.stores.length === 0 && result.items.length === 0) continue;
        groups.push({
          module,
          stores: result.stores,
          items: result.items,
        });
        totalStores += result.stores.length;
        totalItems += result.items.length;
      }
      setPhase({ kind: "results", groups, totalStores, totalItems });
    });
    return () => {
      cancelled = true;
    };
  }, [debounced, modules, stored]);

  // Click-outside closes the dropdown.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function clear() {
    setQuery("");
    setDebounced("");
    setPhase({ kind: "idle" });
  }

  const showDropdown =
    open && query.trim().length > 0 && phase.kind !== "idle";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div className="relative">
        <Search
          size={17}
          className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-ink-500"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search every shop and item in your area…"
          className="w-full rounded-pill border border-ink-200 bg-white py-4 pl-12 pr-12 text-sm text-ink-900 placeholder:text-ink-400 shadow-card transition-all focus:-translate-y-px focus:border-brand-red/40 focus:outline-none focus:shadow-elevated focus:ring-4 focus:ring-brand-red/10"
          aria-label="Search shops or items"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-30 mt-3 overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-floating">
          <Dropdown phase={phase} onPick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- */

function Dropdown({
  phase,
  onPick,
}: {
  phase: Phase;
  onPick: () => void;
}) {
  if (phase.kind === "loading") {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-ink-500">
        <Loader2 size={14} className="animate-spin" />
        Searching every category…
      </div>
    );
  }
  if (phase.kind === "error") {
    return <p className="px-4 py-3 text-sm text-ink-700">{phase.message}</p>;
  }
  if (phase.kind !== "results") return null;

  if (phase.groups.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-ink-600">
        No shops or items match. Try a shorter or different search.
      </p>
    );
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto">
      {phase.groups.map((g) => (
        <section
          key={g.module.id}
          className="border-b border-ink-200/60 last:border-b-0"
        >
          <h3 className="flex items-center justify-between px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            <span>{g.module.module_name}</span>
            <Link
              href={`/browse/${g.module.id}`}
              onClick={onPick}
              className="normal-case tracking-normal text-brand-red hover:underline"
            >
              See all shops →
            </Link>
          </h3>

          {g.stores.length > 0 && (
            <ul className="divide-y divide-ink-200/60">
              {g.stores.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/store/${s.id}`}
                    onClick={onPick}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-ink-900 hover:bg-ink-50"
                  >
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink-100 text-ink-600 text-xs font-semibold">
                      {s.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate font-medium">{s.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {g.items.length > 0 && (
            <p className="bg-ink-50/60 px-4 py-3 text-xs text-ink-600">
              {g.items.length} matching item{g.items.length === 1 ? "" : "s"} —
              open a shop above to find{" "}
              <span className="font-medium text-ink-900">
                {g.items
                  .slice(0, 3)
                  .map((i) => i.name)
                  .join(", ")}
              </span>
              {g.items.length > 3 && " and more"}.
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
