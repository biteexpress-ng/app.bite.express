"use client";

import Image from "next/image";
import { Star, Clock, MapPin, Truck, BadgeAlert } from "lucide-react";
import type { StoreDetail } from "@/lib/api/store-detail";
import { HeartButton } from "@/components/wishlist/heart-button";
import { formatDistance } from "@/lib/geo";

/**
 * Premium store header: cinematic cover with gradient scrim,
 * floating logo, serif name, refined stat bar, announcement.
 */
export function StoreHeader({
  store,
  showDistance,
}: {
  store: StoreDetail;
  /** False when the detail call went out without the customer's lat/lng,
   *  in which case the API's distance is measured from a null point. */
  showDistance: boolean;
}) {
  const isOpen = store.open !== 0;
  const cover = store.cover_photo_full_url ?? null;
  const logo = store.logo_full_url ?? null;
  const rating =
    typeof store.avg_rating === "number" ? store.avg_rating : null;
  const distance = showDistance ? formatDistance(store.distance) : null;

  return (
    <header className="fade-up">
      <div className="relative aspect-[21/8] w-full overflow-hidden rounded-3xl bg-canvas-sunken sm:aspect-[24/7]">
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
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 100%)",
          }}
        />
        {!isOpen && (
          <span className="absolute right-4 top-4 rounded-pill bg-black/70 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur">
            Closed right now
          </span>
        )}
      </div>

      <div className="-mt-12 px-1 sm:-mt-14">
        <div className="relative h-24 w-24 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-floating sm:h-28 sm:w-28">
          {logo && (
            <Image src={logo} alt="" fill sizes="112px" className="object-cover" />
          )}
        </div>
      </div>

      <div className="mt-5 flex items-start gap-4 px-1">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-3xl tracking-[-0.018em] text-ink-900 sm:text-display-md md:text-display-lg">
            {store.name}
          </h1>
          {store.address && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-600">
              <MapPin size={13} className="shrink-0 text-brand-red" />
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

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {rating !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-ink-200 bg-white px-3 py-1.5 text-sm">
            <Star size={14} className="fill-brand-orange text-brand-orange" />
            <span className="font-semibold text-ink-900">
              {rating.toFixed(1)}
            </span>
            {store.rating_count ? (
              <span className="text-ink-500">({store.rating_count})</span>
            ) : null}
          </span>
        )}
        {store.delivery_time && (
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-700">
            <Clock size={14} className="text-ink-500" />
            {store.delivery_time}
          </span>
        )}
        {distance && (
          <span className="inline-flex items-center rounded-pill border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-700">
            {distance} away
          </span>
        )}
        {store.free_delivery && (
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-success/30 bg-success-soft px-3 py-1.5 text-sm font-medium text-success">
            <Truck size={13} />
            Free delivery
          </span>
        )}
        {typeof store.minimum_order === "number" && store.minimum_order > 0 && (
          <span className="inline-flex items-center rounded-pill border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-700">
            Min order ₦{store.minimum_order.toLocaleString()}
          </span>
        )}
      </div>

      {store.announcement === 1 && store.announcement_message && (
        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-warning/30 bg-warning-soft p-4 text-sm text-ink-800">
          <BadgeAlert size={16} className="mt-0.5 shrink-0 text-warning" />
          <p>{store.announcement_message}</p>
        </div>
      )}
    </header>
  );
}
