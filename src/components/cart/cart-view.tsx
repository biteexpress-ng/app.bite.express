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
 * Premium cart page: list of lines, pill steppers, premium summary
 * card with flame CTA.
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
      <div className="fade-up mx-auto max-w-md rounded-3xl border border-ink-200 bg-white p-10 text-center shadow-card">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-brand-red"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,107,74,0.18), rgba(222,22,0,0.08))",
          }}
        >
          <ShoppingBag size={22} strokeWidth={1.8} />
        </div>
        <h2 className="mt-5 font-serif text-display-sm text-ink-900">
          Your cart is empty
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Browse a category and add a few things to get started.
        </p>
        <Link
          href="/browse"
          className="btn-flame mt-7 inline-flex h-12 items-center justify-center rounded-pill px-7 text-sm font-medium text-white"
        >
          Start browsing
          <ArrowRight size={15} strokeWidth={2.2} />
        </Link>
      </div>
    );
  }

  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);

  return (
    <div className="fade-up grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:gap-8">
      <div className="overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-card">
        {storeId !== null && (
          <div className="flex items-center justify-between gap-3 border-b border-ink-200/70 bg-canvas-sunken/50 px-5 py-3 text-sm">
            <Link
              href={`/store/${storeId}`}
              className="font-medium text-ink-900 hover:text-brand-red"
            >
              Continue shopping at this shop →
            </Link>
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1 rounded-pill border border-transparent px-2.5 py-1 text-xs text-ink-500 transition-all hover:border-error/20 hover:text-error"
            >
              <Trash2 size={12} />
              Clear
            </button>
          </div>
        )}

        <ul className="divide-y divide-ink-200/70">
          {lines.map((l) => (
            <li key={l.key} className="flex items-center gap-4 p-4 sm:p-5">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-canvas-sunken">
                {l.imageUrl && (
                  <Image
                    src={l.imageUrl}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold tracking-[-0.005em] text-ink-900">
                  {l.name}
                </p>
                {l.selections.length > 0 && (
                  <p className="mt-1 line-clamp-1 text-xs text-ink-500">
                    {selectionsSummary(l.selections)}
                  </p>
                )}
                {l.addOns.length > 0 && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-ink-500">
                    +{" "}
                    {l.addOns
                      .map((a) =>
                        a.qty > 1 ? `${a.qty} × ${a.name}` : a.name,
                      )
                      .join(", ")}
                  </p>
                )}
                <p className="mt-1 text-xs font-medium text-ink-600">
                  ₦{Math.round(l.unitPrice).toLocaleString()} each
                </p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="inline-flex h-11 items-center rounded-pill border border-ink-200 bg-white shadow-soft sm:h-10">
                  <button
                    type="button"
                    onClick={() => setQty(l.key, l.qty - 1)}
                    aria-label={`Decrease quantity of ${l.name}`}
                    className="inline-flex h-11 w-11 items-center justify-center text-ink-700 transition-colors hover:text-brand-red sm:h-10 sm:w-10"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="min-w-[2rem] text-center text-sm font-semibold text-ink-900">
                    {l.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQty(l.key, l.qty + 1)}
                    aria-label={`Increase quantity of ${l.name}`}
                    className="inline-flex h-11 w-11 items-center justify-center text-ink-700 transition-colors hover:text-brand-red sm:h-10 sm:w-10"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => remove(l.key)}
                  aria-label={`Remove ${l.name}`}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-error/10 hover:text-error sm:h-10 sm:w-10"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="self-start lg:sticky lg:top-24">
        <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-card sm:p-7">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-500">
            Order summary
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between text-ink-700">
              <dt>Items</dt>
              <dd className="font-medium text-ink-900">{count}</dd>
            </div>
            <div className="flex items-center justify-between text-ink-700">
              <dt>Subtotal</dt>
              <dd className="font-semibold text-ink-900">
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
            className="btn-flame mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-pill px-7 text-base font-medium text-white"
          >
            Go to checkout
            <ArrowRight size={16} strokeWidth={2.2} />
          </Link>
          <p className="mt-3 text-center text-xs text-ink-500">
            Sign-in & address confirmation happen on the next step.
          </p>
        </div>
      </div>
    </div>
  );
}
