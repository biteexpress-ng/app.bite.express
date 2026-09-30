"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import {
  fetchStoreDetail,
  fetchStoreCategoryItems,
  type StoreDetail as StoreDetailData,
  type StoreItem,
} from "@/lib/api/store-detail";
import { useLocation } from "@/lib/location-store";
import { trackPixel } from "@/lib/meta-pixel";
import { StoreHeader } from "./store-header";
import { ItemCard } from "./item-card";
import { NoLocation } from "@/components/browse/no-location";
import { cn } from "@/lib/cn";

type PageState =
  | { kind: "hydrating" }
  | { kind: "loading-store" }
  | { kind: "not-found" }
  | { kind: "error"; message: string }
  | { kind: "ready"; store: StoreDetailData; selectedCategoryId: number };

type ItemsByCategory = Record<
  number,
  { loading: boolean; error?: string; items: StoreItem[] }
>;

/** Synthetic category id for the "All" tab. Real categories from
 *  the backend always have id > 0, so 0 is safe as a sentinel. */
const ALL_TAB_ID = 0;

/**
 * Drives the /store/[id] page.
 *
 * - Pulls the store header once.
 * - Lazily loads items per category as the customer clicks tabs;
 *   each (storeId, categoryId) pair is fetched at most once and
 *   cached in component state for the session.
 * - If the customer has no in-zone address picked, bounces them
 *   back to the welcome flow — items can't be fetched without the
 *   zoneId header.
 */
export function StoreDetailView({ storeId }: { storeId: number }) {
  const stored = useLocation((s) => s.location);
  const hydrated = useLocation((s) => s.hydrated);
  const hydrate = useLocation((s) => s.hydrate);

  const [page, setPage] = useState<PageState>({ kind: "hydrating" });
  const [items, setItems] = useState<ItemsByCategory>({});

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // 1. Load store header once we have hydration.
  useEffect(() => {
    if (!hydrated) return;
    setPage({ kind: "loading-store" });

    fetchStoreDetail(storeId, stored?.lat, stored?.lng).then((res) => {
      if (!res.ok) {
        setPage({
          kind: res.status === "not-found" ? "not-found" : "error",
          message: res.message,
        });
        return;
      }
      // Always default to the synthetic "All" tab (id ALL_TAB_ID) so the
      // customer sees the full menu first, not just one category.
      setPage({
        kind: "ready",
        store: res.store,
        selectedCategoryId: ALL_TAB_ID,
      });
      trackPixel("ViewContent", {
        content_ids: [String(storeId)],
        content_name: res.store.name,
        content_type: "product_group",
      });
    });
  }, [hydrated, storeId, stored?.lat, stored?.lng]);

  // 2. When the selected category changes, fetch its items (cached).
  useEffect(() => {
    if (page.kind !== "ready") return;
    const cat = page.selectedCategoryId;
    if (items[cat]) return; // cached

    const zc = stored?.zoneCheck;
    if (!stored || !zc || zc.status !== "in-zone") return;
    const moduleId = page.store.module_id;
    if (!moduleId) return;

    setItems((prev) => ({ ...prev, [cat]: { loading: true, items: [] } }));

    // "All" tab: fan out to every real category in parallel + merge,
    // de-duplicating items that appear in multiple categories.
    if (cat === ALL_TAB_ID) {
      const realCategories = page.store.category_details ?? [];
      if (realCategories.length === 0) {
        setItems((prev) => ({
          ...prev,
          [cat]: { loading: false, items: [] },
        }));
        return;
      }
      Promise.all(
        realCategories.map((c) =>
          fetchStoreCategoryItems({
            storeId: page.store.id,
            categoryId: c.id,
            zoneIds: zc.zoneIds,
            moduleId,
            limit: 50,
            offset: 1,
          }),
        ),
      ).then((results) => {
        const seen = new Set<number>();
        const merged: StoreItem[] = [];
        for (const r of results) {
          if (!r.ok) continue;
          for (const it of r.data.products) {
            if (seen.has(it.id)) continue;
            seen.add(it.id);
            merged.push(it);
          }
        }
        setItems((prev) => ({
          ...prev,
          [cat]: { loading: false, items: merged },
        }));
      });
      return;
    }

    fetchStoreCategoryItems({
      storeId: page.store.id,
      categoryId: cat,
      zoneIds: zc.zoneIds,
      moduleId,
      limit: 30,
      offset: 1,
    }).then((res) => {
      if (res.ok) {
        setItems((prev) => ({
          ...prev,
          [cat]: { loading: false, items: res.data.products },
        }));
      } else {
        setItems((prev) => ({
          ...prev,
          [cat]: { loading: false, items: [], error: res.message },
        }));
      }
    });
  }, [page, items, stored]);

  // ---- guards ----
  if (!hydrated || page.kind === "hydrating" || page.kind === "loading-store") {
    return <CenterSpinner label="Loading…" />;
  }
  if (page.kind === "not-found") {
    return (
      <EmptyState
        title="Store not found"
        body="This store may have closed or moved. Try browsing what's around you."
        cta={{ href: "/browse", label: "Browse shops" }}
      />
    );
  }
  if (page.kind === "error") {
    return (
      <EmptyState
        title="We hit a snag"
        body={page.message}
        cta={{ href: "/browse", label: "Back to browse" }}
      />
    );
  }

  // ready
  const store = page.store;
  const categories = store.category_details ?? [];
  const needsZone = !stored?.zoneCheck || stored.zoneCheck.status !== "in-zone";

  return (
    <div>
      <Link
        href="/browse"
        className="mb-5 inline-flex items-center gap-1.5 rounded-pill border border-ink-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-ink-700 backdrop-blur transition-colors hover:border-brand-red/30 hover:text-brand-red"
      >
        <ArrowLeft size={13} /> Back to shops
      </Link>

      <StoreHeader store={store} showDistance={stored != null} />

      <div className="mt-8">
        {needsZone ? (
          <NoLocation reason="no-pick" />
        ) : categories.length === 0 ? (
          <EmptyInline message="This store hasn't listed any items yet." />
        ) : (
          <>
            <CategoryTabs
              categories={categories}
              selected={page.selectedCategoryId}
              onSelect={(id) =>
                setPage((p) =>
                  p.kind === "ready" ? { ...p, selectedCategoryId: id } : p,
                )
              }
            />

            <ItemGrid
              entry={items[page.selectedCategoryId]}
              isLastPage={true}
            />
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function CategoryTabs({
  categories,
  selected,
  onSelect,
}: {
  categories: NonNullable<StoreDetailData["category_details"]>;
  selected: number;
  onSelect: (id: number) => void;
}) {
  // Synthetic "All" tab first, then the store's real categories.
  const tabs: Array<{ id: number; name: string }> = [
    { id: ALL_TAB_ID, name: "All" },
    ...categories.map((c) => ({ id: c.id, name: c.name })),
  ];
  return (
    <div className="-mx-1 mb-7 flex gap-2 overflow-x-auto px-1 pb-1">
      {tabs.map((c) => {
        const isActive = c.id === selected;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.id)}
            className={cn(
              "inline-flex shrink-0 items-center rounded-pill border px-4 py-2 text-sm font-medium transition-all duration-200",
              isActive
                ? "border-transparent bg-ink-900 text-white shadow-[0_8px_22px_-8px_rgba(13,13,15,0.55)]"
                : "border-ink-200 bg-white text-ink-700 hover:-translate-y-px hover:border-brand-red/30 hover:text-brand-red hover:shadow-soft",
            )}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
}

function ItemGrid({
  entry,
}: {
  entry?: ItemsByCategory[number];
  isLastPage?: boolean;
}) {
  if (!entry || entry.loading) return <CenterSpinner label="Loading items…" />;
  if (entry.error) {
    return (
      <EmptyInline
        message={entry.error || "We couldn't load items for this category."}
      />
    );
  }
  if (entry.items.length === 0) {
    return <EmptyInline message="No items in this category yet." />;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entry.items.map((it) => (
        <ItemCard key={it.id} item={it} />
      ))}
    </div>
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

function EmptyInline({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-200 bg-white/60 p-10 text-center text-sm text-ink-600 backdrop-blur">
      {message}
    </div>
  );
}

function EmptyState({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-ink-200 bg-white p-10 text-center shadow-card">
      <h2 className="font-serif text-display-sm text-ink-900">{title}</h2>
      <p className="mt-2 text-sm text-ink-600">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="btn-flame mt-7 inline-flex h-12 items-center justify-center rounded-pill px-7 text-sm font-medium text-white"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
