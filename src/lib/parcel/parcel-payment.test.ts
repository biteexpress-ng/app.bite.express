import { describe, expect, it } from "vitest";
import type { OrderQuote } from "@/lib/api/order-quote";
import {
  allowedMethods,
  effectivePayment,
  parcelPlaceErrorMessage,
  parcelQuoteKey,
  placeBlocker,
  walletShortfall,
  type PaymentGates,
} from "./parcel-payment";

function gates(
  over: Partial<Omit<PaymentGates, "zone">> = {},
  zone: Partial<PaymentGates["zone"]> = {},
): PaymentGates {
  return {
    digitalPayment: true,
    offlineUsable: true,
    ...over,
    zone: { digital_payment: 1, offline_payment: 1, ...zone },
  };
}

const quote: OrderQuote = {
  subtotal: 0,
  productDiscount: 0,
  couponDiscount: 0,
  deliveryCharge: 700,
  freeDeliveryBy: null,
  additionalCharge: 100,
  extraPackaging: 0,
  taxAmount: 0,
  taxIncluded: false,
  dmTips: 100,
  total: 900,
};

describe("allowedMethods and effectivePayment", () => {
  it("offers food checkout's methods: Pay Online, wallet, Pay Offline", () => {
    expect(allowedMethods(gates())).toEqual(["digital_payment", "wallet", "offline_payment"]);
  });

  it("drops Pay Online when the zone or config switches it off", () => {
    expect(allowedMethods(gates({}, { digital_payment: 0 }))).toEqual(["wallet", "offline_payment"]);
    expect(allowedMethods(gates({ digitalPayment: false }))).toEqual(["wallet", "offline_payment"]);
  });

  it("drops Pay Offline when it is not usable in the zone", () => {
    expect(allowedMethods(gates({ offlineUsable: false }))).toEqual(["digital_payment", "wallet"]);
  });

  it("always keeps the wallet, so there is always a way to pay", () => {
    expect(allowedMethods(gates({ digitalPayment: false, offlineUsable: false }))).toEqual(["wallet"]);
  });

  it("keeps a valid choice and replaces one that is no longer allowed", () => {
    expect(effectivePayment("wallet", gates())).toBe("wallet");
    expect(effectivePayment("offline_payment", gates({ offlineUsable: false }))).toBe("digital_payment");
    expect(effectivePayment("digital_payment", gates({ digitalPayment: false }))).toBe("wallet");
    expect(effectivePayment(null, gates())).toBe("digital_payment");
  });
});

describe("parcelQuoteKey", () => {
  const inputs = {
    categoryId: 8,
    pickup: { lat: 6.6018, lng: 3.3515 },
    dropoff: { lat: 6.4541, lng: 3.4218 },
    distanceKm: 18.45,
    tip: 0,
  };

  it("is stable for the same inputs", () => {
    expect(parcelQuoteKey(inputs)).toBe(parcelQuoteKey({ ...inputs }));
  });

  it("changes with every input the price depends on", () => {
    const base = parcelQuoteKey(inputs);
    expect(parcelQuoteKey({ ...inputs, tip: 200 })).not.toBe(base);
    expect(parcelQuoteKey({ ...inputs, categoryId: 9 })).not.toBe(base);
    expect(parcelQuoteKey({ ...inputs, distanceKm: 18.5 })).not.toBe(base);
    expect(parcelQuoteKey({ ...inputs, dropoff: { lat: 6.45, lng: 3.42 } })).not.toBe(base);
    expect(parcelQuoteKey({ ...inputs, pickup: { lat: 6.6, lng: 3.35 } })).not.toBe(base);
  });
});

describe("placeBlocker", () => {
  const ready = { kind: "ready" as const, quote };
  const base = {
    stepsValid: true,
    quote: ready,
    payment: "wallet" as const,
    walletBalance: 5000,
    email: "ada@example.test",
  };

  it("blocks until every step is valid", () => {
    expect(placeBlocker({ ...base, stepsValid: false })).toBe("Finish the steps above first.");
  });

  it("blocks while the preview for the current inputs is still loading", () => {
    expect(placeBlocker({ ...base, quote: { kind: "loading" } })).toBe("Working out the price…");
    expect(placeBlocker({ ...base, quote: { kind: "idle" } })).toBe("Working out the price…");
  });

  it("blocks with the preview's own message when it failed", () => {
    expect(placeBlocker({ ...base, quote: { kind: "error", message: "Out of coverage area" } })).toBe(
      "Out of coverage area",
    );
  });

  it("blocks without a payment method", () => {
    expect(placeBlocker({ ...base, payment: null })).toBe("Pick how to pay.");
  });

  it("blocks Pay Online without an email, before any order is created", () => {
    expect(placeBlocker({ ...base, payment: "digital_payment", email: null })).toBe(
      "Add an email on the Edit profile page to pay online, or pick another way to pay.",
    );
    expect(placeBlocker({ ...base, payment: "digital_payment", email: "  " })).toBe(
      "Add an email on the Edit profile page to pay online, or pick another way to pay.",
    );
    expect(placeBlocker({ ...base, payment: "wallet", email: null })).toBeNull();
    expect(placeBlocker({ ...base, payment: "digital_payment" })).toBeNull();
  });

  it("blocks a wallet payment the balance cannot cover", () => {
    expect(placeBlocker({ ...base, walletBalance: 600 })).toBe("Your wallet is ₦300 short of the ₦900 total.");
  });

  it("lets a covered or unknown wallet balance through", () => {
    expect(placeBlocker({ ...base, walletBalance: 900 })).toBeNull();
    expect(placeBlocker({ ...base, walletBalance: null })).toBeNull();
    expect(placeBlocker({ ...base, payment: "offline_payment", walletBalance: 0 })).toBeNull();
  });
});

describe("walletShortfall", () => {
  it("is the gap, never negative, and zero when the balance is unknown", () => {
    expect(walletShortfall(900, 600)).toBe(300);
    expect(walletShortfall(900, 1200)).toBe(0);
    expect(walletShortfall(900, null)).toBe(0);
  });
});

describe("parcelPlaceErrorMessage", () => {
  it("maps the zone codes placement returns", () => {
    expect(parcelPlaceErrorMessage("zone", "Out of coverage area")).toBe(
      "We can't collect parcels from the pickup address any more. Pick another pickup address.",
    );
    expect(parcelPlaceErrorMessage("receiverZone", "Out of coverage")).toBe(
      "We don't deliver to the drop-off address any more. Pick another drop-off.",
    );
  });

  it("reads a 203 order_amount refusal as a short wallet", () => {
    expect(parcelPlaceErrorMessage("order_amount", "Insufficient balance")).toBe(
      "Your wallet balance is too low for this parcel. Top up on the Wallet page, or pay another way.",
    );
  });

  it("falls back to the server message, then to a generic line", () => {
    expect(parcelPlaceErrorMessage(null, "Server said no")).toBe("Server said no");
    expect(parcelPlaceErrorMessage(null, "")).toBe("We couldn't place your parcel. Please try again.");
  });
});
