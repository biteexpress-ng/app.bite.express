"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Copy, Landmark, Loader2 } from "lucide-react";
import { walletPayOrder } from "@/lib/api/orders";
import { fetchVirtualAccount, type VirtualAccount } from "@/lib/api/wallet";
import { cn } from "@/lib/cn";

type DvaState =
  | { kind: "loading" }
  | { kind: "ready"; account: VirtualAccount }
  | { kind: "error"; message: string };

type PayState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "insufficient" }
  | { kind: "error"; message: string };

/**
 * /checkout/transfer/[orderId] — the customer has placed an order
 * with payment_method=wallet but has chosen to fund it via DVA
 * bank transfer. Show the DVA, the amount, and a single "I've
 * sent the payment" button that calls /order/wallet-payment.
 *
 * The wallet doesn't credit instantly — Paystack typically webhooks
 * within 5-30 seconds of an NIP transfer landing on a Titan DVA. If
 * the deduct fails with "insufficient", we tell the customer to
 * wait and retry; we don't auto-poll because most customers haven't
 * actually completed the transfer at the moment they tap the button.
 */
export function TransferInstructions({ orderId }: { orderId: number }) {
  const router = useRouter();
  const search = useSearchParams();
  const amountRaw = search.get("amount");
  const amount = amountRaw ? Number(amountRaw) : null;
  const amountText =
    typeof amount === "number" && Number.isFinite(amount)
      ? `₦${Math.round(amount).toLocaleString()}`
      : null;

  const [dva, setDva] = useState<DvaState>({ kind: "loading" });
  const [pay, setPay] = useState<PayState>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    fetchVirtualAccount().then((res) => {
      if (cancelled) return;
      if (res.ok) setDva({ kind: "ready", account: res.account });
      else setDva({ kind: "error", message: res.message });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCheck() {
    setPay({ kind: "checking" });
    const res = await walletPayOrder(orderId);
    if (res.ok) {
      router.replace(`/checkout/success?order_id=${orderId}`);
      return;
    }
    if (res.reason === "insufficient") {
      setPay({ kind: "insufficient" });
      return;
    }
    setPay({ kind: "error", message: res.message });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-display-md text-ink-900">
          Send <span className="text-brand-red">{amountText ?? "the amount"}</span>{" "}
          to your dedicated account
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          Transfer from any Nigerian bank. We'll confirm the moment Paystack
          credits your wallet — usually under a minute.
        </p>
      </header>

      <DvaCard
        state={dva}
        reference={`Order #${orderId}`}
        amountText={amountText}
      />

      <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
        <p className="text-sm font-medium text-ink-900">
          Already sent the transfer?
        </p>
        <p className="mt-1 text-xs text-ink-600">
          Tap below — if your wallet has been credited we'll mark the order
          paid and send you to confirmation. If not, give Paystack a few more
          seconds and tap again.
        </p>

        <button
          type="button"
          onClick={handleCheck}
          disabled={pay.kind === "checking"}
          className={cn(
            "mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-red px-6 text-base font-medium text-white shadow-sm transition-colors",
            "hover:bg-brand-red-600 active:bg-brand-red-700",
            "disabled:cursor-wait disabled:opacity-70",
          )}
        >
          {pay.kind === "checking" ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Checking…
            </>
          ) : (
            <>
              I've sent the payment
              <ArrowRight size={16} strokeWidth={2.2} />
            </>
          )}
        </button>

        {pay.kind === "insufficient" && (
          <p className="mt-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-ink-700">
            We haven't seen the transfer hit your wallet yet. Paystack usually
            takes a few seconds — wait 30s and try again. Your order is held
            for you.
          </p>
        )}
        {pay.kind === "error" && (
          <p className="mt-3 rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-xs text-error">
            {pay.message}
          </p>
        )}
      </div>

      <p className="text-center text-xs text-ink-500">
        Need to come back to this later?{" "}
        <Link href="/orders" className="text-brand-red underline-offset-2 hover:underline">
          Find this order in your history
        </Link>{" "}
        and tap "Confirm transfer" again.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- */

function DvaCard({
  state,
  reference,
  amountText,
}: {
  state: DvaState;
  reference: string;
  amountText: string | null;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  if (state.kind === "loading") {
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm text-ink-500">
          <Loader2 size={14} className="animate-spin" />
          Loading your dedicated account…
        </div>
      </Card>
    );
  }

  if (state.kind === "error") {
    return (
      <Card>
        <p className="text-sm text-ink-700">{state.message}</p>
        <p className="mt-2 text-xs text-ink-500">
          You can set it up on the{" "}
          <Link href="/wallet" className="text-brand-red underline-offset-2 hover:underline">
            Wallet page
          </Link>{" "}
          and come back here.
        </p>
      </Card>
    );
  }

  const acc = state.account;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-500">
            Your dedicated account
          </p>
        </div>
        <Landmark size={20} className="shrink-0 text-brand-red" />
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        <Row label={acc.bank_name_label || "Bank"} value={acc.bank_name} />
        <Row label="Account name" value={acc.account_name} />
        <div>
          <dt className="text-ink-500">Account number</dt>
          <dd className="mt-1 flex items-center gap-3">
            <span className="font-mono text-2xl font-semibold tracking-wide text-ink-900">
              {acc.account_number}
            </span>
            <button
              type="button"
              onClick={() => copy(acc.account_number, "acc")}
              aria-label="Copy account number"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 text-xs font-medium text-ink-900 hover:bg-ink-50"
            >
              {copied === "acc" ? (
                <>
                  <Check size={12} className="text-success" /> Copied
                </>
              ) : (
                <>
                  <Copy size={12} /> Copy
                </>
              )}
            </button>
          </dd>
        </div>
        {amountText && (
          <div>
            <dt className="text-ink-500">Amount to send</dt>
            <dd className="mt-1 flex items-center gap-3">
              <span className="text-2xl font-semibold text-ink-900">
                {amountText}
              </span>
              <button
                type="button"
                onClick={() =>
                  copy(
                    String(Math.round(Number(amountText.replace(/\D/g, "")))),
                    "amt",
                  )
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 text-xs font-medium text-ink-900 hover:bg-ink-50"
              >
                {copied === "amt" ? (
                  <>
                    <Check size={12} className="text-success" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} /> Copy
                  </>
                )}
              </button>
            </dd>
          </div>
        )}
        <Row label="Narration / Reference" value={reference} />
      </dl>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-medium text-ink-900">{value}</dd>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
      {children}
    </div>
  );
}
