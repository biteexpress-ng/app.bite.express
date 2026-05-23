import { getAuthToken } from "./auth";

/**
 * BiteExpress customer-app API client.
 *
 * Talks to the same Laravel backend as the marketing site, but with
 * a few key differences:
 *   - Almost every request runs CLIENT-SIDE (after auth hydrates from
 *     localStorage), so we read the bearer token per-call.
 *   - Sends the canonical 6amMart headers the backend recognises
 *     (X-software-id, X-localization, origin, Accept).
 *   - Returns a discriminated `ApiResult` union — callers never have
 *     to try/catch fetch themselves.
 *
 * On 401: clears the in-memory token isn't this layer's job — the
 * AuthProvider listens for the `biteexpress:auth-expired` window
 * event we dispatch here and signs the user out cleanly.
 */

const SOFTWARE_ID = "33571750";

type RequestOpts = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown> | FormData;
  headers?: Record<string, string>;
  /** Override the auto-injected token (e.g. for unauthenticated calls). */
  token?: string | null;
  /** Locale for X-localization. Defaults to "en". */
  locale?: string;
  /** Skip token injection entirely (e.g. for /auth/login). */
  unauth?: boolean;
  /** Hard timeout (ms). Defaults to 15s. */
  timeoutMs?: number;
  /** Extra headers commonly needed by the backend on geo-aware calls. */
  zoneId?: number | number[];
  latitude?: number;
  longitude?: number;
  moduleId?: number;
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; status: number; message: string; errors?: Record<string, string[]> };

function apiBase(): string | null {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? null;
  return base ? base.replace(/\/$/, "") : null;
}

function publicOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://app.bite.express"
  );
}

export async function api<T>(
  path: string,
  opts: RequestOpts = {},
): Promise<ApiResult<T>> {
  const base = apiBase();
  if (!base) {
    return {
      ok: false,
      skipped: true,
      reason: "NEXT_PUBLIC_API_BASE_URL not set — backend call skipped.",
    };
  }

  const token = opts.unauth ? null : (opts.token ?? getAuthToken());

  const headers: Record<string, string> = {
    "X-software-id": SOFTWARE_ID,
    "X-localization": opts.locale ?? "en",
    origin: publicOrigin(),
    Accept: "application/json",
    ...opts.headers,
  };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.zoneId !== undefined) {
    headers.zoneId = JSON.stringify(
      Array.isArray(opts.zoneId) ? opts.zoneId : [opts.zoneId],
    );
  }
  if (opts.moduleId !== undefined) headers.moduleId = String(opts.moduleId);
  if (opts.latitude !== undefined) headers.latitude = String(opts.latitude);
  if (opts.longitude !== undefined) headers.longitude = String(opts.longitude);

  const isFormData = opts.body instanceof FormData;
  let body: BodyInit | undefined;
  if (opts.body) {
    if (isFormData) {
      body = opts.body as FormData;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
  }

  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  try {
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    });

    if (res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("biteexpress:auth-expired"));
    }

    if (!res.ok) {
      let message = res.statusText;
      let errors: Record<string, string[]> | undefined;
      try {
        const errBody = (await res.json()) as {
          message?: string;
          errors?: Record<string, string[]> | Array<{ message?: string }>;
        };
        if (errBody.message) message = errBody.message;
        if (Array.isArray(errBody.errors)) {
          const first = errBody.errors[0]?.message;
          if (first) message = first;
        } else if (errBody.errors) {
          errors = errBody.errors;
        }
      } catch {
        /* response wasn't JSON — keep statusText */
      }
      return { ok: false, status: res.status, message, errors };
    }

    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, message };
  }
}
