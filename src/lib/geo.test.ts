import { describe, expect, it } from "vitest";
import { formatDistance } from "./geo";

/**
 * The store endpoints return `distance` from MySQL ST_Distance_Sphere,
 * which is metres. Rendering it as km showed a 1.1 km store as
 * "1149.1 km away".
 */
describe("formatDistance", () => {
  it("renders the API's metres as kilometres", () => {
    expect(formatDistance(1149.14)).toBe("1.1 km");
    expect(formatDistance(3538.24)).toBe("3.5 km");
  });

  it("uses metres under one kilometre", () => {
    expect(formatDistance(850.4)).toBe("850 m");
    expect(formatDistance(12)).toBe("12 m");
  });

  it("switches to km when rounding reaches 1000 m", () => {
    expect(formatDistance(999.7)).toBe("1.0 km");
  });

  it("drops the decimal for long distances", () => {
    expect(formatDistance(25_400)).toBe("25 km");
  });

  it("returns null for missing or invalid values", () => {
    expect(formatDistance(undefined)).toBeNull();
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(Number.NaN)).toBeNull();
    expect(formatDistance(-5)).toBeNull();
  });
});
