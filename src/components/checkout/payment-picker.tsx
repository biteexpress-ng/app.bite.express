"use client";

import Link from "next/link";
import {
  Banknote,
  Building2,
  CreditCard,
  Wallet as WalletIcon,
  Landmark,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { OfflinePaymentMethod } from "@/lib/offline-payment-rules";
import { BankChips } from "@/components/checkout/bank-chips";

export type PaymentMethod =
  | "cash_on_delivery"
  | "digital_payment"
  | "wallet"
  | "bank_transfer"
  | "offline_payment";

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
  /** Whether Pay Offline passes all three gates (see
   *  canUseOfflinePayment). When false the option is hidden entirely
   *  rather than disabled — a disabled payment method with no
   *  explanation reads as a bug. */
  offlineEnabled?: boolean;
  /** Banks/methods the customer can pay into. Only read when
   *  offlineEnabled is true. */
  offlineMethods?: OfflinePaymentMethod[];
  offlineMethodId?: number | null;
  onOfflineMethodChange?: (id: number) => void;
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
  {
    id: "offline_payment",
    label: "Pay Offline",
    icon: <Building2 size={18} />,
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
  offlineEnabled = false,
  offlineMethods = [],
  offlineMethodId = null,
  onOfflineMethodChange,
}: Props) {
  const options = OPTIONS.filter(
    (opt) => opt.id !== "offline_payment" || offlineEnabled,
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((opt) => {
          const checked = opt.id === value;
          return (
            <label
              key={opt.id}
              className={cn(
                "group relative flex cursor-pointer items-start gap-3 overflow-hidden rounded-2xl border p-4 transition-all duration-200",
                checked
                  ? "border-transparent bg-white shadow-[0_0_0_2px_rgba(222,22,0,0.5),0_18px_42px_-18px_rgba(222,22,0,0.35)]"
                  : "border-ink-200 bg-white hover:-translate-y-px hover:border-brand-red/30 hover:shadow-soft",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  checked
                    ? "border-brand-red bg-brand-red text-white"
                    : "border-ink-300 bg-white",
                )}
                aria-hidden="true"
              >
                {checked && <span className="h-2 w-2 rounded-full bg-white" />}
              </span>
              <span
                className={cn(
                  "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                  checked
                    ? "bg-brand-red/10 text-brand-red"
                    : "bg-canvas-sunken text-ink-700",
                )}
              >
                {opt.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold tracking-[-0.005em] text-ink-900">
                  {opt.label}
                </p>
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

      {value === "offline_payment" && offlineMethods.length > 0 && (
        <BankChooser
          methods={offlineMethods}
          selectedId={offlineMethodId}
          onSelect={(id) => onOfflineMethodChange?.(id)}
        />
      )}
    </div>
  );
}

/**
 * Which account the customer will transfer into. Shown at checkout so
 * the choice travels with the order; the customer can still change it
 * on /checkout/offline/[orderId] before submitting.
 */
function BankChooser({
  methods,
  selectedId,
  onSelect,
}: {
  methods: OfflinePaymentMethod[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-canvas-sunken p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-500">
        Which bank will you transfer to?
      </p>
      <div className="mt-3">
        <BankChips methods={methods} selectedId={selectedId} onSelect={onSelect} />
      </div>
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
  if (id === "offline_payment") {
    return (
      <p className="mt-0.5 text-xs text-ink-500">
        Transfer from your bank app, then send us the details. No card needed.
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
