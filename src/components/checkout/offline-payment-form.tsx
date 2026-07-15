"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Copy, Landmark, Loader2 } from "lucide-react";
import { fetchOrderTrack, type OfflinePaymentBlock } from "@/lib/api/orders";
import {
  fetchOfflineMethods,
  submitOfflinePayment,
  updateOfflinePayment,
} from "@/lib/api/offline-payment";
import {
  validateOfflineForm,
  type OfflinePaymentMethod,
} from "@/lib/offline-payment-rules";
import { BankChips } from "@/components/checkout/bank-chips";
import { cn } from "@/lib/cn";

type LoadState =
  | { kind: "loading" }
  | {
      kind: "ready";
      methods: OfflinePaymentMethod[];
      amount: number | null;
      /** Present => the customer already submitted; we're editing. */
      existing: OfflinePaymentBlock | null;
    }
  | { kind: "error"; message: string };

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; message: string };

/**
 * /checkout/offline/[orderId]
 *
 * The customer placed an order with payment_method=offline_payment.
 * At this moment the order exists but sits at order_status='failed'
 * (PlaceNewOrder.php:173-179); it only becomes 'pending' once this page
 * successfully PUTs /customer/order/offline-payment. So this page must
 * never dead-end: on failure we keep the customer here with an inline
 * error and let them retry.
 *
 * The page doubles as the edit surface after an admin denies a payment,
 * which is why it reads the order first rather than trusting query
 * params. Reading the order also makes the URL re-enterable: a customer
 * who abandoned mid-flow can come back and finish.
 *
 * We fetch the order via /order/track, NOT /order/details. The latter
 * eager-loads offline_payments and then ignores it, returning line items.
 */
export function OfflinePaymentForm({ orderId }: { orderId: number }) {
  const router = useRouter();
  const search = useSearchParams();
  const methodHint = Number(search.get("method"));

  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [methodId, setMethodId] = useState<number | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [orderRes, methodsRes] = await Promise.all([
        fetchOrderTrack(orderId),
        fetchOfflineMethods(),
      ]);
      if (cancelled) return;

      if (!orderRes.ok) {
        setLoad({ kind: "error", message: orderRes.message });
        return;
      }
      if (!methodsRes.ok) {
        setLoad({ kind: "error", message: methodsRes.message });
        return;
      }
      if (methodsRes.methods.length === 0) {
        setLoad({
          kind: "error",
          message:
            "Bank transfer isn't available right now. Please contact support to pay for this order.",
        });
        return;
      }

      const existing = orderRes.order.offline_payment ?? null;
      const amountRaw = orderRes.order.order_amount;
      const amount =
        typeof amountRaw === "number" && Number.isFinite(amountRaw)
          ? amountRaw
          : null;

      // Pick the starting method: what was already submitted, else the
      // ?method= hint if it resolves to a real active method, else the
      // first. The hint is validated rather than trusted — a bogus
      // method_id is accepted by the backend with a 200 and then makes
      // Helpers::offline_payment_formater throw on every later fetch
      // (Helpers.php:3305).
      const existingId = existing?.data?.method_id ?? null;
      const hintValid = methodsRes.methods.some((m) => m.id === methodHint);
      const initialId =
        existingId ?? (hintValid ? methodHint : methodsRes.methods[0].id);

      setMethodId(initialId);

      if (existing?.input?.length) {
        const prefilled: Record<string, string> = {};
        for (const row of existing.input) {
          prefilled[row.user_input] = row.user_data ?? "";
        }
        setValues(prefilled);
      }
      if (existing?.data?.customer_note) setNote(existing.data.customer_note);

      setLoad({ kind: "ready", methods: methodsRes.methods, amount, existing });
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, methodHint]);

  const method = useMemo(() => {
    if (load.kind !== "ready" || methodId === null) return null;
    return load.methods.find((m) => m.id === methodId) ?? null;
  }, [load, methodId]);

  const isEdit = load.kind === "ready" && load.existing !== null;
  const denied = load.kind === "ready" && load.existing?.data?.status === "denied";

  const amountText =
    load.kind === "ready" && typeof load.amount === "number"
      ? `₦${Math.round(load.amount).toLocaleString()}`
      : null;

  async function handleSubmit() {
    if (!method || methodId === null) return;

    const errs = validateOfflineForm(method, values);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSave({ kind: "saving" });

    // Always send every field the method declares, not just the ones
    // the customer typed into. The update endpoint rebuilds the stored
    // object from scratch (OrderController.php:557), so an omitted key
    // is a deleted key.
    const fields: Record<string, string> = {};
    for (const info of method.method_informations ?? []) {
      fields[info.customer_input] = values[info.customer_input] ?? "";
    }

    const res = isEdit
      ? await updateOfflinePayment({ orderId, customerNote: note, fields })
      : await submitOfflinePayment({
          orderId,
          methodId,
          customerNote: note,
          fields,
        });

    if (res.ok) {
      router.replace(`/checkout/success?order_id=${orderId}`);
      return;
    }

    // Stay put. The order already exists; navigating away here is how
    // an order gets stranded.
    setSave({
      kind: "error",
      message:
        res.reason === "disabled"
          ? "Bank transfer was just switched off. Please contact support to pay for this order."
          : res.message,
    });
  }

  if (load.kind === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-500">
        <Loader2 size={14} className="animate-spin" />
        Loading your payment details…
      </div>
    );
  }

  if (load.kind === "error") {
    return (
      <div className="rounded-2xl border border-error/30 bg-error/5 p-4 text-sm text-error">
        {load.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-display-md text-ink-900">
          Send{" "}
          <span className="text-brand-red">{amountText ?? "the amount"}</span>{" "}
          to complete your order
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          Transfer from your bank app, then fill in the details below so we can
          match your payment. We confirm by hand, usually within a few minutes.
        </p>
      </header>

      {denied && load.existing?.data?.admin_note && (
        <div className="rounded-2xl border border-error/30 bg-error/5 p-4">
          <p className="text-sm font-medium text-error">
            We couldn&apos;t confirm your last payment
          </p>
          <p className="mt-1 text-xs text-ink-700">
            {load.existing.data.admin_note}
          </p>
          <p className="mt-2 text-xs text-ink-600">
            Check the details below and send them again.
          </p>
        </div>
      )}

      {!isEdit && load.methods.length > 1 && (
        <BankSwitcher
          methods={load.methods}
          selectedId={methodId}
          onSelect={(id) => {
            setMethodId(id);
            // The new method declares different fields; stale values
            // would be posted under keys the new method doesn't know.
            setValues({});
            setFieldErrors({});
          }}
        />
      )}

      {method && <AccountCard method={method} amountText={amountText} />}

      {method && (
        <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
          <p className="text-sm font-medium text-ink-900">Your payment details</p>
          <p className="mt-1 text-xs text-ink-600">
            This is how we find your transfer, so please match your bank app
            exactly.
          </p>

          <div className="mt-5 space-y-4">
            {(method.method_informations ?? []).map((info) => (
              <div key={info.customer_input}>
                <label
                  htmlFor={`off-${info.customer_input}`}
                  className="text-xs font-medium text-ink-700"
                >
                  {info.customer_placeholder}
                  {(info.is_required === 1 ||
                    info.is_required === true ||
                    info.is_required === "1") && (
                    <span className="text-brand-red"> *</span>
                  )}
                </label>
                <input
                  id={`off-${info.customer_input}`}
                  type="text"
                  value={values[info.customer_input] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [info.customer_input]: e.target.value,
                    }))
                  }
                  placeholder={info.customer_placeholder}
                  className={cn(
                    "mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm text-ink-900 outline-none transition-colors",
                    fieldErrors[info.customer_input]
                      ? "border-error focus:border-error"
                      : "border-ink-200 focus:border-brand-red",
                  )}
                />
                {fieldErrors[info.customer_input] && (
                  <p className="mt-1 text-xs text-error">
                    {fieldErrors[info.customer_input]}
                  </p>
                )}
              </div>
            ))}

            <div>
              <label htmlFor="off-note" className="text-xs font-medium text-ink-700">
                Anything else we should know? (optional)
              </label>
              <textarea
                id="off-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none transition-colors focus:border-brand-red"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={save.kind === "saving"}
            className={cn(
              "mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-red px-6 text-base font-medium text-white shadow-sm transition-colors",
              "hover:bg-brand-red-600 active:bg-brand-red-700",
              "disabled:cursor-wait disabled:opacity-70",
            )}
          >
            {save.kind === "saving" ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Sending…
              </>
            ) : (
              <>
                {isEdit ? "Update my payment details" : "I've sent the transfer"}
                <ArrowRight size={16} strokeWidth={2.2} />
              </>
            )}
          </button>

          {save.kind === "error" && (
            <p className="mt-3 rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-xs text-error">
              {save.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- */

/**
 * Create mode only. The update endpoint re-reads the method from the
 * stored payment_info (OrderController.php:555-558) and cannot change
 * it, so offering a switcher in edit mode would silently do nothing.
 */
function BankSwitcher({
  methods,
  selectedId,
  onSelect,
}: {
  methods: OfflinePaymentMethod[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-500">
        Paying to a different bank?
      </p>
      <div className="mt-3">
        <BankChips methods={methods} selectedId={selectedId} onSelect={onSelect} />
      </div>
    </div>
  );
}

/** The account the customer pays INTO, from method_fields. */
function AccountCard({
  method,
  amountText,
}: {
  method: OfflinePaymentMethod;
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

  return (
    <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-ink-500">
          Pay into this account
        </p>
        <Landmark size={20} className="shrink-0 text-brand-red" />
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        {(method.method_fields ?? []).map((f) => (
          <div
            key={f.input_name}
            className="flex items-center justify-between gap-3"
          >
            <dt className="text-ink-500">{humanise(f.input_name)}</dt>
            <dd className="flex items-center gap-2">
              <span className="font-medium text-ink-900">{f.input_data}</span>
              <button
                type="button"
                onClick={() => copy(f.input_data, f.input_name)}
                aria-label={`Copy ${humanise(f.input_name)}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 text-xs font-medium text-ink-900 hover:bg-ink-50"
              >
                {copied === f.input_name ? (
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
        ))}

        {amountText && (
          <div>
            <dt className="text-ink-500">Amount to send</dt>
            <dd className="mt-1 text-2xl font-semibold text-ink-900">
              {amountText}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/** "account_number" -> "Account number". The backend slugifies these
 *  labels on save (OfflinePaymentMethodController.php:61-82), so this
 *  is the inverse for display only. */
function humanise(slug: string): string {
  const s = slug.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
