import { describe, expect, it } from "vitest";
import { toAppConfig } from "./config";

describe("toAppConfig", () => {
  it("reads the payment and tip switches", () => {
    expect(
      toAppConfig({
        offline_payment_status: 1,
        digital_payment: false,
        dm_tips_status: 1,
      }),
    ).toEqual({
      offline_payment_status: 1,
      digital_payment: false,
      dm_tips_status: 1,
    });
  });

  it("treats missing switches as off", () => {
    expect(toAppConfig({})).toEqual({
      offline_payment_status: 0,
      digital_payment: false,
      dm_tips_status: 0,
    });
  });

  it("reads numeric and string forms of the switches", () => {
    expect(
      toAppConfig({
        offline_payment_status: "1",
        digital_payment: "1",
        dm_tips_status: "1",
      }),
    ).toEqual({
      offline_payment_status: 1,
      digital_payment: true,
      dm_tips_status: 1,
    });
  });
});
