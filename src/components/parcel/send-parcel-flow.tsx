"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, MapPin, Package } from "lucide-react";
import { useLocation } from "@/lib/location-store";
import { useAuth } from "@/lib/auth-store";
import { fetchProfile } from "@/lib/api/auth";
import { checkZone, type ZoneCheck } from "@/lib/api/zones";
import { fetchConfig, type AppConfig } from "@/lib/api/config";
import { fetchOfflineMethods } from "@/lib/api/offline-payment";
import {
  fetchParcelCategories,
  fetchParcelInstructions,
  type ParcelCategory,
  type ParcelInstruction,
} from "@/lib/api/parcel";
import { fetchRoadDistanceKm, parcelDistanceKm } from "@/lib/api/directions";
import { fetchParcelQuote, type OrderQuoteResult } from "@/lib/api/order-quote";
import { placeParcelOrder, type PlaceParcelOrderInput } from "@/lib/api/orders";
import {
  canUseOfflinePayment,
  type OfflinePaymentMethod,
} from "@/lib/offline-payment-rules";
import { defaultSettleDeps, settleOrder } from "@/lib/checkout/settle-order";
import { normalizePhone } from "@/lib/phone";
import { toast } from "@/lib/toast";
import {
  EMPTY_CONTACT,
  buildReceiverDetails,
  deliveryInstruction,
  dropoffZoneResult,
  furthestStep,
  hasErrors,
  parcelModuleIn,
  pickupZoneResult,
  validateContact,
  type DropoffZone,
  type ParcelContact,
  type ParcelPoint,
  type PickupZone,
  type StepNumber,
} from "@/lib/parcel/parcel-form";
import {
  allowedMethods,
  effectivePayment,
  parcelPlaceErrorMessage,
  parcelQuoteKey,
  placeBlocker,
  walletShortfall,
  type ParcelPaymentMethod,
  type ParcelQuoteView,
  type PaymentGates,
} from "@/lib/parcel/parcel-payment";
import { NoLocation } from "@/components/browse/no-location";
import { AddressPicker } from "@/components/address/address-picker";
import {
  AddressPickerCheckout,
  toCheckoutFromPicked,
  type CheckoutAddress,
} from "@/components/checkout/address-picker-checkout";
import { PaymentPicker } from "@/components/checkout/payment-picker";
import { ParcelStep } from "./parcel-step";
import { CategoryStep, type CategoryList } from "./category-step";
import { ContactFields } from "./contact-fields";
import { InstructionPicker } from "./instruction-picker";
import { TipPicker } from "./tip-picker";
import { ParcelPriceCard } from "./parcel-price-card";

/**
 * A result tagged with the inputs it was fetched for. When the key no
 * longer matches the current inputs the result is stale and reads as
 * "still loading", so no effect ever has to reset state synchronously.
 */
type Keyed<T> = { key: string; value: T };

/**
 * /send. Three steps: what is being sent, pickup and drop-off, review
 * and pay. Every address is zone-checked when picked; the price comes
 * from the get-Tax preview for the current inputs, and "Place order"
 * stays disabled until that preview has landed.
 */
export function SendParcelFlow() {
  const router = useRouter();
  const hydrateLoc = useLocation((s) => s.hydrate);
  const locHydrated = useLocation((s) => s.hydrated);
  const stored = useLocation((s) => s.location);
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  const [area, setArea] = useState<Keyed<ZoneCheck> | null>(null);
  const [categories, setCategories] = useState<Keyed<CategoryList> | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [offlineMethods, setOfflineMethods] = useState<OfflinePaymentMethod[]>([]);
  const [instructions, setInstructions] = useState<ParcelInstruction[]>([]);

  const [category, setCategory] = useState<ParcelCategory | null>(null);
  const [pickupChoice, setPickupChoice] = useState<CheckoutAddress | null>(null);
  const [senderDraft, setSenderDraft] = useState<Partial<ParcelContact>>({});
  const [dropoff, setDropoff] = useState<ParcelPoint | null>(null);
  const [receiver, setReceiver] = useState<ParcelContact>(EMPTY_CONTACT);
  const [showErrors, setShowErrors] = useState(false);
  const [pickupCheck, setPickupCheck] = useState<Keyed<PickupZone> | null>(null);
  const [dropCheck, setDropCheck] = useState<Keyed<DropoffZone> | null>(null);
  const [road, setRoad] = useState<Keyed<number | null> | null>(null);

  const [instructionId, setInstructionId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [paymentChoice, setPaymentChoice] = useState<ParcelPaymentMethod | null>(null);
  const [offlineMethodId, setOfflineMethodId] = useState<number | null>(null);
  const [tip, setTip] = useState(0);
  const [quote, setQuote] = useState<Keyed<OrderQuoteResult> | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [openStep, setOpenStep] = useState<StepNumber>(1);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    hydrateLoc();
  }, [hydrateLoc]);

  // Fresh wallet balance, as checkout does.
  useEffect(() => {
    if (!token) return;
    fetchProfile().then((res) => {
      if (res.ok) setUser(res.user);
    });
  }, [token, setUser]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchConfig(), fetchOfflineMethods(), fetchParcelInstructions()]).then(
      ([cfg, methods, instr]) => {
        if (cancelled) return;
        setConfig(cfg.ok ? cfg.config : null);
        setOfflineMethods(methods.ok ? methods.methods : []);
        setInstructions(instr.ok ? instr.instructions : []);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Which parcel module the customer's current location offers.
  const storedLat = stored?.lat;
  const storedLng = stored?.lng;
  const areaKey = stored ? `${stored.lat},${stored.lng}` : null;
  useEffect(() => {
    if (storedLat === undefined || storedLng === undefined) return;
    let cancelled = false;
    const key = `${storedLat},${storedLng}`;
    checkZone(storedLat, storedLng).then((check) => {
      if (!cancelled) setArea({ key, value: check });
    });
    return () => {
      cancelled = true;
    };
  }, [storedLat, storedLng]);
  const areaCheck = area && area.key === areaKey ? area.value : null;
  const parcelModule = areaCheck?.kind === "in-zone" ? parcelModuleIn(areaCheck.zones) : null;
  const moduleId = parcelModule?.moduleId ?? null;

  useEffect(() => {
    if (moduleId === null) return;
    let cancelled = false;
    fetchParcelCategories(moduleId).then((res) => {
      if (cancelled) return;
      setCategories({
        key: String(moduleId),
        value: res.ok
          ? { kind: "ready", categories: res.categories }
          : { kind: "error", message: res.message },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [moduleId]);
  const categoryList: CategoryList =
    categories && categories.key === String(moduleId) ? categories.value : { kind: "loading" };

  // Pickup: the current delivery location until the customer picks a
  // saved address. Contact from the profile until they edit it.
  const pickupAddress: CheckoutAddress | null =
    pickupChoice ?? (stored ? toCheckoutFromPicked(stored) : null);
  const pickup: ParcelPoint | null = pickupAddress
    ? {
        text: pickupAddress.text,
        lat: pickupAddress.lat,
        lng: pickupAddress.lng,
        addressType: pickupAddress.addressType,
      }
    : null;
  const profileName = user ? [user.f_name, user.l_name].filter(Boolean).join(" ") : "";
  const sender: ParcelContact = {
    ...EMPTY_CONTACT,
    name: profileName,
    phone: user?.phone ?? "",
    ...senderDraft,
  };

  const pickupLat = pickup?.lat;
  const pickupLng = pickup?.lng;
  const pickupKey = pickup && moduleId !== null ? `${pickup.lat},${pickup.lng}|${moduleId}` : null;
  useEffect(() => {
    if (pickupLat === undefined || pickupLng === undefined || moduleId === null) return;
    let cancelled = false;
    const key = `${pickupLat},${pickupLng}|${moduleId}`;
    checkZone(pickupLat, pickupLng).then((check) => {
      if (!cancelled) setPickupCheck({ key, value: pickupZoneResult(check, moduleId) });
    });
    return () => {
      cancelled = true;
    };
  }, [pickupLat, pickupLng, moduleId]);
  const pickupZone = pickupCheck && pickupCheck.key === pickupKey ? pickupCheck.value : null;

  const dropLat = dropoff?.lat;
  const dropLng = dropoff?.lng;
  const dropKey = dropoff ? `${dropoff.lat},${dropoff.lng}` : null;
  useEffect(() => {
    if (dropLat === undefined || dropLng === undefined) return;
    let cancelled = false;
    const key = `${dropLat},${dropLng}`;
    checkZone(dropLat, dropLng).then((check) => {
      if (!cancelled) setDropCheck({ key, value: dropoffZoneResult(check) });
    });
    return () => {
      cancelled = true;
    };
  }, [dropLat, dropLng]);
  const dropZone = dropCheck && dropCheck.key === dropKey ? dropCheck.value : null;

  // Road distance for the leg, asked for only once both ends are served
  // (the proxy is a paid Google call). Straight line when it fails.
  const legReady = pickupZone?.ok === true && dropZone?.ok === true;
  const legKey = pickup && dropoff ? `${pickup.lat},${pickup.lng}>${dropoff.lat},${dropoff.lng}` : null;
  useEffect(() => {
    if (!legReady) return;
    if (pickupLat === undefined || pickupLng === undefined) return;
    if (dropLat === undefined || dropLng === undefined) return;
    let cancelled = false;
    const key = `${pickupLat},${pickupLng}>${dropLat},${dropLng}`;
    fetchRoadDistanceKm({ lat: pickupLat, lng: pickupLng }, { lat: dropLat, lng: dropLng }).then(
      (km) => {
        if (!cancelled) setRoad({ key, value: km });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [legReady, pickupLat, pickupLng, dropLat, dropLng]);
  const distance =
    pickup && dropoff && road && road.key === legKey
      ? parcelDistanceKm(road.value, pickup, dropoff)
      : null;

  const senderErrors = validateContact(pickup, sender);
  const receiverErrors = validateContact(dropoff, receiver);
  const addressesValid =
    !hasErrors(senderErrors) && !hasErrors(receiverErrors) && legReady;
  const maxStep = furthestStep(category !== null, addressesValid);
  const currentStep: StepNumber = openStep <= maxStep ? openStep : maxStep;

  const gates: PaymentGates | null =
    pickupZone && pickupZone.ok
      ? {
          // A config hiccup must not hide the main way to pay; the
          // backend still enforces the switch.
          digitalPayment: config?.digital_payment ?? true,
          zone: pickupZone.zone,
          offlineUsable: canUseOfflinePayment({
            offlinePaymentStatus: config?.offline_payment_status ?? 0,
            zoneOfflinePayment: pickupZone.zone.offline_payment,
            methods: offlineMethods,
          }),
        }
      : null;
  // The sender always pays, up front: Pay Online, wallet or Pay Offline.
  const payment: ParcelPaymentMethod | null = gates
    ? effectivePayment(paymentChoice, gates)
    : null;
  const methods: ParcelPaymentMethod[] = gates ? allowedMethods(gates) : [];
  const email = user?.email ?? null;
  // Placement drops the tip when tips are off; the preview would not.
  const tipsEnabled = config?.dm_tips_status === 1;
  const effectiveTip = tipsEnabled ? tip : 0;
  const chosenOfflineMethodId = offlineMethodId ?? offlineMethods[0]?.id ?? null;
  const instructionText = instructions.find((i) => i.id === instructionId)?.instruction ?? null;

  const orderInput: PlaceParcelOrderInput | null =
    category &&
    pickup &&
    dropoff &&
    pickupZone &&
    pickupZone.ok &&
    dropZone &&
    dropZone.ok &&
    moduleId !== null &&
    distance !== null &&
    payment !== null &&
    addressesValid
      ? {
          moduleId,
          zoneIds: pickupZone.zoneIds,
          pickup,
          sender: {
            name: sender.name.trim(),
            phone: normalizePhone(sender.phone) ?? sender.phone.trim(),
            email,
            house: sender.house.trim(),
            floor: sender.floor.trim(),
            road: sender.road.trim(),
          },
          receiverDetails: buildReceiverDetails(dropoff, receiver, dropZone.zoneId),
          distance,
          parcelCategoryId: category.id,
          paymentMethod: payment,
          dmTips: effectiveTip,
          deliveryInstruction: deliveryInstruction(instructionText, note),
        }
      : null;

  const quoteKey =
    orderInput && dropoff
      ? `${parcelQuoteKey({
          categoryId: orderInput.parcelCategoryId,
          pickup: orderInput.pickup,
          dropoff,
          distanceKm: orderInput.distance,
          tip: effectiveTip,
        })}#${retryNonce}`
      : null;

  useEffect(() => {
    if (!quoteKey || !orderInput) return;
    let cancelled = false;
    const key = quoteKey;
    fetchParcelQuote(orderInput).then((res) => {
      if (!cancelled) setQuote({ key, value: res });
    });
    return () => {
      cancelled = true;
    };
    // The key carries every input the price depends on. orderInput is a
    // fresh object each render and would refetch on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  const quoteView: ParcelQuoteView = !quoteKey
    ? { kind: "idle" }
    : !quote || quote.key !== quoteKey
      ? { kind: "loading" }
      : quote.value.ok
        ? { kind: "ready", quote: quote.value.quote }
        : { kind: "error", message: quote.value.message };

  const walletBalance = user?.wallet_balance ?? null;
  const blocker = placeBlocker({
    stepsValid: orderInput !== null,
    quote: quoteView,
    payment,
    walletBalance,
    email,
  });
  const shortfall =
    payment === "wallet" && quoteView.kind === "ready"
      ? walletShortfall(quoteView.quote.total, walletBalance)
      : 0;

  function chooseCategory(c: ParcelCategory) {
    setCategory(c);
    setOpenStep(2);
  }

  function choosePickup(a: CheckoutAddress) {
    setPickupChoice(a);
    setSenderDraft((d) => ({
      ...d,
      ...(a.contactPersonName ? { name: a.contactPersonName } : {}),
      ...(a.contactPersonNumber ? { phone: a.contactPersonNumber } : {}),
    }));
  }

  function continueToReview() {
    setShowErrors(true);
    if (addressesValid) setOpenStep(3);
  }

  async function handlePlace() {
    // placeBlocker already refuses Pay Online without an email, so no
    // order is created that could never be charged.
    if (!orderInput || blocker !== null || placing) return;

    setPlacing(true);
    const res = await placeParcelOrder(orderInput);
    if (!res.ok) {
      setPlacing(false);
      toast.error(parcelPlaceErrorMessage(res.code, res.message));
      return;
    }

    const outcome = await settleOrder(
      {
        orderId: res.orderId,
        amount: res.amount,
        method: orderInput.paymentMethod,
        successHref: `/orders/${res.orderId}`,
        email,
        offlineMethodId: chosenOfflineMethodId,
      },
      defaultSettleDeps,
    );
    if (outcome.kind === "navigate") {
      if (outcome.error) toast.error(outcome.error);
      router.replace(outcome.href);
      return;
    }
    setPlacing(false);
    if (outcome.tone === "warn") toast.warn(outcome.message);
    else toast.error(outcome.message);
  }

  if (!locHydrated) return <CenterSpinner label="Loading…" />;
  if (!stored || !stored.zoneCheck) return <NoLocation reason="no-pick" />;
  if (stored.zoneCheck.status === "out-of-zone") return <NoLocation reason="out-of-zone" />;
  if (stored.zoneCheck.status === "temp-unavailable") return <NoLocation reason="temp-unavailable" />;
  if (!areaCheck) return <CenterSpinner label="Checking your area…" />;
  if (areaCheck.kind === "error" || areaCheck.kind === "skipped") return <AreaError />;
  if (moduleId === null) return <NotAvailable />;

  const stepTwoSummary = pickup && dropoff ? `${pickup.text} to ${dropoff.text}` : null;

  return (
    <div className="fade-up grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-4">
        <ParcelStep
          step={1}
          title="What you're sending"
          summary={category?.name ?? null}
          open={currentStep === 1}
          done={category !== null}
          locked={false}
          onOpen={() => setOpenStep(1)}
        >
          <CategoryStep
            list={categoryList}
            selectedId={category?.id ?? null}
            onSelect={chooseCategory}
          />
        </ParcelStep>

        <ParcelStep
          step={2}
          title="Pickup and drop-off"
          summary={stepTwoSummary}
          open={currentStep === 2}
          done={addressesValid}
          locked={maxStep < 2}
          onOpen={() => setOpenStep(2)}
        >
          <div className="space-y-8">
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
                <MapPin size={14} />
                Pickup
              </h3>
              <AddressPickerCheckout picked={stored} value={pickupAddress} onChange={choosePickup} />
              <ZoneNote
                checking={pickupKey !== null && pickupZone === null}
                error={pickupZone && !pickupZone.ok ? pickupZone.message : null}
              />
              <div className="mt-4">
                <ContactFields
                  idPrefix="sender"
                  value={sender}
                  onChange={setSenderDraft}
                  errors={showErrors ? senderErrors : {}}
                  showEmail={false}
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
                <Package size={14} />
                Drop-off
              </h3>
              <AddressPicker
                variant="light"
                persistToStore={false}
                onPick={(loc) =>
                  setDropoff({
                    text: loc.formattedAddress,
                    lat: loc.lat,
                    lng: loc.lng,
                    addressType: "Delivery",
                  })
                }
              />
              {dropoff && <p className="mt-2 text-sm text-ink-600">{dropoff.text}</p>}
              {showErrors && receiverErrors.address && (
                <p role="alert" className="mt-2 text-sm text-error">
                  {receiverErrors.address}
                </p>
              )}
              <ZoneNote
                checking={dropKey !== null && dropZone === null}
                error={dropZone && !dropZone.ok ? dropZone.message : null}
              />
              <div className="mt-4">
                <ContactFields
                  idPrefix="receiver"
                  value={receiver}
                  onChange={setReceiver}
                  errors={showErrors ? receiverErrors : {}}
                  showEmail
                />
              </div>
            </div>

            <button
              type="button"
              onClick={continueToReview}
              className="btn-flame inline-flex h-12 items-center justify-center gap-2 rounded-pill px-6 text-sm font-medium text-white"
            >
              Continue
              <ArrowRight size={15} strokeWidth={2.2} />
            </button>
          </div>
        </ParcelStep>

        <ParcelStep
          step={3}
          title="Review and pay"
          open={currentStep === 3}
          done={false}
          locked={maxStep < 3}
          onOpen={() => setOpenStep(3)}
        >
          <div className="space-y-8">
            <Block title="Instructions for the rider">
              <InstructionPicker
                instructions={instructions}
                selectedId={instructionId}
                onSelect={setInstructionId}
                note={note}
                onNoteChange={setNote}
              />
            </Block>
            <Block title="Payment">
              <p className="mb-3 text-sm text-ink-500">
                You pay now, before a rider is sent.
              </p>
              <PaymentPicker
                value={payment}
                onChange={setPaymentChoice}
                allow={methods}
                walletBalance={walletBalance}
                orderTotal={quoteView.kind === "ready" ? quoteView.quote.total : null}
                offlineEnabled={methods.includes("offline_payment")}
                offlineMethods={offlineMethods}
                offlineMethodId={chosenOfflineMethodId}
                onOfflineMethodChange={setOfflineMethodId}
              />
            </Block>
            {tipsEnabled && (
              <Block title="Tip your rider">
                <TipPicker value={tip} onChange={setTip} />
              </Block>
            )}
          </div>
        </ParcelStep>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <ParcelPriceCard quote={quoteView} onRetry={() => setRetryNonce((n) => n + 1)} />
        <button
          type="button"
          onClick={handlePlace}
          disabled={placing || blocker !== null}
          className="btn-flame inline-flex h-14 w-full items-center justify-center gap-2 rounded-pill px-7 text-base font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {placing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Placing your parcel…
            </>
          ) : (
            <>
              <Package size={16} />
              Place order
              <ArrowRight size={16} strokeWidth={2.2} />
            </>
          )}
        </button>
        {!placing && blocker && (
          <p className="text-center text-xs leading-relaxed text-ink-500">{blocker}</p>
        )}
        {shortfall > 0 && (
          <div className="rounded-2xl border border-error/30 bg-error/5 p-4 text-sm leading-relaxed text-ink-700">
            Top up on the{" "}
            <Link href="/wallet" className="font-medium text-brand-red underline">
              Wallet page
            </Link>
            , or pick another way to pay.
          </div>
        )}
      </aside>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-ink-900">{title}</h3>
      {children}
    </div>
  );
}

function ZoneNote({ checking, error }: { checking: boolean; error: string | null }) {
  if (checking) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
        <Loader2 size={12} className="animate-spin" />
        Checking this address…
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="mt-2 text-sm text-error">
        {error}
      </p>
    );
  }
  return null;
}

function NotAvailable() {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-ink-200 bg-white p-8 text-center shadow-soft">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-600">
        <Package size={20} strokeWidth={1.8} />
      </div>
      <h2 className="mt-4 font-serif text-2xl text-ink-900">
        Parcel delivery isn&apos;t available in your area yet
      </h2>
      <p className="mt-2 text-sm text-ink-600">You can still order from shops near you.</p>
      <Link
        href="/browse"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-brand-red px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-red-600"
      >
        Browse shops
      </Link>
    </div>
  );
}

function AreaError() {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-ink-200 bg-white p-8 text-center shadow-soft">
      <h2 className="font-serif text-2xl text-ink-900">We couldn&apos;t check your area</h2>
      <p className="mt-2 text-sm text-ink-600">Refresh the page to try again.</p>
    </div>
  );
}

function CenterSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[30vh] items-center justify-center gap-2 text-ink-500">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}
