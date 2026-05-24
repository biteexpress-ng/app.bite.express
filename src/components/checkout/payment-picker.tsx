"use client";

import Link from "next/link";
import {
  Banknote,
  CreditCard,
  Wallet as WalletIcon,
  Landmark,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type PaymentMethod =
  | "cash_on_delivery"
  | "digital_payment"
  | "wallet"
  | "bank_transfer";

type Props = {
  value: PaymentMethod;
  onChange: (v: PaymentMethod) => void;
  /** Customer's current wallet balance in NGN. Shown next to the
   *  Wallet option so people know whether they have enough. Pass
   *  null while it's still loading; pass 0 if you know it's empty. */
  walletBalance?: number | null;
  /** Pre-computed order subtotal. Used to show "insufficient" hints
   *  next to the wallet option without disabling it (the customer
   *  can still pick it; the backend / transfer page will handle
   *  reconciliation). */
  orderTotal?: number | null;
};

type OptionConfig = {
  id: PaymentMethod;
  label: string;
  icon: React.ReactNode;
};

const OPTIONS: OptionConfig[] = [
  {
    id: "cash_on_delivery",
    label: "Cash on delivery",
    icon: <Banknote size={18} />,
  },
  {
    id: "digital_payment",
    label: "Card (Paystack)",
    icon: <CreditCard size={18} />,
  },
  {
    id: "wallet",
    label: "Wallet balance",
    icon: <WalletIcon size={18} />,
  },
  {
    id: "bank_transfer",
    label: "Bank transfer (Dedicated account)",
    icon: <Landmark size={18} />,
  },
];

/**
 * Payment-method radios for /checkout.
 *
 *   cash_on_delivery   → backend payment_method "cash_on_delivery"
 *   digital_payment    → Paystack inline popup (slice 6b)
 *   wallet             → deducts wallet_balance immediately
 *   bank_transfer      → still backend payment_method "wallet",
 *                        but the customer is routed to a transfer
 *                        instructions page where they send funds to
 *                        their DVA (Paystack credits the wallet via
 *                        webhook), then click "I've sent it" to
 *                        finalise the order.
 */
export function PaymentPicker({
  value,
  onChange,
  walletBalance,
  orderTotal,
}: Props) {
  return (
    <div className="space-y-3">
      {OPTIONS.map((opt) => {
        const checked = opt.id === value;
        return (
          <label
            key={opt.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors",
              checked
                ? "border-brand-red bg-brand-red/5"
                : "border-ink-200 bg-white hover:border-ink-300",
            )}
          >
            <span
              className={cn(
                "mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                checked
                  ? "border-brand-red bg-brand-red text-white"
                  : "border-ink-300 bg-white",
              )}
              aria-hidden="true"
            >
              {checked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
            </span>
            <span className="mt-0.5 text-ink-500">{opt.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink-900">{opt.label}</p>
              <OptionHint
                id={opt.id}
                walletBalance={walletBalance}
                orderTotal={orderTotal}
              />
            </div>
            <input
              type="radio"
              name="checkout-payment"
              checked={checked}
              onChange={() => onChange(opt.id)}
              className="sr-only"
            />
          </label>
        );
      })}
    </div>
  );
}

function OptionHint({
  id,
  walletBalance,
  orderTotal,
}: {
  id: PaymentMethod;
  walletBalance?: number | null;
  orderTotal?: number | null;
}) {
  if (id === "cash_on_delivery") {
    return (
      <p className="mt-0.5 text-xs text-ink-500">
        Pay the rider when your order arrives.
      </p>
    );
  }
  if (id === "digital_payment") {
    return (
      <p className="mt-0.5 text-xs text-ink-500">
        Pay now with any card, bank, or USSD via Paystack.
      </p>
    );
  }
  if (id === "bank_transfer") {
    return (
      <p className="mt-0.5 text-xs text-ink-500">
        Transfer from any bank to your dedicated account — we'll confirm in
        seconds.
      </p>
    );
  }
  // wallet
  const balance =
    typeof walletBalance === "number"
      ? `₦${Math.round(walletBalance).toLocaleString()}`
      : null;
  const insufficient =
    typeof walletBalance === "number" &&
    typeof orderTotal === "number" &&
    walletBalance < orderTotal;

  return (
    <p className="mt-0.5 text-xs text-ink-500">
      {balance ? (
        <>
          Balance: <span className="font-medium text-ink-700">{balance}</span>
          {insufficient && (
            <>
              {" "}
              ·{" "}
              <span className="text-error">
                not enough — top up via{" "}
                <Link href="/wallet" className="underline">
                  your DVA
                </Link>
                .
              </span>
            </>
          )}
        </>
      ) : (
        "Pay from your BiteExpress wallet balance."
      )}
    </p>
  );
}
