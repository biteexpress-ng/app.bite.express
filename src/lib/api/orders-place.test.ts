import { beforeEach, describe, expect, it, vi } from "vitest";
import { placeOrder, type PlaceOrderInput } from "./orders";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ api }));

const input: PlaceOrderInput = {
  storeId: 280,
  moduleId: 1,
  zoneIds: [1],
  lines: [
    {
      key: "1",
      itemId: 1,
      storeId: 280,
      name: "Jollof Rice",
      unitPrice: 2500,
      qty: 1,
      selections: [],
      addOns: [],
    },
  ],
  lat: 6.45,
  lng: 3.39,
  distance: 3.2,
  address: "12 Allen Avenue, Ikeja",
  paymentMethod: "wallet",
  orderType: "delivery",
};

describe("placeOrder", () => {
  beforeEach(() => {
    api.mockReset();
  });

  it("waits up to 45 seconds for placement", async () => {
    api.mockResolvedValue({ ok: true, data: { order_id: 100231, total_ammount: 2900 } });
    expect(await placeOrder(input)).toEqual({ ok: true, orderId: 100231, amount: 2900 });
    expect(api).toHaveBeenCalledWith(
      "/api/v1/customer/order/place",
      expect.objectContaining({ method: "POST", timeoutMs: 45_000 }),
    );
  });

  it("reads a timeout or dropped connection as an unknown outcome, since the order may exist", async () => {
    api.mockResolvedValue({ ok: false, status: 0, message: "signal timed out" });
    expect(await placeOrder(input)).toStrictEqual({
      ok: false,
      code: "unknown_outcome",
      message: "signal timed out",
    });
  });

  it("keeps a real refusal exactly as before, with no code", async () => {
    api.mockResolvedValue({
      ok: false,
      status: 203,
      message: "Insufficient balance",
      errors: { order_amount: ["Insufficient balance"] },
    });
    expect(await placeOrder(input)).toStrictEqual({
      ok: false,
      message: "Insufficient balance",
    });
  });

  it("keeps the unconfigured backend message", async () => {
    api.mockResolvedValue({ ok: false, skipped: true, reason: "no base url" });
    expect(await placeOrder(input)).toStrictEqual({
      ok: false,
      message: "Backend not configured.",
    });
  });
});
