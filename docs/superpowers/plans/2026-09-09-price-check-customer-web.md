# Price-check flow, customer web app, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a customer of an eligible grocery, pharmacy or ecommerce store on app.bite.express send their cart as a price request, review the store's quote, drop lines they no longer want, and pay the agreed total, instead of paying a stale catalogue price.

**Architecture:** The cart carries the intent and checkout sends the request, because the request payload needs an address, coordinates and a distance that do not exist at the cart. A new `/orders/[id]/quote` route renders the quote and owns the accept call. Accept always precedes any payment gateway. All arithmetic and payload shaping lives in pure functions under `src/lib/price-check/` so it can be tested without a DOM, which is the only kind of test this repo can run.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Zustand, Tailwind 4, vitest. No component testing library is installed, so every test in this plan is a pure-function test.

**Spec:** `C:/laragon/www/dashboard.bite.express/docs/superpowers/specs/2026-09-08-price-check-api-contract.md`

Read the contract alongside this plan. Section 12b, "Field names that are easy to get wrong", is load-bearing and has already caught real mistakes in the two client apps that shipped before this one.

## Global Constraints

- **Ships inert.** Every switch is off in production. The only signal a client may branch on is the per-store boolean `price_check_enabled`. Never combine the three server-side flags yourself (contract 2.1).
- **203 is a 2xx.** A cash-ceiling refusal arrives as HTTP 203 with an `errors` array. `res.ok` is true for 203. See Task 1.
- **406 is the store minimum.** Error code `order_time`, which is not a scheduling code (contract 12b).
- **`item_notes` is keyed by `item_id`.** Not `cart_id`, not `order_detail_id` (contract 3.1, 12b).
- **`excluded_detail_ids` holds `order_details.id`.** Not `item_id` (contract 12b).
- **`total_ammount`** on the request response is spelled with two m's. `order_amount` on the accept response is spelled correctly (contract 12b).
- **`quote_expires_at`** is read, never computed. On the order-details response it is on `response[0]` only (contract 9, 10, 12b).
- **Accept before gateway.** `price-check/accept` must return before any payment gateway opens, and the gateway must be opened with `order_amount` from the accept response, never a locally computed figure (contract 6.2).
- **Never treat an expiry as final while a payment is in flight** (contract 9.1).
- **Copy rules:** no em-dashes or en-dashes as sentence punctuation anywhere in user-facing strings, comments or commit messages. See the repo's writing rules.
- **Currency:** the app renders naira as `₦{n.toLocaleString()}`. Match the surrounding code; do not introduce a new formatter.

## Measured baseline

Run before starting, so you can tell your own failures apart from inherited ones:

```bash
cd C:/laragon/www/biteexpress-web-app && npx vitest run
```

Measured on 2026-09-09: **2 test files, 20 tests, all passing.** Any failure you see is yours.

`npx tsc --noEmit` and `npm run lint` should also be clean before you start.

## What already exists, and what it means for you

Facts established by reading the repo on 2026-09-09. Do not re-derive them; do verify any that a task depends on.

- `src/lib/api-client.ts` exposes `api<T>(path, opts): Promise<ApiResult<T>>` and a already-extracted, already-tested `parseErrorBody`. It branches on `res.ok`, so **203 currently parses as success**. This is a live bug for ordinary place-order too, not only for this feature.
- `src/lib/api/orders.ts` holds every order call: `fetchRunningOrders`, `fetchOrderHistory`, `fetchOrderDetailLines`, `fetchOrderTrack`, `placeOrder`, `walletPayOrder`, `confirmPaystackPayment`.
- `src/components/checkout/checkout-flow.tsx` already calls `fetchStoreDetail`, so **checkout has the store object and can read `price_check_enabled` authoritatively.**
- `src/components/cart/cart-view.tsx` renders a plain `<Link href="/checkout">`. It does **not** load the store, so it cannot see the flag without a fetch.
- **There is no client-side store-minimum gate anywhere in this app.** `minimum_order` is only rendered on the store header. This is the defect that had to be fixed in the Flutter app, and it does not exist here. **Do not add one.**
- `src/components/orders/order-status-pill.tsx` falls back to a prettified status string for anything it does not know, so an unhandled `price_check` renders as "price check". It degrades, it does not crash.
- `src/lib/order-channel.ts` subscribes to the public Reverb channel `order_tracking_{orderId}` for `.order_status_updated`. `PriceCheckService::quote()` transitions through `OrderLifecycleService::transition()`, which calls `OrderTimelineService::record()`, which dispatches `OrderStatusUpdated`. **So a quote arriving broadcasts on a channel this app already knows how to listen to.** Verify this before relying on it in Task 8.
- The web app has no push notifications and no reorder endpoint. "Request again" after an expiry is a client-side navigation back to the store.

## File structure

**Create:**

| File | Responsibility |
|---|---|
| `src/lib/price-check/item-notes.ts` | Build the `item_notes` map from cart lines. Pure. |
| `src/lib/price-check/item-notes.test.ts` | Its tests. |
| `src/lib/price-check/quote-line.ts` | The `QuoteLine` shape, parsing a details response into quote lines, the estimated total, and the accept payload. Pure. |
| `src/lib/price-check/quote-line.test.ts` | Its tests. |
| `src/lib/price-check/eligibility.ts` | One predicate deciding whether a cart is a price-request cart. Pure. |
| `src/lib/price-check/eligibility.test.ts` | Its tests. |
| `src/lib/api/price-check.ts` | `sendPriceRequest` and `acceptQuote`. |
| `src/app/orders/[id]/quote/page.tsx` | Route for the quote review screen. |
| `src/components/orders/quote-review.tsx` | The review screen. |
| `src/components/orders/quote-line-row.tsx` | One line: tick, struck-through old price, quoted price, supply line, note. |

**Modify:**

| File | Change |
|---|---|
| `src/lib/api-client.ts` | Treat a 203 carrying errors as a failure. |
| `src/lib/api-client.test.ts` | Cover it. |
| `src/lib/cart-store.ts` | A per-line `note`, a `setLineNote` action, storage key to v4. |
| `src/lib/api/orders.ts` | `price_check` and `price_confirmed` on `OrderStatus`; quote fields on `OrderDetailLine`; `quote_expires_at` on `OrderSummary`. |
| `src/lib/api/store-detail.ts` | `price_check_enabled` on the store type. |
| `src/components/orders/order-status-pill.tsx` | Copy and tone for the two statuses. |
| `src/components/cart/cart-view.tsx` | Note editor per line; CTA copy when the store is eligible. |
| `src/components/checkout/checkout-flow.tsx` | Send a price request instead of placing an order when eligible. |
| `src/components/orders/order-detail-view.tsx` | A "Review the store's prices" action on `price_confirmed`. |

---

### Task 1: Stop reading a 203 refusal as a success

The single highest-risk item in this plan, and a live bug today: a customer whose cash order breaches the module ceiling currently sees "Order placed but no id returned" instead of the real reason, because `placeOrder` finds no `order_id` on what it thinks is a success body. Once the price-check flow exists, the same hole would show a confirmed order that does not exist.

**Files:**
- Modify: `src/lib/api-client.ts:183`
- Test: `src/lib/api-client.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `api<T>()` returns `{ ok: false, status: 203, message, errors? }` when a 203 body carries a usable error. Every later task depends on this.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/api-client.test.ts`. The file already tests `parseErrorBody` directly; these test the new decision in isolation, so export the predicate rather than mocking fetch.

```ts
import { describe, expect, it } from "vitest";
import { isRefusalBody, parseErrorBody } from "./api-client";

describe("isRefusalBody", () => {
  it("treats a 203 carrying a Laravel errors array as a refusal", () => {
    expect(
      isRefusalBody(203, {
        errors: [{ code: "order_amount", message: "Amount crossed maximum cod order amount" }],
      }),
    ).toBe(true);
  });

  it("treats a 203 carrying a bare errors string as a refusal", () => {
    expect(isRefusalBody(203, { errors: "Unauthorized" })).toBe(true);
  });

  it("does not treat a 200 with an errors key as a refusal", () => {
    // Only the 2xx codes the backend actually uses for refusals are
    // reinterpreted. Widening this to every 2xx would let an unrelated
    // endpoint that echoes an empty errors array break its own callers.
    expect(isRefusalBody(200, { errors: [{ code: "x", message: "y" }] })).toBe(false);
  });

  it("does not treat a 203 without a usable error as a refusal", () => {
    expect(isRefusalBody(203, { message: "Prices accepted. You can pay now." })).toBe(false);
    expect(isRefusalBody(203, {})).toBe(false);
    expect(isRefusalBody(203, { errors: [] })).toBe(false);
  });

  it("reads the refusal message through the existing parser", () => {
    const parsed = parseErrorBody({
      errors: [{ code: "order_amount", message: "Amount crossed maximum cod order amount" }],
    });
    expect(parsed.message).toBe("Amount crossed maximum cod order amount");
    expect(parsed.errors).toEqual({ order_amount: ["Amount crossed maximum cod order amount"] });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/api-client.test.ts`
Expected: FAIL, `isRefusalBody` is not exported.

- [ ] **Step 3: Implement**

In `src/lib/api-client.ts`, add above `api()`:

```ts
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
  const { message, errors } = parseErrorBody(body);
  return Boolean(message) || Boolean(errors);
}
```

Then in `api()`, replace the success tail (currently lines 209-210):

```ts
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
```

Note the body is now read once into `raw` and reused. Do not call `res.json()` twice; the stream can only be consumed once.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run`
Expected: all pass, and the pre-existing 20 still pass.

- [ ] **Step 5: Check nothing else relied on the old behaviour**

Run: `npx tsc --noEmit`
Then search for callers that inspect a 2xx body for errors themselves and would now be dead or double-handling:

```bash
grep -rn "203" src --include=*.ts --include=*.tsx
```

Expected: no other site interprets 203. If one exists, remove the now-redundant branch and say so in the commit message.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api-client.ts src/lib/api-client.test.ts
git commit -m "Treat a 203 refusal as a refusal, not a success"
```

---

### Task 2: Types and status copy for the two new order statuses

**Files:**
- Modify: `src/lib/api/orders.ts:49-63` (the `OrderStatus` union), `src/lib/api/orders.ts:14-47` (`OrderSummary`), the `OrderDetailLine` type
- Modify: `src/lib/api/store-detail.ts:71` area (the store type)
- Modify: `src/components/orders/order-status-pill.tsx:4-19`

**Interfaces:**
- Consumes: nothing.
- Produces: `OrderStatus` gains `"price_check" | "price_confirmed"`. `OrderDetailLine` gains `quoted_price?: number | null`, `available_quantity?: number | null`, `is_available?: boolean | null`, `customer_note?: string | null`, `quote_expires_at?: string | null`. `OrderSummary` gains `quote_expires_at?: string | null`. The store type gains `price_check_enabled?: boolean`.

- [ ] **Step 1: Extend the types**

In `src/lib/api/orders.ts`, add to the `OrderStatus` union:

```ts
  /** Parked with the store for pricing. No money has moved. */
  | "price_check"
  /** The store has quoted. Awaiting the customer to accept and pay. */
  | "price_confirmed"
```

Add to `OrderSummary`:

```ts
  /** ISO datetime the quote stops being payable, or null. Present and
   *  null on every order platform-wide, including orders that never
   *  went near a price request. Read it, never compute it. */
  quote_expires_at?: string | null;
```

Add to `OrderDetailLine`:

```ts
  /** Unit price the store returned. Null until quoted. NOT a line total. */
  quoted_price?: number | null;
  /** What the store can supply, 0 to the requested `quantity`. Null until quoted. */
  available_quantity?: number | null;
  /** False when the store marked the line unavailable. Null until quoted. */
  is_available?: boolean | null;
  /** The note the customer attached at request time. */
  customer_note?: string | null;
  /** Order-level, and present on the FIRST row only. Never read it
   *  from a later row. */
  quote_expires_at?: string | null;
```

In `src/lib/api/store-detail.ts`, add to the store type beside `minimum_order`:

```ts
  /** The server has already combined the master, module and per-store
   *  switches into this one boolean. It is the only price-check signal a
   *  client may branch on. */
  price_check_enabled?: boolean;
```

- [ ] **Step 2: Add the status copy**

In `src/components/orders/order-status-pill.tsx`, add to `STATUS_COPY`, above `pending`:

```ts
  price_check: { label: "Awaiting price", tone: "warn" },
  price_confirmed: { label: "Quote ready", tone: "warn" },
```

`price_confirmed` is the state where the customer must act: it covers both "the store has quoted, review it" and "you accepted, now pay". The order only leaves it when payment settles. Do not split it into two labels; there is only one status.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean, 20 tests still passing.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api/orders.ts src/lib/api/store-detail.ts src/components/orders/order-status-pill.tsx
git commit -m "Carry the two price-check order statuses and the quote fields"
```

---

### Task 3: Per-line notes on the cart

**Files:**
- Modify: `src/lib/cart-store.ts`
- Create: `src/lib/price-check/item-notes.ts`
- Create: `src/lib/price-check/item-notes.test.ts`

**Interfaces:**
- Consumes: `CartLine` from `src/lib/cart-store.ts`.
- Produces: `CartLine.note?: string`; a `setLineNote(key: string, note: string): void` action on the store; `buildItemNotes(lines: CartLine[]): Record<string, string>` from `src/lib/price-check/item-notes.ts`.

**The collision to decide now:** the cart keys lines by `key` (item id plus variations plus add-ons), so the same item can appear on two lines. `item_notes` is keyed by `item_id`. Two lines of the same item therefore collapse to one note. This plan takes the same decision the Flutter app took: **one note per item id**, last non-empty one wins, and the cart UI shows that note on every line of that item so the customer is never surprised. Record it in the commit message.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/price-check/item-notes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildItemNotes } from "./item-notes";
import type { CartLine } from "@/lib/cart-store";

function line(over: Partial<CartLine>): CartLine {
  return {
    key: "1", itemId: 1, storeId: 40, name: "Rice", unitPrice: 100,
    qty: 1, selections: [], addOns: [], ...over,
  };
}

describe("buildItemNotes", () => {
  it("keys by item_id, not by cart key", () => {
    expect(buildItemNotes([line({ key: "8801|large", itemId: 8801, note: "5kg bag" })]))
      .toEqual({ "8801": "5kg bag" });
  });

  it("omits lines with no note", () => {
    expect(buildItemNotes([line({ itemId: 1 }), line({ key: "2", itemId: 2, note: "Ripe" })]))
      .toEqual({ "2": "Ripe" });
  });

  it("omits notes that are only whitespace, and trims the rest", () => {
    expect(buildItemNotes([line({ itemId: 1, note: "   " }), line({ key: "2", itemId: 2, note: "  Ripe  " })]))
      .toEqual({ "2": "Ripe" });
  });

  it("collapses two lines of the same item to one note, last non-empty wins", () => {
    expect(buildItemNotes([
      line({ key: "5|a", itemId: 5, note: "first" }),
      line({ key: "5|b", itemId: 5, note: "second" }),
    ])).toEqual({ "5": "second" });
  });

  it("does not let a later empty note erase an earlier one", () => {
    expect(buildItemNotes([
      line({ key: "5|a", itemId: 5, note: "keep me" }),
      line({ key: "5|b", itemId: 5 }),
    ])).toEqual({ "5": "keep me" });
  });

  it("truncates to the server's 255-character limit", () => {
    const notes = buildItemNotes([line({ itemId: 1, note: "x".repeat(300) })]);
    expect(notes["1"]).toHaveLength(255);
  });

  it("returns an empty object when nothing is noted", () => {
    expect(buildItemNotes([line({}), line({ key: "2", itemId: 2 })])).toEqual({});
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/price-check/item-notes.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the builder**

Create `src/lib/price-check/item-notes.ts`:

```ts
import type { CartLine } from "@/lib/cart-store";

/** The server truncates at 255; do it here too so what the customer
 *  sees in the cart is what the store will read. */
const MAX_NOTE = 255;

/**
 * Build the `item_notes` map for POST /customer/order/price-check.
 *
 * Keyed by **item_id**, not by the cart's own line key and not by
 * order_detail_id: at request time no order detail exists yet, and the
 * cart rows are deleted before the server copies the notes across. This
 * is the single easiest field in the contract to get wrong (contract 3.1).
 *
 * Two cart lines of the same item collapse to one note. The last
 * non-empty one wins, so an empty note on a second line never erases a
 * real note on the first.
 */
export function buildItemNotes(lines: CartLine[]): Record<string, string> {
  const notes: Record<string, string> = {};
  for (const line of lines) {
    const note = line.note?.trim();
    if (!note) continue;
    notes[String(line.itemId)] = note.slice(0, MAX_NOTE);
  }
  return notes;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/price-check/item-notes.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the note to the cart store**

In `src/lib/cart-store.ts`:

Add to `CartLine`:

```ts
  /** Free-text note for the store, used only by the price-request flow.
   *  One note per item id: see buildItemNotes. */
  note?: string;
```

Bump the storage key, following the comment convention already in the file:

```ts
// v4 bump — line shape gained `note`. A v3 cart has no notes to lose, so
// this could have migrated in place, but the file's existing convention
// is to bump rather than to branch on shape at read time.
const STORAGE_KEY = "biteexpress.cart.v4";
```

Add a `setLineNote` action next to the existing quantity actions, matching their style. It must find the line by `key`, write the trimmed note (or delete the field when empty), and persist through whatever persist helper the file already uses. Read the existing actions first and mirror them exactly rather than inventing a second style.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/cart-store.ts src/lib/price-check/item-notes.ts src/lib/price-check/item-notes.test.ts
git commit -m "Let a cart line carry a note for the store"
```

The commit body must record the one-note-per-item-id decision and why, so a later reader does not read it as a bug.

---

### Task 4: Deciding whether a cart is a price-request cart

**Files:**
- Create: `src/lib/price-check/eligibility.ts`
- Create: `src/lib/price-check/eligibility.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isPriceRequestCart(store: { price_check_enabled?: boolean } | null | undefined): boolean`.

One predicate, in one place, so the cart and checkout can never disagree about which flow the customer is in.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/price-check/eligibility.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isPriceRequestCart } from "./eligibility";

describe("isPriceRequestCart", () => {
  it("is true only when the server says the store is enabled", () => {
    expect(isPriceRequestCart({ price_check_enabled: true })).toBe(true);
  });

  it("is false when the store is not enabled", () => {
    expect(isPriceRequestCart({ price_check_enabled: false })).toBe(false);
  });

  it("is false when the key is absent, which is every store today", () => {
    expect(isPriceRequestCart({})).toBe(false);
  });

  it("is false when the store has not loaded yet", () => {
    // The cart renders before its fetch resolves. Defaulting to the
    // ordinary checkout means a slow network shows the familiar button
    // rather than flickering into a flow the store may not offer.
    expect(isPriceRequestCart(null)).toBe(false);
    expect(isPriceRequestCart(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/price-check/eligibility.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Create `src/lib/price-check/eligibility.ts`:

```ts
/**
 * Whether this cart goes to the store for pricing instead of to checkout.
 *
 * `price_check_enabled` is the server's already-combined answer across the
 * master switch, the module switch and the per-store switch. Clients must
 * not combine those three themselves (contract 2.1), and there is no
 * per-store flag on the config endpoint to combine it with.
 */
export function isPriceRequestCart(
  store: { price_check_enabled?: boolean } | null | undefined,
): boolean {
  return store?.price_check_enabled === true;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/price-check/eligibility.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/price-check/eligibility.ts src/lib/price-check/eligibility.test.ts
git commit -m "Add the one predicate that decides a price-request cart"
```

---

### Task 5: The request call, and sending it from checkout

**Files:**
- Create: `src/lib/api/price-check.ts`
- Modify: `src/components/checkout/checkout-flow.tsx:256-282`
- Modify: `src/components/cart/cart-view.tsx`

**Interfaces:**
- Consumes: `buildItemNotes` (Task 3), `isPriceRequestCart` (Task 4), `PlaceOrderInput` from `src/lib/api/orders.ts`.
- Produces:

```ts
export type PriceRequestResult =
  | { ok: true; orderId: number; requestedAmount: number }
  | { ok: false; message: string };

export async function sendPriceRequest(
  input: Omit<PlaceOrderInput, "paymentMethod"> & { itemNotes: Record<string, string> },
): Promise<PriceRequestResult>;
```

- [ ] **Step 1: Write the request call**

Create `src/lib/api/price-check.ts`. Build the body exactly as `placeOrder` does, including the `variant: ""` key on every cart entry, whose absence is the documented cause of a 403 (see the comment at `orders.ts:294-302`). Omit `payment_method` entirely: the contract says it is ignored here and the order is parked unpaid.

```ts
"use client";

import { api } from "@/lib/api-client";
import type { PlaceOrderInput } from "@/lib/api/orders";

export type PriceRequestResult =
  | { ok: true; orderId: number; requestedAmount: number }
  | { ok: false; message: string };

type PriceRequestResponse = {
  message?: string;
  order_id?: number;
  /** Two m's. Real key on the backend, unchanged from place-order.
   *  At this point it is the REQUESTED total from stale catalogue
   *  prices, not a price the store has agreed to. */
  total_ammount?: number;
  status?: string;
};

export async function sendPriceRequest(
  input: Omit<PlaceOrderInput, "paymentMethod"> & {
    itemNotes: Record<string, string>;
  },
): Promise<PriceRequestResult> {
  // Reuse placeOrder's cart shaping verbatim. Extract it into a shared
  // helper in orders.ts rather than copying it, so the `variant: ""`
  // fix cannot drift between the two payloads.
  const body: Record<string, unknown> = {
    /* ...identical to placeOrder's body minus payment_method... */
  };

  if (Object.keys(input.itemNotes).length > 0) {
    body.item_notes = input.itemNotes;
  }

  const res = await api<PriceRequestResponse>(
    "/api/v1/customer/order/price-check",
    {
      method: "POST",
      body,
      zoneId: input.zoneIds,
      moduleId: input.moduleId,
      latitude: input.lat,
      longitude: input.lng,
    },
  );

  if (res.ok) {
    if (typeof res.data.order_id === "number") {
      return {
        ok: true,
        orderId: res.data.order_id,
        requestedAmount: Number(res.data.total_ammount ?? 0),
      };
    }
    return { ok: false, message: "Request sent but no order id came back." };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}
```

**Before writing the body:** extract the cart-shaping block from `placeOrder` (`orders.ts:290-306`) into an exported `function toWireCart(lines: CartLine[])` in `orders.ts`, and call it from both. Copying it would let the two payloads drift.

- [ ] **Step 2: Branch checkout onto it**

In `checkout-flow.tsx`, the store detail is already fetched at line 109. Hold `price_check_enabled` in the same state the rest of the store data lands in, and at the submit handler:

```ts
if (isPriceRequestCart(store)) {
  const req = await sendPriceRequest({
    /* every field passed to placeOrder except paymentMethod */
    itemNotes: buildItemNotes(lines),
  });
  if (!req.ok) {
    setPhase({ kind: "ready", moduleId: phase.moduleId, storeZoneId: phase.storeZoneId });
    toast.error(req.message);
    return;
  }
  clear();
  router.replace(`/orders/${req.orderId}`);
  return;
}
```

Place this branch **before** the `placeOrder` call, and leave every existing payment branch below it untouched.

**Do not add a minimum-order check on this path.** There is none in this app today, and adding one would refuse exactly the customer this feature exists for: a basket that looks too small at stale prices and clears the minimum once quoted. The server deliberately moved that gate to accept (contract 6.1 step 5).

The payment picker must not be required on this path. If the submit button is disabled until a payment method is chosen, relax that for a price-request cart: the customer picks how to pay on the review screen, after they know the price.

- [ ] **Step 3: Change the cart CTA**

In `cart-view.tsx`, fetch the cart store's detail with the existing `fetchStoreDetail` and, when `isPriceRequestCart(store)` is true:

- The CTA reads **"Request current prices"** and still links to `/checkout`.
- Under the subtotal, render the notice: **"This store confirms today's prices before you pay. Nothing is charged yet."**
- Label the figure **"Estimated subtotal"**, not "Subtotal".
- Each line gains an "Add a note for the store" control writing through `setLineNote`. When a note exists, render it on the line, and on every other line of the same item id, so the collapse from Task 3 is visible rather than surprising.

While the fetch is in flight, render the ordinary CTA. `isPriceRequestCart(null)` already returns false for exactly this reason.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/price-check.ts src/lib/api/orders.ts src/components/checkout/checkout-flow.tsx src/components/cart/cart-view.tsx
git commit -m "Send the cart as a price request when the store prices on request"
```

---

### Task 6: Reading a quote, and the estimated total

The arithmetic task. Everything here is pure and fully tested; the screen that renders it comes in Task 7.

**Files:**
- Create: `src/lib/price-check/quote-line.ts`
- Create: `src/lib/price-check/quote-line.test.ts`

**Interfaces:**
- Consumes: `OrderDetailLine`, `OrderTrack` from `src/lib/api/orders.ts`.
- Produces:

```ts
export type QuoteLine = {
  detailId: number;
  itemId: number | null;
  name: string;
  requestedQty: number;
  requestedPrice: number;
  quotedPrice: number | null;
  availableQuantity: number | null;
  isAvailable: boolean;
  note: string | null;
  taxAmount: number;
};

export function toQuoteLines(lines: OrderDetailLine[]): QuoteLine[];
export function quoteExpiresAt(lines: OrderDetailLine[]): string | null;
export function isQuoteExpired(expiresAt: string | null, now: Date): boolean;
export function rescaledTax(line: QuoteLine): number;
export function estimatedQuoteTotal(
  lines: QuoteLine[],
  included: Set<number>,
  charges: { deliveryCharge: number; additionalCharge: number; extraPackaging: number; dmTips: number },
): number;
export function buildAcceptPayload(
  orderId: number,
  lines: QuoteLine[],
  included: Set<number>,
  paymentMethod: string | null,
): Record<string, unknown>;
```

**The formula, from contract 6.1 step 7.** The accepted total is the quoted lines, plus each line's own tax rescaled by that line's price and quantity change, plus delivery charge, additional charge, extra packaging and tips carried through from the request unchanged. Order-level discount revalidation is **not** reproduced here: it can only ever reduce the true total, so omitting it makes this estimate err high, which is the safe direction before an irreversible accept. Say so in the copy, which Task 7 owns.

Rescale guard: when a line's original `price * quantity` is zero, the scale factor is undefined. Return 0 rather than dividing.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/price-check/quote-line.test.ts`. Cover at least:

```ts
import { describe, expect, it } from "vitest";
import {
  buildAcceptPayload, estimatedQuoteTotal, isQuoteExpired,
  quoteExpiresAt, rescaledTax, toQuoteLines, type QuoteLine,
} from "./quote-line";

const CHARGES = { deliveryCharge: 500, additionalCharge: 300, extraPackaging: 0, dmTips: 0 };

function ql(over: Partial<QuoteLine>): QuoteLine {
  return {
    detailId: 1, itemId: 10, name: "Chick Egg", requestedQty: 1,
    requestedPrice: 7000, quotedPrice: 9500, availableQuantity: 1,
    isAvailable: true, note: null, taxAmount: 0, ...over,
  };
}

describe("toQuoteLines", () => {
  it("reads the quote fields off each line", () => {
    const [line] = toQuoteLines([{
      id: 55301, item_id: 8801, price: 9000, quantity: 2,
      quoted_price: 9750, available_quantity: 2, is_available: true,
      customer_note: "5kg bag", tax_amount: 100,
      item_details: JSON.stringify({ name: "Rice" }),
    }]);
    expect(line.detailId).toBe(55301);
    expect(line.requestedPrice).toBe(9000);
    expect(line.quotedPrice).toBe(9750);
    expect(line.availableQuantity).toBe(2);
    expect(line.note).toBe("5kg bag");
    expect(line.name).toBe("Rice");
  });

  it("treats a line the store marked unavailable as unavailable", () => {
    const [line] = toQuoteLines([{
      id: 1, price: 100, quantity: 1, quoted_price: 100,
      available_quantity: 0, is_available: false,
    }]);
    expect(line.isAvailable).toBe(false);
  });

  it("treats available_quantity 0 as unavailable even when is_available is true", () => {
    // Contract 6.1 step 2 deletes both on accept, so the screen must
    // present them the same way.
    const [line] = toQuoteLines([{
      id: 1, price: 100, quantity: 1, quoted_price: 100,
      available_quantity: 0, is_available: true,
    }]);
    expect(line.isAvailable).toBe(false);
  });
});

describe("quoteExpiresAt", () => {
  it("reads it from the first row only", () => {
    expect(quoteExpiresAt([
      { id: 1, price: 1, quantity: 1, quote_expires_at: "2026-09-09T16:25:55.000000Z" },
      { id: 2, price: 1, quantity: 1, quote_expires_at: "2026-01-01T00:00:00.000000Z" },
    ])).toBe("2026-09-09T16:25:55.000000Z");
  });

  it("is null on an empty list and when the key is absent", () => {
    expect(quoteExpiresAt([])).toBeNull();
    expect(quoteExpiresAt([{ id: 1, price: 1, quantity: 1 }])).toBeNull();
  });
});

describe("isQuoteExpired", () => {
  it("is false before the deadline and true after it", () => {
    const at = "2026-09-09T16:00:00.000000Z";
    expect(isQuoteExpired(at, new Date("2026-09-09T15:59:00Z"))).toBe(false);
    expect(isQuoteExpired(at, new Date("2026-09-09T16:01:00Z"))).toBe(true);
  });

  it("is false when there is no deadline", () => {
    expect(isQuoteExpired(null, new Date())).toBe(false);
  });

  it("is false when the deadline is unparseable, so a bad string cannot lock a payable quote", () => {
    expect(isQuoteExpired("not a date", new Date())).toBe(false);
  });
});

describe("rescaledTax", () => {
  it("scales tax by the line's own price and quantity change", () => {
    // 3 at 100 taxed 30, cut to 2 at 150: 300 -> 300, so tax holds at 30.
    expect(rescaledTax(ql({
      requestedQty: 3, requestedPrice: 100, quotedPrice: 150,
      availableQuantity: 2, taxAmount: 30,
    }))).toBeCloseTo(30);
  });

  it("returns 0 when the original line total was zero", () => {
    expect(rescaledTax(ql({ requestedPrice: 0, taxAmount: 5 }))).toBe(0);
  });
});

describe("estimatedQuoteTotal", () => {
  it("sums the ticked lines and adds the carried charges", () => {
    const lines = [
      ql({ detailId: 1, quotedPrice: 9500, availableQuantity: 2 }),
      ql({ detailId: 2, quotedPrice: 4200, availableQuantity: 1 }),
    ];
    expect(estimatedQuoteTotal(lines, new Set([1, 2]), CHARGES)).toBe(24000);
  });

  it("drops an unticked line by exactly its line value", () => {
    const lines = [
      ql({ detailId: 1, quotedPrice: 9500, availableQuantity: 2 }),
      ql({ detailId: 2, quotedPrice: 4200, availableQuantity: 1 }),
    ];
    expect(estimatedQuoteTotal(lines, new Set([1]), CHARGES)).toBe(19800);
  });

  it("never counts a line the store cannot supply, ticked or not", () => {
    const lines = [
      ql({ detailId: 1, quotedPrice: 9500, availableQuantity: 2 }),
      ql({ detailId: 2, quotedPrice: 4200, availableQuantity: 0, isAvailable: false }),
    ];
    expect(estimatedQuoteTotal(lines, new Set([1, 2]), CHARGES)).toBe(19800);
  });

  it("still charges delivery when every line is dropped", () => {
    // The screen blocks this before accept, but the arithmetic must not
    // silently produce a negative or a zero that reads as "free".
    expect(estimatedQuoteTotal([ql({})], new Set(), CHARGES)).toBe(800);
  });
});

describe("buildAcceptPayload", () => {
  it("sends the unticked detail ids, not item ids", () => {
    const lines = [ql({ detailId: 55301, itemId: 8801 }), ql({ detailId: 55302, itemId: 8815 })];
    const payload = buildAcceptPayload(90211, lines, new Set([55301]), "cash_on_delivery");
    expect(payload.order_id).toBe(90211);
    expect(payload.excluded_detail_ids).toEqual([55302]);
    expect(payload.payment_method).toBe("cash_on_delivery");
  });

  it("also excludes lines the store cannot supply", () => {
    const lines = [ql({ detailId: 1 }), ql({ detailId: 2, isAvailable: false, availableQuantity: 0 })];
    const payload = buildAcceptPayload(1, lines, new Set([1]), "wallet");
    expect(payload.excluded_detail_ids).toEqual([2]);
  });

  it("omits payment_method when the customer has not chosen one", () => {
    const payload = buildAcceptPayload(1, [ql({ detailId: 1 })], new Set([1]), null);
    expect("payment_method" in payload).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/price-check/quote-line.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Create `src/lib/price-check/quote-line.ts` satisfying every test above. Points the tests pin down, restated so you do not have to infer them:

- `toQuoteLines` reads the item name out of the JSON-encoded `item_details` snapshot the way the existing order detail view already does; reuse that helper rather than writing a second parser.
- `isAvailable` is false when `is_available === false` **or** `available_quantity === 0`.
- `rescaledTax` is `taxAmount * (quotedPrice * availableQuantity) / (requestedPrice * requestedQty)`, guarded to 0 when the denominator is 0.
- `estimatedQuoteTotal` sums `quotedPrice * availableQuantity` plus `rescaledTax` over lines that are both available and ticked, then adds all four carried charges.
- `buildAcceptPayload` excludes every line that is unticked **or** unavailable, and omits `payment_method` entirely when null rather than sending null.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/price-check/quote-line.ts src/lib/price-check/quote-line.test.ts
git commit -m "Reproduce the quoted total the server will charge"
```

The commit body must state that order-level discount revalidation is deliberately not reproduced, and that this makes the estimate err high.

---

### Task 7: The quote review screen and the accept call

**Files:**
- Create: `src/app/orders/[id]/quote/page.tsx`
- Create: `src/components/orders/quote-review.tsx`
- Create: `src/components/orders/quote-line-row.tsx`
- Modify: `src/lib/api/price-check.ts` (add `acceptQuote`)
- Modify: `src/components/orders/order-detail-view.tsx`

**Interfaces:**
- Consumes: everything from Task 6, `sendPriceRequest`'s module, `fetchOrderTrack` and `fetchOrderDetailLines`.
- Produces:

```ts
export type AcceptQuoteResult =
  | { ok: true; orderId: number; orderAmount: number; lineCount: number }
  | { ok: false; status: number; code: string | null; message: string };

export async function acceptQuote(payload: Record<string, unknown>): Promise<AcceptQuoteResult>;
```

`code` is the first `errors[].code` from the body, so callers can branch on `price_check_quote_expired`, `price_check_no_lines`, `price_check_already_answered`, `order_time` and `order_amount` without string-matching messages.

- [ ] **Step 1: Add the accept call**

In `src/lib/api/price-check.ts`. Note this only works correctly because Task 1 landed: a 203 now arrives as `ok: false` with `errors`, so `order_amount` reaches the `code` branch instead of being read as a success with no amount.

- [ ] **Step 2: Build the screen**

`quote-review.tsx` loads the order with `fetchOrderTrack` and its lines with `fetchOrderDetailLines`, converts with `toQuoteLines`, and renders:

- A heading: **"Confirm today's prices"**, and under it **"The store has priced your list. Keep what you want and drop the rest."**
- A hold banner: **"Prices held until {formatted quote_expires_at}"**, from `quoteExpiresAt(lines)`. Format it in the customer's local timezone using the app's existing date formatting; do not hand-roll a parser that drops the zone.
- When any line is unavailable, an amber banner: **"The store cannot supply some of these items. They are removed when you accept."**
- One `quote-line-row` per line: a tick (absent, and the row struck through, when unavailable), the old price struck through beside the quoted price, **"You asked for {n} · store can supply {m}"**, and **"Your note: {note}"** when present.
- A footer with **"Estimated total"** and `estimatedQuoteTotal`, and under it: **"This is an estimate that includes tax. Your final total is confirmed when you pay, because any discount on your order is recalculated on the smaller basket."**
- A payment picker offering only the methods this app already supports, reusing `payment-picker.tsx`.
- **"Accept prices and continue"**, disabled with a visible reason when no payment method is chosen or when no available line is ticked.
- **"Cancel order"**, reusing the app's existing cancel path.

- [ ] **Step 3: Wire the accept, in the required order**

On confirm, show a dialog: **"Accept these prices?"** / **"Items you dropped, and items the store cannot supply, are removed from this order for good. They cannot be added back."** Use the app's own dialog component; no native `confirm`.

Then, and this ordering is the contract's hard rule (6.2):

1. `acceptQuote(buildAcceptPayload(...))`.
2. On failure, branch on `code`:
   - `price_check_quote_expired`: show the expired copy and "Request again" (Task 8).
   - `price_check_no_lines`: keep at least one line ticked.
   - `price_check_already_answered`: reload the order.
   - `order_time` (HTTP 406): show the server's message, which carries the minimum. Let the customer re-tick a line or cancel. Nothing changed server-side.
   - `order_amount` (HTTP 203): show the server's message and **clear the chosen payment method**, so the customer must pick another. The same basket goes through on card, wallet or offline.
   - Anything else: show the message.
   A refusal is fully rolled back, so leave the customer's ticks exactly as they are.
3. On success, pay with `result.orderAmount` and nothing else. Never a locally computed figure: the gateway compares what it captured against the server's total, and a mismatch is rejected **after** the customer has been charged.
   - Cash: the existing payment-method call, then the order page.
   - Wallet: `walletPayOrder`, then the order page.
   - Offline: the existing offline route.
   - Card: `payWithPaystack` with `Math.round(result.orderAmount * 100)` kobo, then `confirmPaystackPayment`.

Keep the button locked for the whole of step 3. Accept is irreversible; a second tap sends a second accept and can send a second payment.

- [ ] **Step 4: Add the entry point**

In `order-detail-view.tsx`, when `order_status === "price_confirmed"`, render **"Review the store's prices"** linking to `/orders/{id}/quote`. When `order_status === "price_check"`, render nothing new: the status pill from Task 2 already says "Awaiting price", and there is nothing for the customer to do.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/orders src/components/orders src/lib/api/price-check.ts
git commit -m "Let the customer review a quote and accept it before paying"
```

---

### Task 8: Expiry, re-request, and the payment-in-flight rule

**Files:**
- Modify: `src/components/orders/quote-review.tsx`
- Modify: `src/components/orders/order-detail-view.tsx`

- [ ] **Step 1: Expired copy**

When `isQuoteExpired(quoteExpiresAt(lines), new Date())`, or when accept returns `price_check_quote_expired`, replace the accept button with **"Request again"** and show: **"These prices have expired. Send a new price request to get today's prices."**

Expect the server refusal even when the local clock says there is time left. A slow clock puts the two minutes apart, and the server is the authority.

- [ ] **Step 2: Re-request**

There is no server clone endpoint. "Request again" navigates to the store page for the order's store. Do not silently repopulate the cart from the cancelled order; the prices that produced it are exactly what went stale.

- [ ] **Step 3: The rule that protects a paying customer**

Contract 9.1: the expiry sweeper cannot see an open gateway session, so a customer can be at the gateway when their order is cancelled, and the server will still settle a capture that lands. Therefore:

- After any gateway return, **re-read the order before drawing any conclusion from it.**
- Never show expired or cancelled copy, and never offer "Request again", for an order with a payment this session started, until that re-read has come back.
- If the gateway result is unknown, re-read rather than assuming the cancellation stands.

The failure this prevents is the one the contract forbids outright: telling a customer who has been charged that nothing was charged.

- [ ] **Step 4: Live update when the quote arrives**

`src/lib/order-channel.ts` already subscribes to `order_tracking_{orderId}`. Verify by inspection that a price-check transition reaches it: `PriceCheckService::quote()` calls `OrderLifecycleService::transition()`, which calls `OrderTimelineService::record()`, which dispatches `OrderStatusUpdated`. If that holds, the order page updates from `price_check` to `price_confirmed` with no polling. If it does not hold, say so in the ledger and leave the customer to refresh; do not add a polling loop without recording why.

- [ ] **Step 5: Verify and commit**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
git add src/components/orders
git commit -m "Handle an expired quote without stranding a paying customer"
```

---

### Task 9: Verification and handover

**Files:** none, except the ledger.

- [ ] **Step 1: Full static pass**

```bash
npx vitest run
npx tsc --noEmit
npm run lint
npm run build
```

Report the numbers against the 20-test baseline. `npm run build` matters here: this repo has App Router routes, and a server/client boundary mistake in the new route only shows up at build.

- [ ] **Step 2: Confirm it ships inert**

With `price_check_enabled` false or absent on every store, confirm by reading the code paths that the cart CTA, the notice, the note controls and the quote route are all unreachable, and that checkout still calls `placeOrder`. This is the state production is in today.

- [ ] **Step 3: Live pass against a local backend**

The Flutter pass used this rig and it works; reuse it rather than inventing one.

1. Serve the dashboard repo root, not `public/`: `php -S 127.0.0.1:8099 -t .` from `C:/laragon/www/dashboard.bite.express`.
2. Point `NEXT_PUBLIC_API_BASE_URL` at it and run `npm run dev`.
3. Store 40 (Yusad Shopping Mall, grocery, zone 2) already carries the per-store flag locally, and the master and grocery switches are on.
4. Answer quotes over the real vendor endpoint: `PUT /api/v1/vendor/price-check` with a vendor token from `POST /api/v1/auth/vendor/login` with `{"email":"...","password":"...","vendor_type":"owner"}` and the header `vendorType: owner`.
5. After `php artisan cache:clear`, config changes take effect; without it the config endpoint serves stale flags.

Exercise, and record what you actually saw for each:

- the price-request CTA and the note control on the cart
- the request send, and the order landing in "Awaiting price"
- the quote arriving, and whether the page updated without a refresh
- the review screen: struck-through prices, the supply line, the note
- unticking a line, and the estimated total dropping by exactly that line's value
- an unavailable line and its banner
- the accept confirmation
- **a basket below the store's minimum, requested and then accepted at a quote that clears it.** Raise `stores.minimum_order` for store 40 to do this. This is the feature's headline case.
- **a cash accept above the module ceiling**, expecting the server's own message and the payment method cleared. Enable cash first: `business_settings.cash_on_delivery` to `{"status":1}`, then clear the cache. The ceiling is `module_zone.maximum_cod_order_amount` for zone 2, module 3.
- **the accept-before-gateway order**, read off the server request log, not inferred from the UI.
- an expired quote, forced with `UPDATE order_price_checks SET quote_expires_at = DATE_SUB(NOW(), INTERVAL 10 MINUTE)`.
- the flags-off case, with `store_configs.price_check_status = 0`.

Restore every setting you changed afterwards, and put `NEXT_PUBLIC_API_BASE_URL` back.

- [ ] **Step 4: Write the handover**

Record in the ledger: what passed, what you could not exercise and why, and every defect found whether or not you fixed it. A verification note that claims more than was observed is worse than none.

- [ ] **Step 5: Commit**

```bash
git commit -m "Record what the web price-check flow was verified against"
```

---

## Self-review notes

Checked against the contract on 2026-09-09.

**Covered:** flags (2.1, 2.2) in Task 4; request and `item_notes` (3.1, 3.2) in Tasks 3 and 5; accept and its errors (6, 6.1, 6.3) in Tasks 6 and 7; the ordering rule (6.2) in Task 7; the 203 trap (7.0) in Task 1, ahead of everything that depends on it; the payment entry points (7.1 to 7.4) in Task 7; expiry and the in-flight rule (9, 9.1) in Task 8; reading an order (10) in Tasks 2 and 6; the field-name traps (12b) as global constraints and in the tests that pin them.

**Deliberately out of scope, each with a reason:**

- **Guest price requests.** The contract allows them on the same terms as place-order. This app's checkout already requires sign-in, so the guest path would be new surface with no caller.
- **Push notifications (12).** The web app has none. Reverb covers the one transition that matters.
- **`responded_by_type` (10).** Vendor-side only; the customer endpoint does not carry it.
- **Coupons on a price request.** `coupon_code` is accepted at request time and revalidated at accept. This app's checkout does not send coupons today, so there is nothing to carry.

**Known risk the plan does not remove:** the estimated total in Task 6 omits order-level discount revalidation. It therefore errs high, which is the safe direction before an irreversible accept, and the copy in Task 7 says the final figure is confirmed at payment. A customer with a coupon sees an estimate above what they pay.
