"use client";

import Image from "next/image";
import Link from "next/link";
import { Star, Clock, BadgePercent, Truck } from "lucide-react";
import type { Store } from "@/lib/api/stores";
import { cn } from "@/lib/cn";

/**
 * Visual card for a store on the browse list. v0 — links to
 * /store/[id] which doesn't exist yet (404). Replace the href
 * once the store detail page lands.
 */
export function StoreCard({ store }: { store: Store }) {
  const isOpen = store.open !== 0;
  const rating = typeof store.avg_rating === "number" ? store.avg_rating : null;
  const cover = store.cover_photo_full_url ?? null;
  const logo = store.logo_full_url ?? null;
  const discount = store.discount?.discount ?? 0;
  const distanceKm =
    typeof store.distance === "number" ? store.distance.toFixed(1) : null;

  return (
    <Link
      href={`/store/${store.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated",
        !isOpen && "opacity-70",
      )}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-ink-100">
        {cover ? (
          <Image
            src={cover}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : null}

        {discount > 0 && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand-red px-2.5 py-1 text-xs font-medium text-white shadow-sm">
            <BadgePercent size={12} />
            {discount}% off
          </span>
        )}
        {store.free_delivery && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-ink-900 shadow-sm">
            <Truck size={12} className="text-brand-red" />
            Free delivery
          </span>
        )}
        {!isOpen && (
          <span className="absolute bottom-3 left-3 rounded-full bg-ink-900/85 px-2.5 py-1 text-xs font-medium text-white">
            Closed
          </span>
        )}
      </div>

      <div className="flex flex-1 items-start gap-3 p-4">
        {logo && (
          <Image
            src={logo}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 shrink-0 rounded-lg border border-ink-200 object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-medium text-ink-900">
            {store.name}
          </h3>
          <p className="mt-1 flex items-center gap-3 text-xs text-ink-500">
            {rating !== null && (
              <span className="inline-flex items-center gap-1">
                <Star size={12} className="fill-brand-orange text-brand-orange" />
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
            {distanceKm && <span>{distanceKm} km</span>}
          </p>
        </div>
      </div>
    </Link>
  );
}
