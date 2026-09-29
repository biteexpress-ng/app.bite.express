import {
  payWithPaystack,
  type PaystackPaymentInput,
  type PaystackResult,
} from "@/lib/paystack";
import {
  confirmPaystackPayment,
  walletPayOrder,
  type ConfirmPaystackResult,
  type WalletPayResult,
} from "@/lib/api/orders";

/**
 * What happens after /order/place has created an order, shared by food
 * checkout and /send. The API calls and the Paystack popup come in as
 * deps so every branch can be tested without a browser.
 *
 * Every order is paid before it is attended to; there is no cash on
 * delivery, so these three methods are the whole set.
 */

export type SettleMethod = "digital_payment" | "wallet" | "offline_payment";

export type SettleInput = {
  orderId: number;
  /** total_ammount from /order/place: what Paystack is asked to capture. */
  amount: number;
  method: SettleMethod;
  /** Where the customer lands once the order is settled. */
  successHref: string;
  /** Needed to charge a card. */
  email: string | null;
  offlineMethodId: number | null;
};

export type SettleDeps = {
  payWithPaystack: (input: PaystackPaymentInput) => Promise<PaystackResult>;
  confirmPaystackPayment: (orderId: number, reference: string) => Promise<ConfirmPaystackResult>;
  walletPayOrder: (orderId: number) => Promise<WalletPayResult>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

export type SettleOutcome =
  /** Leave the form. Show `error` first when present. */
  | { kind: "navigate"; href: string; error?: string }
  /** Stay on the form and let the customer try again. */
  | { kind: "stay"; tone: "warn" | "error"; message: string };

/** Confirm calls after a captured Paystack payment, including the first. */
export const CONFIRM_ATTEMPTS = 4;

export const defaultSettleDeps: SettleDeps = {
  payWithPaystack,
  confirmPaystackPayment,
  walletPayOrder,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
};

export async function settleOrder(
  input: SettleInput,
  deps: SettleDeps,
): Promise<SettleOutcome> {
  const { orderId } = input;

  // Offline orders are created at order_status 'failed' and only become
  // real once /checkout/offline/{id} submits the transfer details
  // (Order::scopeFailed hides them until then), so go straight there.
  if (input.method === "offline_payment") {
    return {
      kind: "navigate",
      href:
        `/checkout/offline/${orderId}` +
        (input.offlineMethodId ? `?method=${input.offlineMethodId}` : ""),
    };
  }

  if (input.method === "digital_payment") {
    if (!input.email) {
      return {
        kind: "stay",
        tone: "warn",
        message: "We need an email on file to charge a card. Add one on the Edit profile page and try again.",
      };
    }

    const reference = `BE-${orderId}-${deps.now().toString(36)}`;
    const pop = await deps.payWithPaystack({
      email: input.email,
      // Kobo, from the server's total, so every fee is included.
      amountKobo: Math.round(input.amount * 100),
      reference,
      metadata: { order_id: orderId },
    });

    if (pop.status === "cancelled") {
      return {
        kind: "stay",
        tone: "warn",
        message: `Payment cancelled. Order #${orderId} is on hold. Re-place it when you're ready.`,
      };
    }
    if (pop.status === "error") {
      return { kind: "stay", tone: "error", message: pop.message };
    }

    // The money is captured by now, so a dropped connection must not read
    // as a failed payment. The endpoint is idempotent (already_paid is 200).
    let confirm = await deps.confirmPaystackPayment(orderId, pop.reference);
    for (let attempt = 1; !confirm.ok && attempt < CONFIRM_ATTEMPTS; attempt++) {
      await deps.sleep(attempt * 1500);
      confirm = await deps.confirmPaystackPayment(orderId, pop.reference);
    }
    if (!confirm.ok) {
      return {
        kind: "navigate",
        href: `/orders/${orderId}`,
        error: `We received your payment but couldn't activate order #${orderId} yet. Please don't pay again; contact support with reference ${pop.reference}.`,
      };
    }
    return { kind: "navigate", href: input.successHref };
  }

  if (input.method === "wallet") {
    const pay = await deps.walletPayOrder(orderId);
    if (pay.ok) return { kind: "navigate", href: input.successHref };
    if (pay.reason === "insufficient") {
      return {
        kind: "stay",
        tone: "warn",
        message: "Wallet balance is too low. Top up via your DVA on the Wallet page, then re-place the order.",
      };
    }
    return { kind: "stay", tone: "error", message: pay.message || "Wallet payment failed." };
  }

  return { kind: "stay", tone: "error", message: "Please pick a payment method and try again." };
}
