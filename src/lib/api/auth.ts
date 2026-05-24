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
  /** When non-null the backend is saying "we already have an
   *  account for this phone — confirm it's the same person before
   *  we hand over a token." Shape comes from
   *  CustomerAuthController@exist_user. */
  is_exist_user: ExistingUserRaw | null;
  login_type: "otp" | "social" | "manual";
  email: string | null;
};

type ExistingUserRaw = {
  id: number;
  name: string;
  image?: string | null;
};

export type ExistingUser = {
  id: number;
  name: string;
  imageUrl: string | null;
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
  | { ok: true; kind: "signed-in"; token: string }
  | { ok: true; kind: "needs-profile"; phone: string }
  | { ok: true; kind: "confirm-existing"; existing: ExistingUser; phone: string }
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

/** Phone + OTP -> outcome. Hits /auth/verify-phone (NOT /auth/login).
 *
 *  Three possible "ok" outcomes:
 *    - signed-in        token in hand, we're done.
 *    - confirm-existing backend found an unverified-but-existing
 *                       account on this phone. Caller must show a
 *                       confirmation step ("is this you?") then call
 *                       confirmExistingUser() with the same OTP.
 *    - needs-profile    no user on file; backend created a blank
 *                       shell. Caller must collect name + email
 *                       and POST /auth/update-info.
 *
 *  Note: the confirm-existing branch does NOT delete the
 *  phone_verifications row, so the OTP is still valid for the
 *  follow-up /auth/login call. */
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
  const { token, is_personal_info, is_exist_user } = res.data;

  if (token && is_personal_info === 1) {
    return { ok: true, kind: "signed-in", token };
  }
  if (is_exist_user && typeof is_exist_user === "object") {
    return {
      ok: true,
      kind: "confirm-existing",
      phone,
      existing: {
        id: is_exist_user.id,
        name: is_exist_user.name,
        imageUrl: is_exist_user.image ?? null,
      },
    };
  }
  return { ok: true, kind: "needs-profile", phone };
}

/** "Yes it's me" follow-up after verifyLoginOtp returns
 *  kind:"confirm-existing". POST /auth/login with verified:"yes"
 *  (the literal string — DO NOT use boolean true; that loose-equals
 *  "no" in PHP and triggers the destructive branch). Uses the same
 *  OTP from the verify step, which is still in phone_verifications. */
export async function confirmExistingUser(
  phone: string,
  otp: string,
): Promise<ManualLoginResult> {
  const res = await api<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: {
      login_type: "otp",
      phone,
      otp,
      verified: "yes",
    },
    unauth: true,
  });
  if (!res.ok) {
    if ("skipped" in res) return { ok: false, message: "Backend not configured." };
    return { ok: false, ...backendError(res) };
  }
  if (res.data.token) return { ok: true, token: res.data.token };
  return {
    ok: false,
    message:
      "Couldn't issue a session token after confirmation. Try signing in again.",
  };
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
