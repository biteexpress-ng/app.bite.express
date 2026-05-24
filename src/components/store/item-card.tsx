"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, Star } from "lucide-react";
import type { StoreItem } from "@/lib/api/store-detail";
import { AddToCartSheet } from "@/components/cart/add-to-cart-sheet";
import { HeartButton } from "@/components/wishlist/heart-button";
import { cn } from "@/lib/cn";

/**
 * Single-item card on the store detail page.
 *
 * Clicking the "+" opens the AddToCartSheet for this item. The sheet
 * handles all the cart-mutation logic (qty stepper, single-store
 * invariant, conflict dialog).
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
  // Don't lock the button on stock === 0. Food module items default
  // to stock=0 because stock tracking is off (config('module.food.stock')
  // is false on the backend). The order-place endpoint enforces
  // real out-of-stock only for modules where stock matters.
  const inStock = true;

  return (
    <>
      <article
        className={cn(
          "flex gap-4 rounded-2xl border border-ink-200 bg-white p-3 shadow-soft transition-shadow hover:shadow-elevated",
          !inStock && "opacity-70",
        )}
      >
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-ink-100">
          {img && (
            <Image src={img} alt="" fill sizes="96px" className="object-cover" />
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
            <h3 className="line-clamp-2 text-sm font-medium text-ink-900">
              {item.name}
            </h3>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              disabled={!inStock}
              aria-label={`Add ${item.name} to cart`}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink-200 bg-white text-ink-900 transition-colors hover:bg-ink-50 hover:text-brand-red disabled:cursor-not-allowed disabled:opacity-50"
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
              <span className="text-sm font-semibold text-ink-900">
                ₦{Math.round(finalPrice).toLocaleString()}
              </span>
              {hasDiscount && (
                <span className="text-xs text-ink-500 line-through">
                  ₦{Math.round(price).toLocaleString()}
                </span>
              )}
            </div>
            {rating !== null && rating > 0 && (
              <span className="inline-flex items-center gap-0.5 text-xs text-ink-500">
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
