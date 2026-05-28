"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, ShoppingBag, User2, X, MapPin } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { useIsAuthenticated } from "@/lib/auth-store";
import { useLocation } from "@/lib/location-store";
import { CartBadge } from "@/components/cart/cart-badge";
import {
  OrdersBadge,
  OrdersInlineCount,
} from "@/components/orders/orders-badge";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { cn } from "@/lib/cn";

/**
 * Premium customer-app header.
 *
 * - Frosted glass surface, hairline border, lifts on scroll.
 * - Live location chip on the left (signed-in users), beside the wordmark.
 * - Right cluster: refined icon buttons with subtle ember hover.
 * - Mobile sheet slides down with smooth motion.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isAuthed = useIsAuthenticated();
  const location = useLocation((s) => s.location);
  const hydrate = useLocation((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const cityLine = location?.formattedAddress ?? null;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 w-full transition-[background,box-shadow,border-color] duration-300",
        scrolled
          ? "bg-white/80 backdrop-blur-xl backdrop-saturate-150 border-b border-ink-200/70 shadow-[0_1px_0_rgba(17,17,17,0.04),0_8px_24px_-12px_rgba(17,17,17,0.10)]"
          : "bg-white/60 backdrop-blur-md border-b border-transparent",
      )}
    >
      <Container className="flex h-16 items-center justify-between md:h-20">
        <div className="flex min-w-0 items-center gap-3 md:gap-5">
          <Logo priority />
          {isAuthed && cityLine && (
            <Link
              href="/addresses"
              className="hidden min-w-0 max-w-[14rem] items-center gap-2 rounded-pill border border-ink-200/80 bg-white/70 px-3 py-1.5 text-xs font-medium text-ink-700 transition-all hover:border-brand-red/30 hover:text-brand-red md:inline-flex"
            >
              <MapPin size={13} className="shrink-0 text-brand-red" />
              <span className="truncate">{cityLine}</span>
            </Link>
          )}
        </div>

        {/* Desktop right cluster */}
        <div className="hidden items-center gap-2 md:flex">
          <NotificationsBell />
          <Link
            href="/cart"
            aria-label="Cart"
            className={cn(
              "relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink-200/80 bg-white/70 text-ink-900 transition-all duration-200",
              "hover:-translate-y-px hover:border-brand-red/30 hover:text-brand-red hover:shadow-[0_8px_20px_-8px_rgba(222,22,0,0.30)]",
            )}
          >
            <ShoppingBag size={17} strokeWidth={1.7} />
            <CartBadge />
          </Link>

          {isAuthed ? (
            <Link
              href="/profile"
              aria-label="Profile"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-ink-200/80 bg-white/70 text-ink-900 transition-all duration-200 hover:-translate-y-px hover:border-brand-red/30 hover:text-brand-red hover:shadow-[0_8px_20px_-8px_rgba(222,22,0,0.30)]"
            >
              <User2 size={17} strokeWidth={1.7} />
              <OrdersBadge />
            </Link>
          ) : (
            <ButtonLink href="/signin" variant="primary" size="sm">
              Sign in
            </ButtonLink>
          )}
        </div>

        {/* Mobile right cluster */}
        <div className="-mr-2 flex items-center gap-1 md:hidden">
          <NotificationsBell className="!border-0 hover:bg-ink-100" />
          <Link
            href="/cart"
            aria-label="Cart"
            onClick={() => setOpen(false)}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-900 hover:bg-ink-100"
          >
            <ShoppingBag size={20} strokeWidth={1.8} />
            <CartBadge />
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-900 transition-colors hover:bg-ink-100"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </Container>

      {/* Mobile sheet */}
      {open && (
        <div className="border-t border-ink-200/70 bg-white/95 backdrop-blur-xl md:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {isAuthed && cityLine && (
              <Link
                href="/addresses"
                className="mb-2 inline-flex items-center gap-2 self-start rounded-pill border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700"
                onClick={() => setOpen(false)}
              >
                <MapPin size={13} className="text-brand-red" />
                <span className="truncate">{cityLine}</span>
              </Link>
            )}
            <MobileLink href="/browse" onClick={() => setOpen(false)}>
              Browse
            </MobileLink>
            {isAuthed && (
              <>
                <MobileLink href="/orders" onClick={() => setOpen(false)}>
                  <span className="flex items-center">
                    Orders
                    <OrdersInlineCount />
                  </span>
                </MobileLink>
                <MobileLink href="/notifications" onClick={() => setOpen(false)}>
                  Notifications
                </MobileLink>
                <MobileLink href="/wallet" onClick={() => setOpen(false)}>
                  Wallet
                </MobileLink>
                <MobileLink href="/addresses" onClick={() => setOpen(false)}>
                  Addresses
                </MobileLink>
                <MobileLink href="/wishlist" onClick={() => setOpen(false)}>
                  Wishlist
                </MobileLink>
                <MobileLink href="/profile" onClick={() => setOpen(false)}>
                  Profile
                </MobileLink>
              </>
            )}
            <a
              href="https://bite.express"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl px-3 py-3 text-base font-medium text-ink-700 transition-colors hover:bg-ink-50 hover:text-ink-900"
              onClick={() => setOpen(false)}
            >
              About BiteExpress ↗
            </a>
            {!isAuthed && (
              <ButtonLink
                href="/signin"
                variant="primary"
                size="md"
                className="mt-3 w-full"
              >
                Sign in
              </ButtonLink>
            )}
          </Container>
        </div>
      )}
    </header>
  );
}

function MobileLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="rounded-xl px-3 py-3 text-base font-medium text-ink-900 transition-colors hover:bg-ink-50"
    >
      {children}
    </Link>
  );
}
