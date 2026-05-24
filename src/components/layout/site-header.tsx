"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, ShoppingBag, User2, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { useIsAuthenticated } from "@/lib/auth-store";
import { CartBadge } from "@/components/cart/cart-badge";
import {
  OrdersBadge,
  OrdersInlineCount,
} from "@/components/orders/orders-badge";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { cn } from "@/lib/cn";

/**
 * Customer-app header.
 *
 * - Always opaque white (unlike the marketing site, which goes
 *   transparent over the dark hero).
 * - Right cluster shows different actions depending on auth:
 *     - Signed out:  Sign in button + Cart icon
 *     - Signed in:   Profile icon + Cart icon
 * - Mobile: hamburger toggles a slide-down sheet.
 */
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const isAuthed = useIsAuthenticated();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-ink-200/60 bg-white/95 backdrop-blur">
      <Container className="flex h-16 items-center justify-between md:h-20">
        <Logo priority />

        {/* Desktop right cluster */}
        <div className="hidden items-center gap-3 md:flex">
          <NotificationsBell />
          <Link
            href="/cart"
            aria-label="Cart"
            className={cn(
              "relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink-200 text-ink-900 transition-colors hover:bg-ink-50 hover:text-brand-red",
            )}
          >
            <ShoppingBag size={17} strokeWidth={1.8} />
            <CartBadge />
          </Link>

          {isAuthed ? (
            <Link
              href="/profile"
              aria-label="Profile"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink-200 text-ink-900 transition-colors hover:bg-ink-50 hover:text-brand-red"
            >
              <User2 size={17} strokeWidth={1.8} />
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-900 hover:bg-ink-100"
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
        <div className="border-t border-ink-200 bg-white md:hidden">
          <Container className="flex flex-col gap-2 py-4">
            <Link
              href="/"
              className="rounded-lg px-3 py-3 text-base font-medium text-ink-900 hover:bg-ink-50"
              onClick={() => setOpen(false)}
            >
              Browse
            </Link>
            {isAuthed && (
              <>
                <Link
                  href="/orders"
                  className="flex items-center rounded-lg px-3 py-3 text-base font-medium text-ink-900 hover:bg-ink-50"
                  onClick={() => setOpen(false)}
                >
                  Orders
                  <OrdersInlineCount />
                </Link>
                <Link
                  href="/notifications"
                  className="rounded-lg px-3 py-3 text-base font-medium text-ink-900 hover:bg-ink-50"
                  onClick={() => setOpen(false)}
                >
                  Notifications
                </Link>
                <Link
                  href="/wallet"
                  className="rounded-lg px-3 py-3 text-base font-medium text-ink-900 hover:bg-ink-50"
                  onClick={() => setOpen(false)}
                >
                  Wallet
                </Link>
                <Link
                  href="/addresses"
                  className="rounded-lg px-3 py-3 text-base font-medium text-ink-900 hover:bg-ink-50"
                  onClick={() => setOpen(false)}
                >
                  Addresses
                </Link>
              </>
            )}
            <a
              href="https://bite.express"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-3 py-3 text-base font-medium text-ink-900 hover:bg-ink-50"
              onClick={() => setOpen(false)}
            >
              About BiteExpress
            </a>
            {!isAuthed && (
              <ButtonLink
                href="/signin"
                variant="primary"
                size="md"
                className="mt-2 w-full"
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
