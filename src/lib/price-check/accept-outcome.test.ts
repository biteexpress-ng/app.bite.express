import { describe, expect, it } from "vitest";
import {
  ACCEPT_AMOUNT_UNREADABLE,
  acceptFailureAction,
} from "./accept-outcome";

describe("acceptFailureAction", () => {
  it("marks the quote expired so the screen stops offering payment", () => {
    const action = acceptFailureAction("price_check_quote_expired");
    expect(action.expired).toBe(true);
    expect(action.clearPaymentMethod).toBe(false);
    expect(action.reloadOrder).toBe(false);
  });

  it("tells the customer to keep a line when everything was excluded", () => {
    const action = acceptFailureAction("price_check_no_lines");
    expect(action.hint).not.toBeNull();
    expect(action.reloadOrder).toBe(false);
  });

  it("reloads the order once it has left price_confirmed", () => {
    const action = acceptFailureAction("price_check_already_answered");
    expect(action.reloadOrder).toBe(true);
  });

  it("clears the payment method on the cash ceiling refusal", () => {
    // order_amount arrives on a 203 and means cash cannot carry this
    // total. The same basket goes through on any other method, so the
    // one thing that must change is the method.
    const action = acceptFailureAction("order_amount");
    expect(action.clearPaymentMethod).toBe(true);
    expect(action.expired).toBe(false);
  });

  it("points the below-minimum refusal at the ticks, the only lever this app has", () => {
    // order_time is a 406 and reads like a scheduling code. It is the
    // store minimum. The server's message carries the figure; the hint
    // must offer only what the screen can do, and this app ships without
    // an order-cancel screen.
    const action = acceptFailureAction("order_time");
    expect(action.clearPaymentMethod).toBe(false);
    expect(action.reloadOrder).toBe(false);
    expect(action.expired).toBe(false);
    expect(action.alreadyAccepted).toBe(false);
    expect(action.hint).toContain("Tick more items back on");
    expect(action.hint).not.toContain("cancel");
  });

  it("stops offering accept when the accept itself already landed", () => {
    // A 200 with no readable total. The order is accepted whatever this
    // client makes of the body, so a second accept can only do harm.
    const action = acceptFailureAction(ACCEPT_AMOUNT_UNREADABLE);
    expect(action.alreadyAccepted).toBe(true);
    expect(action.reloadOrder).toBe(true);
  });

  it("falls back to showing the message for an unknown or missing code", () => {
    for (const code of [null, "something_new"]) {
      const action = acceptFailureAction(code);
      expect(action.clearPaymentMethod).toBe(false);
      expect(action.reloadOrder).toBe(false);
      expect(action.expired).toBe(false);
      expect(action.alreadyAccepted).toBe(false);
      expect(action.hint).toBeNull();
    }
  });
});
