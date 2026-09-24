"use client";

import Image from "next/image";
import Link from "next/link";
import { Star, Clock, BadgePercent, Truck } from "lucide-react";
import type { Store } from "@/lib/api/stores";
import { HeartButton } from "@/components/wishlist/heart-button";
import { cn } from "@/lib/cn";
import { formatDistance } from "@/lib/geo";

/**
 * Premium visual card for a store on the browse list.
 * Links to /store/[id].
 *
 * `showDistance` must be false when the list was fetched without the
 * customer's lat/lng: the API still returns a distance, measured from
 * a null point.
 */
export function StoreCard({
  store,
  showDistance = true,
}: {
  store: Store;
  showDistance?: boolean;
}) {
  const isOpen = store.open !== 0;
  const rating = typeof store.avg_rating === "number" ? store.avg_rating : null;
  const cover = store.cover_photo_full_url ?? null;
  const logo = store.logo_full_url ?? null;
  const discount = store.discount?.discount ?? 0;
  const distance = showDistance ? formatDistance(store.distance) : null;

  return (
    <Link
      href={`/store/${store.id}`}
      className={cn(
        "card-luxe group relative flex flex-col overflow-hidden rounded-3xl",
        !isOpen && "opacity-75",
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-canvas-sunken">
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
          />
        ) : null}

        <div className="image-scrim absolute inset-0" />

        {discount > 0 && (
          <span
            className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-[0.7rem] font-semibold text-white shadow-[0_6px_18px_-4px_rgba(222,22,0,0.55)]"
            style={{
              background:
                "linear-gradient(135deg, #ff3d20 0%, #de1600 60%, #a30f00 100%)",
            }}
          >
            <BadgePercent size={12} />
            {discount}% off
          </span>
        )}
        {store.free_delivery && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-pill bg-white/95 px-2.5 py-1 text-[0.7rem] font-semibold text-ink-900 shadow-card backdrop-blur">
            <Truck size={12} className="text-brand-red" />
            Free delivery
          </span>
        )}
        {!isOpen && (
          <span className="absolute bottom-3 left-3 rounded-pill bg-black/70 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur">
            Closed
          </span>
        )}
        <HeartButton
          kind="store"
          id={store.id}
          label={store.name}
          className="absolute bottom-3 right-3"
        />
      </div>

      <div className="flex flex-1 items-start gap-3 p-4">
        {logo && (
          <Image
            src={logo}
            alt=""
            width={44}
            height={44}
            className="-mt-9 h-12 w-12 shrink-0 rounded-2xl border-2 border-white bg-white object-cover shadow-card"
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold tracking-[-0.005em] text-ink-900">
            {store.name}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
            {rating !== null && (
              <span className="inline-flex items-center gap-1 font-medium text-ink-700">
                <Star
                  size={12}
                  className="fill-brand-orange text-brand-orange"
                />
                {rating.toFixed(1)}
                {store.rating_count ? (
                  <span className="text-ink-400">({store.rating_count})</span>
                ) : null}
              </span>
            )}
            {store.delivery_time && (
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                {store.delivery_time}
              </span>
            )}
            {distance && <span className="text-ink-400">{distance}</span>}
          </p>
        </div>
      </div>
    </Link>
  );
}
