"use client";

import { api } from "@/lib/api-client";
import type { AuthUser } from "@/lib/auth";

/**
 * Typed wrappers for the customer auth endpoints on dashboard.bite.express.
 *
 * Sign-in flow (web-app convention):
 *
 *   1. checkPhone(phone)
 *        POST /auth/check-phone
 *        Returns { exists, hasPassword, isPhoneVerified } so the UI
 *        can decide whether to show the password field, the OTP
 *        fallback, or the "not on BiteExpress, sign up" prompt.
 *
 *   2a. manualLogin(phone, password)
 *         POST /auth/login {login_type:"manual", field_type:"phone", …}
 *         Returns the token on success.
 *
 *   2b. requestLoginOtp(phone) + verifyLoginOtp(phone, otp)
 *         Fallback when the user has forgotten the password.
 *
 *   completeProfile({name, phone, email})
 *         POST /auth/update-info — covers the rare "phone has an
 *         account but no f_name yet" edge case.
 *
 *   register({...})
 *         POST /auth/sign-up — creates the user + returns a token
 *         in one shot, no OTP step.
 *
 * Don't post {login_type:"otp", verified:…} to /auth/login. PHP loose
 * equality (`true == "no"` is TRUE) triggers a destructive branch in
 * the backend's otp_login() that nullifies the existing user's
 * phone column and creates a blank twin. Use /auth/verify-phone for
 * OTP checks.
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

type CheckPhoneResponse = {
  exists: boolean;
  has_password: boolean;
  is_phone_verified: 0 | 1;
};

type RegisterResponse = {
  token?: string | null;
  message?: string;
};

export type CheckPhoneResult =
  | {
      ok: true;
      exists: boolean;
      hasPassword: boolean;
      isPhoneVerified: boolean;
    }
  | { ok: false; message: string };

export type ManualLoginResult =
  | { ok: true; token: string }
  | { ok: false; message: string; code?: string };

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

export type RegisterInput = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  refCode?: string;
};

export type RegisterResult =
  | { ok: true; token: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

function backendError(res: {
  message: string;
  errors?: Record<string, string[]>;
}): { message: string; code?: string } {
  return { message: res.message };
}

/* -------------------------------------------------------------- */
/* Phone existence + manual login                                 */
/* -------------------------------------------------------------- */

/** Look up whether a phone is on file and whether the account has
 *  a real password set (vs the OTP-only placeholder bcrypt(phone)). */
export async function checkPhone(phone: string): Promise<CheckPhoneResult> {
  const res = await api<CheckPhoneResponse>("/api/v1/auth/check-phone", {
    method: "POST",
    body: { phone },
    unauth: true,
  });
  if (res.ok) {
    return {
      ok: true,
      exists: !!res.data.exists,
      hasPassword: !!res.data.has_password,
      isPhoneVerified: res.data.is_phone_verified === 1,
    };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}

/** Manual phone+password login. Returns a token on success. */
export async function manualLogin(
  phone: string,
  password: string,
): Promise<ManualLoginResult> {
  const res = await api<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: {
      login_type: "manual",
      field_type: "phone",
      email_or_phone: phone,
      password,
    },
    unauth: true,
  });
  if (res.ok) {
    if (res.data.token) return { ok: true, token: res.data.token };
    return {
      ok: false,
      message:
        "We couldn't issue a session token — please use the OTP option instead.",
    };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, ...backendError(res) };
}

/* -------------------------------------------------------------- */
/* OTP fallback                                                   */
/* -------------------------------------------------------------- */

/** Phone -> SMS OTP. Send before showing the OTP entry step. */
export async function requestLoginOtp(phone: string): Promise<OtpRequestResult> {
  const res = await api<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: { login_type: "otp", phone },
    unauth: true,
  });
  if (res.ok) return { ok: true };
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, ...backendError(res) };
}

/** Phone + OTP -> token. Hits /auth/verify-phone (NOT /auth/login). */
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
    if ("skipped" in res) return { ok: false, message: "Backend not configured." };
    return { ok: false, ...backendError(res) };
  }
  const { token, is_personal_info } = res.data;
  if (token && is_personal_info === 1) {
    return { ok: true, needsProfile: false, token };
  }
  return { ok: true, needsProfile: true, phone };
}

/* -------------------------------------------------------------- */
/* Profile completion (edge case) + Profile fetch                 */
/* -------------------------------------------------------------- */

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
    if ("skipped" in res) return { ok: false, message: "Backend not configured." };
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

export async function fetchProfile(): Promise<ProfileFetchResult> {
  const res = await api<AuthUser>("/api/v1/customer/info");
  if (res.ok) return { ok: true, user: res.data };
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}

/* -------------------------------------------------------------- */
/* Sign-up                                                         */
/* -------------------------------------------------------------- */

/** POST /auth/sign-up. Returns a session token directly on success. */
export async function register(input: RegisterInput): Promise<RegisterResult> {
  const body: Record<string, unknown> = {
    f_name: input.firstName,
    l_name: input.lastName,
    email: input.email,
    phone: input.phone,
    password: input.password,
  };
  if (input.refCode) body.ref_code = input.refCode;

  const res = await api<RegisterResponse>("/api/v1/auth/sign-up", {
    method: "POST",
    body,
    unauth: true,
  });
  if (res.ok) {
    if (res.data.token) return { ok: true, token: res.data.token };
    return {
      ok: false,
      message:
        res.data.message ??
        "Account created but no session token was issued. Try signing in.",
    };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return {
    ok: false,
    message: res.message,
    fieldErrors: res.errors,
  };
}
