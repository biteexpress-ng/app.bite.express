import { beforeEach, describe, expect, it, vi } from "vitest";
import { parcelOrderBody, placeParcelOrder, type PlaceParcelOrderInput } from "./orders";

const { api } = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/api-client", () => ({ api }));

const input: PlaceParcelOrderInput = {
  moduleId: 6,
  zoneIds: [3, 4],
  pickup: { text: "12 Allen Avenue, Ikeja", lat: 6.6018, lng: 3.3515, addressType: "Home" },
  sender: {
    name: "Ada Obi",
    phone: "+2348012345678",
    email: "ada@example.test",
    house: "12",
    floor: "",
    road: "Allen Avenue",
  },
  receiverDetails: {
    address: "5 Awolowo Road, Ikoyi",
    latitude: "6.4541",
    longitude: "3.4218",
    zone_id: 4,
    contact_person_name: "Bola Ade",
    contact_person_number: "+2348098765432",
    contact_person_email: "",
    road: "",
    house: "",
    floor: "",
    address_type: "Delivery",
    additional_address: "",
  },
  distance: 18.45,
  parcelCategoryId: 8,
  paymentMethod: "wallet",
  dmTips: 200,
  deliveryInstruction: "Fragile (Call on arrival)",
};

describe("parcelOrderBody", () => {
  it("sends a parcel order with no cart and no store", () => {
    const body = parcelOrderBody(input);
    expect(body.order_type).toBe("parcel");
    expect(body).not.toHaveProperty("cart");
    expect(body).not.toHaveProperty("is_buy_now");
    expect(body).not.toHaveProperty("store_id");
  });

  it("describes the pickup as the order address and the sender as its contact", () => {
    expect(parcelOrderBody(input)).toMatchObject({
      address: "12 Allen Avenue, Ikeja",
      address_type: "Home",
      latitude: "6.6018",
      longitude: "3.3515",
      distance: 18.45,
      contact_person_name: "Ada Obi",
      contact_person_number: "+2348012345678",
      contact_person_email: "ada@example.test",
      house: "12",
      floor: "",
      road: "Allen Avenue",
    });
  });

  it("sends receiver_details as a JSON string with the app's address keys", () => {
    const raw = parcelOrderBody(input).receiver_details;
    expect(typeof raw).toBe("string");
    const parsed = JSON.parse(raw as string) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual([
      "additional_address",
      "address",
      "address_type",
      "contact_person_email",
      "contact_person_name",
      "contact_person_number",
      "floor",
      "house",
      "latitude",
      "longitude",
      "road",
      "zone_id",
    ]);
    expect(parsed.zone_id).toBe(4);
  });

  it("always bills the sender, who pays before the order is attended to", () => {
    expect(parcelOrderBody(input).charge_payer).toBe("sender");
    for (const paymentMethod of ["digital_payment", "wallet", "offline_payment"] as const) {
      expect(parcelOrderBody({ ...input, paymentMethod }).charge_payer).toBe("sender");
    }
  });

  it("carries the category, payment method, tip and instruction", () => {
    expect(parcelOrderBody(input)).toMatchObject({
      parcel_category_id: 8,
      payment_method: "wallet",
      dm_tips: 200,
      delivery_instruction: "Fragile (Call on arrival)",
    });
  });

  it("leaves the email out when the sender has none", () => {
    const body = parcelOrderBody({ ...input, sender: { ...input.sender, email: null } });
    expect(body).not.toHaveProperty("contact_person_email");
  });
});

describe("placeParcelOrder", () => {
  beforeEach(() => {
    api.mockReset();
  });

  it("waits up to 45 seconds for placement", async () => {
    api.mockResolvedValue({ ok: true, data: { order_id: 100231, total_ammount: 1300 } });
    await placeParcelOrder(input);
    expect(api).toHaveBeenCalledWith(
      "/api/v1/customer/order/place",
      expect.objectContaining({ method: "POST", timeoutMs: 45_000 }),
    );
  });

  it("reads a timeout or dropped connection as an unknown outcome, since the order may exist", async () => {
    api.mockResolvedValue({ ok: false, status: 0, message: "signal timed out" });
    expect(await placeParcelOrder(input)).toEqual({
      ok: false,
      code: "unknown_outcome",
      message: "signal timed out",
    });
  });

  it("keeps the backend's own error code on a real refusal", async () => {
    api.mockResolvedValue({
      ok: false,
      status: 403,
      message: "Out of coverage area",
      errors: { zone: ["Out of coverage area"] },
    });
    expect(await placeParcelOrder(input)).toEqual({
      ok: false,
      code: "zone",
      message: "Out of coverage area",
    });
  });
});
