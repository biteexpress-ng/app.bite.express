/**
 * Pure helpers for the 6amMart `food_variations` shape.
 *
 * Live contract from /api/v1/items/details/{id}:
 *   food_variations: [
 *     {
 *       name: "Soup Type",
 *       type: "single" | "multi",
 *       min: 0,                  // 0 = no minimum
 *       max: 0,                  // 0 = no maximum (single → effectively 1)
 *       required: "on" | "off",
 *       values: [
 *         { label: "Vegetable", optionPrice: "0" }   // optionPrice is a STRING
 *       ]
 *     }
 *   ]
 *
 * Empty / missing arrays are tolerated — the UI just renders nothing.
 */

export type FoodVariationValue = {
  label: string;
  /** Comes back as a string from the API. Parse with `optionPriceNumber`. */
  optionPrice: string | number;
};

export type FoodVariation = {
  name: string;
  type: "single" | "multi";
  min: number;
  max: number;
  required: "on" | "off";
  values: FoodVariationValue[];
};

/** Per-group choice: the labels the customer selected from one group. */
export type VariationSelection = {
  /** Mirrors FoodVariation.name. */
  name: string;
  /** Selected value labels (always [single]) for type=single. */
  values: string[];
};

/* -------------------------------------------------------------------- */
/* Pure helpers                                                          */
/* -------------------------------------------------------------------- */

/** "500" → 500, undefined → 0, "abc" → 0. */
export function optionPriceNumber(v: FoodVariationValue): number {
  const n = Number(v.optionPrice ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Effective max-pick count for a group.
 *  - single → 1
 *  - multi w/ max=0 → values.length (no cap)
 *  - multi w/ max>0 → max */
export function effectiveMax(v: FoodVariation): number {
  if (v.type === "single") return 1;
  if (v.max <= 0) return v.values.length;
  return v.max;
}

/** Effective min-pick count for a group.
 *  - required="on" + min=0 → 1 (must pick something)
 *  - otherwise → min as given */
export function effectiveMin(v: FoodVariation): number {
  if (v.required === "on" && v.min <= 0) return 1;
  return Math.max(0, v.min);
}

/** Total price uplift in NGN from the chosen variation values. */
export function selectionsUplift(
  variations: FoodVariation[],
  selections: VariationSelection[],
): number {
  let uplift = 0;
  for (const sel of selections) {
    const group = variations.find((g) => g.name === sel.name);
    if (!group) continue;
    for (const label of sel.values) {
      const val = group.values.find((v) => v.label === label);
      if (val) uplift += optionPriceNumber(val);
    }
  }
  return uplift;
}

/** Returns an array of human-readable validation errors. Empty = valid. */
export function validateSelections(
  variations: FoodVariation[],
  selections: VariationSelection[],
): string[] {
  const errors: string[] = [];
  for (const group of variations) {
    const sel = selections.find((s) => s.name === group.name);
    const picked = sel?.values.length ?? 0;
    const min = effectiveMin(group);
    const max = effectiveMax(group);

    if (picked < min) {
      errors.push(
        min === 1
          ? `Pick an option for "${group.name}".`
          : `Pick at least ${min} for "${group.name}".`,
      );
    }
    if (picked > max) {
      errors.push(`Pick at most ${max} for "${group.name}".`);
    }
  }
  return errors;
}

/**
 * Stable cart key for an item + its chosen selections + add-ons.
 *
 * Same item with same selections + same add-ons → same key (qty merges).
 * Different selections or different add-ons → different keys (separate lines).
 *
 * Format: `${itemId}` (nothing extra) or
 *         `${itemId}|name=v1,v2;name2=v3` (selections) or
 *         `${itemId}|name=v|+aid:qty,aid:qty` (selections + add-ons) or
 *         `${itemId}|+aid:qty` (add-ons only).
 *
 * Names + values + add-on ids are all sorted for determinism so
 * picking the same options in a different order still merges.
 *
 * `variantType` is a legacy size (grocery/pharmacy), appended as
 * `|~400gtin` so each size is its own line. Keys without one are
 * unchanged.
 */
export function cartKeyFor(
  itemId: number,
  selections: VariationSelection[],
  addOns?: ReadonlyArray<{ id: number; qty: number }>,
  variantType?: string,
): string {
  const base = foodCartKey(itemId, selections, addOns);
  return variantType ? `${base}|~${variantType}` : base;
}

function foodCartKey(
  itemId: number,
  selections: VariationSelection[],
  addOns?: ReadonlyArray<{ id: number; qty: number }>,
): string {
  const groupParts: string[] = [];
  const sortedGroups = [...selections]
    .filter((s) => s.values.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const g of sortedGroups) {
    const vs = [...g.values].sort().join(",");
    groupParts.push(`${g.name}=${vs}`);
  }

  const addOnParts: string[] = [];
  if (addOns && addOns.length > 0) {
    const sortedAddOns = [...addOns]
      .filter((a) => a.qty > 0)
      .sort((a, b) => a.id - b.id);
    for (const a of sortedAddOns) {
      addOnParts.push(`${a.id}:${a.qty}`);
    }
  }

  if (groupParts.length === 0 && addOnParts.length === 0) {
    return String(itemId);
  }
  const right = [
    groupParts.join(";"),
    addOnParts.length > 0 ? `+${addOnParts.join(",")}` : "",
  ]
    .filter(Boolean)
    .join("|");
  return `${itemId}|${right}`;
}

/** Compact summary of selections for the cart line — single line of text. */
export function selectionsSummary(selections: VariationSelection[]): string {
  return selections
    .filter((s) => s.values.length > 0)
    .map((s) => s.values.join(", "))
    .join(" · ");
}
