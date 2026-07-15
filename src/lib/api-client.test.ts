import { describe, expect, it } from "vitest";
import { parseErrorBody } from "@/lib/api-client";

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
