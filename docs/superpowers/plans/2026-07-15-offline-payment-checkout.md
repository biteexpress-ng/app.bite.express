# Offline Payment at Web Checkout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a customer on app.bite.express pay for an order by bank transfer (offline payment), reaching parity with the Flutter app and WhatsApp ordering, which already run this in production.

**Architecture:** Mirror the Flutter app. The customer picks Pay Offline and a bank at `/checkout`, the order is placed, then they land on `/checkout/offline/[orderId]` which shows the destination account, the authoritative amount, and an admin-defined dynamic form. Submitting flips the order from `failed` to `pending` for manual admin verification. The same page handles edits after a denial.

**Tech Stack:** Next.js 16.2.6 (App Router), React 19.2.4, TypeScript, Tailwind v4 (CSS-first `@theme` tokens), Zustand, vitest (introduced by this plan).

**Spec:** `docs/superpowers/specs/2026-07-15-offline-payment-checkout-design.md`

**Branch:** `feat/offline-payment-checkout`

## Global Constraints

- **Never navigate away from `/checkout/offline/[orderId]` on a failed submit.** The order already exists at that point. Show an inline error and let the customer retry.
- **The offline method list endpoint returns literal JSON `null`, not `[]`,** when there are zero active methods. Always coerce with `Array.isArray(...) ? ... : []`.
- **`is_required` is not enforced server-side.** Validate it client-side or blank required fields save successfully.
- **`customer_input` keys are POSTed verbatim and flat at the top level.** Never nest them, never construct them client-side (they are slugified server-side: "Sender's Name" → `senders_name`).
- **On the update endpoint: never send `method_id`, and always send the full form.** The backend re-reads the method from stored `payment_info` and rebuilds the field object from scratch, so omitted fields are deleted.
- **The `offline_payment` block comes from `/customer/order/track`, NOT `/customer/order/details`.** The latter eager-loads `offline_payments` and then ignores it, returning a line-item array.
- **Forms are hand-rolled `useState`.** `react-hook-form` and `zod` are in `package.json` but have zero imports in `src/`. Do not introduce them.
- **Copy style: no em-dashes in new customer-facing strings.** Use commas, colons, or semicolons. (Existing strings in the codebase have them; leave those alone.)
- **Do not force-kill Node processes on this Windows machine.** It has caused BSODs. Use `npm run build` rather than probing a dev server.
- Conditional classes go through `cn()` from `@/lib/cn`. Spinners are `<Loader2 size={16} className="animate-spin" />`.
- Comment density: this codebase documents the backend contract inline with PHP file:line references. Match it.

---

### Task 1: Test runner + `parseErrorBody` extraction and the `payment` branch

Establishes vitest (the repo has none) and fixes shared error handling first, because every later task depends on readable error messages.

**Why this is needed:** `api<T>()` discards the raw error body and returns only `{ ok, status, message, errors }`. The offline endpoints return `403 {"payment": "<exception message>"}`, which matches none of the three shapes the parser knows, so it falls through to the generic "Something went wrong (error 403)" and the real reason is lost. It must be fixed here; no downstream wrapper can recover it.

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/api-client.test.ts`
- Modify: `package.json` (add `test` script + devDependencies)
- Modify: `src/lib/api-client.ts:116-173`

**Interfaces:**
- Consumes: nothing
- Produces: `parseErrorBody(body: ErrorBody): ParsedError` exported from `@/lib/api-client`, where `ParsedError = { message: string; errors?: Record<string, string[]> }`

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest@^3
```

- [ ] **Step 2: Add the config and test script**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
```

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Write the failing tests**

Create `src/lib/api-client.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseErrorBody } from "@/lib/api-client";

describe("parseErrorBody", () => {
  it("reads Laravel error_processor arrays into message and errors", () => {
    const r = parseErrorBody({
      errors: [{ code: "order_id", message: "The order id field is required." }],
    });
    expect(r.message).toBe("The order id field is required.");
    expect(r.errors).toEqual({
      order_id: ["The order id field is required."],
    });
  });

  it("reads a bare-string errors body from the auth middleware", () => {
    const r = parseErrorBody({ errors: "Unauthorized" });
    expect(r.message).toBe("Unauthorized");
  });

  it("reads Laravel's default validation map", () => {
    const r = parseErrorBody({ errors: { phone: ["The phone field is required."] } });
    expect(r.message).toBe("The phone field is required.");
    expect(r.errors).toEqual({ phone: ["The phone field is required."] });
  });

  it("falls back to a top-level message", () => {
    const r = parseErrorBody({ message: "Server exploded" });
    expect(r.message).toBe("Server exploded");
  });

  // The new branch. OrderController.php:470-540 returns
  // 403 {"payment": "<exception message>"} with no `errors` key at all.
  it("reads the offline-payment {payment: string} exception body", () => {
    const r = parseErrorBody({ payment: "Offline payment is not available." });
    expect(r.message).toBe("Offline payment is not available.");
  });

  it("prefers a specific errors message over the payment key", () => {
    const r = parseErrorBody({
      errors: [{ code: "offline_payment_status", message: "Not available right now." }],
      payment: "generic",
    });
    expect(r.message).toBe("Not available right now.");
  });

  it("returns an empty message when the body carries nothing usable", () => {
    expect(parseErrorBody({}).message).toBe("");
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `parseErrorBody` is not exported from `@/lib/api-client`.

- [ ] **Step 5: Extract and extend `parseErrorBody`**

In `src/lib/api-client.ts`, add above `export async function api<T>(`:

```ts
type ErrorBody = {
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
```

Then replace the body of the `if (!res.ok) {` block (currently `api-client.ts:116-173`) with:

```ts
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 7 tests.

- [ ] **Step 7: Verify nothing else broke**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts package.json package-lock.json src/lib/api-client.ts src/lib/api-client.test.ts
git commit -m "feat: parse the offline-payment {payment: string} error body

Extracts parseErrorBody from api() so Laravel's error shapes can be
unit-tested without mocking fetch, and adds a fourth branch for the
{\"payment\": \"...\"} body the offline-payment endpoints return on
failure. Without it those 403s rendered as the generic \"Something
went wrong\" and the real reason was discarded.

Introduces vitest; the repo had no test runner."
```

---

### Task 2: Pure gating and validation rules

**Files:**
- Create: `src/lib/offline-payment-rules.ts`
- Create: `src/lib/offline-payment-rules.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type OfflineMethodField = { input_name: string; input_data: string }`
  - `type OfflineMethodInformation = { customer_input: string; customer_placeholder: string; is_required: number | boolean | string }`
  - `type OfflinePaymentMethod = { id: number; method_name: string; method_fields: OfflineMethodField[]; method_informations: OfflineMethodInformation[]; status: number }`
  - `canUseOfflinePayment(input: { offlinePaymentStatus: number | null | undefined; zoneOfflinePayment: boolean | number | null | undefined; methods: OfflinePaymentMethod[] | null | undefined }): boolean`
  - `validateOfflineForm(method: OfflinePaymentMethod, values: Record<string, string>): Record<string, string>`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/offline-payment-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  canUseOfflinePayment,
  validateOfflineForm,
  type OfflinePaymentMethod,
} from "@/lib/offline-payment-rules";

const method: OfflinePaymentMethod = {
  id: 1,
  method_name: "Bank Transfer",
  method_fields: [{ input_name: "bank_name", input_data: "GTBank" }],
  method_informations: [
    {
      customer_input: "sender_name",
      customer_placeholder: "Name on the account",
      is_required: 1,
    },
    {
      customer_input: "transaction_reference",
      customer_placeholder: "Reference number",
      is_required: 0,
    },
  ],
  status: 1,
};

describe("canUseOfflinePayment", () => {
  const on = {
    offlinePaymentStatus: 1,
    zoneOfflinePayment: true,
    methods: [method],
  };

  it("allows when the global flag, the zone flag and a method are all present", () => {
    expect(canUseOfflinePayment(on)).toBe(true);
  });

  it("blocks when the global flag is off", () => {
    expect(canUseOfflinePayment({ ...on, offlinePaymentStatus: 0 })).toBe(false);
  });

  it("blocks when the zone flag is off", () => {
    expect(canUseOfflinePayment({ ...on, zoneOfflinePayment: false })).toBe(false);
  });

  it("blocks when there are no methods", () => {
    expect(canUseOfflinePayment({ ...on, methods: [] })).toBe(false);
  });

  // ConfigController.php:1076-1082 returns literal `null`, not [].
  it("blocks when the method list came back as null", () => {
    expect(canUseOfflinePayment({ ...on, methods: null })).toBe(false);
  });

  it("blocks when config could not be read", () => {
    expect(canUseOfflinePayment({ ...on, offlinePaymentStatus: undefined })).toBe(
      false,
    );
  });

  it("accepts the zone flag as a numeric 1", () => {
    expect(canUseOfflinePayment({ ...on, zoneOfflinePayment: 1 })).toBe(true);
  });
});

describe("validateOfflineForm", () => {
  it("passes when required fields are filled", () => {
    expect(validateOfflineForm(method, { sender_name: "Ada" })).toEqual({});
  });

  it("flags a missing required field", () => {
    expect(validateOfflineForm(method, {})).toEqual({
      sender_name: "Name on the account is required.",
    });
  });

  it("treats whitespace as missing", () => {
    expect(validateOfflineForm(method, { sender_name: "   " })).toEqual({
      sender_name: "Name on the account is required.",
    });
  });

  it("ignores optional fields", () => {
    expect(
      validateOfflineForm(method, { sender_name: "Ada", transaction_reference: "" }),
    ).toEqual({});
  });

  it("accepts is_required as the string '1'", () => {
    const m: OfflinePaymentMethod = {
      ...method,
      method_informations: [
        { customer_input: "ref", customer_placeholder: "Ref", is_required: "1" },
      ],
    };
    expect(validateOfflineForm(m, {})).toEqual({ ref: "Ref is required." });
  });

  it("tolerates a method with no informations", () => {
    const m = { ...method, method_informations: [] };
    expect(validateOfflineForm(m, {})).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test src/lib/offline-payment-rules.test.ts`
Expected: FAIL — cannot resolve `@/lib/offline-payment-rules`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/offline-payment-rules.ts`:

```ts
/**
 * Pure rules for offline payment. No React, no fetch, no DOM — this
 * module exists so the gating decision and the form validation can be
 * tested directly, because both are places where a silent mistake is
 * expensive:
 *
 *  - Gating wrong in one direction shows customers an option that does
 *    not work; wrong in the other hides a payment method the business
 *    is actively relying on.
 *  - `is_required` is NOT enforced by the backend (OrderController.php
 *    :470-540 validates only order_id and method_id), so if we don't
 *    enforce it here, blank required fields save happily and the admin
 *    gets a payment record they cannot verify.
 */

export type OfflineMethodField = {
  /** Slugified label, e.g. "bank_name". Display only. */
  input_name: string;
  /** The value to show the customer, e.g. "GTBank". */
  input_data: string;
};

export type OfflineMethodInformation = {
  /** The key to POST back VERBATIM. Slugified server-side
   *  (OfflinePaymentMethodController.php:61-82), so "Sender's Name"
   *  arrives as `senders_name`. Never construct this client-side. */
  customer_input: string;
  customer_placeholder: string;
  /** Arrives as 0|1 but tolerate booleans and strings. */
  is_required: number | boolean | string;
};

export type OfflinePaymentMethod = {
  id: number;
  method_name: string;
  /** Read-only: the account the customer pays INTO. */
  method_fields: OfflineMethodField[];
  /** The form to render. */
  method_informations: OfflineMethodInformation[];
  status: number;
};

function isTruthyFlag(v: unknown): boolean {
  return v === 1 || v === true || v === "1";
}

/**
 * All three must hold for the Pay Offline option to be offered.
 *
 * Only `offlinePaymentStatus` is enforced by the backend (PlaceNewOrder
 * .php:681-685). The per-zone flag is advisory and never checked during
 * order placement, but the Flutter app gates on it, so ignoring it here
 * would make the two clients disagree in a zone deliberately switched
 * off.
 */
export function canUseOfflinePayment(input: {
  offlinePaymentStatus: number | null | undefined;
  zoneOfflinePayment: boolean | number | null | undefined;
  methods: OfflinePaymentMethod[] | null | undefined;
}): boolean {
  if (input.offlinePaymentStatus !== 1) return false;
  if (!isTruthyFlag(input.zoneOfflinePayment)) return false;
  if (!input.methods || input.methods.length === 0) return false;
  return true;
}

/**
 * Returns a map of customer_input -> error message. Empty means valid.
 */
export function validateOfflineForm(
  method: OfflinePaymentMethod,
  values: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const info of method.method_informations ?? []) {
    if (!isTruthyFlag(info.is_required)) continue;
    const value = (values[info.customer_input] ?? "").trim();
    if (!value) {
      errors[info.customer_input] = `${info.customer_placeholder} is required.`;
    }
  }
  return errors;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test src/lib/offline-payment-rules.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline-payment-rules.ts src/lib/offline-payment-rules.test.ts
git commit -m "feat: pure gating and validation rules for offline payment

canUseOfflinePayment requires all three gates: the global flag, the
advisory per-zone flag (which the backend never checks but the Flutter
app honours), and a non-empty method list. The list endpoint returns
literal null rather than [], which is covered.

validateOfflineForm enforces is_required client-side because the
backend validates only order_id and method_id."
```

---

### Task 3: Config fetcher

**Files:**
- Create: `src/lib/api/config.ts`

**Interfaces:**
- Consumes: `api` from `@/lib/api-client`
- Produces: `fetchConfig(): Promise<ConfigResult>` where `ConfigResult = { ok: true; config: AppConfig } | { ok: false; message: string }` and `AppConfig = { offline_payment_status: number }`

- [ ] **Step 1: Write the module**

The app has no `/api/v1/config` fetcher today; it only ever calls the `config/get-zone-id` sub-path. This adds a minimal typed one. The 30 minute TTL mirrors `CACHE_TTL_MS` in `src/components/welcome/zone-result.tsx`.

Create `src/lib/api/config.ts`:

```ts
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/config.ts
git commit -m "feat: add a minimal typed /api/v1/config fetcher

The app had no root config fetcher, only config/get-zone-id. Types and
caches just offline_payment_status, the one offline-payment gate the
backend enforces. 30min TTL matches the zone-check cache."
```

---

### Task 4: Offline payment API wrapper

**Files:**
- Create: `src/lib/api/offline-payment.ts`

**Interfaces:**
- Consumes: `api`, `type ApiResult` from `@/lib/api-client`; `type OfflinePaymentMethod` from `@/lib/offline-payment-rules`
- Produces:
  - `fetchOfflineMethods(): Promise<OfflineMethodsResult>` where `OfflineMethodsResult = { ok: true; methods: OfflinePaymentMethod[] } | { ok: false; message: string }`
  - `submitOfflinePayment(input: { orderId: number; methodId: number; customerNote?: string; fields: Record<string, string> }): Promise<OfflineSubmitResult>`
  - `updateOfflinePayment(input: { orderId: number; customerNote?: string; fields: Record<string, string> }): Promise<OfflineSubmitResult>`
  - `type OfflineSubmitResult = { ok: true } | { ok: false; reason: "disabled" | "not-found" | "other"; message: string }`

- [ ] **Step 1: Write the module**

Create `src/lib/api/offline-payment.ts`:

```ts
"use client";

import { api, type ApiResult } from "@/lib/api-client";
import type { OfflinePaymentMethod } from "@/lib/offline-payment-rules";

export type OfflineMethodsResult =
  | { ok: true; methods: OfflinePaymentMethod[] }
  | { ok: false; message: string };

/**
 * GET /api/v1/offline_payment_method_list
 *
 * No auth, no zone/module headers — it sits outside every auth group
 * (routes/api/v1/api.php:98).
 *
 * IMPORTANT: this returns literal JSON `null`, not `[]`, when there are
 * no active methods (ConfigController.php:1076-1082 does
 * `$data->count() > 0 ? $data : null`). Coerce it, or every consumer
 * has to defend against null separately.
 */
export async function fetchOfflineMethods(): Promise<OfflineMethodsResult> {
  const res = await api<OfflinePaymentMethod[] | null>(
    "/api/v1/offline_payment_method_list",
    { unauth: true },
  );
  if (res.ok) {
    return { ok: true, methods: Array.isArray(res.data) ? res.data : [] };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}

/**
 *   ok:true                    details saved, order flipped to 'pending'
 *   ok:false reason:"disabled" offline payment is switched off globally
 *   ok:false reason:"not-found" order id is wrong
 *   ok:false reason:"other"    generic error with message
 */
export type OfflineSubmitResult =
  | { ok: true }
  | { ok: false; reason: "disabled" | "not-found" | "other"; message: string };

function toSubmitResult(res: ApiResult<{ payment?: string }>): OfflineSubmitResult {
  if (res.ok) return { ok: true };
  if ("skipped" in res) {
    return { ok: false, reason: "other", message: "Backend not configured." };
  }
  if (res.status === 404) {
    return { ok: false, reason: "not-found", message: res.message };
  }
  // The global-flag rejection comes back as
  // 403 {"errors":[{"code":"offline_payment_status", ...}]}
  // (OrderController.php:481-488), which api-client promotes into
  // `errors` keyed by code.
  if (res.errors?.offline_payment_status) {
    return { ok: false, reason: "disabled", message: res.message };
  }
  return { ok: false, reason: "other", message: res.message };
}

/**
 * PUT /api/v1/customer/order/offline-payment
 *
 * This is the call that actually makes the order real. The order was
 * created at order_status='failed' by /order/place (PlaceNewOrder.php
 * :173-179) and only flips to 'pending' here (OrderController.php
 * :515-516). If this never lands, the order is stranded and invisible
 * (Order::scopeFailed hides failed orders with no offline_payments row).
 *
 * `fields` are the dynamic method_informations values and MUST go flat
 * at the top level: the backend harvests them with
 * array_column($method->method_informations, 'customer_input') and
 * copies only keys that already exist (:495-504).
 */
export async function submitOfflinePayment(input: {
  orderId: number;
  methodId: number;
  customerNote?: string;
  fields: Record<string, string>;
}): Promise<OfflineSubmitResult> {
  const body: Record<string, unknown> = {
    order_id: input.orderId,
    method_id: input.methodId,
    ...input.fields,
  };
  if (input.customerNote) body.customer_note = input.customerNote;

  const res = await api<{ payment?: string }>(
    "/api/v1/customer/order/offline-payment",
    { method: "PUT", body },
  );
  return toSubmitResult(res);
}

/**
 * PUT /api/v1/customer/order/offline-payment-update
 *
 * Used after an admin denies a payment and the customer corrects it.
 *
 * Two hard rules from OrderController.php:543-610:
 *  1. Do NOT send method_id. The method is re-read from the stored
 *     payment_info (:555-558); it cannot be changed here, and sending
 *     it is silently ignored.
 *  2. Send the FULL form every time. $offline_payment_info is rebuilt
 *     from scratch (:557), so any field omitted here is DELETED.
 *
 * update_payment_info: 1 notifies the customer that their info was
 * updated; a falsy value fires a store order notification instead
 * (:577), which is wrong for a customer-initiated edit.
 */
export async function updateOfflinePayment(input: {
  orderId: number;
  customerNote?: string;
  fields: Record<string, string>;
}): Promise<OfflineSubmitResult> {
  const body: Record<string, unknown> = {
    order_id: input.orderId,
    update_payment_info: 1,
    ...input.fields,
  };
  if (input.customerNote) body.customer_note = input.customerNote;

  const res = await api<{ payment?: string }>(
    "/api/v1/customer/order/offline-payment-update",
    { method: "PUT", body },
  );
  return toSubmitResult(res);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/offline-payment.ts
git commit -m "feat: offline payment API wrappers

fetchOfflineMethods coerces the endpoint's literal-null empty response.
submitOfflinePayment is the call that flips the order out of 'failed'.
updateOfflinePayment omits method_id and always sends the full form,
because the backend rebuilds the field object from scratch and deletes
anything missing."
```

---

### Task 5: Type the `offline_payment` block on `OrderTrack`

**Files:**
- Modify: `src/lib/api/orders.ts:151-153`

**Interfaces:**
- Consumes: nothing
- Produces: `type OfflinePaymentBlock` exported from `@/lib/api/orders`; `OrderTrack` gains `offline_payment?: OfflinePaymentBlock | null`

- [ ] **Step 1: Add the type**

In `src/lib/api/orders.ts`, replace lines 151-153:

```ts
export type OrderTrack = OrderSummary & {
  timelines?: OrderTimeline[];
};
```

with:

```ts
/**
 * Emitted by track_order (OrderController.php:74) via
 * Helpers::offline_payment_formater (Helpers.php:3300-3332).
 *
 * NOT available on /customer/order/details. That endpoint eager-loads
 * `offline_payments` and then never uses it — it returns
 * order_details_data_formatting($details), an array of line items. Use
 * fetchOrderTrack for anything offline-payment related.
 */
export type OfflinePaymentBlock = {
  /** The customer's submitted values, with method_id/method_name
   *  lifted out into `data`. */
  input?: Array<{ user_input: string; user_data: string }>;
  data?: {
    /** pending | verified | denied. Distinct from order.payment_status,
     *  which stays "unpaid" until an admin verifies. */
    status?: "pending" | "verified" | "denied";
    method_id?: number;
    method_name?: string;
    customer_note?: string | null;
    /** The admin's reason when status is "denied" (DB column `note`). */
    admin_note?: string | null;
  };
  /** Snapshot of the destination account taken at submit time. */
  method_fields?: Array<{ input_name: string; input_data: string }>;
};

export type OrderTrack = OrderSummary & {
  timelines?: OrderTimeline[];
  offline_payment?: OfflinePaymentBlock | null;
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api/orders.ts
git commit -m "feat: type the offline_payment block on OrderTrack

Documents that this comes from /order/track and NOT /order/details,
which eager-loads offline_payments and then ignores it."
```

---

### Task 6: Payment picker option and bank chooser

**Files:**
- Create: `src/components/checkout/bank-chips.tsx`
- Modify: `src/components/checkout/payment-picker.tsx`

**Interfaces:**
- Consumes: `type OfflinePaymentMethod` from `@/lib/offline-payment-rules`
- Produces:
  - `BankChips({ methods, selectedId, onSelect }: { methods: OfflinePaymentMethod[]; selectedId: number | null; onSelect: (id: number) => void })` from `@/components/checkout/bank-chips` — **also consumed by Task 8**
  - `PaymentMethod` union gains `"offline_payment"`; `PaymentPicker` gains props `offlineEnabled?: boolean`, `offlineMethods?: OfflinePaymentMethod[]`, `offlineMethodId?: number | null`, `onOfflineMethodChange?: (id: number) => void`

- [ ] **Step 0: Create the shared bank chip list**

Both this task's picker and Task 8's offline page let the customer choose a bank. The surrounding wrapper and heading differ per surface, but the chips themselves are the same control and must not drift apart. Create `src/components/checkout/bank-chips.tsx`:

```tsx
"use client";

import { cn } from "@/lib/cn";
import type { OfflinePaymentMethod } from "@/lib/offline-payment-rules";

/**
 * The bank/method chips for offline payment. Rendered in two places:
 * the checkout picker (choose before placing) and
 * /checkout/offline/[orderId] (change before submitting). Each caller
 * supplies its own wrapper and heading; only the control lives here so
 * the two can't drift apart.
 */
export function BankChips({
  methods,
  selectedId,
  onSelect,
}: {
  methods: OfflinePaymentMethod[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {methods.map((m) => {
        const checked = m.id === selectedId;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            aria-pressed={checked}
            className={cn(
              "rounded-pill border px-4 py-2 text-xs font-medium transition-colors",
              checked
                ? "border-brand-red bg-brand-red text-white"
                : "border-ink-200 bg-white text-ink-700 hover:border-brand-red/40",
            )}
          >
            {m.method_name}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 1: Extend the type union and imports**

At the top of `src/components/checkout/payment-picker.tsx`, change the icon import (line 4-9) to add `Building2`:

```tsx
import {
  Banknote,
  Building2,
  CreditCard,
  Wallet as WalletIcon,
  Landmark,
} from "lucide-react";
```

Add below the `cn` import:

```tsx
import type { OfflinePaymentMethod } from "@/lib/offline-payment-rules";
import { BankChips } from "@/components/checkout/bank-chips";
```

Replace lines 12-16:

```tsx
export type PaymentMethod =
  | "cash_on_delivery"
  | "digital_payment"
  | "wallet"
  | "bank_transfer"
  | "offline_payment";
```

- [ ] **Step 2: Extend Props**

Replace the `Props` type (lines 18-30) with:

```tsx
type Props = {
  value: PaymentMethod;
  onChange: (v: PaymentMethod) => void;
  /** Customer's current wallet balance in NGN. Shown next to the
   *  Wallet option so people know whether they have enough. Pass
   *  null while it's still loading; pass 0 if you know it's empty. */
  walletBalance?: number | null;
  /** Pre-computed order subtotal. Used to show "insufficient" hints
   *  next to the wallet option without disabling it (the customer
   *  can still pick it; the backend / transfer page will handle
   *  reconciliation). */
  orderTotal?: number | null;
  /** Whether Pay Offline passes all three gates (see
   *  canUseOfflinePayment). When false the option is hidden entirely
   *  rather than disabled — a disabled payment method with no
   *  explanation reads as a bug. */
  offlineEnabled?: boolean;
  /** Banks/methods the customer can pay into. Only read when
   *  offlineEnabled is true. */
  offlineMethods?: OfflinePaymentMethod[];
  offlineMethodId?: number | null;
  onOfflineMethodChange?: (id: number) => void;
};
```

- [ ] **Step 3: Add the OPTIONS entry**

In the `OPTIONS` array (lines 38-59), add before the closing `];`:

```tsx
  {
    id: "offline_payment",
    label: "Pay Offline",
    icon: <Building2 size={18} />,
  },
```

- [ ] **Step 4: Filter the options and render the chooser**

Replace the `PaymentPicker` function signature and its `return` (lines 74-137) with:

```tsx
export function PaymentPicker({
  value,
  onChange,
  walletBalance,
  orderTotal,
  offlineEnabled = false,
  offlineMethods = [],
  offlineMethodId = null,
  onOfflineMethodChange,
}: Props) {
  const options = OPTIONS.filter(
    (opt) => opt.id !== "offline_payment" || offlineEnabled,
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((opt) => {
          const checked = opt.id === value;
          return (
            <label
              key={opt.id}
              className={cn(
                "group relative flex cursor-pointer items-start gap-3 overflow-hidden rounded-2xl border p-4 transition-all duration-200",
                checked
                  ? "border-transparent bg-white shadow-[0_0_0_2px_rgba(222,22,0,0.5),0_18px_42px_-18px_rgba(222,22,0,0.35)]"
                  : "border-ink-200 bg-white hover:-translate-y-px hover:border-brand-red/30 hover:shadow-soft",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  checked
                    ? "border-brand-red bg-brand-red text-white"
                    : "border-ink-300 bg-white",
                )}
                aria-hidden="true"
              >
                {checked && <span className="h-2 w-2 rounded-full bg-white" />}
              </span>
              <span
                className={cn(
                  "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
                  checked
                    ? "bg-brand-red/10 text-brand-red"
                    : "bg-canvas-sunken text-ink-700",
                )}
              >
                {opt.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold tracking-[-0.005em] text-ink-900">
                  {opt.label}
                </p>
                <OptionHint
                  id={opt.id}
                  walletBalance={walletBalance}
                  orderTotal={orderTotal}
                />
              </div>
              <input
                type="radio"
                name="checkout-payment"
                checked={checked}
                onChange={() => onChange(opt.id)}
                className="sr-only"
              />
            </label>
          );
        })}
      </div>

      {value === "offline_payment" && offlineMethods.length > 0 && (
        <BankChooser
          methods={offlineMethods}
          selectedId={offlineMethodId}
          onSelect={(id) => onOfflineMethodChange?.(id)}
        />
      )}
    </div>
  );
}

/**
 * Which account the customer will transfer into. Shown at checkout so
 * the choice travels with the order; the customer can still change it
 * on /checkout/offline/[orderId] before submitting.
 */
function BankChooser({
  methods,
  selectedId,
  onSelect,
}: {
  methods: OfflinePaymentMethod[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-canvas-sunken p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-500">
        Which bank will you transfer to?
      </p>
      <div className="mt-3">
        <BankChips methods={methods} selectedId={selectedId} onSelect={onSelect} />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add the OptionHint branch**

In `OptionHint`, add before the `// wallet` comment:

```tsx
  if (id === "offline_payment") {
    return (
      <p className="mt-0.5 text-xs text-ink-500">
        Transfer from your bank app, then send us the details. No card needed.
      </p>
    );
  }
```

- [ ] **Step 6: Verify it compiles**

Run: `npm run build`
Expected: build succeeds. If it fails in `checkout-flow.tsx` because `backendPaymentMethod` no longer narrows, that is expected and fixed in Task 7.

- [ ] **Step 7: Commit**

```bash
git add src/components/checkout/payment-picker.tsx
git commit -m "feat: add Pay Offline option and bank chooser to the picker

The option is hidden rather than disabled when gated off; a disabled
payment method with no explanation reads as a bug."
```

---

### Task 7: Wire gating and the post-place branch into checkout

**Files:**
- Modify: `src/components/checkout/checkout-flow.tsx`

**Interfaces:**
- Consumes: `canUseOfflinePayment`, `type OfflinePaymentMethod` from `@/lib/offline-payment-rules`; `fetchConfig` from `@/lib/api/config`; `fetchOfflineMethods` from `@/lib/api/offline-payment`; `PaymentPicker` props from Task 6
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Add imports**

Add to the import block in `src/components/checkout/checkout-flow.tsx`:

```tsx
import { fetchConfig } from "@/lib/api/config";
import { fetchOfflineMethods } from "@/lib/api/offline-payment";
import {
  canUseOfflinePayment,
  type OfflinePaymentMethod,
} from "@/lib/offline-payment-rules";
```

- [ ] **Step 2: Add state**

Below `const [payment, setPayment] = useState<PaymentMethod>("cash_on_delivery");` (line 67):

```tsx
  // Offline payment gating. Resolved on mount from three independent
  // sources (see canUseOfflinePayment). Defaults to false so the option
  // never flashes in before we know it's usable.
  const [offlineEnabled, setOfflineEnabled] = useState(false);
  const [offlineMethods, setOfflineMethods] = useState<OfflinePaymentMethod[]>([]);
  const [offlineMethodId, setOfflineMethodId] = useState<number | null>(null);
```

- [ ] **Step 3: Add the gating effect**

Add after the existing `useEffect` that ends at line 111:

```tsx
  // Resolve whether Pay Offline can be offered. Three gates, only one
  // of which the backend enforces:
  //   1. config.offline_payment_status  — enforced (PlaceNewOrder:681)
  //   2. zone.offline_payment           — advisory, but the Flutter app
  //      honours it, so we must too or the clients disagree
  //   3. a non-empty method list        — nothing to pay into otherwise
  //
  // The zone flag is read with .some(): a point can fall inside several
  // zone polygons, and since the backend doesn't enforce this at all,
  // "any eligible zone allows it" is the permissive-but-consistent read.
  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    (async () => {
      const [cfg, methodsRes, zoneRes] = await Promise.all([
        fetchConfig(),
        fetchOfflineMethods(),
        checkZone(address.lat, address.lng),
      ]);
      if (cancelled) return;

      const methods = methodsRes.ok ? methodsRes.methods : [];
      const zoneOffline =
        zoneRes.kind === "in-zone"
          ? zoneRes.zones.some((z) => Boolean(z.offline_payment))
          : false;

      const enabled = canUseOfflinePayment({
        offlinePaymentStatus: cfg.ok ? cfg.config.offline_payment_status : 0,
        zoneOfflinePayment: zoneOffline,
        methods,
      });

      setOfflineEnabled(enabled);
      setOfflineMethods(methods);
      setOfflineMethodId(enabled && methods.length > 0 ? methods[0].id : null);

      // If the customer had Pay Offline selected and it just became
      // unavailable (address change), fall back rather than leave an
      // invisible selection armed.
      if (!enabled) {
        setPayment((p) => (p === "offline_payment" ? "cash_on_delivery" : p));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address?.lat, address?.lng]);
```

- [ ] **Step 4: Pass the props to PaymentPicker**

Replace the `<PaymentPicker ... />` usage (lines 339-344):

```tsx
              <PaymentPicker
                value={payment}
                onChange={setPayment}
                walletBalance={walletBalance}
                orderTotal={subtotal}
                offlineEnabled={offlineEnabled}
                offlineMethods={offlineMethods}
                offlineMethodId={offlineMethodId}
                onOfflineMethodChange={setOfflineMethodId}
              />
```

Note: keep whatever `walletBalance` / `orderTotal` expressions are already there; only the four `offline*` props are new.

- [ ] **Step 5: Add the post-place branch**

In `handlePlace`, immediately after the `if (payment === "cash_on_delivery")` block (which ends at line 225), add:

```tsx
    // Offline payment. The order exists but is NOT real yet: /order/place
    // created it at order_status='failed' (PlaceNewOrder.php:173-179) and
    // only the PUT /offline-payment flips it to 'pending'
    // (OrderController.php:515-516). If the customer never completes that
    // second call the order is stranded AND invisible, because
    // Order::scopeFailed hides failed orders that have no offline_payments
    // row (Order.php:260). So send them straight there and don't stop.
    if (payment === "offline_payment") {
      clear();
      router.replace(
        `/checkout/offline/${res.orderId}` +
          (offlineMethodId ? `?method=${offlineMethodId}` : ""),
      );
      return;
    }
```

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: build succeeds. `backendPaymentMethod` still narrows correctly: `payment === "bank_transfer" ? "wallet" : payment` maps the union minus `bank_transfer`, which is exactly `PlaceOrderInput["paymentMethod"]`.

- [ ] **Step 7: Commit**

```bash
git add src/components/checkout/checkout-flow.tsx
git commit -m "feat: gate and route the Pay Offline checkout branch

Resolves all three gates on mount and falls back to COD if the option
disappears on an address change. The post-place branch routes straight
to the page that flips the order out of 'failed'."
```

---

### Task 8: The offline payment page

The largest task. Creates the route and the component that shows the account, the amount, and the dynamic form, in both create and edit mode.

**Files:**
- Create: `src/app/checkout/offline/[orderId]/page.tsx`
- Create: `src/components/checkout/offline-payment-form.tsx`

**Interfaces:**
- Consumes: `fetchOrderTrack`, `type OfflinePaymentBlock` from `@/lib/api/orders`; `fetchOfflineMethods`, `submitOfflinePayment`, `updateOfflinePayment` from `@/lib/api/offline-payment`; `validateOfflineForm`, `type OfflinePaymentMethod` from `@/lib/offline-payment-rules`; `BankChips` from `@/components/checkout/bank-chips` (created in Task 6)
- Produces: route `/checkout/offline/[orderId]?method=<id>`

- [ ] **Step 1: Create the server page**

Create `src/app/checkout/offline/[orderId]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import { RouteGuard } from "@/components/auth/route-guard";
import { OfflinePaymentForm } from "@/components/checkout/offline-payment-form";

export const metadata: Metadata = {
  title: "Complete your transfer",
};

type Props = { params: Promise<{ orderId: string }> };

export default async function OfflinePaymentPage({ params }: Props) {
  const { orderId } = await params;
  const id = Number(orderId);

  if (!Number.isFinite(id)) {
    return (
      <section className="bg-ink-50 py-10">
        <Container size="prose">
          <p className="text-ink-700">Invalid order.</p>
        </Container>
      </section>
    );
  }

  return (
    <section className="bg-ink-50 py-10 md:py-14">
      <Container size="prose">
        <RouteGuard>
          <Suspense fallback={null}>
            <OfflinePaymentForm orderId={id} />
          </Suspense>
        </RouteGuard>
      </Container>
    </section>
  );
}
```

- [ ] **Step 2: Create the client component**

Create `src/components/checkout/offline-payment-form.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Copy, Landmark, Loader2 } from "lucide-react";
import { fetchOrderTrack, type OfflinePaymentBlock } from "@/lib/api/orders";
import {
  fetchOfflineMethods,
  submitOfflinePayment,
  updateOfflinePayment,
} from "@/lib/api/offline-payment";
import {
  validateOfflineForm,
  type OfflinePaymentMethod,
} from "@/lib/offline-payment-rules";
import { BankChips } from "@/components/checkout/bank-chips";
import { cn } from "@/lib/cn";

type LoadState =
  | { kind: "loading" }
  | {
      kind: "ready";
      methods: OfflinePaymentMethod[];
      amount: number | null;
      /** Present => the customer already submitted; we're editing. */
      existing: OfflinePaymentBlock | null;
    }
  | { kind: "error"; message: string };

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; message: string };

/**
 * /checkout/offline/[orderId]
 *
 * The customer placed an order with payment_method=offline_payment.
 * At this moment the order exists but sits at order_status='failed'
 * (PlaceNewOrder.php:173-179); it only becomes 'pending' once this page
 * successfully PUTs /customer/order/offline-payment. So this page must
 * never dead-end: on failure we keep the customer here with an inline
 * error and let them retry.
 *
 * The page doubles as the edit surface after an admin denies a payment,
 * which is why it reads the order first rather than trusting query
 * params. Reading the order also makes the URL re-enterable: a customer
 * who abandoned mid-flow can come back and finish.
 *
 * We fetch the order via /order/track, NOT /order/details. The latter
 * eager-loads offline_payments and then ignores it, returning line items.
 */
export function OfflinePaymentForm({ orderId }: { orderId: number }) {
  const router = useRouter();
  const search = useSearchParams();
  const methodHint = Number(search.get("method"));

  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [methodId, setMethodId] = useState<number | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [orderRes, methodsRes] = await Promise.all([
        fetchOrderTrack(orderId),
        fetchOfflineMethods(),
      ]);
      if (cancelled) return;

      if (!orderRes.ok) {
        setLoad({ kind: "error", message: orderRes.message });
        return;
      }
      if (!methodsRes.ok) {
        setLoad({ kind: "error", message: methodsRes.message });
        return;
      }
      if (methodsRes.methods.length === 0) {
        setLoad({
          kind: "error",
          message:
            "Bank transfer isn't available right now. Please contact support to pay for this order.",
        });
        return;
      }

      const existing = orderRes.order.offline_payment ?? null;
      const amountRaw = orderRes.order.order_amount;
      const amount =
        typeof amountRaw === "number" && Number.isFinite(amountRaw)
          ? amountRaw
          : null;

      // Pick the starting method: what was already submitted, else the
      // ?method= hint if it resolves to a real active method, else the
      // first. The hint is validated rather than trusted — a bogus
      // method_id is accepted by the backend with a 200 and then makes
      // Helpers::offline_payment_formater throw on every later fetch
      // (Helpers.php:3305).
      const existingId = existing?.data?.method_id ?? null;
      const hintValid = methodsRes.methods.some((m) => m.id === methodHint);
      const initialId =
        existingId ?? (hintValid ? methodHint : methodsRes.methods[0].id);

      setMethodId(initialId);

      if (existing?.input?.length) {
        const prefilled: Record<string, string> = {};
        for (const row of existing.input) {
          prefilled[row.user_input] = row.user_data ?? "";
        }
        setValues(prefilled);
      }
      if (existing?.data?.customer_note) setNote(existing.data.customer_note);

      setLoad({ kind: "ready", methods: methodsRes.methods, amount, existing });
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, methodHint]);

  const method = useMemo(() => {
    if (load.kind !== "ready" || methodId === null) return null;
    return load.methods.find((m) => m.id === methodId) ?? null;
  }, [load, methodId]);

  const isEdit = load.kind === "ready" && load.existing !== null;
  const denied = load.kind === "ready" && load.existing?.data?.status === "denied";

  const amountText =
    load.kind === "ready" && typeof load.amount === "number"
      ? `₦${Math.round(load.amount).toLocaleString()}`
      : null;

  async function handleSubmit() {
    if (!method || methodId === null) return;

    const errs = validateOfflineForm(method, values);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSave({ kind: "saving" });

    // Always send every field the method declares, not just the ones
    // the customer typed into. The update endpoint rebuilds the stored
    // object from scratch (OrderController.php:557), so an omitted key
    // is a deleted key.
    const fields: Record<string, string> = {};
    for (const info of method.method_informations ?? []) {
      fields[info.customer_input] = values[info.customer_input] ?? "";
    }

    const res = isEdit
      ? await updateOfflinePayment({ orderId, customerNote: note, fields })
      : await submitOfflinePayment({
          orderId,
          methodId,
          customerNote: note,
          fields,
        });

    if (res.ok) {
      router.replace(`/checkout/success?order_id=${orderId}`);
      return;
    }

    // Stay put. The order already exists; navigating away here is how
    // an order gets stranded.
    setSave({
      kind: "error",
      message:
        res.reason === "disabled"
          ? "Bank transfer was just switched off. Please contact support to pay for this order."
          : res.message,
    });
  }

  if (load.kind === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-ink-500">
        <Loader2 size={14} className="animate-spin" />
        Loading your payment details…
      </div>
    );
  }

  if (load.kind === "error") {
    return (
      <div className="rounded-2xl border border-error/30 bg-error/5 p-4 text-sm text-error">
        {load.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-display-md text-ink-900">
          Send{" "}
          <span className="text-brand-red">{amountText ?? "the amount"}</span>{" "}
          to complete your order
        </h1>
        <p className="mt-2 text-sm text-ink-600">
          Transfer from your bank app, then fill in the details below so we can
          match your payment. We confirm by hand, usually within a few minutes.
        </p>
      </header>

      {denied && load.existing?.data?.admin_note && (
        <div className="rounded-2xl border border-error/30 bg-error/5 p-4">
          <p className="text-sm font-medium text-error">
            We couldn't confirm your last payment
          </p>
          <p className="mt-1 text-xs text-ink-700">
            {load.existing.data.admin_note}
          </p>
          <p className="mt-2 text-xs text-ink-600">
            Check the details below and send them again.
          </p>
        </div>
      )}

      {!isEdit && load.methods.length > 1 && (
        <BankSwitcher
          methods={load.methods}
          selectedId={methodId}
          onSelect={(id) => {
            setMethodId(id);
            // The new method declares different fields; stale values
            // would be posted under keys the new method doesn't know.
            setValues({});
            setFieldErrors({});
          }}
        />
      )}

      {method && <AccountCard method={method} amountText={amountText} />}

      {method && (
        <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
          <p className="text-sm font-medium text-ink-900">Your payment details</p>
          <p className="mt-1 text-xs text-ink-600">
            This is how we find your transfer, so please match your bank app
            exactly.
          </p>

          <div className="mt-5 space-y-4">
            {(method.method_informations ?? []).map((info) => (
              <div key={info.customer_input}>
                <label
                  htmlFor={`off-${info.customer_input}`}
                  className="text-xs font-medium text-ink-700"
                >
                  {info.customer_placeholder}
                  {(info.is_required === 1 ||
                    info.is_required === true ||
                    info.is_required === "1") && (
                    <span className="text-brand-red"> *</span>
                  )}
                </label>
                <input
                  id={`off-${info.customer_input}`}
                  type="text"
                  value={values[info.customer_input] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({
                      ...v,
                      [info.customer_input]: e.target.value,
                    }))
                  }
                  placeholder={info.customer_placeholder}
                  className={cn(
                    "mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm text-ink-900 outline-none transition-colors",
                    fieldErrors[info.customer_input]
                      ? "border-error focus:border-error"
                      : "border-ink-200 focus:border-brand-red",
                  )}
                />
                {fieldErrors[info.customer_input] && (
                  <p className="mt-1 text-xs text-error">
                    {fieldErrors[info.customer_input]}
                  </p>
                )}
              </div>
            ))}

            <div>
              <label htmlFor="off-note" className="text-xs font-medium text-ink-700">
                Anything else we should know? (optional)
              </label>
              <textarea
                id="off-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none transition-colors focus:border-brand-red"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={save.kind === "saving"}
            className={cn(
              "mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-red px-6 text-base font-medium text-white shadow-sm transition-colors",
              "hover:bg-brand-red-600 active:bg-brand-red-700",
              "disabled:cursor-wait disabled:opacity-70",
            )}
          >
            {save.kind === "saving" ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Sending…
              </>
            ) : (
              <>
                {isEdit ? "Update my payment details" : "I've sent the transfer"}
                <ArrowRight size={16} strokeWidth={2.2} />
              </>
            )}
          </button>

          {save.kind === "error" && (
            <p className="mt-3 rounded-xl border border-error/30 bg-error/5 px-3 py-2 text-xs text-error">
              {save.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- */

/**
 * Create mode only. The update endpoint re-reads the method from the
 * stored payment_info (OrderController.php:555-558) and cannot change
 * it, so offering a switcher in edit mode would silently do nothing.
 */
function BankSwitcher({
  methods,
  selectedId,
  onSelect,
}: {
  methods: OfflinePaymentMethod[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4 shadow-soft">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-500">
        Paying to a different bank?
      </p>
      <div className="mt-3">
        <BankChips methods={methods} selectedId={selectedId} onSelect={onSelect} />
      </div>
    </div>
  );
}

/** The account the customer pays INTO, from method_fields. */
function AccountCard({
  method,
  amountText,
}: {
  method: OfflinePaymentMethod;
  amountText: string | null;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="rounded-3xl border border-ink-200 bg-white p-6 shadow-soft sm:p-8">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-ink-500">
          Pay into this account
        </p>
        <Landmark size={20} className="shrink-0 text-brand-red" />
      </div>

      <dl className="mt-4 space-y-3 text-sm">
        {(method.method_fields ?? []).map((f) => (
          <div
            key={f.input_name}
            className="flex items-center justify-between gap-3"
          >
            <dt className="text-ink-500">{humanise(f.input_name)}</dt>
            <dd className="flex items-center gap-2">
              <span className="font-medium text-ink-900">{f.input_data}</span>
              <button
                type="button"
                onClick={() => copy(f.input_data, f.input_name)}
                aria-label={`Copy ${humanise(f.input_name)}`}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 text-xs font-medium text-ink-900 hover:bg-ink-50"
              >
                {copied === f.input_name ? (
                  <>
                    <Check size={12} className="text-success" /> Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} /> Copy
                  </>
                )}
              </button>
            </dd>
          </div>
        ))}

        {amountText && (
          <div>
            <dt className="text-ink-500">Amount to send</dt>
            <dd className="mt-1 text-2xl font-semibold text-ink-900">
              {amountText}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/** "account_number" -> "Account number". The backend slugifies these
 *  labels on save (OfflinePaymentMethodController.php:61-82), so this
 *  is the inverse for display only. */
function humanise(slug: string): string {
  const s = slug.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: build succeeds.

Note: `OrderSummary.order_amount` is confirmed to be `number` (`orders.ts:16`), so `orderRes.order.order_amount` is correct as written. Do not confuse it with `PlaceOrderResponse.total_ammount` (`orders.ts:243`), which really is spelled with two m's and belongs to a different response.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/checkout/offline src/components/checkout/offline-payment-form.tsx
git commit -m "feat: add the offline payment page

Reads the order via /order/track to get the authoritative amount and to
detect create vs edit mode, which also makes the URL re-enterable. The
?method= hint is validated against the live list rather than trusted,
because a bogus method_id gets a 200 and then throws on every later
fetch of that order.

Never navigates away on a failed submit: the order already exists."
```

---

### Task 9: Offline payment status on the order detail page

**Files:**
- Modify: `src/components/orders/order-detail-view.tsx`

**Interfaces:**
- Consumes: `type OrderTrack`, `type OfflinePaymentBlock` from `@/lib/api/orders`
- Produces: nothing

- [ ] **Step 1: Locate the payment status region**

The target is `TotalsCard` at `src/components/orders/order-detail-view.tsx:378`, whose signature is already `function TotalsCard({ order }: { order: OrderTrack })`. It renders the Paid/Unpaid text at line 392. The new panel goes at the end of that card, so `order` is in scope and no prop threading is needed.

- [ ] **Step 2: Add the import**

Add `Link` from `next/link` to the imports if not already present:

```tsx
import Link from "next/link";
```

- [ ] **Step 3: Add the status block**

Add this component at the bottom of the file:

```tsx
/**
 * Offline payment state, from order.offline_payment (emitted by
 * track_order, OrderController.php:74).
 *
 * "denied" is a normal outcome of manual verification, not an edge
 * case: the admin rejects a payment they can't match and the customer
 * has to correct it. So the CTA here must actually work. The DVA
 * transfer flow tells customers to "tap Confirm transfer again" on this
 * page and no such button exists — don't repeat that.
 */
function OfflinePaymentPanel({
  orderId,
  block,
}: {
  orderId: number;
  block: OfflinePaymentBlock;
}) {
  const status = block.data?.status;
  if (!status) return null;

  if (status === "verified") {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-4">
        <p className="text-sm font-medium text-ink-900">Transfer confirmed</p>
        <p className="mt-1 text-xs text-ink-600">
          We matched your payment{" "}
          {block.data?.method_name ? `from ${block.data.method_name}` : ""} and
          your order is on its way.
        </p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="rounded-2xl border border-error/30 bg-error/5 p-4">
        <p className="text-sm font-medium text-error">
          We couldn't confirm your payment
        </p>
        {block.data?.admin_note && (
          <p className="mt-1 text-xs text-ink-700">{block.data.admin_note}</p>
        )}
        <Link
          href={`/checkout/offline/${orderId}`}
          className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-brand-red px-4 text-sm font-medium text-white hover:bg-brand-red-600"
        >
          Update payment details
        </Link>
      </div>
    );
  }

  // pending
  return (
    <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4">
      <p className="text-sm font-medium text-ink-900">
        Waiting for us to confirm your transfer
      </p>
      <p className="mt-1 text-xs text-ink-600">
        We check transfers by hand, usually within a few minutes.
      </p>
      <Link
        href={`/checkout/offline/${orderId}`}
        className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-ink-200 bg-white px-4 text-sm font-medium text-ink-900 hover:bg-ink-50"
      >
        Edit payment details
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Render it**

Inside `TotalsCard`, immediately after the Paid/Unpaid row that closes around line 392-393, add:

```tsx
      {order.offline_payment && (
        <div className="mt-4">
          <OfflinePaymentPanel orderId={order.id} block={order.offline_payment} />
        </div>
      )}
```

`order` is already the `OrderTrack` prop of `TotalsCard`, so nothing needs threading. Match the surrounding indentation.

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/orders/order-detail-view.tsx
git commit -m "feat: show offline payment status and a working edit CTA

Denial is a normal outcome of manual verification, so the customer gets
the admin's reason and a button that actually goes somewhere."
```

---

### Task 10: Full verification

**Files:** none

- [ ] **Step 1: Run the full check**

```bash
npm test
npm run build
npm run lint
```

Expected:
- `npm test` — all pass.
- `npm run build` — succeeds, no type errors.
- `npm run lint` — **does NOT pass, and is not expected to.** This repo has a pre-existing lint baseline of **51 errors / 3 warnings** across files unrelated to this work, measured at commit `abb8b23`. The bar is *do not add new errors*, not *reach zero*. Two of the baseline errors sit in files this plan touches and are NOT ours: `checkout-flow.tsx:104` (`set-state-in-effect`, in the original effect's `!cartStoreId` branch) and `payment-picker.tsx:228` (`react/no-unescaped-entities`, the apostrophe in the pre-existing `bank_transfer` hint). Cleaning up the baseline is out of scope; doing it here would bury this feature's diff in unrelated churn.

One expected NEW warning: `react-hooks/exhaustive-deps` on the gating effect in `checkout-flow.tsx` (missing `address`). This matches the existing effect in the same file, which uses the same `[x?.lat, x?.lng]` dependency pattern. Leave it.

- [ ] **Step 2: Manual verification against the backend**

Confirm `NEXT_PUBLIC_API_BASE_URL` points at a backend where offline payment is enabled and at least one method is configured. Then walk these, ticking each:

- [ ] Pay Offline appears at checkout with the bank chooser
- [ ] Place an order and land on `/checkout/offline/[orderId]` with the correct account and amount
- [ ] Submitting with a required field blank shows an inline error and does NOT call the API
- [ ] A valid submit lands on `/checkout/success` and the order shows `pending` in admin
- [ ] Switching banks in create mode re-renders the form and posts the new `method_id`
- [ ] Tamper the URL to `?method=999999` and confirm it falls back to the first method rather than posting a bogus id
- [ ] Revisit `/checkout/offline/[orderId]` after submitting: it loads in edit mode, prefilled, with no bank switcher
- [ ] Deny the payment in admin, then confirm `/orders/[id]` shows the admin note and the Update button, and that resubmitting works
- [ ] Confirm the resubmit sent every field, not only the changed one (check `offline_payments.payment_info` in the DB)

- [ ] **Step 3: Verify gating turns the option off**

Set `offline_payment_status` to `0` in admin, hard-reload `/checkout`, and confirm Pay Offline disappears. Set it back.

- [ ] **Step 4: Push to main**

This repo works on `main` only, by the owner's explicit instruction. There is no branch and no PR gate.

**Push exactly once, here, and only after Steps 1-3 have all passed.** A push to `main` triggers an immediate Vercel production deploy of app.bite.express. Pushing intermediate commits would put half-built checkout code in front of live customers, which matters more than usual right now because a bulk email announcing this feature is going to roughly 4,300 customers.

```bash
git log --oneline origin/main..HEAD   # review everything about to ship
git push origin main
```

Then confirm the deploy landed and the real site works:

```bash
curl -s -o /dev/null -w "%{http_code}" https://app.bite.express/checkout
```

If checkout breaks in production, revert rather than fix forward, because every minute is lost orders:

```bash
git revert --no-edit <sha>
git push origin main
```

---

## Self-Review

**Spec coverage:** Data flow → Tasks 6-8. Gating (all three conditions) → Tasks 2, 3, 7. Zone plumbing without touching `location-store` → Task 7 Step 3. New/changed files → all present across Tasks 1-9. Dynamic form incl. verbatim keys and `is_required` → Tasks 2, 8. Bank switching create-mode-only → Tasks 6, 8. Edit/denial → Tasks 8, 9. Error handling incl. both 403 shapes → Tasks 1, 4, 8. Testing (vitest, pure logic only; manual for the rest) → Tasks 1, 2, 10. Known risks are carried into the PR body in Task 10.

**Type consistency:** `OfflinePaymentMethod` is defined once in Task 2 and imported by Tasks 4, 6, 8. `OfflinePaymentBlock` is defined in Task 5 and imported by Tasks 8, 9. `OfflineSubmitResult` is defined in Task 4 and consumed in Task 8. `PaymentMethod` gains `offline_payment` in Task 6 and is used in Task 7. `parseErrorBody`/`ParsedError` from Task 1 are internal to `api-client.ts`.

**Placeholder scan:** Both soft spots from the first draft are now resolved against the real code rather than deferred to the implementer. `OrderSummary.order_amount` is confirmed `number` at `orders.ts:16`. `TotalsCard` at `order-detail-view.tsx:378` already takes `order: OrderTrack`, so Task 9 names the exact insertion point and no variable guessing remains. No TBDs, no "handle errors appropriately", and every code step carries its code.
