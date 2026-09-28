import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { dmSans, dmSerifDisplay } from "@/lib/fonts";
import { siteConfig } from "@/lib/site-config";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { PushBootstrap } from "@/components/notifications/push-bootstrap";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import {
  MobileTabBar,
  MobileTabBarSpacer,
} from "@/components/layout/mobile-tab-bar";
import { Toaster } from "@/components/ui/toaster";
import { PAYSTACK_SCRIPT_SRC } from "@/lib/paystack";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — Order food, groceries & more, delivered fast.`,
    template: `%s | ${siteConfig.name}`,
  },
  description:
    "Order from your favourite restaurants, supermarkets, pharmacies and local stores. Live tracking, secure payments, every neighbourhood in Nigeria.",
  applicationName: siteConfig.name,
  appleWebApp: { capable: true, title: siteConfig.name, statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { email: false, address: false, telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${dmSans.variable} ${dmSerifDisplay.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider />
          <PushBootstrap />
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <MobileTabBar />
          <SiteFooter />
          <Toaster />
          <MobileTabBarSpacer />
        </NextIntlClientProvider>

        <Script src={PAYSTACK_SCRIPT_SRC} strategy="afterInteractive" />
      </body>
    </html>
  );
}
