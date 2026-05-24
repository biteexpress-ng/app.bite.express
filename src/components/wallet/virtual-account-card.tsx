"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Landmark, Loader2 } from "lucide-react";
import { fetchVirtualAccount, type VirtualAccount } from "@/lib/api/wallet";

type State =
  | { kind: "loading" }
  | { kind: "ready"; account: VirtualAccount }
  | { kind: "error"; message: string };

/**
 * Customer's Dedicated Virtual Account.
 *
 * GET /api/v1/customer/virtual-account lazy-creates a Paystack
 * Titan DVA on first hit so the very first render of this card may
 * take a couple of seconds while Paystack issues the account.
 */
export function VirtualAccountCard() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchVirtualAccount().then((res) => {
      if (cancelled) return;
      if (res.ok) setState({ kind: "ready", account: res.account });
      else setState({ kind: "error", message: res.message });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <Card>
        <div className="flex items-center gap-2 text-sm text-ink-500">
          <Loader2 size={14} className="animate-spin" />
          Setting up your dedicated account…
        </div>
      </Card>
    );
  }

  if (state.kind === "error") {
    return (
      <Card>
        <p className="text-sm text-ink-700">{state.message}</p>
      </Card>
    );
  }

  const acc = state.account;
  async function copy() {
    try {
      await navigator.clipboard.writeText(acc.account_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied — ignore */
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-ink-500">
            Your dedicated account
          </p>
          <p className="mt-1 text-sm text-ink-600">
            Transfer to this account to top up your wallet — funds reflect
            in seconds.
          </p>
        </div>
        <Landmark size={20} className="shrink-0 text-brand-red" />
      </div>

      <dl className="mt-5 space-y-3 text-sm">
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
              onClick={copy}
              aria-label="Copy account number"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-3 text-xs font-medium text-ink-900 hover:bg-ink-50"
            >
              {copied ? (
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
