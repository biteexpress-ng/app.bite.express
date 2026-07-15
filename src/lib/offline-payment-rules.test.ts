import { describe, expect, it } from "vitest";
import {
  canUseOfflinePayment,
  validateOfflineForm,
  type OfflinePaymentMethod,
} from "@/lib/offline-payment-rules";

const method: OfflinePaymentMethod = {
  id: 1,
  method_name: "Bank Transfer",
  method_fields: [{ input_name: "bank_name", input_data: "GTBank" }],
  method_informations: [
    {
      customer_input: "sender_name",
      customer_placeholder: "Name on the account",
      is_required: 1,
    },
    {
      customer_input: "transaction_reference",
      customer_placeholder: "Reference number",
      is_required: 0,
    },
  ],
  status: 1,
};

describe("canUseOfflinePayment", () => {
  const on = {
    offlinePaymentStatus: 1,
    zoneOfflinePayment: true,
    methods: [method],
  };

  it("allows when the global flag, the zone flag and a method are all present", () => {
    expect(canUseOfflinePayment(on)).toBe(true);
  });

  it("blocks when the global flag is off", () => {
    expect(canUseOfflinePayment({ ...on, offlinePaymentStatus: 0 })).toBe(false);
  });

  it("blocks when the zone flag is off", () => {
    expect(canUseOfflinePayment({ ...on, zoneOfflinePayment: false })).toBe(false);
  });

  it("blocks when there are no methods", () => {
    expect(canUseOfflinePayment({ ...on, methods: [] })).toBe(false);
  });

  // ConfigController.php:1076-1082 returns literal `null`, not [].
  it("blocks when the method list came back as null", () => {
    expect(canUseOfflinePayment({ ...on, methods: null })).toBe(false);
  });

  it("blocks when config could not be read", () => {
    expect(canUseOfflinePayment({ ...on, offlinePaymentStatus: undefined })).toBe(
      false,
    );
  });

  it("accepts the zone flag as a numeric 1", () => {
    expect(canUseOfflinePayment({ ...on, zoneOfflinePayment: 1 })).toBe(true);
  });
});

describe("validateOfflineForm", () => {
  it("passes when required fields are filled", () => {
    expect(validateOfflineForm(method, { sender_name: "Ada" })).toEqual({});
  });

  it("flags a missing required field", () => {
    expect(validateOfflineForm(method, {})).toEqual({
      sender_name: "Name on the account is required.",
    });
  });

  it("treats whitespace as missing", () => {
    expect(validateOfflineForm(method, { sender_name: "   " })).toEqual({
      sender_name: "Name on the account is required.",
    });
  });

  it("ignores optional fields", () => {
    expect(
      validateOfflineForm(method, { sender_name: "Ada", transaction_reference: "" }),
    ).toEqual({});
  });

  it("accepts is_required as the string '1'", () => {
    const m: OfflinePaymentMethod = {
      ...method,
      method_informations: [
        { customer_input: "ref", customer_placeholder: "Ref", is_required: "1" },
      ],
    };
    expect(validateOfflineForm(m, {})).toEqual({ ref: "Ref is required." });
  });

  it("tolerates a method with no informations", () => {
    const m = { ...method, method_informations: [] };
    expect(validateOfflineForm(m, {})).toEqual({});
  });
});
