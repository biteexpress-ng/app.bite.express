import { describe, expect, it } from "vitest";
import { isRefusalBody, networkErrorMessage, parseErrorBody } from "@/lib/api-client";

describe("isRefusalBody", () => {
  it("treats a 203 carrying a Laravel errors array as a refusal", () => {
    expect(
      isRefusalBody(203, {
        errors: [{ code: "order_amount", message: "Amount crossed maximum cod order amount" }],
      }),
    ).toBe(true);
  });

  it("treats a 203 carrying a bare errors string as a refusal", () => {
    expect(isRefusalBody(203, { errors: "Unauthorized" })).toBe(true);
  });

  it("does not treat a 200 with an errors key as a refusal", () => {
    // Only the 2xx codes the backend actually uses for refusals are
    // reinterpreted. Widening this to every 2xx would let an unrelated
    // endpoint that echoes an empty errors array break its own callers.
    expect(isRefusalBody(200, { errors: [{ code: "x", message: "y" }] })).toBe(false);
  });

  it("does not treat a 203 without a usable error as a refusal", () => {
    expect(isRefusalBody(203, { message: "Prices accepted. You can pay now." })).toBe(false);
    expect(isRefusalBody(203, {})).toBe(false);
    expect(isRefusalBody(203, { errors: [] })).toBe(false);
  });

  it("reads the refusal message through the existing parser", () => {
    const parsed = parseErrorBody({
      errors: [{ code: "order_amount", message: "Amount crossed maximum cod order amount" }],
    });
    expect(parsed.message).toBe("Amount crossed maximum cod order amount");
    expect(parsed.errors).toEqual({ order_amount: ["Amount crossed maximum cod order amount"] });
  });
});

describe("parseErrorBody", () => {
  it("reads Laravel error_processor arrays into message and errors", () => {
    const r = parseErrorBody({
      errors: [{ code: "order_id", message: "The order id field is required." }],
    });
    expect(r.message).toBe("The order id field is required.");
    expect(r.errors).toEqual({
      order_id: ["The order id field is required."],
    });
  });

  it("reads a bare-string errors body from the auth middleware", () => {
    const r = parseErrorBody({ errors: "Unauthorized" });
    expect(r.message).toBe("Unauthorized");
  });

  it("reads Laravel's default validation map", () => {
    const r = parseErrorBody({ errors: { phone: ["The phone field is required."] } });
    expect(r.message).toBe("The phone field is required.");
    expect(r.errors).toEqual({ phone: ["The phone field is required."] });
  });

  it("falls back to a top-level message", () => {
    const r = parseErrorBody({ message: "Server exploded" });
    expect(r.message).toBe("Server exploded");
  });

  // The new branch. OrderController.php:470-540 returns
  // 403 {"payment": "<exception message>"} with no `errors` key at all.
  it("reads the offline-payment {payment: string} exception body", () => {
    const r = parseErrorBody({ payment: "Offline payment is not available." });
    expect(r.message).toBe("Offline payment is not available.");
  });

  it("prefers a specific errors message over the payment key", () => {
    const r = parseErrorBody({
      errors: [{ code: "offline_payment_status", message: "Not available right now." }],
      payment: "generic",
    });
    expect(r.message).toBe("Not available right now.");
  });

  it("returns an empty message when the body carries nothing usable", () => {
    expect(parseErrorBody({}).message).toBe("");
  });
});

describe("networkErrorMessage", () => {
  it("turns AbortSignal.timeout's TimeoutError into words a customer can act on", () => {
    const err = new DOMException("signal timed out", "TimeoutError");
    expect(networkErrorMessage(err)).toBe(
      "The server took too long to answer. Check your connection and try again.",
    );
  });

  it("covers the fetch failures each browser words differently", () => {
    for (const text of [
      "Failed to fetch",
      "Load failed",
      "NetworkError when attempting to fetch resource.",
    ]) {
      expect(networkErrorMessage(new TypeError(text))).toBe(
        "We couldn't reach BiteExpress. Check your connection and try again.",
      );
    }
  });

  it("never passes a raw exception message through", () => {
    expect(networkErrorMessage(new Error("Unexpected token < in JSON"))).toBe(
      "Something went wrong. Please try again.",
    );
    expect(networkErrorMessage("boom")).toBe("Something went wrong. Please try again.");
  });
});
