"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { useLocation } from "@/lib/location-store";
import { useAuth } from "@/lib/auth-store";
import {
  placeOrder,
  confirmPaystackPayment,
  walletPayOrder,
} from "@/lib/api/orders";
import { fetchStoreDetail } from "@/lib/api/store-detail";
import { fetchProfile } from "@/lib/api/auth";
import { checkZone } from "@/lib/api/zones";
import { payWithPaystack } from "@/lib/paystack";
import { distanceKm } from "@/lib/geo";
import { toast } from "@/lib/toast";
import { OrderSummary } from "./order-summary";
import { PaymentPicker, type PaymentMethod } from "./payment-picker";
import {
  AddressPickerCheckout,
  type CheckoutAddress,
} from "./address-picker-checkout";

type Phase =
  | { kind: "hydrating" }
  | { kind: "ready"; moduleId: number; storeZoneId: number | null }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

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
  const [payment, setPayment] = useState<PaymentMethod>("cash_on_delivery");
  const [tip, setTip] = useState(0);

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
      setPhase({ kind: "ready", moduleId: 0, storeZoneId: null });
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
        });
      } else {
        setPhase({ kind: "error", message: res.message });
      }
    });
  }, [cartHydrated, locHydrated, authHydrated, cartStoreId, stored?.lat, stored?.lng]);

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
      setPhase({ kind: "ready", moduleId: phase.moduleId, storeZoneId: phase.storeZoneId });
      toast.error(
        "We don't deliver to that address yet. Pick another and try again.",
      );
      return;
    }
    if (addressZoneCheck.kind === "temp-unavailable") {
      setPhase({ kind: "ready", moduleId: phase.moduleId, storeZoneId: phase.storeZoneId });
      toast.warn("Delivery is paused in that area right now.");
      return;
    }
    if (addressZoneCheck.kind === "error") {
      setPhase({ kind: "ready", moduleId: phase.moduleId, storeZoneId: phase.storeZoneId });
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
      setPhase({ kind: "ready", moduleId: phase.moduleId, storeZoneId: phase.storeZoneId });
      toast.error(
        "This shop doesn't deliver to the chosen address. Pick another address or browse shops near it.",
      );
      return;
    }

    const dist = distanceKm(stored.lat, stored.lng, address.lat, address.lng);

    // "bank_transfer" is a CLIENT-SIDE payment method that maps to
    // the backend's `wallet` method — the customer transfers into
    // their DVA, the webhook credits the wallet, and we deduct.
    const backendPaymentMethod =
      payment === "bank_transfer" ? "wallet" : payment;

    const res = await placeOrder({
      storeId: cartStoreId!,
      moduleId: phase.moduleId,
      zoneIds: eligibleZoneIds,
      lines,
      lat: address.lat,
      lng: address.lng,
      distance: Number.isFinite(dist) ? Math.max(0.1, dist) : 0.5,
      address: address.text,
      addressType: address.addressType,
      contactPersonName:
        address.contactPersonName ??
        (user
          ? [user.f_name, user.l_name].filter(Boolean).join(" ")
          : undefined),
      contactPersonNumber: address.contactPersonNumber ?? user?.phone ?? undefined,
      contactPersonEmail: address.contactPersonEmail ?? user?.email ?? undefined,
      paymentMethod: backendPaymentMethod,
      orderType: "delivery",
      dmTips: tip,
    });

    if (!res.ok) {
      setPhase({ kind: "ready", moduleId: phase.moduleId, storeZoneId: phase.storeZoneId });
      toast.error(res.message);
      return;
    }

    // COD: nothing more to do — go straight to success.
    if (payment === "cash_on_delivery") {
      clear();
      router.replace(`/checkout/success?order_id=${res.orderId}`);
      return;
    }

    // Paystack inline popup path.
    if (payment === "digital_payment") {
      const customerEmail =
        address.contactPersonEmail ?? user?.email ?? null;
      if (!customerEmail) {
        setPhase({ kind: "ready", moduleId: phase.moduleId, storeZoneId: phase.storeZoneId });
        toast.warn(
          "We need an email on file to charge a card. Add one on the Edit profile page and try again.",
        );
        return;
      }

      // Paystack requires the amount in kobo. We trust the server's
      // total_ammount over the locally-computed subtotal so delivery
      // fees / surcharges / discounts are included.
      const amountKobo = Math.round(res.amount * 100);
      const reference = `BE-${res.orderId}-${Date.now().toString(36)}`;

      const pop = await payWithPaystack({
        email: customerEmail,
        amountKobo,
        reference,
        metadata: { order_id: res.orderId },
      });

      if (pop.status === "cancelled") {
        setPhase({ kind: "ready", moduleId: phase.moduleId, storeZoneId: phase.storeZoneId });
        toast.warn(
          `Payment cancelled. Order #${res.orderId} is on hold — re-place it when you're ready.`,
        );
        return;
      }
      if (pop.status === "error") {
        setPhase({ kind: "ready", moduleId: phase.moduleId, storeZoneId: phase.storeZoneId });
        toast.error(pop.message);
        return;
      }

      const confirmRes = await confirmPaystackPayment(
        res.orderId,
        pop.reference,
      );
      if (!confirmRes.ok) {
        setPhase({ kind: "ready", moduleId: phase.moduleId, storeZoneId: phase.storeZoneId });
        toast.error(
          `Paystack charged your card but we couldn't confirm server-side: ${confirmRes.message}. Ops has been notified.`,
        );
        return;
      }

      clear();
      router.replace(`/checkout/success?order_id=${res.orderId}`);
      return;
    }

    // Pay from wallet balance — immediate deduct.
    if (payment === "wallet") {
      const pay = await walletPayOrder(res.orderId);
      if (pay.ok) {
        clear();
        router.replace(`/checkout/success?order_id=${res.orderId}`);
        return;
      }
      setPhase({ kind: "ready", moduleId: phase.moduleId, storeZoneId: phase.storeZoneId });
      if (pay.reason === "insufficient") {
        toast.warn(
          "Wallet balance is too low. Top up via your DVA on the Wallet page, then re-place the order.",
        );
      } else {
        toast.error(pay.message || "Wallet payment failed.");
      }
      return;
    }

    // Bank transfer via DVA — order is placed, send the customer to
    // the transfer instructions page where they make the transfer and
    // then click "I've sent it" to finalise.
    if (payment === "bank_transfer") {
      clear();
      router.replace(
        `/checkout/transfer/${res.orderId}?amount=${encodeURIComponent(res.amount)}`,
      );
      return;
    }

    // Should never reach here — PaymentMethod is fully covered above.
    setPhase({ kind: "ready", moduleId: phase.moduleId, storeZoneId: phase.storeZoneId });
    toast.error("That payment method isn't wired up yet.");
  }

  const placing = phase.kind === "submitting";

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-8">
        <section>
          <h2 className="mb-3 font-serif text-xl text-ink-900">Where to</h2>
          <AddressPickerCheckout
            picked={stored}
            value={address}
            onChange={setAddress}
          />
        </section>

        <section>
          <h2 className="mb-3 font-serif text-xl text-ink-900">How you'd like to pay</h2>
          <PaymentPicker
            value={payment}
            onChange={setPayment}
            walletBalance={user?.wallet_balance ?? null}
            orderTotal={subtotal}
          />
        </section>

        <section>
          <h2 className="mb-3 font-serif text-xl text-ink-900">Tip your rider</h2>
          <div className="flex flex-wrap gap-2">
            {[0, 200, 500, 1000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setTip(amt)}
                className={
                  "inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm transition-colors " +
                  (tip === amt
                    ? "border-brand-red bg-brand-red text-white"
                    : "border-ink-200 bg-white text-ink-900 hover:border-ink-300")
                }
              >
                {amt === 0 ? "None" : `₦${amt.toLocaleString()}`}
              </button>
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <OrderSummary lines={lines} subtotal={subtotal} />
        <button
          type="button"
          onClick={handlePlace}
          disabled={placing || !address}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-red px-6 text-base font-medium text-white shadow-sm hover:bg-brand-red-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {placing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Placing your order…
            </>
          ) : (
            <>
              <ShoppingBag size={16} />
              Place order
              <ArrowRight size={16} strokeWidth={2.2} />
            </>
          )}
        </button>
        <p className="text-center text-xs text-ink-500">
          You'll see the final total (with delivery) on the success screen.
        </p>
      </aside>
    </div>
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
    <div className="mx-auto max-w-md rounded-3xl border border-ink-200 bg-white p-8 text-center shadow-soft">
      <h2 className="font-serif text-2xl text-ink-900">{title}</h2>
      <p className="mt-2 text-sm text-ink-600">{body}</p>
      <Link
        href={cta.href}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-brand-red px-6 text-sm font-medium text-white shadow-sm hover:bg-brand-red-600"
      >
        {cta.label}
      </Link>
    </div>
  );
}
