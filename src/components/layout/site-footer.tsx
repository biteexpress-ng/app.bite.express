import Link from "next/link";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/lib/site-config";

/**
 * Minimal customer-app footer. Most navigation lives in-app (header,
 * cart, profile); this footer is a thin attribution + escape hatch
 * back to the marketing site for help / about / legal pages.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-ink-200 bg-white">
      <Container className="flex flex-col gap-4 py-8 text-sm text-ink-600 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {year} {siteConfig.legalName}. All rights reserved.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link
            href={`${siteConfig.marketingUrl}/help`}
            className="hover:text-brand-red"
          >
            Help
          </Link>
          <Link
            href={`${siteConfig.marketingUrl}/privacy`}
            className="hover:text-brand-red"
          >
            Privacy
          </Link>
          <Link
            href={`${siteConfig.marketingUrl}/terms`}
            className="hover:text-brand-red"
          >
            Terms
          </Link>
          <Link href={siteConfig.marketingUrl} className="hover:text-brand-red">
            About BiteExpress ↗
          </Link>
        </nav>
      </Container>
    </footer>
  );
}
