"use client";

import { api } from "@/lib/api-client";

/**
 * GET /api/v1/module
 *
 * The endpoint returns ALL active modules when no `zoneId` header is
 * sent, or only those serving the given zone(s) when it is.
 *
 * We always pass zoneIds so the customer only sees what they can
 * actually order from. If `stores_count` is 0 we still surface the
 * module (the user can still browse the empty list) but mark it as
 * "no stores yet" in the UI.
 */

export type Module = {
  id: number;
  module_name: string;
  module_type: string;
  icon_full_url?: string | null;
  thumbnail_full_url?: string | null;
  description?: string | null;
  stores_count?: number;
  items_count?: number;
  status?: string | number;
};

export type ModulesResult =
  | { ok: true; modules: Module[] }
  | { ok: false; message: string };

export async function fetchModules(zoneIds: number[]): Promise<ModulesResult> {
  const res = await api<Module[]>("/api/v1/module", {
    unauth: true,
    zoneId: zoneIds.length > 0 ? zoneIds : undefined,
  });
  if (res.ok) return { ok: true, modules: res.data };
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}
