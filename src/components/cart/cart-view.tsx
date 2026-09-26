"use client";

import { useEffect, useState } from "react";
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
import { useCart, type CartLine } from "@/lib/cart-store";
import { selectionsSummary } from "@/lib/food-variations";
import { fetchStoreDetail, type StoreDetail } from "@/lib/api/store-detail";
import { isPriceRequestCart } from "@/lib/price-check/eligibility";
import { buildItemNotes } from "@/lib/price-check/item-notes";

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
  const setLineNote = useCart((s) => s.setLineNote);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);

  // Store detail, fetched to learn whether this store prices on
  // request. Stays null while in flight so the cart shows the
  // ordinary CTA until we know otherwise: isPriceRequestCart(null)
  // returns false for exactly this reason.
  const [store, setStore] = useState<StoreDetail | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (storeId === null) {
        if (!cancelled) setStore(null);
        return;
      }
      const res = await fetchStoreDetail(storeId);
      if (!cancelled) setStore(res.ok ? res.store : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  const priceCheck = isPriceRequestCart(store);
  // Notes collapse per item id (two lines of one item share a single
  // note). Compute the merged map once so every line of an item shows
  // the same note, rather than each line only showing its own.
  const noteByItemId = buildItemNotes(lines);

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
            <li key={l.key} className="flex flex-col gap-3 p-4 sm:p-5">
              <div className="flex items-center gap-4">
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
                  {l.variant && (
                    <p className="mt-1 line-clamp-1 text-xs text-ink-500">
                      {l.variant.label}
                    </p>
                  )}
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
              </div>

              {priceCheck && (
                <LineNoteField
                  line={l}
                  note={noteByItemId[String(l.itemId)]}
                  onChange={(value) => setLineNote(l.key, value)}
                />
              )}
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
              <dt>{priceCheck ? "Estimated subtotal" : "Subtotal"}</dt>
              <dd className="font-semibold text-ink-900">
                ₦{Math.round(subtotal).toLocaleString()}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-ink-200/70 pt-3 text-ink-500">
              <dt>Delivery & fees</dt>
              <dd>Calculated at checkout</dd>
            </div>
          </dl>

          {priceCheck && (
            <p className="mt-3 text-xs leading-relaxed text-ink-500">
              This store confirms today&apos;s prices before you pay. Nothing
              is charged yet.
            </p>
          )}

          <Link
            href="/checkout"
            className="btn-flame mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-pill px-7 text-base font-medium text-white"
          >
            {priceCheck ? "Request current prices" : "Go to checkout"}
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

/**
 * Per-line note control for the price-request flow. Two lines of the
 * same item collapse to a single note (see buildItemNotes), so this
 * shows the merged note on every line of that item id rather than
 * only the line the customer typed it on: without that, editing one
 * line and seeing a sibling line "forget" the note would look broken.
 */
function LineNoteField({
  line,
  note,
  onChange,
}: {
  line: CartLine;
  note: string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-500">
        Add a note for the store
      </span>
      <input
        type="text"
        value={note ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`e.g. no onions on ${line.name}`}
        maxLength={255}
        className="mt-1 h-10 w-full rounded-xl border border-ink-200 bg-canvas-sunken/40 px-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-red/40 focus:outline-none focus:ring-2 focus:ring-brand-red/15"
      />
    </label>
  );
}
