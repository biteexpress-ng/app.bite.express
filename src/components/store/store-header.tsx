"use client";

import Image from "next/image";
import { Star, Clock, MapPin, Truck, BadgeAlert } from "lucide-react";
import type { StoreDetail } from "@/lib/api/store-detail";
import { HeartButton } from "@/components/wishlist/heart-button";
import { cn } from "@/lib/cn";

/**
 * Store header: cover photo + logo + name + meta row +
 * announcement banner when the store has one active.
 */
export function StoreHeader({ store }: { store: StoreDetail }) {
  const isOpen = store.open !== 0;
  const cover = store.cover_photo_full_url ?? null;
  const logo = store.logo_full_url ?? null;
  const rating =
    typeof store.avg_rating === "number" ? store.avg_rating : null;
  const distanceKm =
    typeof store.distance === "number" ? store.distance.toFixed(1) : null;

  return (
    <header>
      <div className="relative aspect-[21/9] w-full overflow-hidden rounded-3xl bg-ink-100 sm:aspect-[24/7]">
        {cover && (
          <Image
            src={cover}
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/0 to-black/0" />
      </div>

      {/* Avatar pops up over the bottom of the cover, but the title
          sits cleanly BELOW the cover so the banner image can never
          obscure the store name. */}
      <div className="-mt-10 px-1 sm:-mt-12">
        <div
          className={cn(
            "relative h-20 w-20 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-soft sm:h-24 sm:w-24",
          )}
        >
          {logo && (
            <Image src={logo} alt="" fill sizes="96px" className="object-cover" />
          )}
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3 px-1">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-2xl text-ink-900 sm:text-3xl">
            {store.name}
          </h1>
          {store.address && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-600">
              <MapPin size={13} className="shrink-0" />
              <span className="truncate">{store.address}</span>
            </p>
          )}
        </div>
        <HeartButton
          kind="store"
          id={store.id}
          label={store.name}
          size="md"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-700">
        {rating !== null && (
          <span className="inline-flex items-center gap-1.5">
            <Star size={14} className="fill-brand-orange text-brand-orange" />
            <span className="font-medium text-ink-900">{rating.toFixed(1)}</span>
            {store.rating_count ? (
              <span className="text-ink-500">({store.rating_count})</span>
            ) : null}
          </span>
        )}
        {store.delivery_time && (
          <span className="inline-flex items-center gap-1.5">
            <Clock size={14} className="text-ink-500" />
            {store.delivery_time}
          </span>
        )}
        {distanceKm && (
          <span className="text-ink-500">{distanceKm} km away</span>
        )}
        {store.free_delivery && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
            <Truck size={12} />
            Free delivery
          </span>
        )}
        {typeof store.minimum_order === "number" && store.minimum_order > 0 && (
          <span className="text-ink-500">
            Min order ₦{store.minimum_order.toLocaleString()}
          </span>
        )}
        {!isOpen && (
          <span className="rounded-full bg-ink-900/85 px-2.5 py-0.5 text-xs font-medium text-white">
            Closed right now
          </span>
        )}
      </div>

      {store.announcement === 1 && store.announcement_message && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-ink-800">
          <BadgeAlert size={16} className="mt-0.5 shrink-0 text-warning" />
          <p>{store.announcement_message}</p>
        </div>
      )}
    </header>
  );
}
