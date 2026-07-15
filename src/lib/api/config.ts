"use client";

import { api } from "@/lib/api-client";

/**
 * GET /api/v1/config
 *
 * The backend returns a very large settings blob. We deliberately type
 * and keep only what we use, so this file doesn't become a dumping
 * ground that has to track every backend setting.
 *
 * `offline_payment_status` is emitted as an int 0|1 at
 * ConfigController.php:396 and is the ONLY offline-payment gate the
 * backend actually enforces (PlaceNewOrder.php:681-685).
 */
export type AppConfig = {
  offline_payment_status: number;
};

type ConfigResponse = {
  offline_payment_status?: number | string;
};

export type ConfigResult =
  | { ok: true; config: AppConfig }
  | { ok: false; message: string };

/** Matches the zone-check cache TTL in welcome/zone-result.tsx. */
const CACHE_TTL_MS = 30 * 60 * 1000;

let cache: { at: number; config: AppConfig } | null = null;

/** Exported for tests and for the rare caller that needs a fresh read. */
export function clearConfigCache(): void {
  cache = null;
}

export async function fetchConfig(): Promise<ConfigResult> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { ok: true, config: cache.config };
  }

  const res = await api<ConfigResponse>("/api/v1/config");

  if (res.ok) {
    const config: AppConfig = {
      offline_payment_status: Number(res.data.offline_payment_status ?? 0),
    };
    cache = { at: Date.now(), config };
    return { ok: true, config };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}
