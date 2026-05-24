"use client";

import { api } from "@/lib/api-client";
import type { AuthUser } from "@/lib/auth";

/**
 * Typed wrappers for the customer auth endpoints on dashboard.bite.express.
 *
 * OTP flow (the only login method in v0):
 *
 *   1. requestLoginOtp(phone)
 *        POST /auth/login {login_type:"otp", phone}
 *        Backend's send_otp() path — issues a phone_verifications row
 *        and sends an SMS. No `verified` field.
 *
 *   2. verifyLoginOtp(phone, otp)
 *        POST /auth/verify-phone {phone, otp, login_type:"otp", verification_type:"phone"}
 *        This is a DIFFERENT endpoint from /auth/login.
 *
 *        Returning customer (is_phone_verified=1, has f_name)
 *          → {token, is_personal_info: 1} — signed in.
 *
 *        Brand-new customer (no user row yet)
 *          → backend creates a blank User with is_phone_verified=1
 *            → {token: null, is_personal_info: 0} — client must
 *               call completeProfile().
 *
 *   3. completeProfile({name, phone, email})
 *        POST /auth/update-info — only for brand-new users.
 *
 * DO NOT post {login_type:"otp", verified: …} to /auth/login. That
 * goes through otp_login() (CustomerAuthController.php line 848+)
 * which compares `verified == 'no'` via PHP loose equality —
 * `true == 'no'` is TRUE in PHP, so JSON `true` triggers the
 * destructive "nullify existing user's phone + create a fresh
 * blank user" branch. Use /auth/verify-phone instead.
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

/** Step 2 — phone + OTP → token (or "needs profile completion" hint).
 *
 *  Posts to /auth/verify-phone (NOT /auth/login). See the file-top
 *  comment for why — /auth/login with verified:true silently
 *  destroys the existing user's phone column. */
export async function verifyLoginOtp(
  phone: string,
  otp: string,
): Promise<OtpVerifyResult> {
  const res = await api<LoginResponse>("/api/v1/auth/verify-phone", {
    method: "POST",
    body: {
      phone,
      otp,
      login_type: "otp",
      verification_type: "phone",
    },
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
  // is_personal_info === 0 means brand-new user — backend created a
  // blank User row; client must fill name + email next.
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
