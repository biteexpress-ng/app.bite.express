import { describe, expect, it } from "vitest";
import { parseHandoff } from "./location-handoff";

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe("parseHandoff", () => {
  it("reads valid coordinates", () => {
    expect(parseHandoff(params("lat=6.52441&lng=3.3792"))).toEqual({
      kind: "coords",
      lat: 6.52441,
      lng: 3.3792,
    });
  });

  it("ignores non-numeric coordinates", () => {
    expect(parseHandoff(params("lat=abc&lng=xyz"))).toBeNull();
  });

  it("ignores out-of-range coordinates", () => {
    expect(parseHandoff(params("lat=95&lng=3.3792"))).toBeNull();
    expect(parseHandoff(params("lat=6.52441&lng=200"))).toBeNull();
  });

  it("ignores a lat with no matching lng", () => {
    expect(parseHandoff(params("lat=6.52441"))).toBeNull();
  });

  it("treats 0,0 as unset", () => {
    expect(parseHandoff(params("lat=0&lng=0"))).toBeNull();
  });

  it("prefers coords over q when both are present", () => {
    expect(parseHandoff(params("lat=6.52441&lng=3.3792&q=Yaba+Lagos"))).toEqual({
      kind: "coords",
      lat: 6.52441,
      lng: 3.3792,
    });
  });

  it("falls back to q when coords are missing or invalid", () => {
    expect(parseHandoff(params("lat=abc&q=Yaba+Lagos"))).toEqual({
      kind: "query",
      q: "Yaba Lagos",
    });
  });

  it("reads a plain query", () => {
    expect(parseHandoff(params("q=Yaba+Lagos"))).toEqual({
      kind: "query",
      q: "Yaba Lagos",
    });
  });

  it("treats a blank q as unset", () => {
    expect(parseHandoff(params("q=%20%20"))).toBeNull();
  });

  it("returns null when nothing is present", () => {
    expect(parseHandoff(params(""))).toBeNull();
  });

  it("trims and caps an overlong q at 200 characters", () => {
    const long = "a".repeat(250);
    const result = parseHandoff(params(`q=${long}`));
    expect(result).toEqual({ kind: "query", q: "a".repeat(200) });
  });
});
