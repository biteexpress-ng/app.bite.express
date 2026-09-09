/**
 * Read the `item_details` snapshot carried on an order detail line.
 * Shared by the order detail view and the quote-line arithmetic so
 * there is exactly one place that knows this blob can be malformed or
 * absent.
 *
 * `Helpers::order_details_data_formatting()` on the backend already
 * calls `json_decode` before serialising the response, so this field
 * normally arrives as an object, not a string. A string is handled as
 * a defensive fallback in case some endpoint ever sends the raw JSON.
 */
export function parseItemDetails(
  raw: string | Record<string, unknown> | undefined | null,
): Record<string, unknown> | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}
