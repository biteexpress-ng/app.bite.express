/**
 * Identity + external URL constants for the BiteExpress customer app.
 * Mirrored from biteexpress-web's site-config so both projects stay
 * brand-consistent; when something diverges (e.g. app-only links),
 * edit only this file.
 */

export const siteConfig = {
  name: "BiteExpress",
  legalName: "BiteExpress Limited",
  shortDescription: "Order food, groceries & more — delivered fast.",
  longDescription:
    "Order from your favourite restaurants, supermarkets, pharmacies and local stores across Nigeria. Live tracking, secure payments, and member-only offers — only on BiteExpress.",
  /** This customer app's public URL. */
  url: "https://app.bite.express",
  /** The marketing site this app pairs with. */
  marketingUrl: "https://bite.express",
  email: "hello@bite.express",
  supportEmail: "support@bite.express",
  phone: "+234 800 BITE EXP",
  social: {
    facebook: "https://web.facebook.com/biteexpressapp",
    twitter: "https://twitter.com/biteexpress",
    instagram: "https://instagram.com/biteexpressng",
    linkedin: "https://www.linkedin.com/showcase/biteexpress/",
    youtube: "https://www.youtube.com/@BiteExpressApp",
    whatsapp: "https://wa.me/2349123051662",
  },
  appStore: {
    ios: "https://apps.apple.com/ng/app/biteexpress/id6466211766",
    android:
      "https://play.google.com/store/apps/details?id=com.biteexpress.biteexpress",
  },
} as const;

export type SiteConfig = typeof siteConfig;
