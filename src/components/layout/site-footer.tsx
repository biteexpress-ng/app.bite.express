import Link from "next/link";
import { Container } from "@/components/ui/container";
import { siteConfig } from "@/lib/site-config";
import { Logo } from "@/components/brand/logo";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  WhatsAppIcon,
  XIcon,
} from "@/components/brand/social-icons";

/**
 * Premium customer-app footer.
 *
 * Dark obsidian band that grounds the page, with refined neon-tinted
 * accents. Two-tier layout: top row for brand + escape hatches,
 * lower row for legal + locale.
 *
 * Social links mirror biteexpress-web's footer — keep the two in sync.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative isolate overflow-hidden bg-canvas-darker text-ink-200">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(40rem 22rem at 86% 10%, rgba(255, 42, 20, 0.18), transparent 60%), radial-gradient(36rem 22rem at 0% 100%, rgba(255, 107, 74, 0.10), transparent 60%)",
        }}
      />
      <Container className="relative grid gap-12 py-16 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:gap-8">
        <div className="space-y-5">
          <Logo variant="dark" asLink={false} className="h-9 w-auto md:h-10" />
          <p className="max-w-xs text-sm leading-relaxed text-ink-400">
            {siteConfig.longDescription}
          </p>
          <div className="flex items-center gap-3 pt-1">
            <SocialLink href={siteConfig.social.instagram} label="Instagram">
              <InstagramIcon size={16} />
            </SocialLink>
            <SocialLink href={siteConfig.social.facebook} label="Facebook">
              <FacebookIcon size={16} />
            </SocialLink>
            <SocialLink href={siteConfig.social.twitter} label="X / Twitter">
              <XIcon size={16} />
            </SocialLink>
            <SocialLink href={siteConfig.social.linkedin} label="LinkedIn">
              <LinkedInIcon size={16} />
            </SocialLink>
            <SocialLink href={siteConfig.social.whatsapp} label="WhatsApp">
              <WhatsAppIcon size={16} />
            </SocialLink>
          </div>
        </div>

        <FooterColumn title="Order">
          <FooterLink href="/browse">Browse</FooterLink>
          <FooterLink href="/cart">Cart</FooterLink>
          <FooterLink href="/orders">Orders</FooterLink>
          <FooterLink href="/wishlist">Wishlist</FooterLink>
        </FooterColumn>

        <FooterColumn title="Account">
          <FooterLink href="/profile">Profile</FooterLink>
          <FooterLink href="/addresses">Addresses</FooterLink>
          <FooterLink href="/wallet">Wallet</FooterLink>
          <FooterLink href="/notifications">Notifications</FooterLink>
        </FooterColumn>

        <FooterColumn title="Company">
          <FooterLink href={`${siteConfig.marketingUrl}`} external>
            About BiteExpress
          </FooterLink>
          <FooterLink href={`${siteConfig.marketingUrl}/help`} external>
            Help
          </FooterLink>
          <FooterLink href={`${siteConfig.marketingUrl}/privacy`} external>
            Privacy
          </FooterLink>
          <FooterLink href={`${siteConfig.marketingUrl}/terms`} external>
            Terms
          </FooterLink>
        </FooterColumn>
      </Container>

      <div className="divider-fade-dark" />

      <Container className="relative flex flex-col items-start gap-3 py-6 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {year} {siteConfig.legalName}. All rights reserved.
        </p>
        <p className="flex items-center gap-2">
          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          Delivering across Nigeria
        </p>
      </Container>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ink-400">
        {title}
      </p>
      <ul className="space-y-2.5 text-sm text-ink-300">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  external,
  children,
}: {
  href: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  if (external) {
    return (
      <li>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block transition-colors hover:text-white"
        >
          {children}
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link
        href={href}
        className="inline-block transition-colors hover:text-white"
      >
        {children}
      </Link>
    </li>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-white/80 transition-all hover:border-white/25 hover:bg-white/10 hover:text-white"
    >
      {children}
    </a>
  );
}
