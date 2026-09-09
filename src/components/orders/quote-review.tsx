"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  confirmPaystackPayment,
  fetchOrderDetailLines,
  fetchOrderTrack,
  payOnDelivery,
  walletPayOrder,
  type OrderDetailLinesResult,
  type OrderTrack,
  type OrderTrackResult,
} from "@/lib/api/orders";
import { fetchProfile } from "@/lib/api/auth";
import { fetchConfig } from "@/lib/api/config";
import { fetchOfflineMethods } from "@/lib/api/offline-payment";
import { checkZone } from "@/lib/api/zones";
import { acceptQuote } from "@/lib/api/price-check";
import { acceptFailureAction } from "@/lib/price-check/accept-outcome";
import { retryDecision } from "@/lib/price-check/retry-safety";
import {
  clearPendingPayment,
  hasOpenOfflineTransfer,
  paymentAccounting,
  writePendingPayment,
  type PendingQuotePayment,
} from "@/lib/price-check/pending-payment";
import { usePendingPayment } from "@/lib/price-check/use-pending-payment";
import {
  EXPIRED_QUOTE_MESSAGE,
  quoteScreenState,
  reRequestHref,
} from "@/lib/price-check/quote-expiry";
import {
  buildAcceptPayload,
  estimatedQuoteTotal,
  quoteExpiresAt,
  toQuoteLines,
  type QuoteLine,
} from "@/lib/price-check/quote-line";
import {
  canUseOfflinePayment,
  type OfflinePaymentMethod,
} from "@/lib/offline-payment-rules";
import { payWithPaystack } from "@/lib/paystack";
import { useAuth } from "@/lib/auth-store";
import { toast } from "@/lib/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  PaymentPicker,
  type PaymentMethod,
} from "@/components/checkout/payment-picker";
import { QuoteLineRow } from "./quote-line-row";

/** Bank transfer is left out on purpose: it settles by crediting the
 *  wallet later, which would leave an accepted quote unpaid and its
 *  hold ticking. The four here all settle now. */
const QUOTE_PAYMENT_METHODS: PaymentMethod[] = [
  "cash_on_delivery",
  "digital_payment",
  "wallet",
  "offline_payment",
];

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      order: OrderTrack;
      lines: QuoteLine[];
      expiresAt: string | null;
    };

/** Shown after a successful accept when the payment leg did not finish.
 *  The prices are locked in by then, so the customer must be able to pay
 *  again without a second accept. */
type PaymentPending = {
  orderAmount: number;
  /** The method the last attempt used, which seeds the picker. Null when a
   *  stored record names a method this build does not offer. */
  method: PaymentMethod | null;
  problem: string;
  /** False once a read of the order says it is paid, or says nothing we can
   *  trust. Charging again on either would risk a second charge. */
  canRetry: boolean;
};

function naira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString()}`;
}

/** A stored method name is only trusted if this screen still offers it. */
function knownMethod(method: string): PaymentMethod | null {
  return QUOTE_PAYMENT_METHODS.find((m) => m === method) ?? null;
}

/** Why the chosen method cannot be used yet, or null. Shared by the accept
 *  button and the retry panel so a method offered in one is offered in the
 *  other on the same terms. */
function methodBlockedReason(
  method: PaymentMethod | null,
  hasEmail: boolean,
): string | null {
  if (method === null) return "Pick how you'd like to pay to carry on.";
  if (method === "digital_payment" && !hasEmail) {
    return "We need an email on file to charge a card. Add one on the Edit profile page, or pick another way to pay.";
  }
  return null;
}

/** Matches how order dates are shown elsewhere in the app: the browser's
 *  own locale and zone, from the ISO string the server sent. */
function formatDeadline(iso: string): string | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * /orders/[id]/quote.
 *
 * The customer sees what the store quoted, drops what they do not want,
 * picks how to pay, and commits. The commit is `acceptQuote` followed by
 * the payment, in that order and never overlapped, because accept is
 * what fixes the total the gateway is checked against.
 */
export function QuoteReview({ orderId }: { orderId: number }) {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const token = useAuth((s) => s.token);

  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [included, setIncluded] = useState<Set<number>>(new Set());
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{
    message: string;
    hint: string | null;
  } | null>(null);
  const [pending, setPending] = useState<PaymentPending | null>(null);
  /** Set when the accept landed but this client could not carry on from it.
   *  Accepting again is not an option, so the review screen stands down. */
  const [acceptedMessage, setAcceptedMessage] = useState<string | null>(null);
  /** Set when the server refuses the accept as expired. The server's
   *  deadline is the authority, so this outranks the local clock. */
  const [serverExpired, setServerExpired] = useState(false);
  /** The accept and payment this browser has on record for the order, read
   *  back from storage so a reload does not strand an accepted, unpaid
   *  order with no way to pay it. */
  const record = usePendingPayment(orderId);

  const [offlineEnabled, setOfflineEnabled] = useState(false);
  const [offlineMethods, setOfflineMethods] = useState<OfflinePaymentMethod[]>(
    [],
  );
  const [offlineMethodId, setOfflineMethodId] = useState<number | null>(null);

  // State updates are batched, so `busy` alone cannot stop two clicks
  // landing in the same tick. Accept is irreversible and the second one
  // would also pay a second time, so the guard has to be synchronous.
  const runningRef = useRef(false);

  const applyLoad = useCallback(
    (trackRes: OrderTrackResult, linesRes: OrderDetailLinesResult) => {
      if (!trackRes.ok) {
        setLoad({ kind: "error", message: trackRes.message });
        return;
      }
      // An empty list here would read as "the store quoted nothing", which
      // is a different thing from "we could not fetch what they quoted".
      if (!linesRes.ok) {
        setLoad({ kind: "error", message: linesRes.message });
        return;
      }
      const rawLines = linesRes.lines;
      const lines = toQuoteLines(rawLines);
      // Everything the store can supply starts ticked: the customer is
      // here to drop things, not to re-choose the list they already sent.
      setIncluded(
        new Set(lines.filter((l) => l.isAvailable).map((l) => l.detailId)),
      );
      setLoad({
        kind: "ready",
        order: trackRes.order,
        lines,
        expiresAt: quoteExpiresAt(rawLines),
      });
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchOrderTrack(orderId),
      fetchOrderDetailLines(orderId),
    ]).then(([trackRes, linesRes]) => {
      if (cancelled) return;
      applyLoad(trackRes, linesRes);
    });
    return () => {
      cancelled = true;
    };
  }, [orderId, applyLoad]);

  // A read that accounts for the payment retires the record. Leaving it in
  // storage would keep offering to pay an order that is already settled.
  useEffect(() => {
    if (load.kind !== "ready" || record === null) return;
    if (paymentAccounting(record, load.order, new Date()) !== "none") return;
    clearPendingPayment(orderId);
  }, [load, record, orderId]);

  // The wallet hint is only useful if it is current, and a top-up made
  // on /wallet a moment ago will not be in the cached user.
  useEffect(() => {
    if (!token) return;
    fetchProfile().then((res) => {
      if (res.ok) setUser(res.user);
    });
  }, [token, setUser]);

  // Pay Offline passes the same three gates as checkout, read against
  // the address already on the order.
  const address = load.kind === "ready" ? load.order.delivery_address : null;
  const addrLat = address?.latitude;
  const addrLng = address?.longitude;

  useEffect(() => {
    const lat = Number(addrLat);
    const lng = Number(addrLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    let cancelled = false;

    (async () => {
      const [cfg, methodsRes, zoneRes] = await Promise.all([
        fetchConfig(),
        fetchOfflineMethods(),
        checkZone(lat, lng),
      ]);
      if (cancelled) return;

      const methods = methodsRes.ok ? methodsRes.methods : [];
      const enabled = canUseOfflinePayment({
        offlinePaymentStatus: cfg.ok ? cfg.config.offline_payment_status : 0,
        zoneOfflinePayment:
          zoneRes.kind === "in-zone"
            ? zoneRes.zones.some((z) => Boolean(z.offline_payment))
            : false,
        methods,
      });

      setOfflineEnabled(enabled);
      setOfflineMethods(methods);
      setOfflineMethodId(enabled && methods.length > 0 ? methods[0].id : null);
      if (!enabled) {
        setPayment((p) => (p === "offline_payment" ? null : p));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [addrLat, addrLng]);

  function toggleLine(detailId: number) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(detailId)) next.delete(detailId);
      else next.add(detailId);
      return next;
    });
  }

  if (load.kind === "loading") {
    return (
      <div className="flex min-h-[30vh] items-center justify-center gap-2 text-ink-500">
        <Loader2 size={16} className="animate-spin" />
        Loading your quote…
      </div>
    );
  }

  if (load.kind === "error") {
    return <ErrorPanel message={load.message} orderId={orderId} />;
  }

  const { order, lines, expiresAt } = load;
  const storeId = order.store?.id ?? null;

  // The rule this screen exists to keep: the expiry sweep cannot see an
  // open gateway session, so a payment started here can land on an order
  // the sweep has already cancelled, and the server settles it by
  // reopening the quote. Until a read accounts for that payment, nothing
  // on this screen may say the prices expired or the order was cancelled,
  // and nothing may offer to start over. The ordering of that rule against
  // the others lives in quoteScreenState, not here.
  const now = new Date();
  const accounting = paymentAccounting(record, order, now);
  const screen = quoteScreenState({
    order,
    expiresAt,
    now,
    serverSaidExpired: serverExpired,
    record,
  });

  // Hoisted above the status guard on purpose: the accept that produced
  // this message also moves the order on, so the guard would swallow it.
  if (acceptedMessage) {
    return <AcceptedPanel message={acceptedMessage} orderId={orderId} />;
  }

  if (screen === "charged") {
    return <ChargedPanel orderId={orderId} />;
  }

  if (screen === "offline-pending") {
    return <OfflinePendingPanel orderId={orderId} />;
  }

  if (screen === "verifying") {
    return (
      <VerifyingPanel
        orderId={orderId}
        busy={busy}
        onRecheck={() => void reload()}
      />
    );
  }

  // The in-session panel, for a payment leg that has just failed. It comes
  // before the status branches because the accept behind it landed.
  if (pending) {
    return (
      <PaymentPendingPanel
        orderId={orderId}
        pending={pending}
        busy={busy}
        user={user}
        offlineEnabled={offlineEnabled}
        offlineMethods={offlineMethods}
        offlineMethodId={offlineMethodId}
        onOfflineMethodChange={setOfflineMethodId}
        onRetry={(method) => void retryPayment(pending, method)}
      />
    );
  }

  if (screen === "not-priced" || screen === "unavailable") {
    return (
      <ErrorPanel
        message={
          screen === "not-priced"
            ? "The store has not priced this order yet. We will let you know as soon as they do."
            : "This order is no longer waiting on your answer."
        }
        orderId={orderId}
      />
    );
  }

  // The durable half of the pay affordance: an accept this browser made,
  // read back from storage, so a reload between accepting and paying does
  // not strand the customer with an accepted order and no way to pay it.
  if (screen === "owes-payment" && record) {
    const storedPending: PaymentPending = {
      orderAmount: record.orderAmount,
      method: knownMethod(record.method),
      canRetry: true,
      problem: "Your prices are accepted and this order is waiting to be paid.",
    };
    return (
      <PaymentPendingPanel
        orderId={orderId}
        pending={storedPending}
        busy={busy}
        user={user}
        offlineEnabled={offlineEnabled}
        offlineMethods={offlineMethods}
        offlineMethodId={offlineMethodId}
        onOfflineMethodChange={setOfflineMethodId}
        onRetry={(method) => void retryPayment(storedPending, method)}
      />
    );
  }

  if (screen === "expired") {
    return (
      <ExpiredPanel
        orderId={orderId}
        storeId={storeId}
        unconfirmedPayment={accounting === "stale"}
      />
    );
  }

  const availableLines = lines.filter((l) => l.isAvailable);
  const keptCount = availableLines.filter((l) =>
    included.has(l.detailId),
  ).length;
  const hasUnavailable = lines.length > availableLines.length;
  const deadline = expiresAt ? formatDeadline(expiresAt) : null;

  const estimate = estimatedQuoteTotal(lines, included, {
    deliveryCharge: order.delivery_charge ?? 0,
    additionalCharge: order.additional_charge ?? 0,
    extraPackaging: order.extra_packaging_amount ?? 0,
    dmTips: order.dm_tips ?? 0,
  });

  const blockedReason =
    methodBlockedReason(payment, Boolean(user?.email)) ??
    (keptCount === 0 ? "Keep at least one item to carry on." : null);

  async function reload() {
    const [trackRes, linesRes] = await Promise.all([
      fetchOrderTrack(orderId),
      fetchOrderDetailLines(orderId),
    ]);
    applyLoad(trackRes, linesRes);
  }

  /** Notes the payment about to be opened, so a reload, a navigation or a
   *  sweep that cancels the order in the meantime still finds it. */
  function noteAttempt(orderAmount: number, method: PaymentMethod) {
    const next: PendingQuotePayment = {
      orderId,
      orderAmount,
      method,
      startedAt: Date.now(),
      charged: false,
    };
    writePendingPayment(next);
  }

  function settled() {
    clearPendingPayment(orderId);
  }

  /**
   * The payment leg. Charges `orderAmount`, which comes from the accept
   * response and from nowhere else: the gateway is checked against the
   * total accept left on the order, and an amount computed here would be
   * rejected only after the customer had been charged.
   */
  async function settle(orderAmount: number, method: PaymentMethod) {
    noteAttempt(orderAmount, method);

    if (method === "cash_on_delivery") {
      const res = await payOnDelivery(orderId);
      if (!res.ok) {
        setPending({ orderAmount, method, problem: res.message, canRetry: true });
        return;
      }
      settled();
      toast.success("Prices accepted. Pay the rider when your order arrives.");
      router.replace(`/orders/${orderId}`);
      return;
    }

    if (method === "wallet") {
      const res = await walletPayOrder(orderId);
      if (!res.ok) {
        setPending({
          orderAmount,
          method,
          canRetry: true,
          problem:
            res.reason === "insufficient"
              ? `Your wallet balance is below ${naira(orderAmount)}. Top up on the Wallet page, then pay again.`
              : res.message || "Wallet payment failed.",
        });
        return;
      }
      settled();
      toast.success("Paid from your wallet.");
      router.replace(`/orders/${orderId}`);
      return;
    }

    if (method === "offline_payment") {
      // The transfer page carries on from here and the order stays unpaid
      // until an admin matches the money, so the record stays too.
      router.replace(
        `/checkout/offline/${orderId}` +
          (offlineMethodId ? `?method=${offlineMethodId}` : ""),
      );
      return;
    }

    // Card, via the same Paystack inline popup checkout uses. Bank
    // transfer never reaches here: it is not offered on this screen,
    // because it settles later and would leave the quote unpaid.
    const email = user?.email ?? null;
    if (method !== "digital_payment" || !email) {
      setPending({
        orderAmount,
        method,
        canRetry: false,
        problem:
          "We could not open the card payment. Pick another way to pay below.",
      });
      return;
    }

    const pop = await payWithPaystack({
      email,
      amountKobo: Math.round(orderAmount * 100),
      reference: `BE-${orderId}-${Date.now().toString(36)}`,
      metadata: { order_id: orderId },
    });

    if (pop.status !== "success") {
      // Re-read before concluding anything. A closed popup is not proof
      // that no money moved: the bank-transfer and USSD channels close the
      // same way with funds already sent, and the order may have been
      // cancelled by the expiry sweep and settled again behind us.
      const decision = retryDecision(await fetchOrderTrack(orderId));
      if (decision === "paid") {
        settled();
        toast.success("Your payment went through. Nothing more to pay.");
        router.replace(`/orders/${orderId}`);
        return;
      }
      const problem =
        pop.status === "cancelled"
          ? `You closed the payment window before Paystack told us the outcome. Your prices are held at ${naira(orderAmount)}.`
          : pop.message;
      setPending({
        orderAmount,
        method,
        canRetry: decision === "retry",
        problem:
          decision === "unknown"
            ? `${problem} We could not check where your payment stands, so we will not charge again until we can.`
            : problem,
      });
      return;
    }

    const confirmRes = await confirmPaystackPayment(orderId, pop.reference);
    if (!confirmRes.ok) {
      // Paystack captured. Whatever this client failed to do with that
      // answer, offering to pay again would be charging twice, so the
      // record is marked charged and no retry is offered.
      writePendingPayment({
        orderId,
        orderAmount,
        method,
        startedAt: Date.now(),
        charged: true,
      });
      setPending({
        orderAmount,
        method,
        canRetry: false,
        problem: `Paystack charged your card but we couldn't confirm it server-side: ${confirmRes.message}. Ops has been notified and will settle this order.`,
      });
      return;
    }

    settled();
    toast.success("Payment confirmed.");
    router.replace(`/orders/${orderId}`);
  }

  async function handleAccept() {
    if (runningRef.current) return;
    if (payment === null || blockedReason !== null) return;
    const method = payment;
    runningRef.current = true;
    setBusy(true);
    setConfirmOpen(false);
    setFailure(null);

    // Accept runs first and is awaited in full. Nothing below may open a
    // gateway before it returns, because until it does the order still
    // holds the pre-quote total and the customer would be charged an
    // amount the server goes on to reject.
    const result = await acceptQuote(
      buildAcceptPayload(orderId, lines, included, method),
    );

    if (!result.ok) {
      const action = acceptFailureAction(result.code);
      if (action.alreadyAccepted) setAcceptedMessage(result.message);
      else if (!action.expired) {
        setFailure({ message: result.message, hint: action.hint });
      }
      // The server's deadline is the authority. Once it refuses, the whole
      // screen switches to the expired copy rather than leaving an accept
      // button next to a refusal.
      if (action.expired) setServerExpired(true);
      if (action.clearPaymentMethod) setPayment(null);
      if (action.reloadOrder) await reload();
      runningRef.current = false;
      setBusy(false);
      return;
    }

    // Locked for the whole payment leg too. Releasing here would let a
    // second tap send a second accept and a second charge.
    await settle(result.orderAmount, method);
    runningRef.current = false;
    setBusy(false);
  }

  async function retryPayment(p: PaymentPending, method: PaymentMethod) {
    if (runningRef.current) return;
    if (methodBlockedReason(method, Boolean(user?.email)) !== null) return;
    // The screen state already keeps this panel away from an order with a
    // transfer in the post, and this stops a stale render from getting
    // through to a second payment for it.
    if (hasOpenOfflineTransfer(order)) {
      setPending({
        ...p,
        canRetry: false,
        problem:
          "Your bank transfer is still being checked. There is nothing else to pay on this order until it is.",
      });
      return;
    }
    runningRef.current = true;
    setBusy(true);

    // Read the order before charging again. A closed popup is not proof
    // that no money moved, so the order's own payment_status decides,
    // and a read that does not come back decides nothing.
    const decision = retryDecision(await fetchOrderTrack(orderId));

    if (decision === "paid") {
      settled();
      toast.success("Your payment went through. Nothing more to pay.");
      router.replace(`/orders/${orderId}`);
      runningRef.current = false;
      setBusy(false);
      return;
    }

    if (decision === "unknown") {
      setPending({
        ...p,
        canRetry: false,
        problem:
          "We could not check whether your payment went through. Open the order to see where it stands before paying again.",
      });
      runningRef.current = false;
      setBusy(false);
      return;
    }

    // The panel stays up for the retry. Dropping back to the review
    // screen here would show a list that has already been accepted, next
    // to a button offering to accept it again.
    await settle(p.orderAmount, method);
    runningRef.current = false;
    setBusy(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-6">
        <header className="rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
          <p className="text-xs uppercase tracking-wider text-ink-500">
            Order #{order.id}
          </p>
          <h1 className="mt-1 font-serif text-2xl text-ink-900 sm:text-3xl">
            Confirm today&apos;s prices
          </h1>
          <p className="mt-2 text-sm text-ink-600">
            The store has priced your list. Keep what you want and drop the
            rest.
          </p>
          {deadline && (
            <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-ink-50 px-3 py-1.5 text-xs font-medium text-ink-700">
              <Clock size={12} />
              Prices held until {deadline}
            </p>
          )}
        </header>

        {hasUnavailable && (
          <div className="flex items-start gap-2 rounded-2xl border border-warning/30 bg-warning/10 p-4">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-ink-700" />
            <p className="text-sm text-ink-700">
              The store cannot supply some of these items. They are removed
              when you accept.
            </p>
          </div>
        )}

        <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-soft sm:p-6">
          <h2 className="mb-1 text-sm font-medium text-ink-900">Your list</h2>
          <ul className="divide-y divide-ink-200/70">
            {lines.map((line) => (
              <QuoteLineRow
                key={line.detailId}
                line={line}
                included={included.has(line.detailId)}
                onToggle={toggleLine}
              />
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-soft sm:p-6">
          <h2 className="mb-3 text-sm font-medium text-ink-900">
            How you&apos;d like to pay
          </h2>
          <PaymentPicker
            value={payment}
            onChange={setPayment}
            allow={QUOTE_PAYMENT_METHODS}
            walletBalance={user?.wallet_balance ?? null}
            orderTotal={estimate}
            offlineEnabled={offlineEnabled}
            offlineMethods={offlineMethods}
            offlineMethodId={offlineMethodId}
            onOfflineMethodChange={setOfflineMethodId}
          />
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-soft sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-ink-700">Estimated total</span>
            <span className="text-xl font-semibold text-ink-900">
              {naira(estimate)}
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-ink-500">
            This is an estimate that includes tax. Your final total is
            confirmed when you pay, because any discount on your order is
            recalculated on the smaller basket.
          </p>

          {failure && (
            <div className="mt-4 rounded-2xl border border-error/30 bg-error/5 p-4">
              <p className="text-sm text-error">{failure.message}</p>
              {failure.hint && (
                <p className="mt-1 text-xs text-ink-700">{failure.hint}</p>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={busy || blockedReason !== null}
            className="btn-flame mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-pill px-6 text-base font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Accepting…
              </>
            ) : (
              <>
                Accept prices and continue
                <ArrowRight size={16} strokeWidth={2.2} />
              </>
            )}
          </button>
          {blockedReason && (
            <p className="mt-2 text-center text-xs text-ink-500">
              {blockedReason}
            </p>
          )}
          <Link
            href={`/orders/${orderId}`}
            className="mt-3 block text-center text-sm text-ink-600 hover:text-ink-900"
          >
            Back to the order
          </Link>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmOpen}
        title="Accept these prices?"
        body="Items you dropped, and items the store cannot supply, are removed from this order for good. They cannot be added back."
        confirmLabel="Accept prices and continue"
        cancelLabel="Keep looking"
        busy={busy}
        onConfirm={handleAccept}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

/* -------------------------------------------------------------- */

function ErrorPanel({
  message,
  orderId,
}: {
  message: string;
  orderId: number;
}) {
  return (
    <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-soft">
      <p className="text-sm text-ink-700">{message}</p>
      <Link
        href={`/orders/${orderId}`}
        className="mt-4 inline-flex h-11 items-center justify-center rounded-full border border-ink-200 bg-white px-5 text-sm font-medium text-ink-900 hover:bg-ink-50"
      >
        Back to the order
      </Link>
    </div>
  );
}

function AcceptedPanel({
  message,
  orderId,
}: {
  message: string;
  orderId: number;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
      <h1 className="font-serif text-2xl text-ink-900">Prices accepted</h1>
      <p className="mt-2 text-sm text-ink-700">{message}</p>
      <Link
        href={`/orders/${orderId}`}
        className="btn-flame mt-5 inline-flex h-12 items-center justify-center rounded-pill px-6 text-sm font-medium text-white"
      >
        Open the order
      </Link>
    </div>
  );
}

/** Shown while a payment this browser started has not been accounted for.
 *  It deliberately says nothing about expiry or cancellation: the server
 *  settles a capture that lands on a swept order, so any such copy here
 *  could tell a charged customer that nothing was charged. */
function VerifyingPanel({
  orderId,
  busy,
  onRecheck,
}: {
  orderId: number;
  busy: boolean;
  onRecheck: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
      <h1 className="font-serif text-2xl text-ink-900">
        Checking your payment
      </h1>
      <p className="mt-2 text-sm text-ink-700">
        You started a payment for this order, so we are confirming where it
        stands before saying anything else. This usually takes a moment.
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRecheck}
          disabled={busy}
          className="btn-flame inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-pill px-6 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <RefreshCw size={15} />
          )}
          Check again
        </button>
        <Link
          href={`/orders/${orderId}`}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-pill border border-ink-200 bg-white px-6 text-sm font-medium text-ink-900 hover:bg-ink-50"
        >
          Back to the order
        </Link>
      </div>
    </div>
  );
}

/** A gateway told us it captured money for this order. The charge is
 *  stated plainly, not hedged, and nothing here offers to pay or to
 *  request fresh prices: both would duplicate what the customer paid. */
function ChargedPanel({ orderId }: { orderId: number }) {
  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
      <h1 className="font-serif text-2xl text-ink-900">Your card was charged</h1>
      <p className="mt-2 text-sm text-ink-700">
        Paystack captured the payment for order #{orderId}, but we could not
        confirm it from here. Ops has been told and will settle this order.
        Do not pay for it again.
      </p>
      <p className="mt-3 text-sm text-ink-600">
        If you have not heard anything within the hour, contact support with
        order #{orderId}.
      </p>
      <Link
        href={`/orders/${orderId}`}
        className="btn-flame mt-5 inline-flex h-12 items-center justify-center rounded-pill px-6 text-sm font-medium text-white"
      >
        Open the order
      </Link>
    </div>
  );
}

/** The customer has sent a bank transfer that a person still has to match.
 *  Offering another payment here would take a second one for one order. */
function OfflinePendingPanel({ orderId }: { orderId: number }) {
  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
      <h1 className="font-serif text-2xl text-ink-900">
        Your transfer is being checked
      </h1>
      <p className="mt-2 text-sm text-ink-700">
        We check transfers by hand, usually within a few minutes. There is
        nothing else to pay on this order while we do.
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link
          href={`/orders/${orderId}`}
          className="btn-flame inline-flex h-12 flex-1 items-center justify-center rounded-pill px-6 text-sm font-medium text-white"
        >
          Open the order
        </Link>
        <Link
          href={`/checkout/offline/${orderId}`}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-pill border border-ink-200 bg-white px-6 text-sm font-medium text-ink-900 hover:bg-ink-50"
        >
          Edit payment details
        </Link>
      </div>
    </div>
  );
}

/** The hold ran out. There is no endpoint that clones a price request, so
 *  the way back is the store's own page and a fresh list. */
function ExpiredPanel({
  orderId,
  storeId,
  unconfirmedPayment,
}: {
  orderId: number;
  storeId: number | null;
  unconfirmedPayment: boolean;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
      <h1 className="font-serif text-2xl text-ink-900">Prices expired</h1>
      <p className="mt-2 text-sm text-ink-700">{EXPIRED_QUOTE_MESSAGE}</p>
      {unconfirmedPayment && (
        <p className="mt-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-ink-700">
          You started a payment for this order and we have not been able to
          confirm where it ended up. If your bank shows a charge, contact
          support with order #{orderId} before paying anything again.
        </p>
      )}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Link
          href={reRequestHref(storeId)}
          className="btn-flame inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-pill px-6 text-sm font-medium text-white"
        >
          Request again
          <ArrowRight size={15} strokeWidth={2.2} />
        </Link>
        <Link
          href={`/orders/${orderId}`}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-pill border border-ink-200 bg-white px-6 text-sm font-medium text-ink-900 hover:bg-ink-50"
        >
          Back to the order
        </Link>
      </div>
    </div>
  );
}

function PaymentPendingPanel({
  orderId,
  pending,
  busy,
  user,
  offlineEnabled,
  offlineMethods,
  offlineMethodId,
  onOfflineMethodChange,
  onRetry,
}: {
  orderId: number;
  pending: PaymentPending;
  busy: boolean;
  user: { email?: string | null; wallet_balance?: number | null } | null;
  offlineEnabled: boolean;
  offlineMethods: OfflinePaymentMethod[];
  offlineMethodId: number | null;
  onOfflineMethodChange: (id: number | null) => void;
  onRetry: (method: PaymentMethod) => void;
}) {
  // A refusal the same method will refuse again is a dead end, so the
  // customer picks the method for the next attempt.
  const [method, setMethod] = useState<PaymentMethod | null>(pending.method);
  const blocked = methodBlockedReason(method, Boolean(user?.email));

  return (
    <div className="mx-auto max-w-lg rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
      <h1 className="font-serif text-2xl text-ink-900">
        Prices accepted, payment not finished
      </h1>
      <p className="mt-2 text-sm text-ink-700">{pending.problem}</p>
      <p className="mt-3 text-sm text-ink-600">
        Your order is accepted and held at {naira(pending.orderAmount)}. We
        check whether it has already been paid before charging again.
      </p>

      {pending.canRetry && (
        <div className="mt-5">
          <h2 className="mb-3 text-sm font-medium text-ink-900">
            How you&apos;d like to pay
          </h2>
          <PaymentPicker
            value={method}
            onChange={setMethod}
            allow={QUOTE_PAYMENT_METHODS}
            walletBalance={user?.wallet_balance ?? null}
            orderTotal={pending.orderAmount}
            offlineEnabled={offlineEnabled}
            offlineMethods={offlineMethods}
            offlineMethodId={offlineMethodId}
            onOfflineMethodChange={onOfflineMethodChange}
          />
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {pending.canRetry && (
          <button
            type="button"
            onClick={() => method && onRetry(method)}
            disabled={busy || blocked !== null}
            className="btn-flame inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-pill px-6 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            Pay {naira(pending.orderAmount)}
          </button>
        )}
        <Link
          href={`/orders/${orderId}`}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-pill border border-ink-200 bg-white px-6 text-sm font-medium text-ink-900 hover:bg-ink-50"
        >
          Back to the order
        </Link>
      </div>
      {pending.canRetry && blocked && (
        <p className="mt-2 text-center text-xs text-ink-500">{blocked}</p>
      )}
    </div>
  );
}
