"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useLocation } from "@/lib/location-store";
import { fetchStores, type Store } from "@/lib/api/stores";
import { StoreCard } from "./store-card";
import { NoLocation } from "./no-location";

const PAGE_SIZE = 12;

type State =
  | { kind: "hydrating" }
  | { kind: "loading" }
  | {
      kind: "ready";
      stores: Store[];
      total: number;
      /** 1-based page number that has already been loaded. */
      loadedPage: number;
      loadingMore: boolean;
    }
  | { kind: "error"; message: string };

/**
 * /browse/[moduleId] — paginated list of stores in the chosen module
 * for the user's current zone. "Load more" pulls the next page on
 * demand; we don't auto-paginate to keep network use predictable.
 */
export function StoreList({ moduleId }: { moduleId: number }) {
  const stored = useLocation((s) => s.location);
  const hydrated = useLocation((s) => s.hydrated);
  const hydrate = useLocation((s) => s.hydrate);

  const [state, setState] = useState<State>({ kind: "hydrating" });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    const zc = stored?.zoneCheck;
    if (!stored || !zc || zc.status !== "in-zone") return;

    setState({ kind: "loading" });
    fetchStores({
      zoneIds: zc.zoneIds,
      moduleId,
      lat: stored.lat,
      lng: stored.lng,
      limit: PAGE_SIZE,
      offset: 1,
    }).then((res) => {
      if (res.ok) {
        setState({
          kind: "ready",
          stores: res.data.stores,
          total: res.data.total_size,
          loadedPage: 1,
          loadingMore: false,
        });
      } else {
        setState({ kind: "error", message: res.message });
      }
    });
  }, [hydrated, stored, moduleId]);

  async function loadMore() {
    if (state.kind !== "ready" || state.loadingMore) return;
    if (!stored?.zoneCheck || stored.zoneCheck.status !== "in-zone") return;
    setState({ ...state, loadingMore: true });
    const nextPage = state.loadedPage + 1;
    const res = await fetchStores({
      zoneIds: stored.zoneCheck.zoneIds,
      moduleId,
      lat: stored.lat,
      lng: stored.lng,
      limit: PAGE_SIZE,
      offset: nextPage,
    });
    if (res.ok) {
      setState({
        kind: "ready",
        stores: [...state.stores, ...res.data.stores],
        total: res.data.total_size,
        loadedPage: nextPage,
        loadingMore: false,
      });
    } else {
      setState({ ...state, loadingMore: false });
    }
  }

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
      <div className="rounded-2xl border border-ink-200 bg-white p-6 text-center shadow-soft">
        <p className="text-ink-900">{state.message}</p>
      </div>
    );
  }

  if (state.stores.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-200 bg-white p-8 text-center shadow-soft">
        <h2 className="font-serif text-xl text-ink-900">
          No shops here yet
        </h2>
        <p className="mt-2 text-sm text-ink-600">
          We're adding new vendors in your area every week.
        </p>
        <Link
          href="/browse"
          className="mt-5 inline-flex h-10 items-center gap-1.5 rounded-full border border-ink-200 px-4 text-sm text-ink-900 hover:bg-ink-50"
        >
          <ArrowLeft size={14} />
          Other categories
        </Link>
      </div>
    );
  }

  const hasMore = state.stores.length < state.total;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {state.stores.map((s) => (
          <StoreCard key={s.id} store={s} />
        ))}
      </div>

      {hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={state.loadingMore}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-ink-200 bg-white px-6 text-sm font-medium text-ink-900 shadow-sm hover:bg-ink-50 disabled:cursor-wait"
          >
            {state.loadingMore && (
              <Loader2 size={14} className="animate-spin" />
            )}
            {state.loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </>
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
