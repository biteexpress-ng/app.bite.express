"use client";

/**
 * Paystack inline-popup helper.
 *
 * We load the official Paystack script via <Script> in the root
 * layout (see app/layout.tsx). It exposes `window.PaystackPop`,
 * which we wrap here in a typed Promise so checkout flows can
 * await the user's action.
 *
 * Env:
 *   NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY   pk_test_... in dev, pk_live_... in prod
 *
 * Backend still verifies every transaction via webhook
 * (POST /api/v1/webhook/paystack already wired). Never trust the
 * popup callback alone to mark an order paid — the server is
 * authoritative.
 */

export type PaystackPaymentInput = {
  email: string;
  amountKobo: number; // amount in kobo (NGN * 100)
  reference: string; // unique transaction ref — generate server-side
  currency?: "NGN";
  metadata?: Record<string, unknown>;
};

export type PaystackResult =
  | { status: "success"; reference: string }
  | { status: "cancelled" }
  | { status: "error"; message: string };

type PaystackPopApi = {
  setup(opts: {
    key: string;
    email: string;
    amount: number;
    currency?: string;
    ref: string;
    metadata?: Record<string, unknown>;
    onClose: () => void;
    callback: (response: { reference: string }) => void;
  }): { openIframe: () => void };
};

declare global {
  interface Window {
    PaystackPop?: PaystackPopApi;
  }
}

export function isPaystackReady(): boolean {
  return typeof window !== "undefined" && Boolean(window.PaystackPop);
}

export function payWithPaystack(
  input: PaystackPaymentInput,
): Promise<PaystackResult> {
  return new Promise((resolve) => {
    const key = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    if (!key) {
      resolve({
        status: "error",
        message: "Paystack public key not configured (NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY).",
      });
      return;
    }
    if (!isPaystackReady()) {
      resolve({
        status: "error",
        message:
          "Paystack script not loaded yet — refresh and try again, or check the network tab.",
      });
      return;
    }

    const handler = window.PaystackPop!.setup({
      key,
      email: input.email,
      amount: input.amountKobo,
      currency: input.currency ?? "NGN",
      ref: input.reference,
      metadata: input.metadata,
      onClose: () => resolve({ status: "cancelled" }),
      callback: (response) =>
        resolve({ status: "success", reference: response.reference }),
    });

    handler.openIframe();
  });
}

export const PAYSTACK_SCRIPT_SRC = "https://js.paystack.co/v1/inline.js";
