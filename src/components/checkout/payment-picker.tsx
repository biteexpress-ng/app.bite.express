"use client";

import {
  Banknote,
  CreditCard,
  Wallet as WalletIcon,
  Landmark,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type PaymentMethod = "cash_on_delivery" | "digital_payment" | "wallet";

type Props = {
  value: PaymentMethod;
  onChange: (v: PaymentMethod) => void;
};

type Option = {
  id: PaymentMethod | "bank_transfer";
  label: string;
  hint?: string;
  icon: React.ReactNode;
  disabled?: boolean;
};

const OPTIONS: Option[] = [
  {
    id: "cash_on_delivery",
    label: "Cash on delivery",
    hint: "Pay the rider when your order arrives.",
    icon: <Banknote size={18} />,
  },
  {
    id: "digital_payment",
    label: "Card (Paystack)",
    hint: "Wired up in the next release.",
    icon: <CreditCard size={18} />,
    disabled: true,
  },
  {
    id: "bank_transfer",
    label: "Bank transfer (Dedicated account)",
    hint: "Use your wallet DVA — coming next.",
    icon: <Landmark size={18} />,
    disabled: true,
  },
  {
    id: "wallet",
    label: "Wallet balance",
    hint: "Coming next.",
    icon: <WalletIcon size={18} />,
    disabled: true,
  },
];

/**
 * Payment-method radios for /checkout.
 *
 * Only cash_on_delivery is enabled in v0. The others render as
 * disabled rows so users see what's coming without us hiding the
 * roadmap. Slice 6b adds Paystack + DVA + wallet.
 */
export function PaymentPicker({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      {OPTIONS.map((opt) => {
        const checked = !opt.disabled && opt.id === value;
        return (
          <label
            key={opt.id}
            className={cn(
              "flex items-start gap-3 rounded-2xl border p-4 transition-colors",
              opt.disabled
                ? "cursor-not-allowed border-ink-200 bg-ink-50 opacity-60"
                : checked
                  ? "cursor-pointer border-brand-red bg-brand-red/5"
                  : "cursor-pointer border-ink-200 bg-white hover:border-ink-300",
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
              {opt.hint && <p className="mt-0.5 text-xs text-ink-500">{opt.hint}</p>}
            </div>
            <input
              type="radio"
              name="checkout-payment"
              checked={checked}
              disabled={opt.disabled}
              onChange={() => {
                if (!opt.disabled && opt.id !== "bank_transfer")
                  onChange(opt.id);
              }}
              className="sr-only"
            />
          </label>
        );
      })}
    </div>
  );
}
