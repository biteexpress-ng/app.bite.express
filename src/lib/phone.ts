/**
 * Nigeria-only phone normalisation.
 *
 * Accept any of:
 *   08012345678, 8012345678, 2348012345678, +2348012345678
 *
 * Returns the international form (+234…) or null when the input
 * is obviously not a Nigerian phone (wrong length, non-digits only).
 *
 * The backend stores phones in international format with the +.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("234") && digits.length === 13) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) {
    return `+234${digits.slice(1)}`;
  }
  if (digits.length === 10) return `+234${digits}`;
  return null;
}
