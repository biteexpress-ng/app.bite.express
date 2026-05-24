"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { selectionsSummary } from "@/lib/food-variations";

/**
 * Cart page contents — list of lines with qty steppers + subtotal +
 * "Go to checkout" CTA. Checkout itself doesn't exist yet (slice 6).
 *
 * Hydrates the cart store on mount so a deep-link / hard-refresh
 * shows the persisted contents.
 */
export function CartView() {
  const hydrate = useCart((s) => s.hydrate);
  const hydrated = useCart((s) => s.hydrated);
  const lines = useCart((s) => s.lines);
  const storeId = useCart((s) => s.storeId);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center gap-2 text-ink-500">
        <Loader2 size={18} className="animate-spin" />
        Loading your cart…
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-ink-200 bg-white p-8 text-center shadow-soft">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-600">
          <ShoppingBag size={20} strokeWidth={1.8} />
        </div>
        <h2 className="mt-4 font-serif text-xl text-ink-900">
          Your cart is empty
        </h2>
        <p className="mt-2 text-sm text-ink-600">
          Browse a category and add a few things to get started.
        </p>
        <Link
          href="/browse"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-brand-red px-6 text-sm font-medium text-white shadow-sm hover:bg-brand-red-600"
        >
          Start browsing
        </Link>
      </div>
    );
  }

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-soft">
        {storeId !== null && (
          <div className="flex items-center justify-between gap-3 border-b border-ink-200/70 px-5 py-3 text-sm">
            <Link
              href={`/store/${storeId}`}
              className="font-medium text-ink-900 hover:text-brand-red"
            >
              Continue shopping at this shop →
            </Link>
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-error"
            >
              <Trash2 size={12} />
              Clear cart
            </button>
          </div>
        )}

        <ul className="divide-y divide-ink-200/70">
          {lines.map((l) => (
            <li key={l.key} className="flex items-center gap-4 p-4 sm:p-5">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ink-100">
                {l.imageUrl && (
                  <Image
                    src={l.imageUrl}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium text-ink-900">
                  {l.name}
                </p>
                {l.selections.length > 0 && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">
                    {selectionsSummary(l.selections)}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-ink-500">
                  ₦{Math.round(l.unitPrice).toLocaleString()} each
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 items-center rounded-full border border-ink-200">
                  <button
                    type="button"
                    onClick={() => setQty(l.key, l.qty - 1)}
                    aria-label={`Decrease quantity of ${l.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center text-ink-700"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="min-w-[2rem] text-center text-sm font-medium text-ink-900">
                    {l.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(l.key, l.qty + 1)}
                    aria-label={`Increase quantity of ${l.name}`}
                    className="inline-flex h-9 w-9 items-center justify-center text-ink-700"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => remove(l.key)}
                  aria-label={`Remove ${l.name}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-400 hover:text-error"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-soft sm:p-6">
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between text-ink-700">
            <dt>Items</dt>
            <dd>{count}</dd>
          </div>
          <div className="flex items-center justify-between text-ink-700">
            <dt>Subtotal</dt>
            <dd className="font-medium text-ink-900">
              ₦{Math.round(subtotal).toLocaleString()}
            </dd>
          </div>
          <div className="flex items-center justify-between border-t border-ink-200/70 pt-3 text-ink-500">
            <dt>Delivery & fees</dt>
            <dd>Calculated at checkout</dd>
          </div>
        </dl>

        <Link
          href="/checkout"
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-red px-6 text-base font-medium text-white shadow-sm hover:bg-brand-red-600"
        >
          Go to checkout
          <ArrowRight size={16} strokeWidth={2.2} />
        </Link>
        <p className="mt-2 text-center text-xs text-ink-500">
          Sign-in & address confirmation happen on the next step.
        </p>
      </div>
    </div>
  );
}
