"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Home, Receipt, ShoppingBag, User2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useIsAuthenticated } from "@/lib/auth-store";
import { useLocation } from "@/lib/location-store";
import { useCart, useCartCount } from "@/lib/cart-store";
import { useRunningOrdersCount } from "@/components/orders/orders-badge";
import { activeTab, homeHref, showTabBar, type TabBarTab } from "@/lib/tab-bar";

/** Matches the bar's rendered height (h-16) plus the iPhone safe area. */
const SPACER_HEIGHT = "h-[calc(4rem+env(safe-area-inset-bottom))]";

type TabConfig = {
  key: TabBarTab;
  label: string;
  href: string;
  icon: typeof Home;
  badge?: React.ReactNode;
};

/**
 * Fixed bottom nav for phones (md:hidden). Hidden on checkout (which has
 * its own pay bar) and the auth pages. Guests are routed to sign-in with
 * a `next` return param for the tabs that require an account.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const isAuthed = useIsAuthenticated();
  const location = useLocation((s) => s.location);
  const hydrateLocation = useLocation((s) => s.hydrate);
  const hydrateCart = useCart((s) => s.hydrate);
  const cartHydrated = useCart((s) => s.hydrated);
  const cartCount = useCartCount();
  const runningOrders = useRunningOrdersCount();

  useEffect(() => {
    hydrateLocation();
    hydrateCart();
  }, [hydrateLocation, hydrateCart]);

  if (!showTabBar(pathname)) return null;

  const active = activeTab(pathname);

  const tabs: TabConfig[] = [
    {
      key: "home",
      label: "Home",
      href: homeHref(!!location),
      icon: Home,
    },
    {
      key: "cart",
      label: "Cart",
      href: "/cart",
      icon: ShoppingBag,
      badge:
        cartHydrated && cartCount > 0 ? (
          <CountBadge
            count={cartCount}
            label={`${cartCount} ${cartCount === 1 ? "item" : "items"} in cart`}
          />
        ) : null,
    },
    {
      key: "orders",
      label: "Orders",
      href: isAuthed ? "/orders" : "/signin?next=%2Forders",
      icon: Receipt,
      badge:
        isAuthed && runningOrders > 0 ? (
          <DotBadge label="You have a running order" />
        ) : null,
    },
    {
      key: "profile",
      label: "Profile",
      href: isAuthed ? "/profile" : "/signin?next=%2Fprofile",
      icon: User2,
    },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch justify-around">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[0.65rem] font-medium transition-colors",
                isActive ? "text-brand-red" : "text-ink-500",
              )}
            >
              <span className="relative inline-flex">
                <Icon size={22} strokeWidth={isActive ? 2.2 : 1.8} />
                {tab.badge}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Reserves space at the bottom of the page so content and the footer
 *  never sit behind the fixed bar. Rendered as the very last element in
 *  the body so it reserves space past the footer too. */
export function MobileTabBarSpacer() {
  const pathname = usePathname();
  if (!showTabBar(pathname)) return null;
  return <div aria-hidden="true" className={cn(SPACER_HEIGHT, "md:hidden")} />;
}

function CountBadge({ count, label }: { count: number; label: string }) {
  return (
    <span className="pointer-events-none absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-red px-1 text-[9px] font-semibold leading-none text-white">
      <span aria-hidden="true">{count > 99 ? "99+" : count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function DotBadge({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute -right-0.5 -top-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-brand-red ring-2 ring-white">
      <span className="sr-only">{label}</span>
    </span>
  );
}
