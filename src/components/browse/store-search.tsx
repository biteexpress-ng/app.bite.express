"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Search, X } from "lucide-react";
import { useLocation } from "@/lib/location-store";
import {
  searchStoresAndItems,
  type SearchHitItem,
  type SearchHitStore,
} from "@/lib/api/search";
import { cn } from "@/lib/cn";

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "results";
      stores: SearchHitStore[];
      items: SearchHitItem[];
    }
  | { kind: "error"; message: string };

type Props = {
  moduleId: number;
  className?: string;
};

/**
 * Module-scoped store + item search.
 *
 * Sits at the top of /browse/[moduleId]. Debounced (300ms) so we
 * don't spam the backend with every keystroke. Min query length is
 * 2 chars — single letters return too much noise.
 *
 * Items in the response come back without store_id, so we surface
 * them as a count-only hint ("3 matching items — try the shops
 * below") rather than as clickable rows. Customers click a store
 * to drill in.
 */
export function StoreSearch({ moduleId, className }: Props) {
  const stored = useLocation((s) => s.location);
  const hydrated = useLocation((s) => s.hydrated);
  const hydrate = useLocation((s) => s.hydrate);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Debounce the input.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Fire the search whenever the debounced value changes.
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

    let cancelled = false;
    setPhase({ kind: "loading" });
    searchStoresAndItems({
      query: debounced,
      zoneIds: zc.zoneIds,
      moduleId,
      lat: stored.lat,
      lng: stored.lng,
    }).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setPhase({
          kind: "results",
          stores: res.stores,
          items: res.items,
        });
      } else {
        setPhase({ kind: "error", message: res.message });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [debounced, moduleId, stored]);

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
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-500"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search shops or items in this category…"
          className="w-full rounded-full border border-ink-200 bg-white py-3 pl-11 pr-10 text-sm text-ink-900 placeholder:text-ink-400 shadow-soft focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/15"
          aria-label="Search shops or items"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {!hydrated && null}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-elevated">
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
        Searching…
      </div>
    );
  }
  if (phase.kind === "error") {
    return <p className="px-4 py-3 text-sm text-ink-700">{phase.message}</p>;
  }
  if (phase.kind !== "results") return null;

  const { stores, items } = phase;
  const hasNothing = stores.length === 0 && items.length === 0;
  if (hasNothing) {
    return (
      <p className="px-4 py-3 text-sm text-ink-600">
        No shops or items match. Try a shorter or different search.
      </p>
    );
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto">
      {stores.length > 0 && (
        <section>
          <h3 className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            Shops
          </h3>
          <ul className="divide-y divide-ink-200/60">
            {stores.map((s) => (
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
        </section>
      )}

      {items.length > 0 && (
        <section className="border-t border-ink-200/70 bg-ink-50/60">
          <p className="px-4 py-3 text-xs text-ink-600">
            {items.length} matching item{items.length === 1 ? "" : "s"} —
            open a shop above to find{" "}
            <span className="font-medium text-ink-900">
              {items
                .slice(0, 3)
                .map((i) => i.name)
                .join(", ")}
            </span>
            {items.length > 3 && " and more"}.
          </p>
        </section>
      )}
    </div>
  );
}
