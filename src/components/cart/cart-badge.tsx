"use client";

import { useEffect } from "react";
import { useCart, useCartCount } from "@/lib/cart-store";

/**
 * Tiny pill badge for the cart icon in the header.
 *
 * Hydrates the cart store on first mount and renders nothing until
 * hydration completes — keeps SSR markup ("server thinks count=0")
 * in sync with first client paint.
 */
export function CartBadge() {
  const hydrate = useCart((s) => s.hydrate);
  const hydrated = useCart((s) => s.hydrated);
  const count = useCartCount();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated || count <= 0) return null;

  return (
    <span className="pointer-events-none absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-semibold leading-none text-white shadow">
      {count > 99 ? "99+" : count}
    </span>
  );
}
