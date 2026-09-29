import type { OrderQuote } from "@/lib/api/order-quote";
import type { ZoneData } from "@/lib/api/zones";
import type { SettleOutcome } from "@/lib/checkout/settle-order";

/**
 * Pure rules for how a parcel is paid and when it can be placed. No
 * React and no fetch, so the decisions that stop a customer paying the
 * wrong amount, or reaching a placement the backend refuses, are tested
 * directly.
 *
 * The sender always pays, up front. There is no cash on delivery.
 */

/** The same strings as PaymentMethod in payment-picker.tsx. */
export type ParcelPaymentMethod = "digital_payment" | "wallet" | "offline_payment";

export type PaymentGates = {
  /** config.digital_payment. Placement refuses Pay Online when it is off. */
  digitalPayment: boolean;
  /** The pickup zone's own switches, from get-zone-id. */
  zone: Pick<ZoneData, "digital_payment" | "offline_payment">;
  /** canUseOfflinePayment() for the pickup zone. */
  offlineUsable: boolean;
};

function isOn(flag: number | boolean | string | null | undefined): boolean {
  return flag === 1 || flag === true || flag === "1";
}

/**
 * The methods food checkout offers (Pay Online, wallet, Pay Offline),
 * less any the switches turn off. The wallet is always there.
 */
export function allowedMethods(g: PaymentGates): ParcelPaymentMethod[] {
  const methods: ParcelPaymentMethod[] = [];
  if (g.digitalPayment && isOn(g.zone.digital_payment)) methods.push("digital_payment");
  methods.push("wallet");
  if (g.offlineUsable) methods.push("offline_payment");
  return methods;
}

export function effectivePayment(
  choice: ParcelPaymentMethod | null,
  g: PaymentGates,
): ParcelPaymentMethod | null {
  const allowed = allowedMethods(g);
  if (choice !== null && allowed.includes(choice)) return choice;
  return allowed[0] ?? null;
}

export type ParcelQuoteInputs = {
  categoryId: number;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  distanceKm: number;
  tip: number;
};

/**
 * Names the inputs a preview was fetched for. A preview whose key is not
 * the current key is stale and must never enable payment.
 */
export function parcelQuoteKey(i: ParcelQuoteInputs): string {
  return [
    i.categoryId,
    i.pickup.lat,
    i.pickup.lng,
    i.dropoff.lat,
    i.dropoff.lng,
    i.distanceKm,
    i.tip,
  ].join("|");
}

export type ParcelQuoteView =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; quote: OrderQuote }
  | { kind: "error"; message: string };

export function walletShortfall(total: number, balance: number | null): number {
  return typeof balance === "number" ? Math.max(0, total - balance) : 0;
}

/**
 * Why "Place order" is disabled, or null when the parcel can be placed.
 * Only a ready preview for the current inputs lets the customer pay, and
 * Pay Online without an email is stopped here, before /order/place
 * creates an order that could never be charged.
 */
export function placeBlocker(a: {
  stepsValid: boolean;
  quote: ParcelQuoteView;
  payment: ParcelPaymentMethod | null;
  walletBalance: number | null;
  email: string | null;
}): string | null {
  if (!a.stepsValid) return "Finish the steps above first.";
  if (a.quote.kind === "error") return a.quote.message;
  if (a.quote.kind !== "ready") return "Working out the price…";
  if (a.payment === null) return "Pick how to pay.";
  if (a.payment === "digital_payment" && !a.email?.trim()) {
    return "Add an email on the Edit profile page to pay online, or pick another way to pay.";
  }
  if (a.payment === "wallet") {
    const total = a.quote.quote.total;
    const short = walletShortfall(total, a.walletBalance);
    if (short > 0) {
      return `Your wallet is ₦${Math.round(short).toLocaleString()} short of the ₦${Math.round(total).toLocaleString()} total.`;
    }
  }
  return null;
}

/**
 * What /send and food checkout do once settleOrder answers. Placement
 * debits the wallet and the wallet endpoint answers 200 for an order
 * already paid, so a wallet "stay" can only be a transport failure after
 * payment. Leaving the form open there would invite a second debit, so
 * the customer goes to the order instead. A cancelled or failed Paystack
 * popup still stays.
 */
export function afterSettle(
  method: ParcelPaymentMethod,
  outcome: SettleOutcome,
  orderId: number,
): SettleOutcome {
  if (method === "wallet" && outcome.kind === "stay") {
    return {
      kind: "navigate",
      href: `/orders/${orderId}`,
      error: `We couldn't confirm the wallet payment for order #${orderId}. Check the order before paying again.`,
    };
  }
  return outcome;
}

/**
 * Placement errors in plain words. A 203 "order_amount" means the wallet
 * cannot cover the total (placement's cash ceiling never applies: there
 * is no cash on delivery).
 */
export function parcelPlaceErrorMessage(code: string | null, fallback: string): string {
  if (code === "zone") {
    return "We can't collect parcels from the pickup address any more. Pick another pickup address.";
  }
  if (code === "receiverZone") {
    return "We don't deliver to the drop-off address any more. Pick another drop-off.";
  }
  if (code === "order_amount") {
    return "Your wallet balance is too low for this parcel. Top up on the Wallet page, or pay another way.";
  }
  if (code === "unknown_outcome") {
    return "We couldn't confirm whether your parcel was placed. Check your orders before trying again.";
  }
  return fallback || "We couldn't place your parcel. Please try again.";
}
