"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Minus, Plus, X, ShoppingBag, Loader2 } from "lucide-react";
import type { StoreItem } from "@/lib/api/store-detail";
import { useCart } from "@/lib/cart-store";
import { CartConflictDialog } from "./cart-conflict-dialog";
import { cn } from "@/lib/cn";

type Props = {
  item: StoreItem | null;
  open: boolean;
  onClose: () => void;
};

/**
 * Add-to-cart bottom sheet for a single item.
 *
 * v0: quantity stepper only. Variations / food_variations / add_ons
 * are surfaced as a read-only "Customisation comes in the next
 * release" notice so users with complex items know it's not
 * forgotten. Adding still proceeds with the default config.
 *
 * Single-store invariant: if the cart already has items from a
 * different store, surfaces <CartConflictDialog /> instead of
 * adding. Confirming clears the prior cart and adds.
 */
export function AddToCartSheet({ item, open, onClose }: Props) {
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    if (open) {
      setQty(1);
      setSubmitting(false);
      setConflict(false);
    }
  }, [open, item?.id]);

  if (!open || !item) return null;

  const price = item.price ?? 0;
  const discount = item.discount ?? 0;
  const discountType = item.discount_type ?? null;
  const unit =
    discount > 0
      ? discountType === "amount"
        ? Math.max(0, price - discount)
        : Math.max(0, price - (price * discount) / 100)
      : price;
  const lineTotal = Math.round(unit * qty);
  const inStock = item.stock === undefined || item.stock > 0;
  const maxQty =
    typeof item.stock === "number" && item.stock > 0
      ? Math.min(item.stock, 99)
      : 99;

  const hasComplexConfig = Boolean(
    item.food_variations?.length ||
      item.variations?.length ||
      item.add_ons?.length,
  );

  function handleAdd(force = false) {
    if (!item) return;
    setSubmitting(true);
    const res = add(
      {
        itemId: item.id,
        storeId: item.store_id,
        name: item.name,
        imageUrl: item.image_full_url,
        unitPrice: unit,
        qty,
      },
      { force },
    );
    if (!res.ok && res.reason === "store-conflict") {
      setSubmitting(false);
      setConflict(true);
      return;
    }
    setSubmitting(false);
    onClose();
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`Add ${item.name} to cart`}
      >
        <div
          className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-elevated sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative aspect-[16/9] w-full bg-ink-100">
            {item.image_full_url && (
              <Image
                src={item.image_full_url}
                alt=""
                fill
                sizes="(min-width: 640px) 28rem, 100vw"
                className="object-cover"
              />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-ink-900 shadow-sm hover:bg-white"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5">
            <h2 className="text-lg font-medium text-ink-900">{item.name}</h2>
            {item.description && (
              <p className="mt-1 text-sm text-ink-600">{item.description}</p>
            )}

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-xl font-semibold text-ink-900">
                ₦{Math.round(unit).toLocaleString()}
              </span>
              {unit !== price && (
                <span className="text-sm text-ink-500 line-through">
                  ₦{Math.round(price).toLocaleString()}
                </span>
              )}
            </div>

            {hasComplexConfig ? (
              <p className="mt-4 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-600">
                Variations & add-ons come in the next release — adding the
                default option for now.
              </p>
            ) : null}

            {!inStock && (
              <p className="mt-4 rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
                Out of stock right now.
              </p>
            )}

            <div className="mt-5 flex items-center justify-between">
              <span className="text-sm text-ink-600">Quantity</span>
              <div className="inline-flex h-10 items-center rounded-full border border-ink-200 bg-white">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                  aria-label="Decrease quantity"
                  className="inline-flex h-10 w-10 items-center justify-center text-ink-700 disabled:opacity-40"
                >
                  <Minus size={16} />
                </button>
                <span className="min-w-[2.5rem] text-center text-base font-medium text-ink-900">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                  disabled={qty >= maxQty}
                  aria-label="Increase quantity"
                  className="inline-flex h-10 w-10 items-center justify-center text-ink-700 disabled:opacity-40"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleAdd(false)}
              disabled={submitting || !inStock}
              className={cn(
                "mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-red px-6 text-base font-medium text-white shadow-sm transition-colors",
                "hover:bg-brand-red-600 active:bg-brand-red-700",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Adding…
                </>
              ) : (
                <>
                  <ShoppingBag size={16} />
                  Add to cart — ₦{lineTotal.toLocaleString()}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <CartConflictDialog
        open={conflict}
        onCancel={() => setConflict(false)}
        onConfirm={() => {
          setConflict(false);
          handleAdd(true);
        }}
      />
    </>
  );
}
