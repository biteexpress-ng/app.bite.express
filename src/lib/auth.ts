/**
 * Bearer-token auth — minimal pure-functions layer.
 *
 * Tokens live in localStorage under `biteexpress.auth`. The auth
 * store (lib/auth-store.ts) is the React-facing wrapper; this file
 * is the SSR-safe primitive that store + api-client both call into.
 *
 * Why localStorage and not httpOnly cookies?
 *   - Matches the existing customer-app pattern (BiteExpress Laravel
 *     backend issues a Bearer token from /api/v1/auth/login etc.)
 *   - Cookie + CORS setup against the Laravel API would need backend
 *     changes; localStorage doesn't.
 *   - We accept the XSS-exposure tradeoff — content is sanitized
 *     server-side, no user-generated HTML rendered as markup.
 */

const STORAGE_KEY = "biteexpress.auth";

export type AuthUser = {
  id: number;
  f_name: string;
  l_name?: string | null;
  email?: string | null;
  phone?: string | null;
  image?: string | null;
};

export type AuthSnapshot = {
  token: string | null;
  user: AuthUser | null;
};

const EMPTY: AuthSnapshot = { token: null, user: null };

/** Safe read — returns EMPTY in SSR / when nothing is stored. */
export function readAuth(): AuthSnapshot {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as AuthSnapshot;
    if (!parsed || typeof parsed !== "object") return EMPTY;
    return {
      token: typeof parsed.token === "string" ? parsed.token : null,
      user: parsed.user ?? null,
    };
  } catch {
    return EMPTY;
  }
}

export function writeAuth(snapshot: AuthSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    // Broadcast so other tabs / hooks watching for changes can react.
    window.dispatchEvent(new Event("biteexpress:auth"));
  } catch {
    /* quota or denied — best-effort */
  }
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("biteexpress:auth"));
  } catch {
    /* ignore */
  }
}

/** Synchronous token getter — used by api-client.ts on every request. */
export function getAuthToken(): string | null {
  return readAuth().token;
}
