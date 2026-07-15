# Offline Payment at Checkout (app.bite.express)

**Date:** 2026-07-15
**Status:** Approved, ready for implementation planning
**Repo:** `biteexpress-web-app` (app.bite.express)
**Branch:** `feat/offline-payment-checkout`

## Purpose

Offline payment (pay by bank transfer, verified manually by an admin) is live in the
Flutter customer app and in the WhatsApp ordering flow, and is actively used in
production. It is **not** wired into the customer web app. This spec covers bringing
app.bite.express to parity.

The business driver: Paystack card payments fail often enough that customers abandon
and orders get cancelled. Offline payment removes the card step. A bulk email
announcing this is going out to ~4,300 customers, so the web gap needs closing before
customers arrive looking for the option.

## Success criteria

1. A customer on app.bite.express can select Pay Offline at checkout, see the
   destination bank account and the exact amount owed, submit their transfer details,
   and land on the order success page.
2. The option appears only where the Flutter app would also show it.
3. A customer whose payment is denied by an admin can see the admin's reason and
   resubmit corrected details, without leaving the web app.
4. A failed submit never strands the customer on a page with no way forward.

## Non-goals

- Fixing the orphaned-order window in the Flutter app (see Known risks).
- Changing any backend code. This is a client-side integration against the existing
  API.
- Fixing the unrelated dead-end bug in the bank transfer flow (noted below, tracked
  separately).

## Backend contract (existing, unchanged)

All paths are relative to `/api/v1`.

### Fetch available methods

`GET /offline_payment_method_list` ([`ConfigController.php:1076-1082`])

No auth, no `zoneId`/`moduleId` headers. Returns a raw model dump with no transformer.

**Returns literal JSON `null`, not `[]`, when there are zero active methods.** The
client must treat `null` as "no methods available" rather than letting it blow up.

```json
[
  {
    "id": 1,
    "method_name": "Bank Transfer",
    "method_fields": [
      { "input_name": "bank_name", "input_data": "GTBank" },
      { "input_name": "account_number", "input_data": "0123456789" }
    ],
    "method_informations": [
      {
        "customer_input": "sender_name",
        "customer_placeholder": "Enter the name on the account",
        "is_required": 1
      }
    ],
    "status": 1
  }
]
```

- `method_fields[]` is **read-only display data**: the account the customer pays into.
- `method_informations[]` **defines the form to render**. `customer_input` is the key
  to POST back verbatim; `customer_placeholder` is the label; `is_required` is `0|1`.

`method_fields` and `method_informations` are cast to array on the model, so they
arrive as real JSON arrays, not strings.

### Place the order

`POST /customer/order/place` with `payment_method: "offline_payment"`.

The value is already accepted by the validator
(`'payment_method' => 'required|in:cash_on_delivery,digital_payment,wallet,offline_payment'`).

The order is created at **`order_status = 'failed'`, `payment_status = 'unpaid'`**
([`PlaceNewOrder.php:173-179`]). This is expected, not an error. It only becomes
`pending` after the submit call below.

Gated on the global flag ([`PlaceNewOrder.php:681-685`]): a `403` with
`code: offline_payment_status` if offline payment is switched off.

### Submit payment details

`PUT /customer/order/offline-payment` ([`OrderController.php:470-540`])

Auth: bearer token, or a `guest_id` in the body (`apiGuestCheck` middleware).

Validation is only `order_id` and `method_id`. Everything else is optional and
unvalidated.

| Field | Type | Required | Notes |
|---|---|---|---|
| `order_id` | int | yes | No ownership check server-side |
| `method_id` | int | yes | Must resolve to a method with `status = 1` |
| `customer_note` | string | no | Free text |
| *dynamic* | string | no | One key per `method_informations[].customer_input`, **flat at top level** |

On success: sets `order_status = 'pending'` and `payment_method = 'offline_payment'`,
creates an `offline_payments` row at `status = 'pending'`. Returns
`200 {"payment": "success"}`.

Failure shapes differ and **both must be handled**:
- `403 {"errors": [{"code": "offline_payment_status", "message": "..."}]}` when the
  global flag is off
- `403 {"payment": "<exception message>"}` on an exception, with **no `errors` key**

### Update payment details

`PUT /customer/order/offline-payment-update` ([`OrderController.php:543-610`])

Validation is only `order_id`.

Three traps:
- **Do not send `method_id`.** The method is re-read from the stored `payment_info`;
  it cannot be changed here.
- **Always submit the full form.** The info object is rebuilt from scratch, so any
  omitted field is deleted.
- Send `update_payment_info: 1` so the customer gets an "info updated" notification
  rather than the store receiving an order notification.

Resets `status` to `pending` regardless of prior state. Returns
`200 {"payment": "Payment_Info_Updated_successfully"}`.

### Read status

**Use `GET /customer/order/track?order_id=`, not `/customer/order/details`.**

This is worth stating loudly because it is counter-intuitive.
`get_order_details` ([`OrderController.php:161-198`]) eager-loads `offline_payments`
and then **never uses it** — it returns `Helpers::order_details_data_formatting($details)`,
an array of *line items*. The eager-load is dead weight and the `offline_payment` block
is absent from that response entirely.

`track_order` ([`OrderController.php:37-86`]) is what emits it, at
[`OrderController.php:74`]. It also scopes by `user_id`, unlike the submit endpoint.
For an authenticated customer only `order_id` is required (`contact_number` is required
only for guests).

The web app already wraps this as `fetchOrderTrack()` ([`orders.ts:159-168`]), so no new
fetcher is needed — only an extension to the `OrderTrack` type.

The `offline_payment` block (via `Helpers::offline_payment_formater`,
[`Helpers.php:3300-3332`]):

```json
{
  "input": [ { "user_input": "sender_name", "user_data": "John Doe" } ],
  "data": {
    "status": "pending",
    "method_id": 1,
    "method_name": "Bank Transfer",
    "customer_note": "Paid at 10am",
    "admin_note": null
  },
  "method_fields": [ { "input_name": "bank_name", "input_data": "GTBank" } ]
}
```

- Status: `offline_payment.data.status` — `pending` | `verified` | `denied`.
  (Not `unpaid`; that is `order.payment_status`, a separate field.)
- Denial reason: `offline_payment.data.admin_note`.

State machine:

```
place → order failed/unpaid
  → PUT offline-payment → order pending, offline pending
    → admin verifies → order confirmed/paid, offline verified
    → admin denies   → offline denied + admin_note
      → PUT offline-payment-update → offline pending
```

## Design

### Chosen approach

Mirror the Flutter app: pick the method at checkout, place the order, then route to a
dedicated page for bank details and the form.

Two alternatives were rejected:

- **Collect everything before placing the order.** Impossible: the authoritative order
  total only exists in the `placeOrder` response. `checkout-flow` deliberately uses
  `res.amount` rather than the local subtotal, and client-side total computation is
  exactly what previously broke on the `additional_charge` percentage mode. We cannot
  tell a customer "transfer exactly ₦X" before the server has said so. It also asks for
  a transaction reference before the customer has paid.
- **Bank account preview inline at checkout.** Deferred. Cheap to add later if
  customers ask; not worth the duplication now.

### Flow

```
/checkout
  PaymentPicker shows "Pay Offline" only when gated on
  Customer picks Pay Offline + chooses a bank
       ↓
  placeOrder({ payment_method: "offline_payment", ... })  →  { orderId, amount }
       ↓
  clear(); router.replace(`/checkout/offline/${orderId}?method=${methodId}`)
       ↓
/checkout/offline/[orderId]
  Fetches GET /customer/order/track?order_id=   (existing fetchOrderTrack)
    ├─ no offline_payment block  → create mode → PUT offline-payment
    └─ offline_payment present   → edit mode, prefill from input[] → PUT offline-payment-update
  Shows destination account, authoritative amount, dynamic form
       ↓
  router.replace(`/checkout/success?order_id=${orderId}`)
```

`?method=` is an initial bank hint for create mode only. It is validated against the
live method list rather than trusted, which also avoids a backend bug: a `method_id`
that does not resolve to an active method still returns `200 {"payment":"success"}`,
but then makes `Helpers::offline_payment_formater` throw on `$user_inputes['method_name']`
([`Helpers.php:3305`]) every time the order is subsequently fetched.

**Switching banks.** In create mode the customer can change to a different method on
this page, matching the Flutter app's swipeable bank card carousel. Changing the method
re-renders the form from the new method's `method_informations` and changes the
`method_id` sent on submit. This matters because a customer who picked the wrong bank at
checkout would otherwise have to abandon, and an abandoned offline order becomes an
invisible stranded order (see Known risks).

In **edit mode the method selector is not shown**, because
`PUT /offline-payment-update` re-reads the method from the stored `payment_info` and
cannot change it. Offering a selector that silently does nothing would be worse than
omitting it.

The amount is **not** passed via query string (unlike `/checkout/transfer/[orderId]?amount=`).
The page calls `fetchOrderTrack()` anyway for mode detection, so the amount comes from
there and is not tamper-able.

Fetching the order also makes the page idempotent and re-enterable: a customer who
abandons mid-flow can finish by returning to the URL.

### Gating

The Pay Offline option renders only when all three hold:

| Condition | Source | Enforced server-side |
|---|---|---|
| `offline_payment_status === 1` | `GET /config` | Yes, at both place and submit |
| `zone.offline_payment === true` | `GET /config/get-zone-id` | No, advisory only |
| Method list non-empty (not `null`) | `GET /offline_payment_method_list` | n/a |

The per-zone flag is never checked by the backend during order placement, but the
Flutter app gates on it. Ignoring it on web would make the two clients disagree in any
zone deliberately switched off.

**Zone data plumbing:** `checkZone` already returns per-zone `offline_payment`, but
`ZoneCacheEntry` ([`location-store.ts:29-32`]) persists only `zoneIds` and discards the
`zones` array. Rather than change that persisted shape (which would need a
localStorage migration for existing entries), `checkout-flow` calls `checkZone` on mount
and holds the flags in local state. It already calls `checkZone` at submit, so the
pattern is established, and no shared store changes.

**Config fetching is new.** The web app has no `/api/v1/config` fetcher at all today;
it only calls the `config/get-zone-id` sub-path. A minimal typed fetcher with a 30
minute TTL cache, mirroring the `CACHE_TTL_MS` precedent in `zone-result.tsx`, is
required.

### Files

**New**

| File | Purpose |
|---|---|
| `src/lib/api/config.ts` | `fetchConfig()`, typed subset (`offline_payment_status`), TTL cache |
| `src/lib/api/offline-payment.ts` | `fetchOfflineMethods()`, `submitOfflinePayment()`, `updateOfflinePayment()` |
| `src/lib/offline-payment-rules.ts` | Pure, dependency-free: `canUseOfflinePayment()`, `validateOfflineForm()`. Extracted so the gating and validation logic is unit-testable without a DOM |
| `src/app/checkout/offline/[orderId]/page.tsx` | Server page, structural clone of the transfer page |
| `src/components/checkout/offline-payment-form.tsx` | Client component, sibling to `transfer-instructions.tsx` |
| `vitest.config.ts` + `src/lib/*.test.ts` | New test runner and the pure-logic tests (see Testing) |

**Changed**

| File | Change |
|---|---|
| `src/components/checkout/payment-picker.tsx` | Add `offline_payment` to the `PaymentMethod` union, an `OPTIONS` entry, an `OptionHint` branch, the bank chooser, and gating props |
| `src/components/checkout/checkout-flow.tsx` | Fetch config + methods + zone flags; pass to picker; add post-place branch |
| `src/lib/api-client.ts` | Extract `parseErrorBody()` as an exported pure function; add the `payment` branch (see Error handling) |
| `src/lib/api/orders.ts` | Extend the `OrderTrack` type with the `offline_payment` block |
| `src/components/orders/order-detail-view.tsx` | Status chip, admin note on denial, working edit affordance |

`offline_payment` is already present in `PlaceOrderInput` ([`orders.ts:231`]), so
`placeOrder` passes it straight through. The `PaymentMethod` union in the picker and the
post-place branch in `checkout-flow` are the two real seams.

### Dynamic form

Rendered from `method_informations[]`. Rules:

- **Echo `customer_input` verbatim** as the POST key, flat at top level, never nested.
  The backend harvests keys via `array_column(...,'customer_input')` and copies only
  those that already exist. Keys are slugified server-side ("Sender's Name" →
  `senders_name`), so constructing them client-side silently drops the field.
- **Enforce `is_required` client-side.** The server does not. Unenforced, blank required
  fields save successfully and hand the admin a useless payment record.
- Plus an optional free-text `customer_note`.

**Hand-rolled `useState`, not react-hook-form or zod.** Both are in `package.json` but
have zero imports in `src/`. House style is hand-rolled state with discriminated-union
steps ([`signin-flow.tsx:47-59`]). Match the code that exists, not the unused deps.

### Edit and denial

On `order-detail-view.tsx`: a status chip from `offline_payment.data.status`, and on
`denied`, the `admin_note` alongside a working **Update payment details** button routing
back to `/checkout/offline/[orderId]`, which detects edit mode and prefills.

The button must actually exist. [`transfer-instructions.tsx:139-145`] currently tells
customers to "find this order in your history and tap 'Confirm transfer' again", but no
such button exists in `order-detail-view.tsx`, which only renders payment status text.
That is a live dead end in the bank transfer flow. This spec does not inherit it, and
does not fix it either; it should be tracked separately.

### Error handling

Route through the existing `api<T>()` wrapper. The HTTP/2 blank-toast bug is **already
fixed** ([`api-client.ts:116-173`]): it parses three Laravel error shapes and guarantees
a non-empty message, since `res.statusText` is always `""` over HTTP/2.

**But `{"payment": "<exception message>"}` is not one of those three shapes.** It has no
`errors` key, is not a bare-string `errors`, is not a validation map, and has no
top-level `message`. It would fall through to the generic
`"Something went wrong (error 403). Please try again."`, discarding the actual reason the
payment failed. That is precisely the blank-toast class of bug this file already exists
to prevent.

**This must be fixed in `api-client.ts`, not in the offline-payment wrapper.** `api<T>()`
discards the raw error body and returns only `{ ok, status, message, errors }`
([`api-client.ts:173`]), so by the time a per-endpoint wrapper sees the result, the
`payment` key is already gone. There is no way to recover it downstream.

The change is additive and small: extract the existing error-body parsing into an
exported pure function `parseErrorBody(body): { message: string; errors?: Record<string, string[]> }`
and add a fourth branch for a top-level string `payment`, mirroring the existing
bare-string `errors` branch. Extracting it is what makes it unit-testable without mocking
`fetch`; the branch is what makes it correct. Existing behaviour is unchanged for every
other caller.

Per-endpoint wrappers then follow the `walletPayOrder` `reason`-discriminant convention
([`orders.ts:355-379`]) rather than a bare message string.

**The load-bearing rule: if the PUT fails, the order already exists.** The customer stays
on the page with an inline error and a retry. Never navigate away, never toast-and-dump.
Inline errors match `transfer-instructions.tsx`; toasts stay at checkout.

### Conventions to follow

- **Tailwind v4, CSS-first tokens** in `globals.css` (`--color-brand-red`, `ink-0…ink-1000`,
  `canvas`, semantic `success/warning/error/info`). Named utilities: `btn-flame`,
  `rounded-pill`, `shadow-soft`/`card`/`floating`. Conditional classes via `cn()`.
- **Zustand** stores with the explicit `hydrate()` + `hydrated` flag pattern; narrow
  selectors.
- **Loading**: `<Loader2 size={16} className="animate-spin" />` inline in buttons with
  `disabled:cursor-not-allowed disabled:opacity-60`.
- **Mount fetches**: the `cancelled` flag cleanup idiom ([`transfer-instructions.tsx:47-57`]).
- **Server pages**: `params` is a `Promise` (Next 16) and must be awaited; `Number.isFinite`
  guard; `<Container>` + `<RouteGuard>` + `<Suspense fallback={null}>`.
- **Comments**: this codebase documents the backend contract and the *why* inline, with
  file paths and PHP line numbers. Match that density.

## Known risks

**Orphaned orders.** Place and submit are two non-atomic calls. An order abandoned
between them stays at `order_status = 'failed'` forever, and `Order::scopeFailed`
([`Order.php:260`]) specifically hides orders that are `failed` with no `offline_payments`
row, so it becomes invisible rather than merely stale. The Flutter app has this same
exposure today. Accepted as-is for this scope; the re-enterable `/checkout/offline/[orderId]`
page mitigates it partially (the URL still works) but does not close it, since such orders
are hidden from order history. Worth a follow-up covering both clients.

**No server-side ownership check** on `PUT /customer/order/offline-payment`. Any
authenticated customer can submit payment details against any `order_id`. Pre-existing;
not introduced here; worth reporting to the upstream vendor.

## Testing

**Starting point: this repo has no test infrastructure.** `package.json` scripts are
`dev`, `build`, `start`, `lint` only. No vitest, jest, playwright, or testing-library;
zero test files. (`react-hook-form` and `zod` are dependencies but have no imports in
`src/` — do not read their presence as a convention.)

### Automated: vitest, pure logic only

Introduce vitest and cover the three places where bugs actually hide. All are pure
functions with no DOM, deliberately extracted so they are testable in isolation:

1. **The gating predicate** — `offline_payment_status`, the zone flag, and the method
   list combined. Must include the method list arriving as literal `null` rather than
   `[]`, each condition false independently, and all three true.
2. **Required-field validation** — derived from `is_required`, since the server does not
   enforce it.
3. **Error-shape normalisation** — `parseErrorBody()` against all four Laravel shapes,
   specifically including `{"payment":"<message>"}` with no `errors` key, each producing
   a readable non-empty message. Regression-guard the three existing shapes too, since
   this touches shared code every caller depends on.

Scope is deliberately narrow. Component and integration tests are **not** in scope; this
introduces a runner for logic that warrants it, without committing the codebase to a
component testing strategy it has never had.

### Manual verification

The remaining cases need a browser against a real backend:

4. PUT fails after place succeeds: customer retains form state and can retry, and is not
   navigated away.
5. Denial → edit → resubmit round trip, confirming the **full** form is resent (omitted
   fields are deleted server-side).
6. `?method=` tampered to an id absent from the live list.
7. Switching banks in create mode re-renders the form and submits the new `method_id`.
8. Edit mode shows no bank selector.

Use `npm run build` plus a live check rather than probing a dev server. Per an existing
project constraint, do not force-kill Node processes on this Windows machine; that has
caused BSODs.

## References

- `dashboard.bite.express/app/Http/Controllers/Api/V1/ConfigController.php:1076-1082`
- `dashboard.bite.express/app/Http/Controllers/Api/V1/OrderController.php:470-610`
- `dashboard.bite.express/app/Traits/PlaceNewOrder.php:173-179`, `:681-685`
- `dashboard.bite.express/app/CentralLogics/Helpers.php:3300-3332`
- `dashboard.bite.express/app/Models/Order.php:260`
- `biteexpress-web-app/src/components/checkout/checkout-flow.tsx:189-212`, `:304-310`
- `biteexpress-web-app/src/components/checkout/payment-picker.tsx:12-16`, `:38-59`
- `biteexpress-web-app/src/components/checkout/transfer-instructions.tsx`
- `biteexpress-web-app/src/lib/api-client.ts:116-173`
- `biteexpress-web-app/src/lib/api/orders.ts:231`, `:355-379`
- `biteexpress-web-app/src/lib/location-store.ts:29-32`
