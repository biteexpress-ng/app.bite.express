import type { Module } from "@/lib/api/modules";

export type ModuleEntry = { href: string; subtitle: string; showCount: boolean };

/**
 * Where a module card on /browse leads. The parcel module has no shops,
 * so it goes to /send instead of a store list. It only reaches this list
 * when a zone offers it, because /api/v1/module is filtered by zone.
 */
export function moduleEntry(m: Pick<Module, "id" | "module_type" | "stores_count">): ModuleEntry {
  if (m.module_type === "parcel") {
    return { href: "/send", subtitle: "Send a package across town", showCount: false };
  }
  const count = m.stores_count ?? 0;
  return {
    href: `/browse/${m.id}`,
    subtitle: count > 0 ? `Explore ${count} shops` : "Coming soon",
    showCount: count > 0,
  };
}
