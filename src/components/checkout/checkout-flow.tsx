"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-store";
import { useLocation } from "@/lib/location-store";
import { useAuth } from "@/lib/auth-store";
import { placeOrder, confirmPaystackPayment } from "@/lib/api/orders";
import { fetchStoreDetail } from "@/lib/api/store-detail";
import { payWithPaystack } from "@/lib/paystack";
import { distanceKm } from "@/lib/geo";
import { OrderSummary } from "./order-summary";
import { PaymentPicker, type PaymentMethod } from "./payment-picker";
import {
  AddressPickerCheckout,
  type CheckoutAddress,
} from "./address-picker-checkout";

type Phase =
  | { kind: "hydrating" }
  | { kind: "ready"; moduleId: number }
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

  const [phase, setPhase] = useState<Phase>({ kind: "hydrating" });
  const [address, setAddress] = useState<CheckoutAddress | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>("cash_on_delivery");
  const [tip, setTip] = useState(0);

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
      setPhase({ kind: "ready", moduleId: 0 });
      return;
    }

    setPhase({ kind: "hydrating" });
    fetchStoreDetail(
      cartStoreId,
      stored?.lat,
      stored?.lng,
    ).then((res) => {
      if (res.ok) {
        setPhase({ kind: "ready", moduleId: res.store.module_id ?? 0 });
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

    const dist = distanceKm(stored.lat, stored.lng, address.lat, address.lng);

    const res = await placeOrder({
      storeId: cartStoreId!,
      moduleId: phase.moduleId,
      zoneIds: stored.zoneCheck.zoneIds,
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
      paymentMethod: payment,
      orderType: "delivery",
      dmTips: tip,
    });

    if (!res.ok) {
      setPhase({ kind: "ready", moduleId: phase.moduleId });
      alert(res.message); // crude but adequate for v0 — replace with toast next pass
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
        setPhase({ kind: "ready", moduleId: phase.moduleId });
        alert(
          "We need an email on file to charge a card. Add one in /profile then try again.",
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
        setPhase({ kind: "ready", moduleId: phase.moduleId });
        alert(
          `Payment cancelled. Your order #${res.orderId} is on hold — you can retry by re-placing it.`,
        );
        return;
      }
      if (pop.status === "error") {
        setPhase({ kind: "ready", moduleId: phase.moduleId });
        alert(pop.message);
        return;
      }

      const confirm = await confirmPaystackPayment(res.orderId, pop.reference);
      if (!confirm.ok) {
        setPhase({ kind: "ready", moduleId: phase.moduleId });
        alert(
          `Paystack charged your card, but we couldn't confirm it server-side: ${confirm.message}. Ops has been notified.`,
        );
        return;
      }

      clear();
      router.replace(`/checkout/success?order_id=${res.orderId}`);
      return;
    }

    // wallet, offline, bank_transfer — disabled in PaymentPicker for now.
    setPhase({ kind: "ready", moduleId: phase.moduleId });
    alert("That payment method isn't wired up yet.");
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
          <PaymentPicker value={payment} onChange={setPayment} />
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
