import { describe, expect, it, vi } from "vitest";
import {
  CONFIRM_ATTEMPTS,
  settleOrder,
  type SettleDeps,
  type SettleInput,
} from "./settle-order";

const NOW = 1_700_000_000_000;

function deps(over: Partial<SettleDeps> = {}): SettleDeps {
  return {
    payWithPaystack: vi.fn(async () => ({ status: "success" as const, reference: "BE-77-ref" })),
    confirmPaystackPayment: vi.fn(async () => ({ ok: true as const })),
    walletPayOrder: vi.fn(async () => ({ ok: true as const })),
    sleep: vi.fn(async () => {}),
    now: () => NOW,
    ...over,
  };
}

const base: SettleInput = {
  orderId: 77,
  amount: 1300.5,
  method: "digital_payment",
  successHref: "/checkout/success?order_id=77",
  email: "ada@example.test",
  offlineMethodId: null,
};

describe("settleOrder: offline payment", () => {
  it("sends the customer to the transfer form with the chosen bank", async () => {
    const d = deps();
    expect(await settleOrder({ ...base, method: "offline_payment", offlineMethodId: 3 }, d)).toEqual({
      kind: "navigate",
      href: "/checkout/offline/77?method=3",
    });
    expect(d.payWithPaystack).not.toHaveBeenCalled();
    expect(d.walletPayOrder).not.toHaveBeenCalled();
  });

  it("omits the bank when none was chosen", async () => {
    expect(await settleOrder({ ...base, method: "offline_payment" }, deps())).toEqual({
      kind: "navigate",
      href: "/checkout/offline/77",
    });
  });
});

describe("settleOrder: wallet", () => {
  it("lands on the success target once the wallet is charged", async () => {
    const d = deps();
    expect(await settleOrder({ ...base, method: "wallet" }, d)).toEqual({
      kind: "navigate",
      href: "/checkout/success?order_id=77",
    });
    expect(d.walletPayOrder).toHaveBeenCalledWith(77);
  });

  it("stays with a top-up warning when the balance is short", async () => {
    const d = deps({
      walletPayOrder: vi.fn(async () => ({ ok: false as const, reason: "insufficient" as const, message: "Insufficient balance" })),
    });
    expect(await settleOrder({ ...base, method: "wallet" }, d)).toEqual({
      kind: "stay",
      tone: "warn",
      message: "Wallet balance is too low. Top up via your DVA on the Wallet page, then re-place the order.",
    });
  });

  it("stays with the server's error otherwise", async () => {
    const d = deps({
      walletPayOrder: vi.fn(async () => ({ ok: false as const, reason: "other" as const, message: "" })),
    });
    expect(await settleOrder({ ...base, method: "wallet" }, d)).toEqual({
      kind: "stay",
      tone: "error",
      message: "Wallet payment failed.",
    });
  });
});

describe("settleOrder: Paystack", () => {
  it("needs an email before opening the popup", async () => {
    const d = deps();
    expect(await settleOrder({ ...base, email: null }, d)).toEqual({
      kind: "stay",
      tone: "warn",
      message: "We need an email on file to charge a card. Add one on the Edit profile page and try again.",
    });
    expect(d.payWithPaystack).not.toHaveBeenCalled();
  });

  it("charges the server total in kobo and lands on the success target", async () => {
    const d = deps();
    expect(await settleOrder(base, d)).toEqual({ kind: "navigate", href: "/checkout/success?order_id=77" });
    expect(d.payWithPaystack).toHaveBeenCalledWith({
      email: "ada@example.test",
      amountKobo: 130050,
      reference: `BE-77-${NOW.toString(36)}`,
      metadata: { order_id: 77 },
    });
    expect(d.confirmPaystackPayment).toHaveBeenCalledWith(77, "BE-77-ref");
  });

  it("stays when the customer closes the popup", async () => {
    const d = deps({ payWithPaystack: vi.fn(async () => ({ status: "cancelled" as const })) });
    expect(await settleOrder(base, d)).toEqual({
      kind: "stay",
      tone: "warn",
      message: "Payment cancelled. Order #77 is on hold. Re-place it when you're ready.",
    });
    expect(d.confirmPaystackPayment).not.toHaveBeenCalled();
  });

  it("stays with the popup's error", async () => {
    const d = deps({ payWithPaystack: vi.fn(async () => ({ status: "error" as const, message: "Paystack script not loaded" })) });
    expect(await settleOrder(base, d)).toEqual({ kind: "stay", tone: "error", message: "Paystack script not loaded" });
  });

  it("retries the confirm with a growing pause and succeeds", async () => {
    const confirm = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, message: "Network down" })
      .mockResolvedValueOnce({ ok: false, message: "Network down" })
      .mockResolvedValue({ ok: true });
    const d = deps({ confirmPaystackPayment: confirm });
    expect(await settleOrder(base, d)).toEqual({ kind: "navigate", href: "/checkout/success?order_id=77" });
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(d.sleep).toHaveBeenNthCalledWith(1, 1500);
    expect(d.sleep).toHaveBeenNthCalledWith(2, 3000);
  });

  it("sends a captured but unconfirmed payment to the order page, never back to pay again", async () => {
    const confirm = vi.fn().mockResolvedValue({ ok: false, message: "Network down" });
    const d = deps({ confirmPaystackPayment: confirm });
    expect(await settleOrder(base, d)).toEqual({
      kind: "navigate",
      href: "/orders/77",
      error: "We received your payment but couldn't activate order #77 yet. Please don't pay again; contact support with reference BE-77-ref.",
    });
    expect(confirm).toHaveBeenCalledTimes(CONFIRM_ATTEMPTS);
  });
});
