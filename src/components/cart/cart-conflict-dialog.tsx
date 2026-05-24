"use client";

import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Surfaced when the customer tries to add an item from a different
 * store while the cart already has items from another shop.
 *
 * 6amMart's single-store cart invariant — confirming clears the
 * prior cart and starts a new one for the new store.
 */
export function CartConflictDialog({ open, onCancel, onConfirm }: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="cart-conflict-title"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-elevated">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-red/10 text-brand-red">
          <ShoppingBag size={20} />
        </div>
        <h2
          id="cart-conflict-title"
          className="mt-4 font-serif text-xl text-ink-900"
        >
          Start a new cart?
        </h2>
        <p className="mt-2 text-sm text-ink-600">
          Your cart has items from another shop. Adding this one will clear
          those.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "inline-flex h-11 flex-1 items-center justify-center rounded-full bg-brand-red px-5 text-sm font-medium text-white shadow-sm",
              "hover:bg-brand-red-600 active:bg-brand-red-700",
            )}
          >
            Start new cart
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-ink-200 bg-white px-5 text-sm font-medium text-ink-900 hover:bg-ink-50"
          >
            Keep current
          </button>
        </div>
      </div>
    </div>
  );
}
