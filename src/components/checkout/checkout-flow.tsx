"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { useLocation } from "@/lib/location-store";
import { useAuth } from "@/lib/auth-store";
import { placeOrder } from "@/lib/api/orders";
import { fetchOrderQuote } from "@/lib/api/order-quote";
import { sendPriceRequest } from "@/lib/api/price-check";
import { isPriceRequestCart } from "@/lib/price-check/eligibility";
import { buildItemNotes } from "@/lib/price-check/item-notes";
import { fetchStoreDetail } from "@/lib/api/store-detail";
import { fetchProfile } from "@/lib/api/auth";
import { checkZone } from "@/lib/api/zones";
import { defaultSettleDeps, settleOrder } from "@/lib/checkout/settle-order";
import { distanceKm } from "@/lib/geo";
import { toast } from "@/lib/toast";
import { fetchConfig } from "@/lib/api/config";
import { fetchOfflineMethods } from "@/lib/api/offline-payment";
import {
  canUseOfflinePayment,
  type OfflinePaymentMethod,
} from "@/lib/offline-payment-rules";
import { OrderSummary, type QuoteState } from "./order-summary";
import { PaymentPicker, type PaymentMethod } from "./payment-picker";
import {
  AddressPickerCheckout,
  type CheckoutAddress,
} from "./address-picker-checkout";

type Phase =
  | { kind: "hydrating" }
  | {
      kind: "ready";
      moduleId: number;
      storeZoneId: number | null;
      /** Whether the cart's store prices on request instead of at
       *  catalogue price. Carried on the ready phase (not re-derived
       *  at submit time) so it survives every intermediate setPhase
       *  call between the store fetch and the submit handler. */
      priceCheckEnabled: boolean;
      /** Where the rider collects from. Delivery is priced on the
       *  distance from here to the dropoff. Null if the store row has
       *  no coordinates. */
      storeLat: number | null;
      storeLng: number | null;
    }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

/**
 * Kilometres for the delivery-charge calculation: STORE to dropoff,
 * which is what the backend prices per-km and what the distance bands
 * are measured against. The Flutter app sends the same leg.
 *
 * It used to be measured from the home-page pin to the delivery
 * address, which is the same point whenever the customer hasn't saved
 * a separate address — distance ~0, so every web order was charged
 * `minimum_shipping_charge` however far the rider had to ride.
 *
 * Both the pricing preview (get-Tax) and the order POST call this, so
 * the distance they price on cannot drift apart.
 *
 * Straight-line, where the app asks Google for the driving route. That
 * makes web quotes equal to or slightly under the app's for the same
 * order, never over. Banded zones are unaffected: the server already
 * floors the band lookup at the straight-line store-to-dropoff length.
 */
function orderDistanceKm(
  store: { lat: number | null; lng: number | null },
  to: { lat: number; lng: number },
  /** Used only when the store row carries no coordinates, so an
   *  incomplete store record can't stop someone checking out. */
  fallbackFrom: { lat: number; lng: number },
): number {
  const from =
    store.lat !== null && store.lng !== null
      ? { lat: store.lat, lng: store.lng }
      : fallbackFrom;
  const d = distanceKm(from.lat, from.lng, to.lat, to.lng);
  return Number.isFinite(d) ? Math.max(0.1, d) : 0.5;
}

/** Store lat/lng arrive as MySQL decimal strings. */
function coord(v: number | string | undefined): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

/**
 * Drives the /checkout page state machine.
 *
 * Guards (rendered as friendly empty states):
 *   - Auth required        → "Sign in to continue" CTA
 *   - Empty cart           → "Browse a category"
 *   - No in-zone location  → "Pick an in-zone address first"
 *   - No store/module ctx  → "Go back to the shop"  (rare — happens
 *                           if the cart store_id no longer exists)
 *
 * Order placement uses is_buy_now=1 + cart-in-body so we don't have
 * to sync the local cart to the server cart_table first.
 */
export function CheckoutFlow() {
  const router = useRouter();
  const hydrateLoc = useLocation((s) => s.hydrate);
  const hydrateCart = useCart((s) => s.hydrate);
  const cartHydrated = useCart((s) => s.hydrated);
  const lines = useCart((s) => s.lines);
  const cartStoreId = useCart((s) => s.storeId);
  const subtotal = useCart((s) =>
    s.lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),
  );
  const clear = useCart((s) => s.clear);
  const stored = useLocation((s) => s.location);
  const locHydrated = useLocation((s) => s.hydrated);
  const token = useAuth((s) => s.token);
  const authHydrated = useAuth((s) => s.hydrated);
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  const [phase, setPhase] = useState<Phase>({ kind: "hydrating" });
  const [address, setAddress] = useState<CheckoutAddress | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>("digital_payment");
  const [tip, setTip] = useState(0);
  const [quote, setQuote] = useState<QuoteState>({ kind: "idle" });

  // Offline payment gating. Resolved on mount from three independent
  // sources (see canUseOfflinePayment). Defaults to false so the option
  // never flashes in before we know it's usable.
  const [offlineEnabled, setOfflineEnabled] = useState(false);
  const [offlineMethods, setOfflineMethods] = useState<OfflinePaymentMethod[]>([]);
  const [offlineMethodId, setOfflineMethodId] = useState<number | null>(null);

  // Refresh wallet_balance whenever the page mounts so the
  // PaymentPicker shows the freshest number (the cached AuthUser
  // can lag behind any top-up done on /wallet a moment ago).
  useEffect(() => {
    if (!token) return;
    fetchProfile().then((res) => {
      if (res.ok) setUser(res.user);
    });
  }, [token, setUser]);

  useEffect(() => {
    hydrateCart();
    hydrateLoc();
  }, [hydrateCart, hydrateLoc]);

  // Pull the cart's store details to learn module_id (we don't carry
  // it on the cart line, intentionally — items can belong to a
  // module via their store).
  useEffect(() => {
    if (!cartHydrated || !locHydrated || !authHydrated) return;
    if (!cartStoreId) {
      setPhase({
        kind: "ready",
        moduleId: 0,
        storeZoneId: null,
        priceCheckEnabled: false,
        storeLat: null,
        storeLng: null,
      });
      return;
    }

    setPhase({ kind: "hydrating" });
    fetchStoreDetail(
      cartStoreId,
      stored?.lat,
      stored?.lng,
    ).then((res) => {
      if (res.ok) {
        setPhase({
          kind: "ready",
          moduleId: res.store.module_id ?? 0,
          storeZoneId: res.store.zone_id ?? null,
          priceCheckEnabled: isPriceRequestCart(res.store),
          storeLat: coord(res.store.latitude),
          storeLng: coord(res.store.longitude),
        });
      } else {
        setPhase({ kind: "error", message: res.message });
      }
    });
  }, [cartHydrated, locHydrated, authHydrated, cartStoreId, stored?.lat, stored?.lng]);

  // Resolve whether Pay Offline can be offered. Three gates, only one
  // of which the backend enforces:
  //   1. config.offline_payment_status  — enforced (PlaceNewOrder:681)
  //   2. zone.offline_payment           — advisory, but the Flutter app
  //      honours it, so we must too or the clients disagree
  //   3. a non-empty method list        — nothing to pay into otherwise
  //
  // The zone flag is read with .some(): a point can fall inside several
  // zone polygons, and since the backend doesn't enforce this at all,
  // "any eligible zone allows it" is the permissive-but-consistent read.
  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    (async () => {
      const [cfg, methodsRes, zoneRes] = await Promise.all([
        fetchConfig(),
        fetchOfflineMethods(),
        checkZone(address.lat, address.lng),
      ]);
      if (cancelled) return;

      const methods = methodsRes.ok ? methodsRes.methods : [];
      const zoneOffline =
        zoneRes.kind === "in-zone"
          ? zoneRes.zones.some((z) => Boolean(z.offline_payment))
          : false;

      const enabled = canUseOfflinePayment({
        offlinePaymentStatus: cfg.ok ? cfg.config.offline_payment_status : 0,
        zoneOfflinePayment: zoneOffline,
        methods,
      });

      setOfflineEnabled(enabled);
      setOfflineMethods(methods);
      setOfflineMethodId(enabled && methods.length > 0 ? methods[0].id : null);

      // If the customer had Pay Offline selected and it just became
      // unavailable (address change), fall back rather than leave an
      // invisible selection armed.
      if (!enabled) {
        setPayment((p) => (p === "offline_payment" ? "digital_payment" : p));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address?.lat, address?.lng]);

  // Ask the backend what this order actually costs. get-Tax runs the
  // same delivery-charge and pricing code order placement runs, so the
  // customer sees the delivery fee, service charge and grand total
  // BEFORE choosing how to pay — previously checkout only showed the
  // item subtotal, and someone paying from their wallet would top up
  // that amount and still be told their balance was too low.
  //
  // Re-runs whenever anything the server prices on changes: the cart,
  // the delivery address, or the tip.
  const quoteSeq = useRef(0);
  const ready = phase.kind === "ready" ? phase : null;
  const quotableStoreId = ready && !ready.priceCheckEnabled ? cartStoreId : null;
  const addrLat = address?.lat;
  const addrLng = address?.lng;

  useEffect(() => {
    if (!quotableStoreId || !ready) return;
    if (addrLat === undefined || addrLng === undefined) return;
    if (!stored || lines.length === 0) return;
    // Same zone header the order POST sends, so both calls resolve the
    // same zone/module pivot and therefore the same delivery pricing.
    const zoneIds =
      stored.zoneCheck?.status === "in-zone" ? stored.zoneCheck.zoneIds : [];

    const seq = ++quoteSeq.current;
    setQuote({ kind: "loading" });

    fetchOrderQuote({
      storeId: quotableStoreId,
      moduleId: ready.moduleId,
      zoneIds,
      lines,
      lat: addrLat,
      lng: addrLng,
      distance: orderDistanceKm(
        { lat: ready.storeLat, lng: ready.storeLng },
        { lat: addrLat, lng: addrLng },
        stored,
      ),
      dmTips: tip,
    }).then((res) => {
      // A newer address/tip/cart already fired; its answer wins.
      if (seq !== quoteSeq.current) return;
      setQuote(
        res.ok
          ? { kind: "ready", quote: res.quote }
          : { kind: "error", message: res.message },
      );
    });
    // `ready` is a fresh object on every setPhase, so depend on the
    // two fields the quote is actually keyed on instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    quotableStoreId,
    ready?.moduleId,
    ready?.storeLat,
    ready?.storeLng,
    addrLat,
    addrLng,
    tip,
    lines,
    stored?.lat,
    stored?.lng,
  ]);

  if (!cartHydrated || !locHydrated || !authHydrated || phase.kind === "hydrating") {
    return <CenterSpinner label="Loading checkout…" />;
  }

  if (!token) return <SignInGate />;
  if (lines.length === 0) return <EmptyCartGate />;
  if (!stored || stored.zoneCheck?.status !== "in-zone")
    return <NoLocationGate />;

  if (phase.kind === "error") {
    return (
      <div className="rounded-2xl border border-error/30 bg-error/5 p-4 text-sm text-error">
        {phase.message}
      </div>
    );
  }

  async function handlePlace() {
    if (!address || !stored || stored.zoneCheck?.status !== "in-zone") return;
    if (phase.kind !== "ready") return;

    // Don't create an order the wallet demonstrably can't cover.
    // /order/place would succeed and only the follow-up wallet-payment
    // call would fail, leaving an unpaid order behind and the customer
    // staring at "insufficient balance" with no number to top up to.
    if (payment === "wallet" && quote.kind === "ready") {
      const short = quote.quote.total - (user?.wallet_balance ?? 0);
      if (short > 0) {
        toast.warn(
          `Your wallet is ₦${Math.round(short).toLocaleString()} short of the ₦${Math.round(quote.quote.total).toLocaleString()} total. Top up on the Wallet page, or pay online.`,
        );
        return;
      }
    }

    setPhase({ kind: "submitting" });

    // Preflight zone check on the actual delivery address — guards
    // against the case where the customer picked a saved address
    // (or any address other than the welcome-flow location) that's
    // outside the store's zone polygon. The backend's
    // getZoneAndStore would otherwise return $zone=null and crash
    // (see PlaceNewOrder.php:135). We surface a friendly error and
    // bail before the request goes out.
    const addressZoneCheck = await checkZone(address.lat, address.lng);
    if (addressZoneCheck.kind === "out-of-zone") {
      setPhase(phase);
      toast.error(
        "We don't deliver to that address yet. Pick another and try again.",
      );
      return;
    }
    if (addressZoneCheck.kind === "temp-unavailable") {
      setPhase(phase);
      toast.warn("Delivery is paused in that area right now.");
      return;
    }
    if (addressZoneCheck.kind === "error") {
      setPhase(phase);
      toast.error(addressZoneCheck.message);
      return;
    }
    // "skipped" passes through silently — likely a dev env without
    // NEXT_PUBLIC_API_BASE_URL set; the order POST will fail later
    // with its own message.
    const eligibleZoneIds =
      addressZoneCheck.kind === "in-zone"
        ? addressZoneCheck.zoneIds
        : stored.zoneCheck.zoneIds;

    // Block when the store the cart belongs to ISN'T in the
    // delivery address's covered zones. This was the actual root
    // cause of the 500 — customer picked a saved address in zone 5
    // but the cart store is in zone 1, so the store-zone polygon
    // never contains the new lat/lng and $zone comes back null.
    if (
      phase.storeZoneId !== null &&
      !eligibleZoneIds.includes(phase.storeZoneId)
    ) {
      setPhase(phase);
      toast.error(
        "This shop doesn't deliver to the chosen address. Pick another address or browse shops near it.",
      );
      return;
    }

    const dist = orderDistanceKm(
      { lat: phase.storeLat, lng: phase.storeLng },
      address,
      stored,
    );

    // Stores that price on request never receive a paymentMethod or a
    // total to pay: the store quotes first, and the customer picks how
    // to pay on the review screen once they've seen the real price.
    // This branch has to run before any payment-method logic below,
    // because none of it applies to a price request.
    if (phase.priceCheckEnabled) {
      const req = await sendPriceRequest({
        storeId: cartStoreId!,
        moduleId: phase.moduleId,
        zoneIds: eligibleZoneIds,
        lines,
        lat: address.lat,
        lng: address.lng,
        distance: dist,
        address: address.text,
        addressType: address.addressType,
        contactPersonName:
          address.contactPersonName ??
          (user
            ? [user.f_name, user.l_name].filter(Boolean).join(" ")
            : undefined),
        contactPersonNumber: address.contactPersonNumber ?? user?.phone ?? undefined,
        contactPersonEmail: address.contactPersonEmail ?? user?.email ?? undefined,
        orderType: "delivery",
        dmTips: tip,
        itemNotes: buildItemNotes(lines),
      });

      if (!req.ok) {
        setPhase(phase);
        toast.error(req.message);
        return;
      }

      clear();
      router.replace(`/orders/${req.orderId}`);
      return;
    }

    const res = await placeOrder({
      storeId: cartStoreId!,
      moduleId: phase.moduleId,
      zoneIds: eligibleZoneIds,
      lines,
      lat: address.lat,
      lng: address.lng,
      distance: dist,
      address: address.text,
      addressType: address.addressType,
      contactPersonName:
        address.contactPersonName ??
        (user
          ? [user.f_name, user.l_name].filter(Boolean).join(" ")
          : undefined),
      contactPersonNumber: address.contactPersonNumber ?? user?.phone ?? undefined,
      contactPersonEmail: address.contactPersonEmail ?? user?.email ?? undefined,
      paymentMethod: payment,
      orderType: "delivery",
      dmTips: tip,
    });

    if (!res.ok && res.code === "unknown_outcome") {
      // The order may exist, and a wallet order is already paid, so Place
      // order stays off: the orders list is the only safe next step. The
      // cart is kept in case the order never reached the backend.
      toast.warn("We couldn't confirm whether your order was placed. Check your orders before trying again.");
      router.replace("/orders");
      return;
    }
    if (!res.ok) {
      setPhase(phase);
      toast.error(res.message);
      return;
    }

    const outcome = await settleOrder(
      {
        orderId: res.orderId,
        amount: res.amount,
        method: payment,
        successHref: `/checkout/success?order_id=${res.orderId}`,
        email: address.contactPersonEmail ?? user?.email ?? null,
        offlineMethodId,
      },
      defaultSettleDeps,
    );

    if (outcome.kind === "navigate") {
      // Cleared even when the confirm failed, so a retry can't charge the
      // customer twice for the same order.
      clear();
      if (outcome.error) toast.error(outcome.error);
      router.replace(outcome.href);
      return;
    }
    setPhase(phase);
    if (outcome.tone === "warn") toast.warn(outcome.message);
    else toast.error(outcome.message);
  }

  const placing = phase.kind === "submitting";
  const priceCheckEnabled = phase.kind === "ready" && phase.priceCheckEnabled;
  const quoted = quote.kind === "ready" ? quote.quote : null;
  // The figure the customer owes. Falls back to the subtotal only while
  // the quote is in flight, and the UI marks that case with a "+".
  const payable = quoted && !priceCheckEnabled ? quoted.total : subtotal;
  const walletBalance = user?.wallet_balance ?? null;
  const walletShortfall =
    payment === "wallet" && quoted && typeof walletBalance === "number"
      ? Math.max(0, quoted.total - walletBalance)
      : 0;

  return (
    <div className="fade-up grid gap-8 pb-28 lg:grid-cols-[1.6fr_1fr] lg:pb-0">
      <div className="space-y-10">
        <CheckoutSection
          step="01"
          title="Where to"
          subtitle="Pick where the rider should drop your order."
        >
          <AddressPickerCheckout
            picked={stored}
            value={address}
            onChange={setAddress}
          />
        </CheckoutSection>

        {/* This store quotes prices instead of charging at catalogue
            price, so how to pay is chosen on the quote review screen
            once the customer knows the real total, and any method
            picked here would be ignored by the server. */}
        {!priceCheckEnabled && (
          <CheckoutSection
            step="02"
            title="How you'd like to pay"
            subtitle="Pay online, from your wallet, or by transfer."
          >
            <PaymentPicker
              value={payment}
              onChange={setPayment}
              walletBalance={user?.wallet_balance ?? null}
              orderTotal={quoted ? quoted.total : null}
              offlineEnabled={offlineEnabled}
              offlineMethods={offlineMethods}
              offlineMethodId={offlineMethodId}
              onOfflineMethodChange={setOfflineMethodId}
            />
          </CheckoutSection>
        )}

        <CheckoutSection
          step={priceCheckEnabled ? "02" : "03"}
          title="Tip your rider"
          subtitle="100% goes to the rider who delivers your order."
        >
          <div className="flex flex-wrap gap-2">
            {[0, 200, 500, 1000].map((amt) => {
              const active = tip === amt;
              return (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setTip(amt)}
                  className={
                    "inline-flex h-11 items-center justify-center rounded-pill border px-5 text-sm font-medium transition-all duration-200 " +
                    (active
                      ? "border-transparent bg-ink-900 text-white shadow-[0_8px_22px_-8px_rgba(13,13,15,0.55)]"
                      : "border-ink-200 bg-white text-ink-900 hover:-translate-y-px hover:border-brand-red/30 hover:text-brand-red hover:shadow-soft")
                  }
                >
                  {amt === 0 ? "No tip" : `₦${amt.toLocaleString()}`}
                </button>
              );
            })}
          </div>
        </CheckoutSection>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <OrderSummary
          lines={lines}
          subtotal={subtotal}
          priceCheckEnabled={priceCheckEnabled}
          quote={quote}
        />
        <button
          type="button"
          onClick={handlePlace}
          disabled={placing || !address}
          className="btn-flame hidden h-14 w-full items-center justify-center gap-2 rounded-pill px-7 text-base font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 lg:inline-flex"
        >
          {placing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {priceCheckEnabled ? "Sending your request…" : "Placing your order…"}
            </>
          ) : (
            <>
              <ShoppingBag size={16} />
              {priceCheckEnabled ? "Send price request" : "Place order"}
              <ArrowRight size={16} strokeWidth={2.2} />
            </>
          )}
        </button>
        {walletShortfall > 0 && (
          <div className="rounded-2xl border border-error/30 bg-error/5 p-4 text-sm leading-relaxed text-ink-700">
            Your wallet is ₦{Math.round(walletShortfall).toLocaleString()} short
            of the ₦{Math.round(payable).toLocaleString()} total. Top up that
            much on the{" "}
            <Link href="/wallet" className="font-medium text-brand-red underline">
              Wallet page
            </Link>
            , or pay online instead.
          </div>
        )}
        {priceCheckEnabled && (
          <p className="text-center text-xs leading-relaxed text-ink-500">
            This store confirms today&apos;s prices before you pay. Nothing
            is charged yet.
          </p>
        )}
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200 bg-white/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-12px_rgba(17,17,17,0.12)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-500">
              {priceCheckEnabled
                ? "Estimated subtotal"
                : quoted
                  ? "Total to pay"
                  : "Subtotal"}
            </p>
            <p className="text-base font-semibold text-ink-900">
              ₦{Math.round(payable).toLocaleString()}
              {!priceCheckEnabled && !quoted && (
                <span className="ml-1 text-xs font-normal text-ink-500">
                  + delivery
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handlePlace}
            disabled={placing || !address}
            className="btn-flame inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-pill px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {placing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {priceCheckEnabled ? "Sending…" : "Placing…"}
              </>
            ) : (
              <>
                <ShoppingBag size={14} />
                {priceCheckEnabled ? "Send price request" : "Place order"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckoutSection({
  step,
  title,
  subtitle,
  children,
}: {
  step: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-baseline gap-3">
        <span className="font-mono text-[0.7rem] font-semibold tracking-[0.18em] text-brand-red">
          {step}
        </span>
        <div>
          <h2 className="font-serif text-2xl tracking-[-0.012em] text-ink-900">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

/* -------------------------------------------------------------------- */
/* Gates                                                                */
/* -------------------------------------------------------------------- */

function CenterSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[30vh] items-center justify-center gap-2 text-ink-500">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}

function SignInGate() {
  return (
    <Gate
      title="Sign in to keep going"
      body="Checkout needs a signed-in customer so we can attach the order, save the address, and get the rider to you."
      cta={{ href: "/signin?next=/checkout", label: "Sign in" }}
    />
  );
}

function EmptyCartGate() {
  return (
    <Gate
      title="Your cart is empty"
      body="Browse a category and add a few things first."
      cta={{ href: "/browse", label: "Start browsing" }}
    />
  );
}

function NoLocationGate() {
  return (
    <Gate
      title="Pick an in-zone address first"
      body="We need a delivery address inside one of our serviced zones before we can take an order."
      cta={{ href: "/", label: "Pick an address" }}
    />
  );
}

function Gate({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-ink-200 bg-white p-10 text-center shadow-card">
      <h2 className="font-serif text-display-sm text-ink-900">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{body}</p>
      <Link
        href={cta.href}
        className="btn-flame mt-7 inline-flex h-12 items-center justify-center rounded-pill px-7 text-sm font-medium text-white"
      >
        {cta.label}
      </Link>
    </div>
  );
}
