/**
 * Pure routing logic for the mobile bottom nav. Kept dependency-free
 * (no next/navigation) so it can be unit tested without a DOM.
 */

const HIDDEN_PREFIXES = ["/checkout", "/signin", "/signup"];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function showTabBar(pathname: string): boolean {
  return !HIDDEN_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export type TabBarTab = "home" | "cart" | "orders" | "profile";

export function activeTab(pathname: string): TabBarTab | null {
  if (
    pathname === "/" ||
    matchesPrefix(pathname, "/browse") ||
    matchesPrefix(pathname, "/store")
  ) {
    return "home";
  }
  if (pathname === "/cart") return "cart";
  if (matchesPrefix(pathname, "/orders")) return "orders";
  if (matchesPrefix(pathname, "/profile")) return "profile";
  return null;
}

export function homeHref(hasLocation: boolean): string {
  return hasLocation ? "/browse" : "/";
}
