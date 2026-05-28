"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Landmark, Loader2, Wallet as WalletIcon } from "lucide-react";
import { fetchVirtualAccount, type VirtualAccount } from "@/lib/api/wallet";
import { useAuth } from "@/lib/auth-store";

type State =
  | { kind: "loading" }
  | { kind: "ready"; account: VirtualAccount }
  | { kind: "error"; message: string };

/**
 * Premium DVA card — looks like a high-end fintech card with the
 * BiteExpress brand colors and a copy-able account number.
 */
export function VirtualAccountCard() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [copied, setCopied] = useState(false);
  const user = useAuth((s) => s.user);
  const balance =
    typeof user?.wallet_balance === "number" ? user.wallet_balance : null;

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
    <div className="fade-up space-y-5">
      {/* Premium balance card */}
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-canvas-darker p-7 text-white shadow-luxe sm:p-9">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-95"
          style={{
            background:
              "radial-gradient(34rem 22rem at 92% -10%, rgba(255,42,20,0.42), transparent 60%), radial-gradient(28rem 18rem at -10% 110%, rgba(255,107,74,0.20), transparent 60%)",
          }}
        />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white/55">
              BiteExpress Wallet
            </p>
            <p className="mt-3 font-serif text-4xl tracking-[-0.015em] text-white sm:text-5xl">
              ₦{balance !== null ? Math.round(balance).toLocaleString() : "—"}
            </p>
          </div>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white backdrop-blur">
            <WalletIcon size={20} strokeWidth={1.7} />
          </span>
        </div>
        <p className="mt-6 max-w-md text-sm leading-relaxed text-white/65">
          Transfer to your dedicated account below to top up — funds reflect
          in seconds and can be spent at checkout.
        </p>
      </div>

      {/* DVA bank details */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-500">
              Top-up account
            </p>
            <p className="mt-1.5 font-serif text-xl tracking-[-0.012em] text-ink-900">
              {acc.account_name}
            </p>
          </div>
          <span
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-brand-red"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,107,74,0.18), rgba(222,22,0,0.06))",
            }}
          >
            <Landmark size={20} />
          </span>
        </div>

        <dl className="mt-6 space-y-4 text-sm">
          <Row label={acc.bank_name_label || "Bank"} value={acc.bank_name} />
          <div>
            <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-500">
              Account number
            </dt>
            <dd className="mt-2 flex items-center gap-3">
              <span className="font-mono text-3xl font-semibold tracking-[0.04em] text-ink-900">
                {acc.account_number}
              </span>
              <button
                type="button"
                onClick={copy}
                aria-label="Copy account number"
                className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-ink-200 bg-white px-3.5 text-xs font-medium text-ink-900 shadow-soft transition-all hover:-translate-y-px hover:border-brand-red/30 hover:text-brand-red"
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
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ink-500">
        {label}
      </dt>
      <dd className="mt-1 text-base font-medium text-ink-900">{value}</dd>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[2rem] border border-ink-200 bg-white p-7 shadow-card sm:p-9">
      {children}
    </div>
  );
}
