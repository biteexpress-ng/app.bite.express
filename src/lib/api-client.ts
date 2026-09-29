import { getAuthToken } from "./auth";

/**
 * BiteExpress customer-app API client.
 *
 * Talks to the same Laravel backend as the marketing site, but with
 * a few key differences:
 *   - Almost every request runs CLIENT-SIDE (after auth hydrates from
 *     localStorage), so we read the bearer token per-call.
 *   - Sends the canonical 6amMart headers the backend recognises
 *     (X-software-id, X-localization, origin, Accept), plus X-Client
 *     so orders placed here are tagged as web-app orders.
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

export type ErrorBody = {
  message?: string;
  /** Offline-payment endpoints return {"payment": "<exception message>"}
   *  on failure (OrderController.php:470-540). It carries no `errors`
   *  key and no top-level `message`, so without an explicit branch it
   *  would fall through to the generic "Something went wrong" text and
   *  the real reason would be lost. */
  payment?: string;
  errors?:
    | string
    | Record<string, string[]>
    | Array<{ code?: string; message?: string }>;
};

export type ParsedError = {
  message: string;
  errors?: Record<string, string[]>;
};

/**
 * Normalise Laravel's four different error-body shapes into one result.
 * Extracted from `api()` so it can be unit-tested without mocking fetch.
 * Returns an empty message when nothing usable is present; the caller
 * is responsible for the final fallback.
 */
export function parseErrorBody(errBody: ErrorBody): ParsedError {
  let message = "";
  let errors: Record<string, string[]> | undefined;

  if (Array.isArray(errBody.errors)) {
    // Laravel Helpers::error_processor returns [{code, message}].
    // Promote into both the top-level `message` AND a Record so
    // field-level UIs can highlight the offending input.
    const first = errBody.errors[0]?.message;
    if (first) message = first;
    const map: Record<string, string[]> = {};
    for (const e of errBody.errors) {
      if (e.code && e.message) {
        if (!map[e.code]) map[e.code] = [];
        map[e.code].push(e.message);
      }
    }
    if (Object.keys(map).length > 0) errors = map;
  } else if (typeof errBody.errors === "string") {
    // The auth / zone / module middleware returns a bare string,
    // e.g. {"errors":"Unauthorized"}. Without this branch the
    // message stayed empty and the UI showed a blank red toast.
    message = errBody.errors;
  } else if (errBody.errors && typeof errBody.errors === "object") {
    // Laravel's default validation shape: {field: ["msg", ...]}.
    errors = errBody.errors;
    const firstField = Object.values(errBody.errors)[0];
    if (Array.isArray(firstField) && firstField[0]) {
      message = firstField[0];
    }
  }

  // A top-level `message` (Laravel exceptions / abort()) wins only
  // when we haven't already found something more specific above.
  if (!message && errBody.message) message = errBody.message;

  // Same rule for the offline-payment exception shape.
  if (!message && typeof errBody.payment === "string") message = errBody.payment;

  return { message, errors };
}

/**
 * HTTP 203 is a 2xx, so `res.ok` is true for it, but the backend uses it
 * to REFUSE: place-order and price-check/accept both return 203 with an
 * errors array when the total is over the module's cash-on-delivery
 * ceiling. Read as a success it shows the customer a confirmed order that
 * does not exist. See the price-check API contract, section 7.0.
 *
 * Only 203 is reinterpreted. A blanket "any 2xx with an errors key"
 * rule would let an unrelated endpoint that echoes an empty errors
 * array start failing its own callers.
 */
export function isRefusalBody(status: number, body: ErrorBody): boolean {
  if (status !== 203) return false;
  // Check if the raw body has a usable errors key (any shape: array, string, object).
  // A 203 with an empty errors array or a message-only body is not a refusal.
  if (!body.errors) return false;
  if (Array.isArray(body.errors) && body.errors.length === 0) return false;
  return true;
}

/**
 * What a customer reads when no HTTP answer arrived at all. The raw
 * exception text ("signal timed out", "Failed to fetch", "Load failed")
 * differs per browser and tells them nothing, so it never reaches the UI.
 * Callers that need to know an answer is missing check `status === 0`,
 * not this text.
 */
export function networkErrorMessage(err: unknown): string {
  const name = err instanceof Error || err instanceof DOMException ? err.name : "";
  // Older Safari aborts AbortSignal.timeout() with AbortError instead.
  if (name === "TimeoutError" || name === "AbortError") {
    return "The server took too long to answer. Check your connection and try again.";
  }
  // fetch() rejects with a TypeError when the network is down, DNS
  // fails, or CORS blocks the response.
  if (err instanceof TypeError) {
    return "We couldn't reach BiteExpress. Check your connection and try again.";
  }
  return "Something went wrong. Please try again.";
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
    // The backend stamps orders placed with this header as source='web',
    // which is what puts the web-app icon on the admin order list.
    "X-Client": "web-app",
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
      // NOTE: `res.statusText` is ALWAYS "" over HTTP/2 (and HTTP/3),
      // which is how Cloudflare serves this API to browsers — there's
      // no reason-phrase in the protocol. So it can never be trusted
      // as a fallback message; we only use it if it's actually present.
      let message = "";
      let errors: Record<string, string[]> | undefined;
      try {
        const parsed = parseErrorBody((await res.json()) as ErrorBody);
        message = parsed.message;
        errors = parsed.errors;
      } catch {
        /* response wasn't JSON (HTML error page, empty body, etc.) */
      }
      // Never surface an empty message — it renders as a contentless
      // toast. Fall back to statusText when the protocol provides one,
      // otherwise a human-readable line that still carries the status
      // code for support/diagnosis.
      if (!message) {
        message =
          res.statusText ||
          `Something went wrong (error ${res.status}). Please try again.`;
      }
      return { ok: false, status: res.status, message, errors };
    }

    const raw: unknown = await res.json();

    if (isRefusalBody(res.status, raw as ErrorBody)) {
      const parsed = parseErrorBody(raw as ErrorBody);
      return {
        ok: false,
        status: res.status,
        message:
          parsed.message ||
          `Something went wrong (error ${res.status}). Please try again.`,
        errors: parsed.errors,
      };
    }

    return { ok: true, data: raw as T };
  } catch (err) {
    return { ok: false, status: 0, message: networkErrorMessage(err) };
  }
}
