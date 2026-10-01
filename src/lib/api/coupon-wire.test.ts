import { beforeEach, describe, expect, it, vi } from "vitest";
import { placeOrder, type PlaceOrderInput } from "./orders";
import { fetchOrderQuote, type OrderQuoteInput } from "./order-quote";
import { applyCoupon } from "./coupon";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ api }));

const line = {
  key: "1",
  itemId: 1,
  storeId: 280,
  name: "Jollof Rice",
  unitPrice: 2500,
  qty: 1,
  selections: [],
  addOns: [],
};

const quoteInput: OrderQuoteInput = {
  storeId: 280,
  moduleId: 2,
  zoneIds: [6],
  lines: [line],
  lat: 12,
  lng: 8.5,
  distance: 3.2,
};

const placeInput: PlaceOrderInput = {
  ...quoteInput,
  address: "Nasarawa GRA, Kano",
  paymentMethod: "digital_payment",
};

function sentBody(): Record<string, unknown> {
  return api.mock.calls[0][1].body as Record<string, unknown>;
}

beforeEach(() => {
  api.mockReset();
});

describe("coupon_code on the wire", () => {
  it("sends the code to the price preview and to placement", async () => {
    api.mockResolvedValue({ ok: true, data: {} });
    await fetchOrderQuote({ ...quoteInput, couponCode: "AREWA" });
    expect(sentBody().coupon_code).toBe("AREWA");

    api.mockReset();
    api.mockResolvedValue({ ok: true, data: { order_id: 1, total_ammount: 2500 } });
    await placeOrder({ ...placeInput, couponCode: "AREWA" });
    expect(sentBody().coupon_code).toBe("AREWA");
  });

  it("leaves the key out entirely when no code is applied", async () => {
    api.mockResolvedValue({ ok: true, data: {} });
    await fetchOrderQuote({ ...quoteInput, couponCode: null });
    expect(sentBody()).not.toHaveProperty("coupon_code");

    api.mockReset();
    api.mockResolvedValue({ ok: true, data: { order_id: 1, total_ammount: 2500 } });
    await placeOrder(placeInput);
    expect(sentBody()).not.toHaveProperty("coupon_code");
  });

  it("flags a refusal caused by the coupon so checkout can drop it", async () => {
    api.mockResolvedValue({
      ok: false,
      status: 403,
      message: "Coupon usage limit is over",
      errors: { coupon: ["Coupon usage limit is over"] },
    });
    expect(await fetchOrderQuote({ ...quoteInput, couponCode: "AREWA" })).toEqual({
      ok: false,
      message: "Coupon usage limit is over",
      couponError: "Coupon usage limit is over",
    });
  });

  it("does not blame the coupon for an unrelated refusal", async () => {
    api.mockResolvedValue({ ok: false, status: 403, message: "Store is closed", errors: { store: ["Store is closed"] } });
    expect(await fetchOrderQuote({ ...quoteInput, couponCode: "AREWA" })).toEqual({
      ok: false,
      message: "Store is closed",
    });
  });
});

describe("applyCoupon", () => {
  it("checks the code against the cart's store with the module header", async () => {
    api.mockResolvedValue({ ok: true, data: { code: "AREWA", coupon_type: "free_delivery", min_purchase: 0 } });
    const res = await applyCoupon({ code: " arewa ", storeId: 280, moduleId: 2, zoneIds: [6] });
    expect(api).toHaveBeenCalledWith(
      "/api/v1/coupon/apply?code=arewa&store_id=280",
      { zoneId: [6], moduleId: 2 },
    );
    expect(res).toEqual({
      ok: true,
      coupon: { code: "AREWA", title: null, couponType: "free_delivery", minPurchase: 0 },
    });
  });

  it("refuses an empty code without calling the server", async () => {
    expect(await applyCoupon({ code: "  ", storeId: 280, moduleId: 2, zoneIds: [6] })).toEqual({
      ok: false,
      message: "Enter a coupon code.",
    });
    expect(api).not.toHaveBeenCalled();
  });

  it("passes the server's reason through", async () => {
    api.mockResolvedValue({ ok: false, status: 404, message: "Invalid coupon code." });
    expect(await applyCoupon({ code: "NOPE", storeId: 280, moduleId: 2, zoneIds: [6] })).toEqual({
      ok: false,
      message: "Invalid coupon code.",
    });
  });
});
