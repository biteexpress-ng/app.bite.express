"use client";

import { api } from "@/lib/api-client";

/**
 * Wallet + Dedicated Virtual Account (auth-only).
 *
 * Backend:
 *   GET /api/v1/customer/virtual-account  - lazy-creates a Paystack
 *                                           Titan DVA on first hit
 *                                           and returns:
 *     {
 *       success: true,
 *       message: "Virtual account found",
 *       data: {
 *         account_name,
 *         account_number,
 *         bank_name,
 *         bank_name_label,
 *         bank_slug,
 *         currency
 *       }
 *     }
 *
 *   GET /api/v1/customer/wallet/transactions - paginated wallet
 *                                              history (not used
 *                                              in v0)
 *
 * The wallet *balance* lives on /api/v1/customer/info -> wallet_balance,
 * which the auth profile fetch already pulls.
 */

export type VirtualAccount = {
  account_name: string;
  account_number: string;
  bank_name: string;
  bank_name_label: string;
  bank_slug?: string;
  currency: string;
};

type VirtualAccountEnvelope = {
  success: boolean;
  message?: string;
  data?: VirtualAccount;
};

export type VirtualAccountResult =
  | { ok: true; account: VirtualAccount }
  | { ok: false; message: string };

export async function fetchVirtualAccount(): Promise<VirtualAccountResult> {
  const res = await api<VirtualAccountEnvelope>(
    "/api/v1/customer/virtual-account",
  );
  if (res.ok) {
    if (res.data.success && res.data.data) {
      return { ok: true, account: res.data.data };
    }
    return {
      ok: false,
      message: res.data.message || "Virtual account unavailable.",
    };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}
