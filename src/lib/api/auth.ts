"use client";

import { api } from "@/lib/api-client";
import type { AuthUser } from "@/lib/auth";

/**
 * Typed wrappers for the customer auth endpoints on dashboard.bite.express.
 *
 * The Laravel CustomerAuthController is one endpoint (`POST /auth/login`)
 * that branches on `login_type`. For the customer web app we only use
 * OTP login (phone + 6-digit code) — manual password and social signin
 * are skipped for v0.
 *
 * Flow:
 *   1. requestLoginOtp(phone)            → SMS OTP sent
 *   2. verifyLoginOtp(phone, otp)        → returns {token, isPersonalInfo}
 *      - if isPersonalInfo == 1 → token is non-null, signed-in
 *      - if isPersonalInfo == 0 → token is null, brand-new user, go to step 3
 *   3. completeProfile({name, email})    → returns token, signed-in
 */

type LoginResponse = {
  token: string | null;
  is_phone_verified: 0 | 1;
  is_email_verified: 0 | 1;
  is_personal_info: 0 | 1;
  is_exist_user: number | null;
  login_type: "otp" | "social" | "manual";
  email: string | null;
};

export type OtpRequestResult =
  | { ok: true }
  | { ok: false; message: string; code?: string };

export type OtpVerifyResult =
  | { ok: true; needsProfile: true; phone: string }
  | { ok: true; needsProfile: false; token: string }
  | { ok: false; message: string; code?: string };

export type ProfileCompleteResult =
  | { ok: true; token: string }
  | { ok: false; message: string };

export type ProfileFetchResult =
  | { ok: true; user: AuthUser }
  | { ok: false; message: string };

function backendError(
  res: { message: string; errors?: Record<string, string[]> },
): { message: string; code?: string } {
  // CustomerAuthController returns { errors: [{ code, message }] } shapes.
  // api-client already collapses that into a top-level `message` when the
  // array contains one entry — we just surface it.
  return { message: res.message };
}

/** Step 1 — phone number → SMS OTP. */
export async function requestLoginOtp(phone: string): Promise<OtpRequestResult> {
  const res = await api<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: { login_type: "otp", phone },
    unauth: true,
  });
  if (res.ok) return { ok: true };
  if ("skipped" in res) {
    return { ok: false, message: "Backend not configured yet." };
  }
  return { ok: false, ...backendError(res) };
}

/** Step 2 — phone + OTP → token (or "needs profile completion" hint). */
export async function verifyLoginOtp(
  phone: string,
  otp: string,
): Promise<OtpVerifyResult> {
  const res = await api<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: { login_type: "otp", phone, otp, verified: true },
    unauth: true,
  });
  if (!res.ok) {
    if ("skipped" in res) {
      return { ok: false, message: "Backend not configured yet." };
    }
    return { ok: false, ...backendError(res) };
  }

  const { token, is_personal_info } = res.data;
  if (token && is_personal_info === 1) {
    return { ok: true, needsProfile: false, token };
  }
  // is_personal_info === 0 means brand-new user — token is null until
  // the profile is filled in.
  return { ok: true, needsProfile: true, phone };
}

/** Step 3 (new users only) — full name + email → token. */
export async function completeProfile(input: {
  name: string;
  phone: string;
  email: string;
}): Promise<ProfileCompleteResult> {
  const res = await api<LoginResponse>("/api/v1/auth/update-info", {
    method: "POST",
    body: { ...input, login_type: "otp" },
    unauth: true,
  });
  if (!res.ok) {
    if ("skipped" in res) {
      return { ok: false, message: "Backend not configured yet." };
    }
    return { ok: false, message: res.message };
  }
  if (!res.data.token) {
    return {
      ok: false,
      message: "Profile saved but no auth token returned. Try signing in again.",
    };
  }
  return { ok: true, token: res.data.token };
}

/** Fetch the signed-in customer profile. Requires bearer token. */
export async function fetchProfile(): Promise<ProfileFetchResult> {
  const res = await api<AuthUser>("/api/v1/customer/info");
  if (res.ok) return { ok: true, user: res.data };
  if ("skipped" in res) {
    return { ok: false, message: "Backend not configured yet." };
  }
  return { ok: false, message: res.message };
}
