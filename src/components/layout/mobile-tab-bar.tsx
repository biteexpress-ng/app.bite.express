"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Home, ShoppingBag, User2 } from "lucide-react";
import { ReceiptNaira } from "@/components/icons/receipt-naira";
import { cn } from "@/lib/cn";
import { useIsAuthenticated } from "@/lib/auth-store";
import { useLocation } from "@/lib/location-store";
import { useCart, useCartCount } from "@/lib/cart-store";
import { useRunningOrdersCount } from "@/components/orders/orders-badge";
import { activeTab, homeHref, showTabBar, type TabBarTab } from "@/lib/tab-bar";

/** Gap between the floating bar and the bottom edge. On a notched iPhone
 *  the bar sits just above the home indicator, as the native one does. */
const BAR_BOTTOM = "bottom-[max(0.875rem,calc(env(safe-area-inset-bottom)_-_0.375rem))]";
/** Bar height (h-[3.875rem]) plus its bottom gap plus breathing room, so the
 *  last content on a page can scroll clear of the bar. */
const SPACER_HEIGHT =
  "h-[calc(3.875rem_+_max(0.875rem,calc(env(safe-area-inset-bottom)_-_0.375rem))_+_1rem)]";

type TabConfig = {
  key: TabBarTab;
  label: string;
  href: string;
  icon: typeof Home;
  badge?: React.ReactNode;
};

/**
 * Floating glass tab bar for phones (md:hidden), after the iOS 26 bar in
 * Instagram: a frosted capsule, icons without captions, and a lens that
 * slides under the active tab. Each link keeps its name as an aria-label.
 * Hidden on checkout (which has its own pay bar) and the auth pages.
 * Guests are routed to sign-in with a `next` return param for the tabs
 * that require an account.
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
      icon: ReceiptNaira,
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

  const activeIndex = tabs.findIndex((tab) => tab.key === active);

  return (
    <nav
      aria-label="Primary"
      className={cn("fixed inset-x-0 z-40 flex justify-center px-4 md:hidden", BAR_BOTTOM)}
    >
      <div className="glass-tabbar relative flex h-[3.875rem] w-full max-w-[23rem] items-stretch rounded-full p-1.5">
        {/* The lens is one element that moves, so switching tabs reads as
            the highlight sliding across rather than two states swapping. */}
        <span
          aria-hidden="true"
          className="glass-tabbar-lens pointer-events-none absolute inset-y-1.5 left-1.5 rounded-full"
          style={{
            width: `calc((100% - 0.75rem) / ${tabs.length})`,
            transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
            opacity: activeIndex < 0 ? 0 : 1,
          }}
        />
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "glass-tabbar-item relative z-10 flex flex-1 items-center justify-center rounded-full outline-none",
                "focus-visible:ring-2 focus-visible:ring-brand-red/60",
                "[-webkit-tap-highlight-color:transparent]",
                isActive ? "text-ink-900" : "text-ink-700",
              )}
            >
              <span className="glass-tabbar-icon relative inline-flex">
                <Icon size={25} strokeWidth={isActive ? 2.4 : 1.7} />
                {tab.badge}
              </span>
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
    <span className="pointer-events-none absolute -right-0.5 -top-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-brand-red ring-2 ring-white/90">
      <span className="sr-only">{label}</span>
    </span>
  );
}
