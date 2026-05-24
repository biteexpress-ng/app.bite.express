"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Minus, Plus, X, ShoppingBag, Loader2 } from "lucide-react";
import type { StoreItem } from "@/lib/api/store-detail";
import { useCart } from "@/lib/cart-store";
import {
  selectionsUplift,
  validateSelections,
  type VariationSelection,
} from "@/lib/food-variations";
import { VariationPicker } from "./variation-picker";
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
 * Mounts <VariationPicker /> when the item has food_variations, and
 * blocks adding until validation passes (required groups picked,
 * min/max respected). unitPrice in the CTA reflects the chosen
 * options live.
 *
 * Add-ons remain TODO — when add_ons.length > 0 we still show a
 * notice so users know it's not forgotten.
 *
 * Single-store invariant: if the cart already has items from a
 * different store, surfaces <CartConflictDialog /> instead of
 * adding. Confirming clears the prior cart and adds.
 */
export function AddToCartSheet({ item, open, onClose }: Props) {
  const add = useCart((s) => s.add);
  const [qty, setQty] = useState(1);
  const [selections, setSelections] = useState<VariationSelection[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (open) {
      setQty(1);
      setSelections([]);
      setSubmitting(false);
      setConflict(false);
      setShowErrors(false);
    }
  }, [open, item?.id]);

  if (!open || !item) return null;

  const variations = item.food_variations ?? [];
  const errors = validateSelections(variations, selections);

  const price = item.price ?? 0;
  const discount = item.discount ?? 0;
  const discountType = item.discount_type ?? null;
  const basePrice =
    discount > 0
      ? discountType === "amount"
        ? Math.max(0, price - discount)
        : Math.max(0, price - (price * discount) / 100)
      : price;
  const uplift = selectionsUplift(variations, selections);
  const unit = basePrice + uplift;
  const lineTotal = Math.round(unit * qty);
  // See item-card.tsx — stock=0 is the default for food module items;
  // we let the backend's order-place endpoint enforce real stock.
  const inStock = true;
  const maxQty =
    typeof item.stock === "number" && item.stock > 0
      ? Math.min(item.stock, item.maximum_cart_quantity ?? 99)
      : (item.maximum_cart_quantity ?? 99);

  const hasAddons = Boolean(item.add_ons?.length);
  const canAdd = inStock && errors.length === 0;

  function handleAdd(force = false) {
    if (!item) return;
    if (errors.length > 0) {
      setShowErrors(true);
      return;
    }
    setSubmitting(true);
    const res = add(
      {
        itemId: item.id,
        storeId: item.store_id,
        name: item.name,
        imageUrl: item.image_full_url,
        unitPrice: unit,
        qty,
        selections,
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
          className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-elevated sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative aspect-[16/9] w-full shrink-0 bg-ink-100">
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

          <div className="flex-1 overflow-y-auto p-5">
            <h2 className="text-lg font-medium text-ink-900">{item.name}</h2>
            {item.description && (
              <p className="mt-1 text-sm text-ink-600">{item.description}</p>
            )}

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-xl font-semibold text-ink-900">
                ₦{Math.round(basePrice).toLocaleString()}
              </span>
              {basePrice !== price && (
                <span className="text-sm text-ink-500 line-through">
                  ₦{Math.round(price).toLocaleString()}
                </span>
              )}
            </div>

            {variations.length > 0 && (
              <div className="mt-5">
                <VariationPicker
                  variations={variations}
                  selections={selections}
                  onChange={(next) => {
                    setSelections(next);
                    if (showErrors) setShowErrors(false);
                  }}
                />
              </div>
            )}

            {hasAddons && (
              <p className="mt-5 rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-600">
                Add-ons come in the next release — adding this item without
                extras for now.
              </p>
            )}

            {!inStock && (
              <p className="mt-5 rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
                Out of stock right now.
              </p>
            )}

            {showErrors && errors.length > 0 && (
              <ul className="mt-5 space-y-1 rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-xs text-error">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="shrink-0 border-t border-ink-200 bg-white p-5">
            <div className="flex items-center justify-between">
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
              disabled={submitting || !inStock || !canAdd}
              className={cn(
                "mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-red px-6 text-base font-medium text-white shadow-sm transition-colors",
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
