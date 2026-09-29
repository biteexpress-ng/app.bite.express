import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendPriceRequest } from "./price-check";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ api }));

const input: Parameters<typeof sendPriceRequest>[0] = {
  storeId: 280,
  moduleId: 1,
  zoneIds: [1],
  lines: [
    {
      key: "1",
      itemId: 1,
      storeId: 280,
      name: "Tomatoes (basket)",
      unitPrice: 18000,
      qty: 1,
      selections: [],
      addOns: [],
    },
  ],
  lat: 10.52,
  lng: 7.44,
  distance: 4.1,
  address: "3 Ahmadu Bello Way, Kaduna",
  orderType: "delivery",
  itemNotes: {},
};

describe("sendPriceRequest", () => {
  beforeEach(() => {
    api.mockReset();
  });

  it("waits as long as placement does, since the store is notified on success", async () => {
    api.mockResolvedValue({ ok: true, data: { order_id: 100400, total_ammount: 18900 } });
    expect(await sendPriceRequest(input)).toEqual({
      ok: true,
      orderId: 100400,
      requestedAmount: 18900,
    });
    expect(api).toHaveBeenCalledWith(
      "/api/v1/customer/order/price-check",
      expect.objectContaining({ method: "POST", timeoutMs: 45_000 }),
    );
  });

  it("reads a timeout or dropped connection as an unknown outcome, since the request may have landed", async () => {
    api.mockResolvedValue({ ok: false, status: 0, message: "The server took too long to answer." });
    expect(await sendPriceRequest(input)).toStrictEqual({
      ok: false,
      code: "unknown_outcome",
      message: "The server took too long to answer.",
    });
  });

  it("keeps a real refusal as a plain error with no code", async () => {
    api.mockResolvedValue({ ok: false, status: 403, message: "The store is closed right now." });
    expect(await sendPriceRequest(input)).toStrictEqual({
      ok: false,
      message: "The store is closed right now.",
    });
  });
});
