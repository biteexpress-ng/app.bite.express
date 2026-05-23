/**
 * Locale registry. English-only at launch; structure ready for
 * additional languages later via next-intl.
 */

export const locales = ["en"] as const;
export const defaultLocale = "en" as const;

export type Locale = (typeof locales)[number];
