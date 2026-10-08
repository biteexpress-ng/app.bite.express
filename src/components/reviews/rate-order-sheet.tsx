"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Bike, Check, ChevronDown, Loader2, Store, X } from "lucide-react";
import {
  fetchOrderDetailLines,
  fetchOrderTrack,
  type OrderDetailLine,
  type OrderTrack,
  type TrackRider,
} from "@/lib/api/orders";
import { submitItemReview, submitRiderReview } from "@/lib/api/reviews";
import { trackRider } from "@/lib/tracking";
import {
  markOrderRated,
  rateableItems,
  RIDER_TAGS,
  riderComment,
  starLabel,
  type RateableItem,
} from "@/lib/reviews/review-state";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";
import { StarRating } from "./star-rating";

type Props = {
  orderId: number;
  open: boolean;
  onClose: () => void;
  /** Called once everything the customer rated has been accepted. */
  onRated?: () => void;
  /** Already-loaded order data, so the order page doesn't fetch twice. */
  initial?: { order: OrderTrack; lines: OrderDetailLine[] };
};

type Loaded = {
  order: OrderTrack;
  items: RateableItem[];
  rider: TrackRider | null;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; data: Loaded }
  | { kind: "error"; message: string };

function toLoaded(order: OrderTrack, lines: OrderDetailLine[]): Loaded {
  return { order, items: rateableItems(lines), rider: trackRider(order.delivery_man) };
}

/**
 * Bottom sheet for rating a delivered order: the store (through its
 * items, which is how the backend builds a store's rating) and the rider.
 * Either part can be skipped. A part that went through stays sent if the
 * other fails, so a retry only resends what is missing.
 */
export function RateOrderSheet({ orderId, open, onClose, onRated, initial }: Props) {
  // Only used without `initial`. With it, data is derived each render so a
  // rider assigned after the page loaded still shows up here.
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });

  const [storeRating, setStoreRating] = useState(0);
  const [itemRatings, setItemRatings] = useState<Record<number, number>>({});
  const [perItem, setPerItem] = useState(false);
  const [storeNote, setStoreNote] = useState("");
  const [storeSent, setStoreSent] = useState(false);

  const [riderRating, setRiderRating] = useState(0);
  const [riderTags, setRiderTags] = useState<string[]>([]);
  const [riderNote, setRiderNote] = useState("");
  const [riderSent, setRiderSent] = useState(false);
  const [riderNeedsNote, setRiderNeedsNote] = useState(false);

  const [busy, setBusy] = useState(false);
  const riderNoteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open || initial) return;
    let cancelled = false;
    Promise.all([fetchOrderTrack(orderId), fetchOrderDetailLines(orderId)]).then(
      ([trackRes, linesRes]) => {
        if (cancelled) return;
        if (!trackRes.ok) {
          setLoad({ kind: "error", message: trackRes.message });
          return;
        }
        setLoad({
          kind: "ready",
          data: toLoaded(trackRes.order, linesRes.ok ? linesRes.lines : []),
        });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, orderId, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const view: LoadState = initial
    ? { kind: "ready", data: toLoaded(initial.order, initial.lines) }
    : load;
  const data = view.kind === "ready" ? view.data : null;
  const hasStore = (data?.items.length ?? 0) > 0;
  const rider = data?.rider ?? null;
  const riderFirstName = rider?.f_name?.trim() || "your rider";

  const wantsStore = hasStore && storeRating > 0 && !storeSent;
  const wantsRider = rider !== null && riderRating > 0 && !riderSent;
  const canSend = (wantsStore || wantsRider) && !busy;

  function setStore(value: number) {
    setStoreRating(value);
    // Per-item stars follow the store star until the customer changes one.
    setItemRatings({});
  }

  function toggleTag(tag: string) {
    setRiderNeedsNote(false);
    setRiderTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  async function send() {
    if (!data || !canSend) return;
    const comment = riderComment(riderTags, riderNote);
    if (wantsRider && !comment) {
      setRiderNeedsNote(true);
      // The field can sit below the fold of the sheet; bring it to the
      // customer rather than leaving an error they can't see.
      riderNoteRef.current?.focus({ preventScroll: true });
      requestAnimationFrame(() =>
        document
          .getElementById("rider-note-error")
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
      );
      return;
    }

    setBusy(true);
    const failures: string[] = [];

    let storeDone = storeSent || !wantsStore;
    if (wantsStore) {
      const results = await Promise.all(
        data.items.map((item) =>
          submitItemReview({
            orderId,
            itemId: item.itemId,
            rating: itemRatings[item.itemId] ?? storeRating,
            comment: storeNote,
          }),
        ),
      );
      const failed = results.find((r) => !r.ok);
      if (failed && !failed.ok) failures.push(failed.message);
      else {
        storeDone = true;
        setStoreSent(true);
      }
    }

    let riderDone = riderSent || !wantsRider;
    if (wantsRider && rider) {
      const res = await submitRiderReview({
        orderId,
        deliveryManId: rider.id,
        rating: riderRating,
        comment,
      });
      if (!res.ok) failures.push(res.message);
      else {
        riderDone = true;
        setRiderSent(true);
      }
    }

    setBusy(false);

    if (storeDone && riderDone) {
      markOrderRated(orderId);
      toast.success("Thanks. Your rating has been sent.");
      onRated?.();
      onClose();
      return;
    }
    toast.error(failures[0] || "We couldn't send your rating. Try again.");
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rate-order-title"
        className="sheet-up flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-floating sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 justify-center pt-2.5 sm:hidden" aria-hidden="true">
          <span className="h-1.5 w-12 rounded-full bg-ink-200" />
        </div>

        <div className="flex shrink-0 items-start justify-between gap-3 px-6 pb-2 pt-4">
          <div className="min-w-0">
            <h2 id="rate-order-title" className="font-serif text-2xl tracking-[-0.01em] text-ink-900">
              How was your order?
            </h2>
            <p className="mt-1 text-sm text-ink-500">Order #{orderId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {view.kind === "loading" && (
            <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-ink-500">
              <Loader2 size={16} className="animate-spin" />
              Loading your order
            </div>
          )}

          {view.kind === "error" && (
            <p className="rounded-2xl bg-error-soft p-4 text-sm text-error">{view.message}</p>
          )}

          {data && !hasStore && !rider && (
            <p className="py-8 text-center text-sm text-ink-500">
              There is nothing on this order to rate.
            </p>
          )}

          {data && hasStore && (
            <section aria-labelledby="rate-store-heading" className="py-4">
              <SectionHeading
                id="rate-store-heading"
                image={data.order.store?.logo_full_url ?? null}
                fallback={<Store size={18} />}
                title={data.order.store?.name ?? "The store"}
                sent={storeSent}
              />
              {storeSent ? (
                <SentNote>Store rating sent.</SentNote>
              ) : (
                <>
                  <div className="mt-3 flex flex-col items-center">
                    <StarRating
                      value={storeRating}
                      onChange={setStore}
                      label={data.order.store?.name ?? "the store"}
                    />
                    <p className="mt-1 h-5 text-sm font-medium text-ink-700" aria-live="polite">
                      {starLabel(storeRating)}
                    </p>
                  </div>

                  {storeRating > 0 && (
                    <div className="fade-up mt-3 space-y-3">
                      {data.items.length > 1 && (
                        <div>
                          <button
                            type="button"
                            onClick={() => setPerItem((v) => !v)}
                            aria-expanded={perItem}
                            className="inline-flex h-11 items-center gap-1.5 text-sm font-medium text-ink-700 hover:text-ink-900"
                          >
                            Rate items separately
                            <ChevronDown
                              size={16}
                              className={cn("transition-transform duration-200", perItem && "rotate-180")}
                            />
                          </button>
                          {perItem && (
                            <ul className="divide-y divide-ink-200/70 rounded-2xl border border-ink-200 px-3">
                              {data.items.map((item) => (
                                <li key={item.itemId} className="flex items-center justify-between gap-2 py-1">
                                  <span className="line-clamp-2 min-w-0 text-sm text-ink-900">
                                    {item.name}
                                  </span>
                                  <StarRating
                                    size="sm"
                                    value={itemRatings[item.itemId] ?? storeRating}
                                    onChange={(v) =>
                                      setItemRatings((prev) => ({ ...prev, [item.itemId]: v }))
                                    }
                                    label={item.name}
                                  />
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                      <label className="block">
                        <span className="text-sm font-medium text-ink-900">
                          Add a note <span className="font-normal text-ink-500">(optional)</span>
                        </span>
                        <textarea
                          value={storeNote}
                          onChange={(e) => setStoreNote(e.target.value)}
                          rows={2}
                          maxLength={500}
                          placeholder="What did you like, or what could be better?"
                          className="mt-1.5 w-full resize-none rounded-2xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-900 placeholder:text-ink-500 focus:border-ink-400 focus:outline-none"
                        />
                      </label>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {data && rider && (
            <section
              aria-labelledby="rate-rider-heading"
              className={cn("py-4", hasStore && "border-t border-ink-200")}
            >
              <SectionHeading
                id="rate-rider-heading"
                image={rider.image_full_url ?? null}
                fallback={<Bike size={18} />}
                title={
                  [rider.f_name, rider.l_name].filter(Boolean).join(" ").trim() || "Your rider"
                }
                subtitle="Your rider"
                sent={riderSent}
              />
              {riderSent ? (
                <SentNote>Rider rating sent.</SentNote>
              ) : (
                <>
                  <div className="mt-3 flex flex-col items-center">
                    <StarRating value={riderRating} onChange={setRiderRating} label="the rider" />
                    <p className="mt-1 h-5 text-sm font-medium text-ink-700" aria-live="polite">
                      {starLabel(riderRating)}
                    </p>
                  </div>

                  {riderRating > 0 && (
                    <div className="fade-up mt-3 space-y-3">
                      <fieldset>
                        <legend className="text-sm font-medium text-ink-900">What stood out?</legend>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {RIDER_TAGS.map((tag) => {
                            const on = riderTags.includes(tag);
                            return (
                              <button
                                key={tag}
                                type="button"
                                aria-pressed={on}
                                onClick={() => toggleTag(tag)}
                                className={cn(
                                  "inline-flex min-h-10 items-center rounded-pill border px-3.5 text-sm transition-colors",
                                  on
                                    ? "border-ink-900 bg-ink-900 text-white"
                                    : "border-ink-200 bg-white text-ink-700 hover:border-ink-400",
                                )}
                              >
                                {tag}
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>
                      <label className="block">
                        <span className="text-sm font-medium text-ink-900">
                          Anything else for {riderFirstName}?
                        </span>
                        <textarea
                          ref={riderNoteRef}
                          value={riderNote}
                          onChange={(e) => {
                            setRiderNote(e.target.value);
                            setRiderNeedsNote(false);
                          }}
                          rows={2}
                          maxLength={500}
                          aria-invalid={riderNeedsNote}
                          aria-describedby={riderNeedsNote ? "rider-note-error" : undefined}
                          className={cn(
                            "mt-1.5 w-full resize-none rounded-2xl border bg-white px-4 py-3 text-base text-ink-900 placeholder:text-ink-500 focus:outline-none",
                            riderNeedsNote ? "border-error" : "border-ink-200 focus:border-ink-400",
                          )}
                        />
                      </label>
                      {riderNeedsNote && (
                        <p id="rider-note-error" role="alert" className="text-sm text-error">
                          Pick something that stood out, or write a few words for the rider.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>

        {data && (hasStore || rider) && (
          <div className="shrink-0 border-t border-ink-200 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              className="btn-flame inline-flex h-12 w-full items-center justify-center gap-2 rounded-pill text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {busy ? "Sending" : "Send rating"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeading({
  id,
  image,
  fallback,
  title,
  subtitle,
  sent,
}: {
  id: string;
  image: string | null;
  fallback: React.ReactNode;
  title: string;
  subtitle?: string;
  sent: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-canvas-sunken text-ink-500">
        {image ? <Image src={image} alt="" fill sizes="44px" className="object-cover" /> : fallback}
      </div>
      <div className="min-w-0 flex-1">
        {subtitle && <p className="text-xs text-ink-500">{subtitle}</p>}
        <h3 id={id} className="truncate text-base font-semibold text-ink-900">
          {title}
        </h3>
      </div>
      {sent && (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-success-soft text-success">
          <Check size={15} strokeWidth={2.5} />
          <span className="sr-only">Sent</span>
        </span>
      )}
    </div>
  );
}

function SentNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm text-ink-600">{children}</p>;
}
