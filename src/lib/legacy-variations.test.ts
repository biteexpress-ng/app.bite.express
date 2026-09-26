import { describe, expect, it } from "vitest";
import {
  cheapestVariantPrice,
  hasLegacyChoices,
  missingChoices,
  resolveVariant,
  variantKey,
  variantLabel,
} from "./legacy-variations";

const peak = {
  choice_options: [
    { name: "choice_1", title: "Size", options: ["Roll of 12 x 14g sachets", "400g tin", "850g tin"] },
  ],
  variations: [
    { type: "Rollof12x14gsachets", price: 3000, stock: 100 },
    { type: "400gtin", price: 7500, stock: 100 },
    { type: "850gtin", price: 14500, stock: 0 },
  ],
};

describe("variantKey", () => {
  it("strips spaces and joins attributes with a hyphen, as the server and the mobile app do", () => {
    expect(variantKey(["Roll of 12 x 14g sachets"])).toBe("Rollof12x14gsachets");
    expect(variantKey(["Red", "X L"])).toBe("Red-XL");
  });

  it("keeps dots, because the stored key keeps them", () => {
    expect(variantKey(["1.5L PET"])).toBe("1.5LPET");
  });
});

describe("hasLegacyChoices", () => {
  it("is true only when there are both choices and variation rows", () => {
    expect(hasLegacyChoices(peak)).toBe(true);
    expect(hasLegacyChoices({ choice_options: [], variations: [] })).toBe(false);
    expect(hasLegacyChoices({ choice_options: peak.choice_options, variations: [] })).toBe(false);
    expect(hasLegacyChoices({})).toBe(false);
  });

  it("tolerates the API's null and empty-string shapes", () => {
    expect(hasLegacyChoices({ choice_options: null, variations: null })).toBe(false);
  });
});

describe("resolveVariant", () => {
  it("returns the matching row with its full price", () => {
    expect(resolveVariant(peak, { choice_1: "400g tin" })).toEqual({ type: "400gtin", price: 7500, stock: 100 });
  });

  it("returns null until every choice is picked", () => {
    expect(resolveVariant(peak, {})).toBeNull();
  });

  it("returns null for a combination with no variation row, instead of letting it price at zero", () => {
    const shirt = {
      choice_options: [
        { name: "choice_2", title: "Color", options: ["Red", "Blue"] },
        { name: "choice_1", title: "Size", options: ["S", "M"] },
      ],
      variations: [{ type: "Red-S", price: 10, stock: 1 }],
    };
    expect(resolveVariant(shirt, { choice_2: "Red", choice_1: "S" })?.type).toBe("Red-S");
    expect(resolveVariant(shirt, { choice_2: "Blue", choice_1: "M" })).toBeNull();
  });
});

describe("missingChoices", () => {
  it("names the attributes still to pick, in display order", () => {
    expect(missingChoices(peak, {})).toEqual(["Size"]);
    expect(missingChoices(peak, { choice_1: "400g tin" })).toEqual([]);
  });
});

describe("cheapestVariantPrice", () => {
  it("is the lowest size price, for a 'from' label", () => {
    expect(cheapestVariantPrice(peak)).toBe(3000);
    expect(cheapestVariantPrice({ variations: [] })).toBeNull();
  });
});

describe("variantLabel", () => {
  it("is the picked option text, readable rather than the stripped key", () => {
    expect(variantLabel(peak, { choice_1: "Roll of 12 x 14g sachets" })).toBe("Roll of 12 x 14g sachets");
  });

  it("joins several attributes in display order", () => {
    const shirt = {
      choice_options: [
        { name: "choice_2", title: "Color", options: ["Red"] },
        { name: "choice_1", title: "Size", options: ["S"] },
      ],
      variations: [{ type: "Red-S", price: 10, stock: 1 }],
    };
    expect(variantLabel(shirt, { choice_1: "S", choice_2: "Red" })).toBe("Red · S");
  });
});
