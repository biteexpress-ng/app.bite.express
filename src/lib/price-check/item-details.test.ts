import { describe, expect, it } from "vitest";
import { parseItemDetails } from "./item-details";

describe("parseItemDetails", () => {
  it("passes an object through unchanged", () => {
    const details = { name: "Rice", id: 8801 };
    expect(parseItemDetails(details)).toBe(details);
  });

  it("parses a valid JSON string", () => {
    expect(parseItemDetails(JSON.stringify({ name: "Rice" }))).toEqual({ name: "Rice" });
  });

  it("returns null for malformed JSON", () => {
    expect(parseItemDetails("{not json")).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(parseItemDetails(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(parseItemDetails(null)).toBeNull();
  });
});
