/**
 * Pure helpers for the legacy variation system used by the grocery,
 * pharmacy and ecommerce modules (food uses food_variations instead).
 *
 * Contract from Helpers::product_data_formatting:
 *   choice_options: [{ name: "choice_1", title: "Size", options: ["400g tin", "850g tin"] }]
 *   variations:     [{ type: "400gtin", price: 7500, stock: 100 }]
 *
 * A variation's `type` is each picked option with its spaces removed,
 * joined with "-" in choice_options order. Admin\ItemController::store()
 * builds it that way and the mobile app rebuilds it the same way.
 *
 * Unlike food variations, the price is the FULL price of that size and
 * replaces the item price; PlaceNewOrder does not add it to a base.
 */

export type ChoiceOption = {
  name: string;
  title: string;
  options: string[];
};

export type LegacyVariation = {
  type: string;
  price: number;
  stock: number;
};

type WithLegacy = {
  choice_options?: ChoiceOption[] | null;
  variations?: LegacyVariation[] | null;
};

/** Picked option per choice, keyed by ChoiceOption.name. */
export type ChoicePicks = Record<string, string>;

function choicesOf(item: WithLegacy): ChoiceOption[] {
  return Array.isArray(item.choice_options) ? item.choice_options : [];
}

function variationsOf(item: WithLegacy): LegacyVariation[] {
  return Array.isArray(item.variations) ? item.variations : [];
}

export function variantKey(pickedOptions: string[]): string {
  return pickedOptions.map((o) => o.replaceAll(" ", "")).join("-");
}

export function hasLegacyChoices(item: WithLegacy): boolean {
  return choicesOf(item).length > 0 && variationsOf(item).length > 0;
}

/** Attribute titles the customer has not picked yet. */
export function missingChoices(item: WithLegacy, picks: ChoicePicks): string[] {
  return choicesOf(item)
    .filter((c) => !picks[c.name])
    .map((c) => c.title);
}

/** The variation row for the current picks, or null when a choice is
 *  missing or the combination has no row. A missing row must never be
 *  sent: the server would price it at zero. */
export function resolveVariant(item: WithLegacy, picks: ChoicePicks): LegacyVariation | null {
  const choices = choicesOf(item);
  if (choices.length === 0 || missingChoices(item, picks).length > 0) return null;
  const key = variantKey(choices.map((c) => picks[c.name]));
  return variationsOf(item).find((v) => v.type === key) ?? null;
}

export function cheapestVariantPrice(item: WithLegacy): number | null {
  const prices = variationsOf(item).map((v) => Number(v.price)).filter(Number.isFinite);
  return prices.length > 0 ? Math.min(...prices) : null;
}

/** Readable label for a cart line, e.g. "400g tin" or "Red · S". */
export function variantLabel(item: WithLegacy, picks: ChoicePicks): string {
  return choicesOf(item)
    .map((c) => picks[c.name])
    .filter(Boolean)
    .join(" · ");
}
