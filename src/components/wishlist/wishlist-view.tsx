"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Heart, Loader2, Store as StoreIcon } from "lucide-react";
import { useLocation } from "@/lib/location-store";
import { fetchWishlist } from "@/lib/api/wishlist";
import type { StoreItem } from "@/lib/api/store-detail";
import { cheapestVariantPrice, hasLegacyChoices } from "@/lib/legacy-variations";
import type { Store } from "@/lib/api/stores";
import { StoreCard } from "@/components/browse/store-card";
import { HeartButton } from "./heart-button";

type State =
  | { kind: "hydrating" }
  | { kind: "loading" }
  | { kind: "no-zone" }
  | { kind: "ready"; items: StoreItem[]; stores: Store[] }
  | { kind: "error"; message: string };

/**
 * /wishlist — pre-grouped {items, stores} from the backend's
 * Helpers::wishlist_data_formatting.
 *
 * Items + stores both come back ALREADY filtered to the customer's
 * zone server-side (so items/stores in zones the customer isn't
 * currently using show up via the OR cluster but not here). Each
 * card includes a heart toggle so the customer can quickly unfavour
 * from this page; toggling immediately reflects in the same list
 * thanks to the optimistic wishlist store.
 */
export function WishlistView() {
  const stored = useLocation((s) => s.location);
  const hydrated = useLocation((s) => s.hydrated);
  const hydrateLoc = useLocation((s) => s.hydrate);

  const [state, setState] = useState<State>({ kind: "hydrating" });

  useEffect(() => {
    hydrateLoc();
  }, [hydrateLoc]);

  useEffect(() => {
    if (!hydrated) return;
    const zc = stored?.zoneCheck;
    if (!stored || !zc || zc.status !== "in-zone") {
      setState({ kind: "no-zone" });
      return;
    }
    setState({ kind: "loading" });
    fetchWishlist(zc.zoneIds).then((res) => {
      if (res.ok) {
        setState({
          kind: "ready",
          items: res.items,
          stores: res.stores,
        });
      } else {
        setState({ kind: "error", message: res.message });
      }
    });
  }, [hydrated, stored]);

  if (state.kind === "hydrating" || state.kind === "loading") {
    return <CenterSpinner label="Loading your wishlist…" />;
  }
  if (state.kind === "no-zone") {
    return (
      <EmptyCard
        title="Pick a delivery address first"
        body="We need a serviced address to know which of your favourites are deliverable."
        cta={{ href: "/", label: "Pick an address" }}
      />
    );
  }
  if (state.kind === "error") {
    return (
      <div className="rounded-2xl border border-error/30 bg-error/5 p-4 text-sm text-error">
        {state.message}
      </div>
    );
  }

  if (state.items.length === 0 && state.stores.length === 0) {
    return (
      <EmptyCard
        title="No favourites yet"
        body="Tap the heart on a shop or an item and it'll show up here."
        cta={{ href: "/browse", label: "Browse shops" }}
      />
    );
  }

  return (
    <div className="space-y-10">
      {state.stores.length > 0 && (
        <section>
          <h2 className="mb-4 font-serif text-xl text-ink-900">
            Shops
            <span className="ml-2 text-sm font-normal text-ink-500">
              ({state.stores.length})
            </span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.stores.map((s) => (
              <StoreCard key={s.id} store={s} showDistance={false} />
            ))}
          </div>
        </section>
      )}

      {state.items.length > 0 && (
        <section>
          <h2 className="mb-4 font-serif text-xl text-ink-900">
            Items
            <span className="ml-2 text-sm font-normal text-ink-500">
              ({state.items.length})
            </span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {state.items.map((it) => (
              <WishlistItemCard key={it.id} item={it} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- */

function WishlistItemCard({ item }: { item: StoreItem }) {
  const img = item.image_full_url ?? null;
  // Items with sizes are priced per size, so the card shows the cheapest.
  const hasSizes = hasLegacyChoices(item);
  const price = hasSizes
    ? (cheapestVariantPrice(item) ?? item.price ?? 0)
    : (item.price ?? 0);
  const discount = item.discount ?? 0;
  const discountType = item.discount_type ?? null;
  const finalPrice =
    discount > 0
      ? discountType === "amount"
        ? Math.max(0, price - discount)
        : Math.max(0, price - (price * discount) / 100)
      : price;
  const hasDiscount = finalPrice !== price;

  const href = item.store_id ? `/store/${item.store_id}` : "/browse";

  return (
    <article className="flex gap-4 rounded-2xl border border-ink-200 bg-white p-3 shadow-soft">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-ink-100">
        {img && (
          <Image src={img} alt="" fill sizes="96px" className="object-cover" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={href}
            className="line-clamp-2 text-sm font-medium text-ink-900 hover:text-brand-red"
          >
            {item.name}
          </Link>
          <HeartButton kind="item" id={item.id} label={item.name} />
        </div>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs text-ink-500">
            {item.description}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="flex items-baseline gap-1.5">
            {hasSizes && (
              <span className="text-xs font-medium text-ink-500">From</span>
            )}
            <span className="text-sm font-semibold text-ink-900">
              ₦{Math.round(finalPrice).toLocaleString()}
            </span>
            {hasDiscount && (
              <span className="text-xs text-ink-500 line-through">
                ₦{Math.round(price).toLocaleString()}
              </span>
            )}
          </div>
          {item.store_id && (
            <Link
              href={`/store/${item.store_id}`}
              className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-brand-red"
            >
              <StoreIcon size={11} />
              View shop
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function EmptyCard({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-ink-200 bg-white p-8 text-center shadow-soft">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-600">
        <Heart size={20} />
      </div>
      <h2 className="mt-4 font-serif text-xl text-ink-900">{title}</h2>
      <p className="mt-2 text-sm text-ink-600">{body}</p>
      <Link
        href={cta.href}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-brand-red px-6 text-sm font-medium text-white shadow-sm hover:bg-brand-red-600"
      >
        {cta.label}
      </Link>
    </div>
  );
}

function CenterSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[20vh] items-center justify-center gap-2 text-ink-500">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}
