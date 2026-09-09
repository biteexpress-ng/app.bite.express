/**
 * Parse the JSON-encoded `item_details` snapshot carried on an order
 * detail line. Shared by the order detail view and the quote-line
 * arithmetic so there is exactly one place that knows this blob can be
 * malformed or absent.
 */
export function parseItemDetails(
  raw: string | undefined,
): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}
