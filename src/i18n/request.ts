import { getRequestConfig } from "next-intl/server";
import { defaultLocale } from "./locales";

/**
 * next-intl request config — invoked per request by the server.
 * Returns the active locale + messages. No-routing mode: locale is
 * static for now (defaultLocale only). When we add more languages
 * we'll switch to URL-prefixed routing under app/[locale]/.
 */
export default getRequestConfig(async () => {
  const locale = defaultLocale;
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
