"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, Star } from "lucide-react";
import type { StoreItem } from "@/lib/api/store-detail";
import { AddToCartSheet } from "@/components/cart/add-to-cart-sheet";
import { HeartButton } from "@/components/wishlist/heart-button";
import { cn } from "@/lib/cn";

/**
 * Premium single-item card on the store detail page.
 *
 * Clicking the "+" opens the AddToCartSheet for this item.
 */
export function ItemCard({ item }: { item: StoreItem }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const img = item.image_full_url ?? null;
  const price = item.price ?? 0;
  const discount = item.discount ?? 0;
  const discountType = item.discount_type ?? null;

  const finalPrice =
    discount > 0
      ? discountType === "amount"
        ? Math.max(0, price - discount)
        : Math.max(0, price - (price * discount) / 100)
      : price;
  const hasDiscount = finalPrice !== price;

  const rating = typeof item.avg_rating === "number" ? item.avg_rating : null;
  const inStock = true;

  const percentOff =
    hasDiscount && discount > 0
      ? discountType === "amount"
        ? Math.round((discount / price) * 100)
        : Math.round(discount)
      : null;

  return (
    <>
      <article
        className={cn(
          "group flex gap-4 rounded-2xl border border-ink-200 bg-white p-3 shadow-soft transition-all duration-300 hover:-translate-y-px hover:border-brand-red/20 hover:shadow-elevated",
          !inStock && "opacity-75",
        )}
      >
        <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-canvas-sunken">
          {img && (
            <Image
              src={img}
              alt=""
              fill
              sizes="112px"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
            />
          )}
          {percentOff !== null && percentOff > 0 && (
            <span
              className="absolute left-2 top-2 inline-flex items-center rounded-pill px-2 py-0.5 text-[0.65rem] font-semibold text-white shadow-[0_4px_10px_-2px_rgba(222,22,0,0.55)]"
              style={{
                background:
                  "linear-gradient(135deg, #ff3d20 0%, #de1600 80%)",
              }}
            >
              -{percentOff}%
            </span>
          )}
          <HeartButton
            kind="item"
            id={item.id}
            label={item.name}
            className="!h-7 !w-7 absolute right-1 top-1 !shadow"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-[0.95rem] font-semibold tracking-[-0.005em] text-ink-900">
              {item.name}
            </h3>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              disabled={!inStock}
              aria-label={`Add ${item.name} to cart`}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-900 shadow-soft transition-all duration-200 hover:-translate-y-px hover:border-brand-red hover:bg-brand-red hover:text-white hover:shadow-[0_8px_20px_-6px_rgba(222,22,0,0.55)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} strokeWidth={2.2} />
            </button>
          </div>

          {item.description && (
            <p className="mt-1 line-clamp-2 text-xs text-ink-500">
              {item.description}
            </p>
          )}

          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-semibold text-ink-900">
                ₦{Math.round(finalPrice).toLocaleString()}
              </span>
              {hasDiscount && (
                <span className="text-xs text-ink-500 line-through">
                  ₦{Math.round(price).toLocaleString()}
                </span>
              )}
            </div>
            {rating !== null && rating > 0 && (
              <span className="inline-flex items-center gap-0.5 text-xs font-medium text-ink-600">
                <Star
                  size={11}
                  className="fill-brand-orange text-brand-orange"
                />
                {rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </article>

      <AddToCartSheet
        item={sheetOpen ? item : null}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
