# Web Parcel Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in customer on app.bite.express sends a package from a `/send` page with app parity (category, zone-checked pickup and drop-off, instructions, who pays, food checkout's payment methods), sees the backend's exact price including surge before paying, and tracks the parcel with pickup and drop-off shown correctly.

**Architecture:** The backend's `get-Tax` preview resolves the parcel pickup zone the way placement does (a new `parcelPickupZone()` shared by both), so surge is applied and the fee is carried as the delivery charge, making the preview total equal the placed total. The web adds pure rule modules (`src/lib/parcel/*`), a `parcelOrderBody()` that the preview and the order POST both send, and a `settleOrder()` helper extracted from food checkout that both checkouts call after the order is created. `/send` is a three-step client page; tracking and the orders list read parcel fields through pure helpers.

**Tech Stack:** Laravel 12 (PHP 8.3 locally, PHPUnit, MySQL 5.7 test DB), Next.js 16 App Router, React 19, Tailwind v4, zustand 5, vitest 3 (node environment, `src/**/*.test.ts` only).

**Spec:** C:\laragon\www\biteexpress-web-app-parcel\docs\superpowers\specs\2026-09-29-web-parcel-orders-design.md

**Spec resolutions (read before Task 1):**
- Section 3 says "no other backend change", but its own test "the preview total equals the placed total" cannot pass with surge alone: for parcels `getCalculatedTax` passes `delivery_charge = null` into the pricing resolver (only `original_delivery_charge` is set), so today's preview `order_amount` leaves the fee out entirely. Placement sets `delivery_charge` from the rounded original (PlaceNewOrder.php:414). Task 1 mirrors that one line in the preview. The Flutter parcel screen reads only `tax_amount` from this response, so the app sees only the surge change the spec already accepts.
- Sections 4 and 5 assume food checkout has cash on delivery and a bank-transfer redirect. It has neither: both were removed from the web on 2026-09-15 (payment-picker.tsx:71-72) and `handlePlace` today runs offline, Paystack and wallet only. `settleOrder` therefore covers Paystack, wallet, the offline redirect and cash on delivery (used only by parcel receiver-pays). Sender pays offers the food set (Pay Online, wallet, Pay Offline). The live pass places the food orders by wallet and by Pay Offline, since cash is not offered on web food checkout.
- Receiver pays is offered only when cash on delivery is on both in config and in the pickup zone, the same two switches the Flutter app checks (parcel_request_screen.dart:106-108). Every parcel zone in the local DB has `cash_on_delivery = 0`; Task 13 switches one on for the run and restores it.
- The tip control shows only when `dm_tips_status = 1`: placement drops the tip when it is 0 but the preview still adds it, so showing it would break preview parity.
- The web refuses a parcel preview that carries no fee and no free-delivery reason (Task 3). That is exactly what a backend without Task 1 returns, so a web deploy ahead of the backend can never show a total below what is charged.
- The Paystack "Payment cancelled" toast loses its em dash when it moves into `settleOrder` (copy rule). That is the only text food checkout customers can see change.

## Global Constraints

- Backend repo `C:\laragon\www\dashboard.bite.express`, branch `parcel-preview-surge` cut from `main`. Web worktree `C:\laragon\www\biteexpress-web-app-parcel`, branch `parcel-orders` (already checked out; never switch it).
- Never push either repo. A push to `main` auto-deploys (backend to srv02 in about a minute, web to Vercel). Rollout, backend first then web, is a separate user-approved step outside this plan.
- No em dash or en dash as punctuation in copy, code comments or commit messages; no emoji.
- Commit subjects are imperative sentences in each repo's style (for example "Hide the rider distance when the rider location is stale"), no `feat:` prefixes, and the body ends with the trailer naming the implementing model, for example `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The commit commands below use that name; substitute the implementing model's own name if different.
- Stage explicit paths only. Never commit `.phpunit.cache/test-results`, `resources/lang/en/messages.php` noise, `package-lock.json` churn or `.env.local`.
- Use the PowerShell tool for every command. Never `git stash` (the stash is shared across worktrees).
- Backend tests: one PHPUnit process at a time (all worktrees share the `biteexpress_testing` database). Set `$env:OPENSSL_CONF='C:\laragon\bin\php\php-8.3.28-Win32-vs16-x64\extras\ssl\openssl.cnf'` in the same command as every PHPUnit run, or tests using `FakesFcmTransport` silently skip. Directory-sized runs use `php vendor/bin/phpunit -d memory_limit=1024M <path>`. After every run, `git status --short`; if `resources/lang/en/messages.php` is listed, `git checkout -- resources/lang/en/messages.php`. No migrations in this plan.
- Web commands (from the worktree root): `npx vitest run <file>`, `npm test`, `npx tsc --noEmit`, `npx eslint <files>`, `npm run build`. The worktree has no `node_modules`; Task 2 runs `npm install` once, as the normal user, into the worktree only.
- Lint: only NEW errors count. Existing files already carry `react-hooks/set-state-in-effect` and `react/no-unescaped-entities` errors; each task that edits an existing file records its baseline first. New files must lint clean: never call a state setter synchronously in an effect body (set state only inside `.then` callbacks and derive "loading" from a key mismatch), and escape apostrophes in JSX text with `&apos;`.
- No native `alert()`/`confirm()`; errors use `toast` (`src/lib/toast.ts`) or inline text.
- Fee figures are read from the `get-Tax` preview and never recomputed on the web. The preview and the order POST send the identical body from `parcelOrderBody()`, with the identical `distance` number.
- Money renders as `₦{Math.round(x).toLocaleString()}` like checkout. Brand red is `#de1600` via the existing `brand-red` classes; match checkout's card, radio and `btn-flame` styling.
- Dev servers and `php -S` processes are stopped by the PIDs you started, never by process name, never with `-Force` on a name match.
- `AGENTS.md` warns this Next.js differs from training data. The only new route (`src/app/send/page.tsx`) copies the shape of `src/app/orders/page.tsx` exactly; do not introduce other routing APIs.

## Review Focus

- The directions proxy answers HTTP 200 even when Google fails (`{"error": "..."}`, `[]` or `null`): distance must fall back to straight line, never to NaN or 0 (which would price every parcel at the minimum). Pinned by the `roadDistanceKm` shape tests (Task 2).
- A pickup zone with cash on delivery off (every parcel zone in the local DB today) or config COD off: "Receiver" must not be offered, and a receiver choice made before the pickup changed must fall back to the sender, or placement 403s after the customer filled every step. Pinned by `allowedPayers` and `effectivePayer` tests (Task 5).
- The backend preview not yet deployed (or rolled back) returns `delivery_charge: 0` with no free-delivery reason: the web must refuse to quote rather than show "Free" delivery and a total below the charge. Pinned by the `parcelQuoteUsable` tests (Task 3).
- A 203 `order_amount` refusal means "wallet short" when paying by wallet and "over the COD ceiling" when the receiver pays cash: the message must match the method. Pinned by the `parcelPlaceErrorMessage` tests (Task 5).
- The customer changes the tip, payer or drop-off while a preview is in flight or after one failed: "Place order" must stay disabled until a preview for the current inputs lands, so nobody pays a total they were not shown. Pinned by the `parcelQuoteKey` and `placeBlocker` tests (Task 5).

---

## File map

**Backend (dashboard.bite.express)**

| File | Action | Responsibility |
|---|---|---|
| `app/Traits/PlaceNewOrder.php` | Modify | `parcelPickupZone()`; placement and preview both use it; preview carries the parcel fee as the delivery charge |
| `tests/Feature/Parcel/ParcelPreviewSurgeTest.php` | Create | Surge in preview, no-surge charge, refusals, preview equals placement |

**Web (biteexpress-web-app, worktree `biteexpress-web-app-parcel`)**

| File | Action | Responsibility |
|---|---|---|
| `src/lib/api/config.ts` (+ `config.test.ts`) | Modify / Create test | COD, digital and tip switches |
| `src/lib/api/parcel.ts` | Create | Parcel categories and rider instructions |
| `src/lib/api/directions.ts` (+ test) | Create | Road distance from the proxy, straight-line fallback |
| `src/lib/api/orders.ts` | Modify | Parcel order types, `parcelOrderBody()`, `placeParcelOrder()`, parcel fields on `OrderSummary` |
| `src/lib/api/orders-parcel.test.ts` | Create | Parcel body and `receiver_details` keys |
| `src/lib/api/order-quote.ts` (+ test) | Modify | `fetchParcelQuote()`, `parcelQuoteUsable()` |
| `src/lib/parcel/parcel-form.ts` (+ test) | Create | Contact validation, zone results, receiver details, instruction text, step unlocking |
| `src/lib/parcel/parcel-payment.ts` (+ test) | Create | Payers, methods, quote key, place blocker, placement error copy |
| `src/lib/checkout/settle-order.ts` (+ test) | Create | Post-creation payment handling shared by both checkouts |
| `src/components/checkout/checkout-flow.tsx` | Modify | Calls `settleOrder` |
| `src/components/checkout/address-picker-checkout.tsx` | Modify | Exports `toCheckoutFromPicked` |
| `src/components/parcel/parcel-step.tsx` | Create | Collapsible step shell |
| `src/components/parcel/category-step.tsx` | Create | Category cards |
| `src/components/parcel/contact-fields.tsx` | Create | Name, phone, optional email, house, floor, road |
| `src/components/parcel/instruction-picker.tsx` | Create | Preset instructions plus note |
| `src/components/parcel/payer-picker.tsx` | Create | Me or Receiver |
| `src/components/parcel/tip-picker.tsx` | Create | Same tip control as checkout |
| `src/components/parcel/parcel-price-card.tsx` | Create | Preview breakdown with retry |
| `src/components/parcel/send-parcel-flow.tsx` | Create | The `/send` state and steps |
| `src/app/send/page.tsx` | Create | Route, behind `RouteGuard` |
| `src/lib/module-entry.ts` (+ test) | Create | Module card link and subtitle |
| `src/components/browse/module-picker.tsx` | Modify | Parcel module links to `/send` |
| `src/lib/parcel/parcel-order.ts` (+ test) | Create | Parcel tracking helpers |
| `src/components/orders/order-detail-view.tsx` | Modify | Parcel heading, map points, address cards, parcel card, timeline |
| `src/components/orders/orders-view.tsx` | Modify | "Parcel to {name}" rows |

---

## Task 0: Branches

**Files:** none.

- [ ] **Step 1: Cut the backend branch**

```powershell
cd C:\laragon\www\dashboard.bite.express; git status --short; git switch main; git switch -c parcel-preview-surge
```

Expected: `git status --short` prints nothing before the switch. If it prints anything, stop and ask the user; do not stash or discard someone else's work.

- [ ] **Step 2: Bring the web branch up to date with main**

`parcel-orders` was cut before three merges landed on `main` (mobile tab bar, location handoff, app download nudge). None touches a file this plan edits, and `/send` should be built against the current header, tab bar and `AddressPicker`.

```powershell
cd C:\laragon\www\biteexpress-web-app-parcel; git status --short; git branch --show-current; git merge --no-edit main
```

Expected: status empty, branch `parcel-orders`, merge completes with no conflicts (the branch only adds the spec). If it conflicts, `git merge --abort` and ask the user.

---

## Task 1: Backend, parcel preview priced from the pickup zone

**Files:**
- Modify: `app/Traits/PlaceNewOrder.php:783-787` (`getZoneAndStore` parcel branch), insert after `:806-807` (end of `getZoneAndStore`), `:1848-1856` (`getCalculatedTax`)
- Test: `tests/Feature/Parcel/ParcelPreviewSurgeTest.php`

**Interfaces:**
- Produces: `protected function parcelPickupZone($request): ?\App\Models\Zone` on the `PlaceNewOrder` trait. `POST /api/v1/customer/order/get-Tax` with `order_type=parcel` now returns 403 `{"errors":[{"code":"zone","message":...}]}` when no zone in the `zoneId` header contains the pickup and offers the parcel module; otherwise `delivery_charge` and `original_delivery_charge` both carry the fee including surge, and `order_amount` includes it.
- Consumes: existing `getDeliveryCharge()`, `resolveOrderPricing()`, `getSurgePriceValue()`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Parcel/ParcelPreviewSurgeTest.php`:

```php
<?php

namespace Tests\Feature\Parcel;

use App\Models\DMVehicle;
use App\Models\Module;
use App\Models\Order;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use MatanYadaev\EloquentSpatial\Objects\LineString;
use MatanYadaev\EloquentSpatial\Objects\Point;
use MatanYadaev\EloquentSpatial\Objects\Polygon;
use Tests\Support\CreatesCommerceTestData;
use Tests\TestCase;

/**
 * The parcel price preview (POST /customer/order/get-Tax) against placement
 * (POST /customer/order/place), through the real routes, zone lookup and
 * pricing. Figures: the category charges 100 per km with a 500 minimum and
 * the parcel travels 8 km, so the plain fee is 800; a 25% surge makes it
 * 1000. The service charge is a fixed 100 and the tip is 200.
 */
class ParcelPreviewSurgeTest extends TestCase
{
    use CreatesCommerceTestData;
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'round_up_to_digit' => 2,
            'bitepass.pricing_enabled' => false,
        ]);

        // Placement reads dm_tips_status and the free-delivery settings
        // straight from the table.
        $this->setUpCommerceBaseline([
            'dm_tips_status' => '1',
            'free_delivery_over' => '9999999',
            'admin_free_delivery_status' => '0',
        ]);

        // Helpers::get_business_settings() memoises every row in a static
        // for the life of the PHP process, so settings read through it are
        // pinned with the `<key>_conf` override instead of the table.
        config([
            'cash_on_delivery_conf' => ['key' => 'cash_on_delivery', 'value' => json_encode(['status' => 1])],
            'additional_charge_status_conf' => ['key' => 'additional_charge_status', 'value' => '1'],
            'additional_charge_conf' => ['key' => 'additional_charge', 'value' => '100'],
            'additional_charge_type_conf' => ['key' => 'additional_charge_type', 'value' => 'fixed'],
        ]);

        // Vehicle extra charges are distance-ranged rows in the shared test
        // DB; remove them so the fee is exactly the category formula.
        DMVehicle::query()->delete();
    }

    /**
     * Built through the Eloquent Polygon cast (SRID 0, this app's
     * POINT_SRID) so the real ST_CONTAINS lookups resolve. Covers latitude
     * 6 to 7 and longitude 3 to 4, which holds Ikeja and Ikoyi.
     */
    private function createZone(Module $module): Zone
    {
        $zone = Zone::create([
            'name' => $this->uniqueValue('zone'),
            'display_name' => $this->uniqueValue('zone'),
            'coordinates' => new Polygon([new LineString([
                new Point(6.00, 3.00),
                new Point(7.00, 3.00),
                new Point(7.00, 4.00),
                new Point(6.00, 4.00),
                new Point(6.00, 3.00),
            ])]),
            'status' => 1,
        ]);

        DB::table('module_zone')->insert([
            'module_id' => $module->id,
            'zone_id' => $zone->id,
            'per_km_shipping_charge' => 10,
            'minimum_shipping_charge' => 10,
            'maximum_cod_order_amount' => 1000000,
            'maximum_shipping_charge' => 100,
            'delivery_charge_type' => 'distance',
        ]);

        return $zone;
    }

    /** @return array{0: User, 1: Module, 2: Zone, 3: int} */
    private function parcelContext(): array
    {
        $module = $this->createModule(['module_type' => 'parcel']);
        $zone = $this->createZone($module);

        $categoryId = DB::table('parcel_categories')->insertGetId([
            'module_id' => $module->id,
            'name' => $this->uniqueValue('parcel-category'),
            'description' => 'Documents and small boxes',
            'image' => null,
            'status' => 1,
            'orders_count' => 0,
            'parcel_per_km_shipping_charge' => 100,
            'parcel_minimum_shipping_charge' => 500,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return [$this->createCustomer(), $module, $zone, $categoryId];
    }

    /** A surge for today, all day, through the dated table the lookup reads first. */
    private function activateSurge(Zone $zone, Module $module, float $percent): void
    {
        $surgeId = DB::table('surge_prices')->insertGetId([
            'surge_price_name' => 'Rain surge',
            'customer_note' => null,
            'customer_note_status' => 0,
            'module_ids' => json_encode([(string) $module->id]),
            'zone_id' => $zone->id,
            'price' => $percent,
            'price_type' => 'percent',
            'status' => 1,
            'is_permanent' => 0,
            'duration_type' => 'custom',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('surge_price_dates')->insert([
            'surge_price_id' => $surgeId,
            'zone_id' => $zone->id,
            'module_id' => $module->id,
            'status' => 1,
            'applicable_date' => now()->format('Y-m-d'),
            'start_time' => '00:00:00',
            'end_time' => '23:59:59',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * APIGuestMiddleware reads the raw Authorization header, so a real
     * Passport token is needed (Passport::actingAs alone leaves the request
     * unauthenticated), same as PriceCheckRequestTest.
     */
    private function headers(User $customer, Module $module, array $zoneIds): array
    {
        return [
            'Authorization' => 'Bearer ' . $customer->createToken('test')->accessToken,
            'moduleId' => (string) $module->id,
            'zoneId' => json_encode($zoneIds),
        ];
    }

    private function payload(Zone $zone, int $categoryId, array $overrides = []): array
    {
        return array_merge([
            'order_type' => 'parcel',
            'payment_method' => 'cash_on_delivery',
            'parcel_category_id' => $categoryId,
            'charge_payer' => 'receiver',
            'distance' => 8,
            'address' => '12 Allen Avenue, Ikeja',
            'address_type' => 'Delivery',
            'latitude' => '6.6018',
            'longitude' => '3.3515',
            'contact_person_name' => 'Ada Sender',
            'contact_person_number' => '+2348012345678',
            'dm_tips' => 200,
            'delivery_instruction' => 'Fragile (Call on arrival)',
            'receiver_details' => json_encode([
                'address' => '5 Awolowo Road, Ikoyi',
                'latitude' => '6.4541',
                'longitude' => '3.4218',
                'zone_id' => $zone->id,
                'contact_person_name' => 'Bola Receiver',
                'contact_person_number' => '+2348098765432',
                'contact_person_email' => '',
                'road' => '',
                'house' => '',
                'floor' => '',
                'address_type' => 'Delivery',
                'additional_address' => '',
            ]),
        ], $overrides);
    }

    public function test_preview_includes_active_surge_in_the_parcel_charge(): void
    {
        [$customer, $module, $zone, $categoryId] = $this->parcelContext();
        $this->activateSurge($zone, $module, 25);

        $preview = $this->withHeaders($this->headers($customer, $module, [$zone->id]))
            ->postJson('/api/v1/customer/order/get-Tax', $this->payload($zone, $categoryId));

        $preview->assertOk();
        $this->assertSame(1000.0, (float) $preview->json('original_delivery_charge'));
        $this->assertSame(1000.0, (float) $preview->json('delivery_charge'));
        $this->assertSame(100.0, (float) $preview->json('additional_charge'));
        $this->assertEqualsWithDelta(
            1000.0 + 100.0 + 200.0 + (float) $preview->json('tax_amount'),
            (float) $preview->json('order_amount'),
            0.001,
            'the preview total must include the surged fee, the service charge and the tip'
        );
    }

    public function test_preview_without_surge_keeps_the_plain_charge(): void
    {
        [$customer, $module, $zone, $categoryId] = $this->parcelContext();

        $preview = $this->withHeaders($this->headers($customer, $module, [$zone->id]))
            ->postJson('/api/v1/customer/order/get-Tax', $this->payload($zone, $categoryId));

        $preview->assertOk();
        $this->assertSame(800.0, (float) $preview->json('original_delivery_charge'));
        $this->assertSame(800.0, (float) $preview->json('delivery_charge'));
        $this->assertEqualsWithDelta(
            800.0 + 100.0 + 200.0 + (float) $preview->json('tax_amount'),
            (float) $preview->json('order_amount'),
            0.001
        );
    }

    public function test_preview_refuses_a_pickup_outside_every_parcel_zone(): void
    {
        [$customer, $module, $zone, $categoryId] = $this->parcelContext();

        // Abuja: outside the zone polygon.
        $preview = $this->withHeaders($this->headers($customer, $module, [$zone->id]))
            ->postJson('/api/v1/customer/order/get-Tax', $this->payload($zone, $categoryId, [
                'latitude' => '9.0765',
                'longitude' => '7.3986',
            ]));

        $preview->assertStatus(403);
        $this->assertSame('zone', $preview->json('errors.0.code'));
    }

    public function test_preview_refuses_a_zone_that_does_not_offer_parcels(): void
    {
        [$customer, $module, $zone, $categoryId] = $this->parcelContext();
        $foodZone = $this->createZone($this->createModule(['module_type' => 'food']));

        // The pickup is inside $foodZone, but only $foodZone is sent.
        $preview = $this->withHeaders($this->headers($customer, $module, [$foodZone->id]))
            ->postJson('/api/v1/customer/order/get-Tax', $this->payload($zone, $categoryId));

        $preview->assertStatus(403);
        $this->assertSame('zone', $preview->json('errors.0.code'));
    }

    public function test_preview_total_equals_the_total_of_the_placed_order(): void
    {
        [$customer, $module, $zone, $categoryId] = $this->parcelContext();
        $this->activateSurge($zone, $module, 25);
        $headers = $this->headers($customer, $module, [$zone->id]);
        $payload = $this->payload($zone, $categoryId);

        $preview = $this->withHeaders($headers)->postJson('/api/v1/customer/order/get-Tax', $payload);
        $preview->assertOk();

        $placed = $this->withHeaders($headers)->postJson('/api/v1/customer/order/place', $payload);
        $placed->assertOk();

        $order = Order::query()->findOrFail($placed->json('order_id'));
        $this->assertSame('parcel', $order->order_type);
        $this->assertSame('receiver', $order->charge_payer);
        $this->assertEqualsWithDelta((float) $preview->json('order_amount'), (float) $order->order_amount, 0.001);
        $this->assertEqualsWithDelta((float) $preview->json('order_amount'), (float) $placed->json('total_ammount'), 0.001);
        $this->assertEqualsWithDelta((float) $preview->json('delivery_charge'), (float) $order->delivery_charge, 0.001);
        $this->assertEqualsWithDelta((float) $preview->json('additional_charge'), (float) $order->additional_charge, 0.001);
        $this->assertEqualsWithDelta((float) $preview->json('tax_amount'), (float) $order->total_tax_amount, 0.001);
        $this->assertEqualsWithDelta(200.0, (float) $order->dm_tips, 0.001);
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

```powershell
cd C:\laragon\www\dashboard.bite.express; $env:OPENSSL_CONF='C:\laragon\bin\php\php-8.3.28-Win32-vs16-x64\extras\ssl\openssl.cnf'; php vendor/bin/phpunit tests/Feature/Parcel/ParcelPreviewSurgeTest.php; git status --short
```

Expected: 5 tests, 5 failures. Surge test: `Failed asserting that 800.0 is identical to 1000.0.` No-surge test: `Failed asserting that 0.0 is identical to 800.0.` (today's preview leaves `delivery_charge` null). Both refusal tests: `Expected response status code [403] but received 200.` Parity test fails on the `order_amount` delta. Revert `resources/lang/en/messages.php` if listed.

- [ ] **Step 3: Extract the pickup zone lookup**

In `app/Traits/PlaceNewOrder.php`, find:

```php
            if ($request->order_type == 'parcel') {
                $zone_ids = $request->header('zoneId') ? json_decode($request->header('zoneId'), true) : [];
                $zone = Zone::whereIn('id', $zone_ids)->whereContains('coordinates', new Point($request->latitude, $request->longitude, POINT_SRID))->wherehas('modules', function ($q) {
                    $q->where('module_type', 'parcel');
                })->first();
```

Replace with:

```php
            if ($request->order_type == 'parcel') {
                $zone = $this->parcelPickupZone($request);
```

Then find the end of `getZoneAndStore`:

```php
        return ['zone' => $zone ?? null, 'store' => $store ?? null];
    }
```

Replace with:

```php
        return ['zone' => $zone ?? null, 'store' => $store ?? null];
    }

    /**
     * The zone a parcel is collected from: one of the zones in the zoneId
     * header that contains the pickup point and offers the parcel module.
     * Placement and the price preview both resolve it here, so a preview
     * carries that zone's surge and is refused wherever placement would be.
     */
    protected function parcelPickupZone($request): ?Zone
    {
        if (!$request->latitude || !$request->longitude) {
            return null;
        }

        $zone_ids = $request->header('zoneId') ? json_decode($request->header('zoneId'), true) : [];

        return Zone::whereIn('id', $zone_ids)->whereContains('coordinates', new Point($request->latitude, $request->longitude, POINT_SRID))->wherehas('modules', function ($q) {
            $q->where('module_type', 'parcel');
        })->first();
    }
```

- [ ] **Step 4: Price the preview from that zone**

In `getCalculatedTax`, find:

```php
                $order_details = $order_details['order_details'];
            }
        }

        $deliveryChargeData = ['delivery_charge' => 0, 'original_delivery_charge' => 0];
        if ($request->order_type !== 'take_away') {
            $module_wise_delivery_charge = $zone?->modules()?->where('modules.id', $request->header('moduleId'))->first();
            $deliveryChargeData = $this->getDeliveryCharge($request, $zone, $store, $module_wise_delivery_charge, null, $request->header('moduleId'));
        }
```

Replace with:

```php
                $order_details = $order_details['order_details'];
            }
        } else {
            // Same zone rule as placement: the preview carries the pickup
            // zone's surge and refuses a pickup placement would refuse.
            $zone = $this->parcelPickupZone($request);
            if (!$zone) {
                return response()->json([
                    'errors' => [
                        ['code' => 'zone', 'message' => translate('messages.out_of_coverage_area')]
                    ]
                ], 403);
            }
        }

        $deliveryChargeData = ['delivery_charge' => 0, 'original_delivery_charge' => 0];
        if ($request->order_type !== 'take_away') {
            $module_wise_delivery_charge = $zone?->modules()?->where('modules.id', $request->header('moduleId'))->first();
            $deliveryChargeData = $this->getDeliveryCharge($request, $zone, $store, $module_wise_delivery_charge, null, $request->header('moduleId'));
        }

        if ($request->order_type === 'parcel') {
            // Placement charges the parcel fee as the delivery charge
            // (new_place_order sets it from the rounded original), so the
            // preview does the same or its total leaves the fee out.
            $deliveryChargeData['delivery_charge'] = round($deliveryChargeData['original_delivery_charge'], config('round_up_to_digit'));
        }
```

- [ ] **Step 5: Run it to verify it passes**

```powershell
cd C:\laragon\www\dashboard.bite.express; $env:OPENSSL_CONF='C:\laragon\bin\php\php-8.3.28-Win32-vs16-x64\extras\ssl\openssl.cnf'; php vendor/bin/phpunit tests/Feature/Parcel/ParcelPreviewSurgeTest.php; git status --short
```

Expected: `OK (5 tests, ...)`. Revert `messages.php` if listed.

- [ ] **Step 6: Run the suites that share this code**

```powershell
cd C:\laragon\www\dashboard.bite.express; $env:OPENSSL_CONF='C:\laragon\bin\php\php-8.3.28-Win32-vs16-x64\extras\ssl\openssl.cnf'; php vendor/bin/phpunit tests/Feature/DeliveryPricing; php vendor/bin/phpunit -d memory_limit=1024M tests/Feature/PriceCheck; php vendor/bin/phpunit tests/Feature/BitePass/BitePassOrderPricingFeatureTest.php; git status --short
```

Expected: all green (run one after another, never in parallel). Revert `messages.php` if listed.

- [ ] **Step 7: Commit**

```powershell
cd C:\laragon\www\dashboard.bite.express; git add app/Traits/PlaceNewOrder.php tests/Feature/Parcel/ParcelPreviewSurgeTest.php; git commit -m "Price parcel previews from the pickup zone so surge is included" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Web, config switches, parcel lookups and road distance

**Files:**
- Modify: `src/lib/api/config.ts` (whole file, 54 lines)
- Create: `src/lib/api/config.test.ts`, `src/lib/api/parcel.ts`, `src/lib/api/directions.ts`, `src/lib/api/directions.test.ts`

**Interfaces:**
- Produces:
  - `AppConfig = { offline_payment_status: number; cash_on_delivery: boolean; digital_payment: boolean; dm_tips_status: number }`; `toAppConfig(data): AppConfig`. `fetchConfig()` keeps its signature.
  - `ParcelCategory = { id: number; name: string; description?: string | null; image_full_url?: string | null; parcel_per_km_shipping_charge?: number | null; parcel_minimum_shipping_charge?: number | null }`; `fetchParcelCategories(moduleId: number): Promise<{ ok: true; categories: ParcelCategory[] } | { ok: false; message: string }>`.
  - `ParcelInstruction = { id: number; instruction: string }`; `fetchParcelInstructions(): Promise<{ ok: true; instructions: ParcelInstruction[] } | { ok: false; message: string }>`.
  - `roadDistanceKm(body: unknown): number | null`; `parcelDistanceKm(roadKm: number | null, from: {lat,lng}, to: {lat,lng}): number` (kilometres rounded to the metre); `fetchRoadDistanceKm(from, to): Promise<number | null>`.
- Consumes: `api()` from `src/lib/api-client.ts`, `distanceKm()` from `src/lib/geo.ts`.

- [ ] **Step 1: Install dependencies once**

```powershell
cd C:\laragon\www\biteexpress-web-app-parcel; npm install; git status --short
```

Expected: `node_modules` created. If `package-lock.json` shows as modified, `git checkout -- package-lock.json`.

- [ ] **Step 2: Write the failing tests**

`src/lib/api/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toAppConfig } from "./config";

describe("toAppConfig", () => {
  it("reads the payment and tip switches", () => {
    expect(
      toAppConfig({
        offline_payment_status: 1,
        cash_on_delivery: true,
        digital_payment: false,
        dm_tips_status: 1,
      }),
    ).toEqual({
      offline_payment_status: 1,
      cash_on_delivery: true,
      digital_payment: false,
      dm_tips_status: 1,
    });
  });

  it("treats missing switches as off", () => {
    expect(toAppConfig({})).toEqual({
      offline_payment_status: 0,
      cash_on_delivery: false,
      digital_payment: false,
      dm_tips_status: 0,
    });
  });

  it("reads numeric and string forms of the switches", () => {
    expect(
      toAppConfig({
        offline_payment_status: "1",
        cash_on_delivery: 1,
        digital_payment: "1",
        dm_tips_status: "1",
      }),
    ).toEqual({
      offline_payment_status: 1,
      cash_on_delivery: true,
      digital_payment: true,
      dm_tips_status: 1,
    });
  });
});
```

`src/lib/api/directions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { distanceKm } from "@/lib/geo";
import { parcelDistanceKm, roadDistanceKm } from "./directions";

const ikeja = { lat: 6.6018, lng: 3.3515 };
const ikoyi = { lat: 6.4541, lng: 3.4218 };

describe("roadDistanceKm", () => {
  it("reads the first route's distanceMeters as kilometres", () => {
    expect(roadDistanceKm({ routes: [{ distanceMeters: 18450, duration: "1500s" }] })).toBe(18.45);
  });

  it("accepts a numeric string", () => {
    expect(roadDistanceKm({ routes: [{ distanceMeters: "9000" }] })).toBe(9);
  });

  it("returns null for every shape the proxy sends when Google has no answer", () => {
    // cURL failure: the proxy returns ['error' => ...] with HTTP 200.
    expect(roadDistanceKm({ error: "Could not resolve host: routes.googleapis.com" })).toBeNull();
    // No route: json_decode('{}', true) re-encodes as [].
    expect(roadDistanceKm([])).toBeNull();
    // Empty upstream body.
    expect(roadDistanceKm(null)).toBeNull();
    expect(roadDistanceKm({})).toBeNull();
    expect(roadDistanceKm({ routes: [] })).toBeNull();
    expect(roadDistanceKm({ routes: [{}] })).toBeNull();
    expect(roadDistanceKm({ routes: [{ distanceMeters: 0 }] })).toBeNull();
    expect(roadDistanceKm({ routes: [{ distanceMeters: "abc" }] })).toBeNull();
  });
});

describe("parcelDistanceKm", () => {
  it("prices on the road distance when there is one", () => {
    expect(parcelDistanceKm(18.45, ikeja, ikoyi)).toBe(18.45);
  });

  it("falls back to the straight line, never to zero", () => {
    const straight = distanceKm(ikeja.lat, ikeja.lng, ikoyi.lat, ikoyi.lng);
    expect(parcelDistanceKm(null, ikeja, ikoyi)).toBe(Math.round(straight * 1000) / 1000);
    expect(parcelDistanceKm(null, ikeja, ikoyi)).toBeGreaterThan(15);
  });

  it("rounds to the metre so the preview and the order send the same figure", () => {
    expect(parcelDistanceKm(18.4567891, ikeja, ikoyi)).toBe(18.457);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run src/lib/api/config.test.ts src/lib/api/directions.test.ts`
Expected: FAIL. `config.test.ts`: `toAppConfig is not a function` (not exported yet). `directions.test.ts`: `Failed to resolve import "./directions"`.

- [ ] **Step 4: Write the implementation**

Replace the whole of `src/lib/api/config.ts`:

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
 *
 * `cash_on_delivery` and `digital_payment` are the global payment
 * switches; placement refuses a method whose switch is off.
 * `dm_tips_status` is 0|1, and placement drops dm_tips when it is 0
 * even though the get-Tax preview would still add the tip.
 */
export type AppConfig = {
  offline_payment_status: number;
  cash_on_delivery: boolean;
  digital_payment: boolean;
  dm_tips_status: number;
};

type ConfigResponse = {
  offline_payment_status?: number | string;
  cash_on_delivery?: boolean | number | string;
  digital_payment?: boolean | number | string;
  dm_tips_status?: number | string;
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

function isOn(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true";
}

/** Exported for tests: the switches arrive as booleans, ints or strings. */
export function toAppConfig(data: ConfigResponse): AppConfig {
  return {
    offline_payment_status: Number(data.offline_payment_status ?? 0),
    cash_on_delivery: isOn(data.cash_on_delivery),
    digital_payment: isOn(data.digital_payment),
    dm_tips_status: Number(data.dm_tips_status ?? 0),
  };
}

export async function fetchConfig(): Promise<ConfigResult> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { ok: true, config: cache.config };
  }

  const res = await api<ConfigResponse>("/api/v1/config");

  if (res.ok) {
    const config = toAppConfig(res.data);
    cache = { at: Date.now(), config };
    return { ok: true, config };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}
```

`src/lib/api/parcel.ts`:

```ts
"use client";

import { api } from "@/lib/api-client";

/**
 * GET /api/v1/parcel-category (ParcelCategoryController@index).
 *
 * The route sits behind the module-check middleware, which rejects the
 * call without a moduleId header, and the controller scopes the list to
 * that module. So the parcel module id is required.
 */
export type ParcelCategory = {
  id: number;
  name: string;
  description?: string | null;
  image_full_url?: string | null;
  parcel_per_km_shipping_charge?: number | null;
  parcel_minimum_shipping_charge?: number | null;
};

export type ParcelCategoriesResult =
  | { ok: true; categories: ParcelCategory[] }
  | { ok: false; message: string };

export async function fetchParcelCategories(
  moduleId: number,
): Promise<ParcelCategoriesResult> {
  const res = await api<ParcelCategory[]>("/api/v1/parcel-category", {
    moduleId,
  });
  if (res.ok) {
    return { ok: true, categories: Array.isArray(res.data) ? res.data : [] };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}

/**
 * GET /api/v1/customer/order/parcel-instructions
 * (OrderController@parcel_instructions). Paginated as
 * {total_size, limit, offset, data}; `offset` is the 1-based page.
 */
export type ParcelInstruction = { id: number; instruction: string };

type InstructionPage = { data?: ParcelInstruction[] };

export type ParcelInstructionsResult =
  | { ok: true; instructions: ParcelInstruction[] }
  | { ok: false; message: string };

export async function fetchParcelInstructions(): Promise<ParcelInstructionsResult> {
  const res = await api<InstructionPage>(
    "/api/v1/customer/order/parcel-instructions?limit=50&offset=1",
  );
  if (res.ok) {
    return {
      ok: true,
      instructions: Array.isArray(res.data?.data) ? res.data.data : [],
    };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}
```

`src/lib/api/directions.ts`:

```ts
"use client";

import { api } from "@/lib/api-client";
import { distanceKm } from "@/lib/geo";

type LatLng = { lat: number; lng: number };

/**
 * GET /api/v1/config/direction-api (ConfigController@direction_api)
 * proxies Google's Routes API. It answers HTTP 200 even when the
 * upstream call fails: a cURL failure comes back as {"error": "..."},
 * "no route" as an empty array and an empty upstream body as null. So
 * the distance is read defensively and anything unusable is null.
 */
export function roadDistanceKm(body: unknown): number | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const routes = (body as { routes?: unknown }).routes;
  if (!Array.isArray(routes) || routes.length === 0) return null;
  const first = routes[0] as { distanceMeters?: unknown } | null;
  const metres = Number(first?.distanceMeters);
  if (!Number.isFinite(metres) || metres <= 0) return null;
  return metres / 1000;
}

/**
 * Kilometres a parcel is priced on: the road distance when the proxy
 * gave one, otherwise the straight line. Rounded to the metre so the
 * number the preview is sent and the number the order is sent are the
 * same value.
 */
export function parcelDistanceKm(
  roadKm: number | null,
  from: LatLng,
  to: LatLng,
): number {
  const km = roadKm ?? distanceKm(from.lat, from.lng, to.lat, to.lng);
  return Math.round(km * 1000) / 1000;
}

/** Road distance in km, or null on any failure. Never throws. */
export async function fetchRoadDistanceKm(
  from: LatLng,
  to: LatLng,
): Promise<number | null> {
  const query = new URLSearchParams({
    origin_lat: String(from.lat),
    origin_lng: String(from.lng),
    destination_lat: String(to.lat),
    destination_lng: String(to.lng),
  });
  const res = await api<unknown>(
    `/api/v1/config/direction-api?${query.toString()}`,
    { unauth: true, timeoutMs: 8000 },
  );
  return res.ok ? roadDistanceKm(res.data) : null;
}
```

- [ ] **Step 5: Run them to verify they pass**

Run: `npx vitest run src/lib/api/config.test.ts src/lib/api/directions.test.ts`
Expected: PASS (9 tests: 3 in config, 6 in directions).

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit; npx eslint src/lib/api/config.ts src/lib/api/parcel.ts src/lib/api/directions.ts`
Expected: tsc clean; eslint prints nothing.

- [ ] **Step 7: Commit**

```powershell
cd C:\laragon\www\biteexpress-web-app-parcel; git add src/lib/api/config.ts src/lib/api/config.test.ts src/lib/api/parcel.ts src/lib/api/directions.ts src/lib/api/directions.test.ts; git commit -m "Read parcel categories, rider instructions and road distance from the API" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 3: Web, parcel order and preview wire

**Files:**
- Modify: `src/lib/api/orders.ts:63-67` (end of `OrderSummary`), append after `:502` (end of file)
- Modify: `src/lib/api/order-quote.ts:5` (imports), append after `:137` (end of file)
- Create: `src/lib/api/orders-parcel.test.ts`
- Modify: `src/lib/api/order-quote.test.ts` (append a `describe`)

**Interfaces:**
- Produces (orders.ts):
  - `OrderReceiver = { address?: string; latitude?: string | number; longitude?: string | number; contact_person_name?: string; contact_person_number?: string; contact_person_email?: string | null }`
  - `OrderSummary` gains `order_type?: string | null; receiver_details?: OrderReceiver | null; parcel_category?: { id?: number; name?: string | null; image_full_url?: string | null } | null; charge_payer?: "sender" | "receiver" | null; delivery_instruction?: string | null`
  - `ReceiverDetails = { address: string; latitude: string; longitude: string; zone_id: number; contact_person_name: string; contact_person_number: string; contact_person_email: string; road: string; house: string; floor: string; address_type: string; additional_address: string }`
  - `PlaceParcelOrderInput = { moduleId: number; zoneIds: number[]; pickup: { text: string; lat: number; lng: number; addressType?: string }; sender: { name: string; phone: string; email: string | null; house: string; floor: string; road: string }; receiverDetails: ReceiverDetails; distance: number; parcelCategoryId: number; chargePayer: "sender" | "receiver"; paymentMethod: "cash_on_delivery" | "digital_payment" | "wallet" | "offline_payment"; dmTips: number; deliveryInstruction: string }`
  - `parcelOrderBody(input: PlaceParcelOrderInput): Record<string, unknown>`
  - `PlaceParcelOrderResult = { ok: true; orderId: number; amount: number } | { ok: false; code: string | null; message: string }`; `placeParcelOrder(input): Promise<PlaceParcelOrderResult>`
- Produces (order-quote.ts): `parcelQuoteUsable(q: OrderQuote): boolean`; `fetchParcelQuote(input: PlaceParcelOrderInput): Promise<OrderQuoteResult>`
- Consumes: `api()`, existing `parseQuote`, `OrderQuote`, `OrderQuoteResult`, `PlaceOrderResponse` (module-private type in orders.ts).

- [ ] **Step 1: Write the failing tests**

`src/lib/api/orders-parcel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parcelOrderBody, type PlaceParcelOrderInput } from "./orders";

const input: PlaceParcelOrderInput = {
  moduleId: 6,
  zoneIds: [3, 4],
  pickup: { text: "12 Allen Avenue, Ikeja", lat: 6.6018, lng: 3.3515, addressType: "Home" },
  sender: {
    name: "Ada Obi",
    phone: "+2348012345678",
    email: "ada@example.test",
    house: "12",
    floor: "",
    road: "Allen Avenue",
  },
  receiverDetails: {
    address: "5 Awolowo Road, Ikoyi",
    latitude: "6.4541",
    longitude: "3.4218",
    zone_id: 4,
    contact_person_name: "Bola Ade",
    contact_person_number: "+2348098765432",
    contact_person_email: "",
    road: "",
    house: "",
    floor: "",
    address_type: "Delivery",
    additional_address: "",
  },
  distance: 18.45,
  parcelCategoryId: 8,
  chargePayer: "receiver",
  paymentMethod: "cash_on_delivery",
  dmTips: 200,
  deliveryInstruction: "Fragile (Call on arrival)",
};

describe("parcelOrderBody", () => {
  it("sends a parcel order with no cart and no store", () => {
    const body = parcelOrderBody(input);
    expect(body.order_type).toBe("parcel");
    expect(body).not.toHaveProperty("cart");
    expect(body).not.toHaveProperty("is_buy_now");
    expect(body).not.toHaveProperty("store_id");
  });

  it("describes the pickup as the order address and the sender as its contact", () => {
    expect(parcelOrderBody(input)).toMatchObject({
      address: "12 Allen Avenue, Ikeja",
      address_type: "Home",
      latitude: "6.6018",
      longitude: "3.3515",
      distance: 18.45,
      contact_person_name: "Ada Obi",
      contact_person_number: "+2348012345678",
      contact_person_email: "ada@example.test",
      house: "12",
      floor: "",
      road: "Allen Avenue",
    });
  });

  it("sends receiver_details as a JSON string with the app's address keys", () => {
    const raw = parcelOrderBody(input).receiver_details;
    expect(typeof raw).toBe("string");
    const parsed = JSON.parse(raw as string) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual([
      "additional_address",
      "address",
      "address_type",
      "contact_person_email",
      "contact_person_name",
      "contact_person_number",
      "floor",
      "house",
      "latitude",
      "longitude",
      "road",
      "zone_id",
    ]);
    expect(parsed.zone_id).toBe(4);
  });

  it("carries the category, payer, payment method, tip and instruction", () => {
    expect(parcelOrderBody(input)).toMatchObject({
      parcel_category_id: 8,
      charge_payer: "receiver",
      payment_method: "cash_on_delivery",
      dm_tips: 200,
      delivery_instruction: "Fragile (Call on arrival)",
    });
  });

  it("leaves the email out when the sender has none", () => {
    const body = parcelOrderBody({ ...input, sender: { ...input.sender, email: null } });
    expect(body).not.toHaveProperty("contact_person_email");
  });
});
```

Append to `src/lib/api/order-quote.test.ts` (and change its import line to `import { parcelQuoteUsable, parseQuote } from "./order-quote";`):

```ts
describe("parcelQuoteUsable", () => {
  it("accepts a preview that carries the parcel fee", () => {
    const q = parseQuote({
      order_amount: 1300,
      delivery_charge: 1000,
      additional_charge: 100,
      pricing_breakdown: { normalized_inputs: { dm_tips: 200 } },
    });
    expect(parcelQuoteUsable(q)).toBe(true);
  });

  it("refuses a preview with no fee and no free-delivery reason", () => {
    // What a backend without the parcel preview fix returns: the fee
    // is missing from delivery_charge and from the total.
    const q = parseQuote({
      order_amount: 300,
      delivery_charge: 0,
      additional_charge: 100,
      pricing_breakdown: { normalized_inputs: { dm_tips: 200 } },
    });
    expect(parcelQuoteUsable(q)).toBe(false);
  });

  it("accepts a fee zeroed by free delivery", () => {
    const q = parseQuote({
      order_amount: 300,
      delivery_charge: 0,
      additional_charge: 100,
      pricing_breakdown: {
        normalized_inputs: { dm_tips: 200 },
        breakdown: { free_delivery_by: "admin" },
      },
    });
    expect(parcelQuoteUsable(q)).toBe(true);
  });

  it("refuses an empty body", () => {
    expect(parcelQuoteUsable(parseQuote({}))).toBe(false);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/lib/api/orders-parcel.test.ts src/lib/api/order-quote.test.ts`
Expected: FAIL. `parcelOrderBody is not a function` and `parcelQuoteUsable is not a function`; the five existing `parseQuote` tests still pass.

- [ ] **Step 3: Add the parcel fields to `OrderSummary`**

In `src/lib/api/orders.ts`, find:

```ts
  delivery_charge?: number;
  additional_charge?: number;
  extra_packaging_amount?: number;
  dm_tips?: number;
};
```

Replace with:

```ts
  delivery_charge?: number;
  additional_charge?: number;
  extra_packaging_amount?: number;
  dm_tips?: number;
  /** "delivery", "take_away" or "parcel". */
  order_type?: string | null;
  /** Parcel orders only. For a parcel, delivery_address above is the
   *  SENDER (pickup) and this is the receiver (drop-off). */
  receiver_details?: OrderReceiver | null;
  /** Parcel orders only; eager-loaded by track, list and running-orders. */
  parcel_category?: {
    id?: number;
    name?: string | null;
    image_full_url?: string | null;
  } | null;
  /** Parcel orders only: who pays the rider's fee. */
  charge_payer?: "sender" | "receiver" | null;
  delivery_instruction?: string | null;
};

/** receiver_details as the Order model casts it back from JSON. */
export type OrderReceiver = {
  address?: string;
  latitude?: string | number;
  longitude?: string | number;
  contact_person_name?: string;
  contact_person_number?: string;
  contact_person_email?: string | null;
};
```

- [ ] **Step 4: Append the parcel placement wire to `orders.ts`**

At the end of `src/lib/api/orders.ts` (after `payOnDelivery`), append:

```ts

/* -------------------------------------------------------------- */
/* Parcel orders                                                   */
/* -------------------------------------------------------------- */

/**
 * receiver_details as PlaceNewOrder reads it: the keys of the Flutter
 * app's AddressModel, sent as a JSON string. getZoneAndStore() checks
 * that zone_id contains latitude/longitude (error code "receiverZone").
 */
export type ReceiverDetails = {
  address: string;
  latitude: string;
  longitude: string;
  zone_id: number;
  contact_person_name: string;
  contact_person_number: string;
  contact_person_email: string;
  road: string;
  house: string;
  floor: string;
  address_type: string;
  additional_address: string;
};

export type PlaceParcelOrderInput = {
  moduleId: number;
  /** Zones containing the pickup point. PlaceNewOrder picks the one
   *  that offers the parcel module (error code "zone" if none). */
  zoneIds: number[];
  /** Where the rider collects. Sent as the order's address. */
  pickup: { text: string; lat: number; lng: number; addressType?: string };
  /** The pickup contact. Stored in delivery_address. */
  sender: {
    name: string;
    phone: string;
    email: string | null;
    house: string;
    floor: string;
    road: string;
  };
  receiverDetails: ReceiverDetails;
  /** Kilometres, pickup to drop-off. The preview must get the same number. */
  distance: number;
  parcelCategoryId: number;
  chargePayer: "sender" | "receiver";
  paymentMethod: "cash_on_delivery" | "digital_payment" | "wallet" | "offline_payment";
  dmTips: number;
  deliveryInstruction: string;
};

/**
 * The body for POST /order/place with order_type=parcel. The get-Tax
 * preview is sent this exact body too (fetchParcelQuote), so the two
 * cannot price different inputs. No cart, no store_id, no is_buy_now:
 * the parcel branch of PlaceNewOrder reads none of them.
 */
export function parcelOrderBody(
  input: PlaceParcelOrderInput,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    order_type: "parcel",
    payment_method: input.paymentMethod,
    parcel_category_id: input.parcelCategoryId,
    charge_payer: input.chargePayer,
    receiver_details: JSON.stringify(input.receiverDetails),
    distance: input.distance,
    address: input.pickup.text,
    address_type: input.pickup.addressType ?? "Delivery",
    latitude: String(input.pickup.lat),
    longitude: String(input.pickup.lng),
    contact_person_name: input.sender.name,
    contact_person_number: input.sender.phone,
    house: input.sender.house,
    floor: input.sender.floor,
    road: input.sender.road,
    dm_tips: input.dmTips,
    delivery_instruction: input.deliveryInstruction,
  };
  if (input.sender.email) body.contact_person_email = input.sender.email;
  return body;
}

export type PlaceParcelOrderResult =
  | { ok: true; orderId: number; amount: number }
  /** `code` is the backend's error code: "zone", "receiverZone", or
   *  "order_amount" on a 203 refusal (wallet short or over the cash
   *  ceiling, depending on the payment method). */
  | { ok: false; code: string | null; message: string };

export async function placeParcelOrder(
  input: PlaceParcelOrderInput,
): Promise<PlaceParcelOrderResult> {
  const res = await api<PlaceOrderResponse>("/api/v1/customer/order/place", {
    method: "POST",
    body: parcelOrderBody(input),
    zoneId: input.zoneIds,
    moduleId: input.moduleId,
    latitude: input.pickup.lat,
    longitude: input.pickup.lng,
  });

  if (res.ok) {
    if (typeof res.data.order_id === "number") {
      return {
        ok: true,
        orderId: res.data.order_id,
        amount: Number(res.data.total_ammount ?? 0),
      };
    }
    return { ok: false, code: null, message: "Order placed but no id returned." };
  }
  if ("skipped" in res) {
    return { ok: false, code: null, message: "Backend not configured." };
  }
  const code = res.errors ? (Object.keys(res.errors)[0] ?? null) : null;
  return { ok: false, code, message: res.message };
}
```

- [ ] **Step 5: Add the parcel preview to `order-quote.ts`**

Find:

```ts
import { toWireCart } from "@/lib/api/orders";
```

Replace with:

```ts
import {
  parcelOrderBody,
  toWireCart,
  type PlaceParcelOrderInput,
} from "@/lib/api/orders";
```

At the end of the file (after `parseQuote`), append:

```ts

/**
 * A parcel preview is only trusted when it carries the fee. A backend
 * without the parcel preview fix returns delivery_charge 0 with no
 * free-delivery reason and a total that leaves the fee out; showing
 * that would print "Free" delivery and a total below the real charge.
 */
export function parcelQuoteUsable(q: OrderQuote): boolean {
  return q.total > 0 && (q.deliveryCharge > 0 || q.freeDeliveryBy !== null);
}

/**
 * The parcel preview. Sent the exact body placeParcelOrder() sends, with
 * the same zone and module headers, so the backend prices the fee on the
 * same distance and category, adds the pickup zone's surge, and refuses
 * a pickup outside every parcel zone (code "zone") just as placement would.
 */
export async function fetchParcelQuote(
  input: PlaceParcelOrderInput,
): Promise<OrderQuoteResult> {
  const res = await api<GetTaxResponse>("/api/v1/customer/order/get-Tax", {
    method: "POST",
    body: parcelOrderBody(input),
    zoneId: input.zoneIds,
    moduleId: input.moduleId,
    latitude: input.pickup.lat,
    longitude: input.pickup.lng,
  });

  if (res.ok) {
    const quote = parseQuote(res.data);
    if (!parcelQuoteUsable(quote)) {
      return {
        ok: false,
        message: "We couldn't price this delivery just now. Try again in a moment.",
      };
    }
    return { ok: true, quote };
  }
  if ("skipped" in res) return { ok: false, message: "Backend not configured." };
  return { ok: false, message: res.message };
}
```

- [ ] **Step 6: Run them to verify they pass**

Run: `npx vitest run src/lib/api/orders-parcel.test.ts src/lib/api/order-quote.test.ts src/lib/api/orders-wire.test.ts`
Expected: PASS (5 + 9 + existing wire tests).

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit; npx eslint src/lib/api/orders.ts src/lib/api/order-quote.ts`
Expected: tsc clean; eslint prints nothing.

- [ ] **Step 8: Commit**

```powershell
cd C:\laragon\www\biteexpress-web-app-parcel; git add src/lib/api/orders.ts src/lib/api/order-quote.ts src/lib/api/orders-parcel.test.ts src/lib/api/order-quote.test.ts; git commit -m "Place parcel orders and preview their price from the same request body" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 4: Web, parcel form rules

**Files:**
- Create: `src/lib/parcel/parcel-form.ts`, `src/lib/parcel/parcel-form.test.ts`

**Interfaces:**
- Produces:
  - `ParcelContact = { name: string; phone: string; email: string; house: string; floor: string; road: string }`; `EMPTY_CONTACT: ParcelContact`
  - `ParcelPoint = { text: string; lat: number; lng: number; addressType?: string }`
  - `ContactErrors = Partial<Record<"address" | "name" | "phone" | "email", string>>`; `validateContact(point: ParcelPoint | null, contact: ParcelContact): ContactErrors`; `hasErrors(errors: ContactErrors): boolean`
  - `ParcelModule = { moduleId: number; zoneIds: number[] }`; `parcelModuleIn(zones: readonly ZoneData[]): ParcelModule | null`
  - `PickupZone = { ok: true; zoneIds: number[]; zone: ZoneData } | { ok: false; message: string }`; `pickupZoneResult(check: ZoneCheck, moduleId: number): PickupZone`
  - `DropoffZone = { ok: true; zoneId: number } | { ok: false; message: string }`; `dropoffZoneResult(check: ZoneCheck): DropoffZone`
  - `buildReceiverDetails(point: ParcelPoint, contact: ParcelContact, zoneId: number): ReceiverDetails`
  - `deliveryInstruction(selected: string | null, note: string): string`
  - `StepNumber = 1 | 2 | 3`; `furthestStep(categoryChosen: boolean, addressesValid: boolean): StepNumber`
- Consumes: `normalizePhone` (`src/lib/phone.ts`), `ZoneCheck`, `ZoneData` (`src/lib/api/zones.ts`), `ReceiverDetails` (Task 3).

- [ ] **Step 1: Write the failing test**

`src/lib/parcel/parcel-form.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ZoneCheck, ZoneData } from "@/lib/api/zones";
import {
  EMPTY_CONTACT,
  buildReceiverDetails,
  deliveryInstruction,
  dropoffZoneResult,
  furthestStep,
  hasErrors,
  parcelModuleIn,
  pickupZoneResult,
  validateContact,
} from "./parcel-form";

const point = { text: "12 Allen Avenue, Ikeja", lat: 6.6018, lng: 3.3515 };
const contact = { ...EMPTY_CONTACT, name: "Ada Obi", phone: "0801 234 5678" };

function zone(
  id: number,
  modules: Array<{ id: number; module_type: string }>,
): ZoneData {
  return { id, status: 1, cash_on_delivery: 1, digital_payment: 1, offline_payment: 0, modules };
}

describe("validateContact", () => {
  it("accepts a complete contact", () => {
    expect(validateContact(point, contact)).toEqual({});
    expect(hasErrors(validateContact(point, contact))).toBe(false);
  });

  it("flags every missing field", () => {
    expect(validateContact(null, EMPTY_CONTACT)).toEqual({
      address: "Pick an address.",
      name: "Enter a contact name.",
      phone: "Enter a phone number.",
    });
    expect(hasErrors(validateContact(null, EMPTY_CONTACT))).toBe(true);
  });

  it("accepts every phone shape the rest of the app accepts", () => {
    for (const phone of ["08012345678", "8012345678", "2348012345678", "+234 801 234 5678"]) {
      expect(validateContact(point, { ...contact, phone }).phone).toBeUndefined();
    }
  });

  it("rejects a phone that is not Nigerian", () => {
    expect(validateContact(point, { ...contact, phone: "12345" }).phone).toBe(
      "Enter a Nigerian phone number, like 0801 234 5678.",
    );
  });

  it("treats email as optional but checks one that is typed", () => {
    expect(validateContact(point, { ...contact, email: "" }).email).toBeUndefined();
    expect(validateContact(point, { ...contact, email: "ada@example.test" }).email).toBeUndefined();
    expect(validateContact(point, { ...contact, email: "ada@" }).email).toBe(
      "Enter a valid email or leave it blank.",
    );
  });
});

describe("parcelModuleIn", () => {
  it("finds the parcel module and the zones that offer it", () => {
    const zones = [
      zone(7, [{ id: 1, module_type: "food" }]),
      zone(9, [{ id: 6, module_type: "parcel" }]),
      zone(11, [{ id: 1, module_type: "food" }, { id: 6, module_type: "parcel" }]),
    ];
    expect(parcelModuleIn(zones)).toEqual({ moduleId: 6, zoneIds: [9, 11] });
  });

  it("keeps to the first parcel module when zones offer different ones", () => {
    const zones = [zone(9, [{ id: 6, module_type: "parcel" }]), zone(12, [{ id: 13, module_type: "parcel" }])];
    expect(parcelModuleIn(zones)).toEqual({ moduleId: 6, zoneIds: [9] });
  });

  it("returns null when no zone offers parcels", () => {
    expect(parcelModuleIn([zone(7, [{ id: 1, module_type: "food" }])])).toBeNull();
    expect(parcelModuleIn([])).toBeNull();
  });
});

describe("pickupZoneResult", () => {
  it("uses the pickup's own zone ids, not the home location's", () => {
    // A saved pickup address in zones 7 and 9; only 9 has parcels. The
    // header must still carry every zone containing the pickup.
    const check: ZoneCheck = {
      kind: "in-zone",
      zoneIds: [7, 9],
      zones: [zone(7, [{ id: 1, module_type: "food" }]), zone(9, [{ id: 6, module_type: "parcel" }])],
    };
    const result = pickupZoneResult(check, 6);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.zoneIds).toEqual([7, 9]);
      expect(result.zone.id).toBe(9);
    }
  });

  it("refuses a served address whose zones do not offer parcels", () => {
    const check: ZoneCheck = { kind: "in-zone", zoneIds: [7], zones: [zone(7, [{ id: 1, module_type: "food" }])] };
    expect(pickupZoneResult(check, 6)).toEqual({
      ok: false,
      message: "We can't collect parcels from this address yet. Pick another pickup address.",
    });
  });

  it("explains out-of-zone, paused and failed checks", () => {
    expect(pickupZoneResult({ kind: "out-of-zone" }, 6)).toEqual({
      ok: false,
      message: "We don't cover this pickup address yet. Pick another.",
    });
    expect(pickupZoneResult({ kind: "temp-unavailable" }, 6)).toEqual({
      ok: false,
      message: "Pickups are paused in this area right now.",
    });
    expect(pickupZoneResult({ kind: "error", message: "timeout" }, 6)).toEqual({
      ok: false,
      message: "We couldn't check this address. Try again in a moment.",
    });
  });
});

describe("dropoffZoneResult", () => {
  it("takes the first served zone as receiver_details.zone_id", () => {
    const check: ZoneCheck = { kind: "in-zone", zoneIds: [4, 2], zones: [] };
    expect(dropoffZoneResult(check)).toEqual({ ok: true, zoneId: 4 });
  });

  it("refuses an address no zone serves", () => {
    expect(dropoffZoneResult({ kind: "out-of-zone" })).toEqual({
      ok: false,
      message: "We don't deliver to this address yet. Pick another drop-off.",
    });
    expect(dropoffZoneResult({ kind: "in-zone", zoneIds: [], zones: [] }).ok).toBe(false);
    expect(dropoffZoneResult({ kind: "skipped", reason: "no env" }).ok).toBe(false);
  });
});

describe("buildReceiverDetails", () => {
  it("builds the app's address keys with a normalised phone", () => {
    const details = buildReceiverDetails(
      { text: "5 Awolowo Road, Ikoyi", lat: 6.4541, lng: 3.4218 },
      { name: " Bola Ade ", phone: "0809 876 5432", email: "", house: "5", floor: "", road: "Awolowo Road" },
      4,
    );
    expect(details).toEqual({
      address: "5 Awolowo Road, Ikoyi",
      latitude: "6.4541",
      longitude: "3.4218",
      zone_id: 4,
      contact_person_name: "Bola Ade",
      contact_person_number: "+2348098765432",
      contact_person_email: "",
      road: "Awolowo Road",
      house: "5",
      floor: "",
      address_type: "Delivery",
      additional_address: "",
    });
  });
});

describe("deliveryInstruction", () => {
  it("joins a preset and a note the way the app does", () => {
    expect(deliveryInstruction("Fragile", "Call on arrival")).toBe("Fragile (Call on arrival)");
  });

  it("sends either one alone", () => {
    expect(deliveryInstruction("Fragile", "")).toBe("Fragile");
    expect(deliveryInstruction(null, "Call on arrival")).toBe("Call on arrival");
    expect(deliveryInstruction(null, "   ")).toBe("");
  });
});

describe("furthestStep", () => {
  it("unlocks a step only when every step before it is valid", () => {
    expect(furthestStep(false, false)).toBe(1);
    expect(furthestStep(false, true)).toBe(1);
    expect(furthestStep(true, false)).toBe(2);
    expect(furthestStep(true, true)).toBe(3);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/parcel/parcel-form.test.ts`
Expected: FAIL, `Failed to resolve import "./parcel-form"`.

- [ ] **Step 3: Write the implementation**

`src/lib/parcel/parcel-form.ts`:

```ts
import { normalizePhone } from "@/lib/phone";
import type { ZoneCheck, ZoneData } from "@/lib/api/zones";
import type { ReceiverDetails } from "@/lib/api/orders";

/**
 * Pure rules for the /send form. No React and no fetch, so the checks
 * that decide whether a step can complete are tested directly.
 */

export type ParcelContact = {
  name: string;
  phone: string;
  email: string;
  house: string;
  floor: string;
  road: string;
};

export const EMPTY_CONTACT: ParcelContact = {
  name: "",
  phone: "",
  email: "",
  house: "",
  floor: "",
  road: "",
};

export type ParcelPoint = {
  text: string;
  lat: number;
  lng: number;
  addressType?: string;
};

export type ContactErrors = Partial<Record<"address" | "name" | "phone" | "email", string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Phones are checked with the same normalizePhone() the sign-in flow uses. */
export function validateContact(
  point: ParcelPoint | null,
  contact: ParcelContact,
): ContactErrors {
  const errors: ContactErrors = {};
  if (!point || !point.text.trim()) errors.address = "Pick an address.";
  if (!contact.name.trim()) errors.name = "Enter a contact name.";
  if (!contact.phone.trim()) {
    errors.phone = "Enter a phone number.";
  } else if (!normalizePhone(contact.phone)) {
    errors.phone = "Enter a Nigerian phone number, like 0801 234 5678.";
  }
  const email = contact.email.trim();
  if (email && !EMAIL.test(email)) {
    errors.email = "Enter a valid email or leave it blank.";
  }
  return errors;
}

export function hasErrors(errors: ContactErrors): boolean {
  return Object.keys(errors).length > 0;
}

export type ParcelModule = { moduleId: number; zoneIds: number[] };

/**
 * The parcel module a set of zones offers, and which of those zones
 * offer it. If zones offer different parcel modules, the first wins so
 * the categories shown and the moduleId header always agree.
 */
export function parcelModuleIn(zones: readonly ZoneData[]): ParcelModule | null {
  let moduleId: number | null = null;
  const zoneIds: number[] = [];
  for (const z of zones) {
    const mod = (z.modules ?? []).find(
      (m) => m.module_type === "parcel" && (moduleId === null || m.id === moduleId),
    );
    if (!mod) continue;
    if (moduleId === null) moduleId = mod.id;
    zoneIds.push(z.id);
  }
  return moduleId === null ? null : { moduleId, zoneIds };
}

export type PickupZone =
  | { ok: true; zoneIds: number[]; zone: ZoneData }
  | { ok: false; message: string };

/**
 * Placement needs a zone in the zoneId header that contains the pickup
 * and offers the parcel module. zoneIds are the pickup's own zones, so
 * a saved address in another zone than the home location still works.
 */
export function pickupZoneResult(check: ZoneCheck, moduleId: number): PickupZone {
  if (check.kind === "in-zone") {
    const z = check.zones.find((candidate) =>
      (candidate.modules ?? []).some((m) => m.id === moduleId),
    );
    if (z) return { ok: true, zoneIds: check.zoneIds, zone: z };
    return {
      ok: false,
      message: "We can't collect parcels from this address yet. Pick another pickup address.",
    };
  }
  if (check.kind === "out-of-zone") {
    return { ok: false, message: "We don't cover this pickup address yet. Pick another." };
  }
  if (check.kind === "temp-unavailable") {
    return { ok: false, message: "Pickups are paused in this area right now." };
  }
  return { ok: false, message: "We couldn't check this address. Try again in a moment." };
}

export type DropoffZone = { ok: true; zoneId: number } | { ok: false; message: string };

/** The drop-off only has to be in a served zone; its id becomes receiver_details.zone_id. */
export function dropoffZoneResult(check: ZoneCheck): DropoffZone {
  if (check.kind === "in-zone" && check.zoneIds.length > 0) {
    return { ok: true, zoneId: check.zoneIds[0] };
  }
  if (check.kind === "in-zone" || check.kind === "out-of-zone") {
    return { ok: false, message: "We don't deliver to this address yet. Pick another drop-off." };
  }
  if (check.kind === "temp-unavailable") {
    return { ok: false, message: "Deliveries are paused in this area right now." };
  }
  return { ok: false, message: "We couldn't check this address. Try again in a moment." };
}

export function buildReceiverDetails(
  point: ParcelPoint,
  contact: ParcelContact,
  zoneId: number,
): ReceiverDetails {
  return {
    address: point.text,
    latitude: String(point.lat),
    longitude: String(point.lng),
    zone_id: zoneId,
    contact_person_name: contact.name.trim(),
    contact_person_number: normalizePhone(contact.phone) ?? contact.phone.trim(),
    contact_person_email: contact.email.trim(),
    road: contact.road.trim(),
    house: contact.house.trim(),
    floor: contact.floor.trim(),
    address_type: point.addressType ?? "Delivery",
    additional_address: "",
  };
}

/** Preset plus note, as the app sends them: "Fragile (Call on arrival)". */
export function deliveryInstruction(selected: string | null, note: string): string {
  const preset = selected?.trim() ?? "";
  const extra = note.trim();
  if (preset && extra) return `${preset} (${extra})`;
  return preset || extra;
}

export type StepNumber = 1 | 2 | 3;

/** The furthest step the customer may open: each needs every step before it to be valid. */
export function furthestStep(categoryChosen: boolean, addressesValid: boolean): StepNumber {
  if (!categoryChosen) return 1;
  if (!addressesValid) return 2;
  return 3;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/parcel/parcel-form.test.ts`
Expected: PASS (17 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit; npx eslint src/lib/parcel/parcel-form.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```powershell
cd C:\laragon\www\biteexpress-web-app-parcel; git add src/lib/parcel/parcel-form.ts src/lib/parcel/parcel-form.test.ts; git commit -m "Add parcel form rules for contacts, zones and receiver details" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Web, parcel payer and payment rules

**Files:**
- Create: `src/lib/parcel/parcel-payment.ts`, `src/lib/parcel/parcel-payment.test.ts`

**Interfaces:**
- Produces:
  - `ParcelPayer = "sender" | "receiver"`; `ParcelPaymentMethod = "digital_payment" | "wallet" | "offline_payment" | "cash_on_delivery"`
  - `PaymentGates = { cashOnDelivery: boolean; digitalPayment: boolean; zone: Pick<ZoneData, "cash_on_delivery" | "digital_payment" | "offline_payment">; offlineUsable: boolean }`
  - `allowedPayers(g): ParcelPayer[]`; `effectivePayer(choice, g): ParcelPayer`; `allowedMethods(payer, g): ParcelPaymentMethod[]`; `effectivePayment(payer, choice: ParcelPaymentMethod | null, g): ParcelPaymentMethod | null`
  - `ParcelQuoteInputs = { categoryId: number; pickup: {lat,lng}; dropoff: {lat,lng}; distanceKm: number; payer: ParcelPayer; tip: number }`; `parcelQuoteKey(i): string`
  - `ParcelQuoteView = { kind: "idle" } | { kind: "loading" } | { kind: "ready"; quote: OrderQuote } | { kind: "error"; message: string }`
  - `walletShortfall(total: number, balance: number | null): number`
  - `placeBlocker(a: { stepsValid: boolean; quote: ParcelQuoteView; payment: ParcelPaymentMethod | null; walletBalance: number | null }): string | null`
  - `parcelPlaceErrorMessage(code: string | null, method: ParcelPaymentMethod, fallback: string): string`
- Consumes: `OrderQuote` (order-quote.ts), `ZoneData` (zones.ts).

- [ ] **Step 1: Write the failing test**

`src/lib/parcel/parcel-payment.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { OrderQuote } from "@/lib/api/order-quote";
import {
  allowedMethods,
  allowedPayers,
  effectivePayer,
  effectivePayment,
  parcelPlaceErrorMessage,
  parcelQuoteKey,
  placeBlocker,
  walletShortfall,
  type PaymentGates,
} from "./parcel-payment";

function gates(
  over: Partial<Omit<PaymentGates, "zone">> = {},
  zone: Partial<PaymentGates["zone"]> = {},
): PaymentGates {
  return {
    cashOnDelivery: true,
    digitalPayment: true,
    offlineUsable: true,
    ...over,
    zone: { cash_on_delivery: 1, digital_payment: 1, offline_payment: 1, ...zone },
  };
}

const quote: OrderQuote = {
  subtotal: 0,
  productDiscount: 0,
  couponDiscount: 0,
  deliveryCharge: 700,
  freeDeliveryBy: null,
  additionalCharge: 100,
  extraPackaging: 0,
  taxAmount: 0,
  taxIncluded: false,
  dmTips: 100,
  total: 900,
};

describe("allowedPayers and effectivePayer", () => {
  it("offers the receiver when cash is on globally and in the pickup zone", () => {
    expect(allowedPayers(gates())).toEqual(["sender", "receiver"]);
  });

  it("hides the receiver when the pickup zone has cash on delivery off", () => {
    expect(allowedPayers(gates({}, { cash_on_delivery: 0 }))).toEqual(["sender"]);
  });

  it("hides the receiver when cash on delivery is off in config", () => {
    expect(allowedPayers(gates({ cashOnDelivery: false }))).toEqual(["sender"]);
  });

  it("falls back to the sender when a receiver choice is no longer allowed", () => {
    expect(effectivePayer("receiver", gates())).toBe("receiver");
    expect(effectivePayer("receiver", gates({}, { cash_on_delivery: 0 }))).toBe("sender");
  });
});

describe("allowedMethods and effectivePayment", () => {
  it("gives the receiver cash on delivery only", () => {
    expect(allowedMethods("receiver", gates())).toEqual(["cash_on_delivery"]);
  });

  it("gives the sender food checkout's methods, never cash", () => {
    expect(allowedMethods("sender", gates())).toEqual(["digital_payment", "wallet", "offline_payment"]);
  });

  it("drops Pay Online when the zone or config switches it off", () => {
    expect(allowedMethods("sender", gates({}, { digital_payment: 0 }))).toEqual(["wallet", "offline_payment"]);
    expect(allowedMethods("sender", gates({ digitalPayment: false }))).toEqual(["wallet", "offline_payment"]);
  });

  it("drops Pay Offline when it is not usable in the zone", () => {
    expect(allowedMethods("sender", gates({ offlineUsable: false }))).toEqual(["digital_payment", "wallet"]);
  });

  it("keeps a valid choice and replaces one that is not allowed", () => {
    expect(effectivePayment("sender", "wallet", gates())).toBe("wallet");
    expect(effectivePayment("sender", "offline_payment", gates({ offlineUsable: false }))).toBe("digital_payment");
    expect(effectivePayment("sender", null, gates())).toBe("digital_payment");
    expect(effectivePayment("receiver", "wallet", gates())).toBe("cash_on_delivery");
  });
});

describe("parcelQuoteKey", () => {
  const inputs = {
    categoryId: 8,
    pickup: { lat: 6.6018, lng: 3.3515 },
    dropoff: { lat: 6.4541, lng: 3.4218 },
    distanceKm: 18.45,
    payer: "sender" as const,
    tip: 0,
  };

  it("is stable for the same inputs", () => {
    expect(parcelQuoteKey(inputs)).toBe(parcelQuoteKey({ ...inputs }));
  });

  it("changes with every input the price depends on", () => {
    const base = parcelQuoteKey(inputs);
    expect(parcelQuoteKey({ ...inputs, tip: 200 })).not.toBe(base);
    expect(parcelQuoteKey({ ...inputs, payer: "receiver" })).not.toBe(base);
    expect(parcelQuoteKey({ ...inputs, categoryId: 9 })).not.toBe(base);
    expect(parcelQuoteKey({ ...inputs, distanceKm: 18.5 })).not.toBe(base);
    expect(parcelQuoteKey({ ...inputs, dropoff: { lat: 6.45, lng: 3.42 } })).not.toBe(base);
    expect(parcelQuoteKey({ ...inputs, pickup: { lat: 6.6, lng: 3.35 } })).not.toBe(base);
  });
});

describe("placeBlocker", () => {
  const ready = { kind: "ready" as const, quote };

  it("blocks until every step is valid", () => {
    expect(placeBlocker({ stepsValid: false, quote: ready, payment: "wallet", walletBalance: 5000 })).toBe(
      "Finish the steps above first.",
    );
  });

  it("blocks while the preview for the current inputs is still loading", () => {
    expect(placeBlocker({ stepsValid: true, quote: { kind: "loading" }, payment: "wallet", walletBalance: 5000 })).toBe(
      "Working out the price…",
    );
    expect(placeBlocker({ stepsValid: true, quote: { kind: "idle" }, payment: "wallet", walletBalance: 5000 })).toBe(
      "Working out the price…",
    );
  });

  it("blocks with the preview's own message when it failed", () => {
    expect(
      placeBlocker({
        stepsValid: true,
        quote: { kind: "error", message: "Out of coverage area" },
        payment: "digital_payment",
        walletBalance: null,
      }),
    ).toBe("Out of coverage area");
  });

  it("blocks without a payment method", () => {
    expect(placeBlocker({ stepsValid: true, quote: ready, payment: null, walletBalance: null })).toBe("Pick how to pay.");
  });

  it("blocks a wallet payment the balance cannot cover", () => {
    expect(placeBlocker({ stepsValid: true, quote: ready, payment: "wallet", walletBalance: 600 })).toBe(
      "Your wallet is ₦300 short of the ₦900 total.",
    );
  });

  it("lets a covered or unknown wallet balance through", () => {
    expect(placeBlocker({ stepsValid: true, quote: ready, payment: "wallet", walletBalance: 900 })).toBeNull();
    expect(placeBlocker({ stepsValid: true, quote: ready, payment: "wallet", walletBalance: null })).toBeNull();
    expect(placeBlocker({ stepsValid: true, quote: ready, payment: "cash_on_delivery", walletBalance: 0 })).toBeNull();
  });
});

describe("walletShortfall", () => {
  it("is the gap, never negative, and zero when the balance is unknown", () => {
    expect(walletShortfall(900, 600)).toBe(300);
    expect(walletShortfall(900, 1200)).toBe(0);
    expect(walletShortfall(900, null)).toBe(0);
  });
});

describe("parcelPlaceErrorMessage", () => {
  it("maps the zone codes placement returns", () => {
    expect(parcelPlaceErrorMessage("zone", "wallet", "Out of coverage area")).toBe(
      "We can't collect parcels from the pickup address any more. Pick another pickup address.",
    );
    expect(parcelPlaceErrorMessage("receiverZone", "wallet", "Out of coverage")).toBe(
      "We don't deliver to the drop-off address any more. Pick another drop-off.",
    );
  });

  it("reads a 203 order_amount refusal by the payment method", () => {
    expect(parcelPlaceErrorMessage("order_amount", "cash_on_delivery", "Amount crossed maximum")).toBe(
      "This parcel is over the cash on delivery limit for the area. Choose Me as the payer and pay another way.",
    );
    expect(parcelPlaceErrorMessage("order_amount", "wallet", "Insufficient balance")).toBe(
      "Your wallet balance is too low for this parcel. Top up on the Wallet page, or pay another way.",
    );
    expect(parcelPlaceErrorMessage("order_amount", "digital_payment", "Something odd")).toBe("Something odd");
  });

  it("falls back to the server message, then to a generic line", () => {
    expect(parcelPlaceErrorMessage(null, "wallet", "Server said no")).toBe("Server said no");
    expect(parcelPlaceErrorMessage(null, "wallet", "")).toBe("We couldn't place your parcel. Please try again.");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/parcel/parcel-payment.test.ts`
Expected: FAIL, `Failed to resolve import "./parcel-payment"`.

- [ ] **Step 3: Write the implementation**

`src/lib/parcel/parcel-payment.ts`:

```ts
import type { OrderQuote } from "@/lib/api/order-quote";
import type { ZoneData } from "@/lib/api/zones";

/**
 * Pure rules for who pays for a parcel and how, and for when it can be
 * placed. No React and no fetch, so the decisions that stop a customer
 * paying the wrong amount, or reaching a placement the backend refuses,
 * are tested directly.
 */

export type ParcelPayer = "sender" | "receiver";

export type ParcelPaymentMethod =
  | "digital_payment"
  | "wallet"
  | "offline_payment"
  | "cash_on_delivery";

export type PaymentGates = {
  /** config.cash_on_delivery. Placement refuses cash when it is off. */
  cashOnDelivery: boolean;
  /** config.digital_payment. */
  digitalPayment: boolean;
  /** The pickup zone's own switches, from get-zone-id. */
  zone: Pick<ZoneData, "cash_on_delivery" | "digital_payment" | "offline_payment">;
  /** canUseOfflinePayment() for the pickup zone. */
  offlineUsable: boolean;
};

function isOn(flag: number | boolean | string | null | undefined): boolean {
  return flag === 1 || flag === true || flag === "1";
}

/**
 * The receiver can only pay cash on delivery, so the option exists only
 * where cash is on both in config and in the pickup zone. The app
 * applies the same two switches.
 */
export function allowedPayers(g: PaymentGates): ParcelPayer[] {
  return g.cashOnDelivery && isOn(g.zone.cash_on_delivery)
    ? ["sender", "receiver"]
    : ["sender"];
}

export function effectivePayer(choice: ParcelPayer, g: PaymentGates): ParcelPayer {
  return allowedPayers(g).includes(choice) ? choice : "sender";
}

/**
 * Receiver pays: cash on delivery only. Sender pays: the methods food
 * checkout offers (Pay Online, wallet, Pay Offline), less any the
 * switches turn off. Cash is not offered to a paying sender, matching
 * food checkout.
 */
export function allowedMethods(payer: ParcelPayer, g: PaymentGates): ParcelPaymentMethod[] {
  if (payer === "receiver") {
    return allowedPayers(g).includes("receiver") ? ["cash_on_delivery"] : [];
  }
  const methods: ParcelPaymentMethod[] = [];
  if (g.digitalPayment && isOn(g.zone.digital_payment)) methods.push("digital_payment");
  methods.push("wallet");
  if (g.offlineUsable) methods.push("offline_payment");
  return methods;
}

export function effectivePayment(
  payer: ParcelPayer,
  choice: ParcelPaymentMethod | null,
  g: PaymentGates,
): ParcelPaymentMethod | null {
  const allowed = allowedMethods(payer, g);
  if (choice !== null && allowed.includes(choice)) return choice;
  return allowed[0] ?? null;
}

export type ParcelQuoteInputs = {
  categoryId: number;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  distanceKm: number;
  payer: ParcelPayer;
  tip: number;
};

/**
 * Names the inputs a preview was fetched for. A preview whose key is not
 * the current key is stale and must never enable payment.
 */
export function parcelQuoteKey(i: ParcelQuoteInputs): string {
  return [
    i.categoryId,
    i.pickup.lat,
    i.pickup.lng,
    i.dropoff.lat,
    i.dropoff.lng,
    i.distanceKm,
    i.payer,
    i.tip,
  ].join("|");
}

export type ParcelQuoteView =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; quote: OrderQuote }
  | { kind: "error"; message: string };

export function walletShortfall(total: number, balance: number | null): number {
  return typeof balance === "number" ? Math.max(0, total - balance) : 0;
}

/**
 * Why "Place order" is disabled, or null when the parcel can be placed.
 * Only a ready preview for the current inputs lets the customer pay.
 */
export function placeBlocker(a: {
  stepsValid: boolean;
  quote: ParcelQuoteView;
  payment: ParcelPaymentMethod | null;
  walletBalance: number | null;
}): string | null {
  if (!a.stepsValid) return "Finish the steps above first.";
  if (a.quote.kind === "error") return a.quote.message;
  if (a.quote.kind !== "ready") return "Working out the price…";
  if (a.payment === null) return "Pick how to pay.";
  if (a.payment === "wallet") {
    const total = a.quote.quote.total;
    const short = walletShortfall(total, a.walletBalance);
    if (short > 0) {
      return `Your wallet is ₦${Math.round(short).toLocaleString()} short of the ₦${Math.round(total).toLocaleString()} total.`;
    }
  }
  return null;
}

/**
 * Placement errors in plain words. "order_amount" arrives on a 203 for
 * two different reasons, told apart by the payment method: the wallet
 * cannot cover the total, or the total is over the zone's cash ceiling.
 */
export function parcelPlaceErrorMessage(
  code: string | null,
  method: ParcelPaymentMethod,
  fallback: string,
): string {
  if (code === "zone") {
    return "We can't collect parcels from the pickup address any more. Pick another pickup address.";
  }
  if (code === "receiverZone") {
    return "We don't deliver to the drop-off address any more. Pick another drop-off.";
  }
  if (code === "order_amount" && method === "cash_on_delivery") {
    return "This parcel is over the cash on delivery limit for the area. Choose Me as the payer and pay another way.";
  }
  if (code === "order_amount" && method === "wallet") {
    return "Your wallet balance is too low for this parcel. Top up on the Wallet page, or pay another way.";
  }
  return fallback || "We couldn't place your parcel. Please try again.";
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/parcel/parcel-payment.test.ts`
Expected: PASS (21 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit; npx eslint src/lib/parcel/parcel-payment.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```powershell
cd C:\laragon\www\biteexpress-web-app-parcel; git add src/lib/parcel/parcel-payment.ts src/lib/parcel/parcel-payment.test.ts; git commit -m "Add parcel payer and payment rules" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 6: Web, shared settleOrder helper

**Files:**
- Create: `src/lib/checkout/settle-order.ts`, `src/lib/checkout/settle-order.test.ts`
- Modify: `src/components/checkout/checkout-flow.tsx:10-14`, `:22`, `:469-568`

**Interfaces:**
- Produces:
  - `SettleMethod = "digital_payment" | "wallet" | "offline_payment" | "cash_on_delivery"`
  - `SettleInput = { orderId: number; amount: number; method: SettleMethod; successHref: string; email: string | null; offlineMethodId: number | null }`
  - `SettleDeps = { payWithPaystack(input: PaystackPaymentInput): Promise<PaystackResult>; confirmPaystackPayment(orderId: number, reference: string): Promise<ConfirmPaystackResult>; walletPayOrder(orderId: number): Promise<WalletPayResult>; sleep(ms: number): Promise<void>; now(): number }`
  - `SettleOutcome = { kind: "navigate"; href: string; error?: string } | { kind: "stay"; tone: "warn" | "error"; message: string }`
  - `CONFIRM_ATTEMPTS = 4`; `defaultSettleDeps: SettleDeps`; `settleOrder(input: SettleInput, deps: SettleDeps): Promise<SettleOutcome>`
- Contract for callers: on `navigate`, clear anything order-scoped (food clears the cart), show `error` with `toast.error` if present, then `router.replace(href)`. On `stay`, re-enable the form and show `message` with `toast.warn` or `toast.error` by `tone`.
- Consumes: `payWithPaystack` (`src/lib/paystack.ts`), `confirmPaystackPayment`, `walletPayOrder` and their result types (`src/lib/api/orders.ts`).

- [ ] **Step 1: Record the lint baseline**

Run: `npx eslint src/components/checkout/checkout-flow.tsx`
Expected today: errors `react-hooks/set-state-in-effect` at 162:7 and 270:5, warning `react-hooks/exhaustive-deps` at 243:6. Note the exact output; the edited file must show no rule hit that is not in this list.

- [ ] **Step 2: Write the failing test**

`src/lib/checkout/settle-order.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  CONFIRM_ATTEMPTS,
  settleOrder,
  type SettleDeps,
  type SettleInput,
} from "./settle-order";

const NOW = 1_700_000_000_000;

function deps(over: Partial<SettleDeps> = {}): SettleDeps {
  return {
    payWithPaystack: vi.fn(async () => ({ status: "success" as const, reference: "BE-77-ref" })),
    confirmPaystackPayment: vi.fn(async () => ({ ok: true as const })),
    walletPayOrder: vi.fn(async () => ({ ok: true as const })),
    sleep: vi.fn(async () => {}),
    now: () => NOW,
    ...over,
  };
}

const base: SettleInput = {
  orderId: 77,
  amount: 1300.5,
  method: "digital_payment",
  successHref: "/checkout/success?order_id=77",
  email: "ada@example.test",
  offlineMethodId: null,
};

describe("settleOrder: offline payment", () => {
  it("sends the customer to the transfer form with the chosen bank", async () => {
    const d = deps();
    expect(await settleOrder({ ...base, method: "offline_payment", offlineMethodId: 3 }, d)).toEqual({
      kind: "navigate",
      href: "/checkout/offline/77?method=3",
    });
    expect(d.payWithPaystack).not.toHaveBeenCalled();
    expect(d.walletPayOrder).not.toHaveBeenCalled();
  });

  it("omits the bank when none was chosen", async () => {
    expect(await settleOrder({ ...base, method: "offline_payment" }, deps())).toEqual({
      kind: "navigate",
      href: "/checkout/offline/77",
    });
  });
});

describe("settleOrder: cash on delivery", () => {
  it("lands on the success target without taking any payment", async () => {
    const d = deps();
    expect(await settleOrder({ ...base, method: "cash_on_delivery", successHref: "/orders/77" }, d)).toEqual({
      kind: "navigate",
      href: "/orders/77",
    });
    expect(d.payWithPaystack).not.toHaveBeenCalled();
    expect(d.walletPayOrder).not.toHaveBeenCalled();
  });
});

describe("settleOrder: wallet", () => {
  it("lands on the success target once the wallet is charged", async () => {
    const d = deps();
    expect(await settleOrder({ ...base, method: "wallet" }, d)).toEqual({
      kind: "navigate",
      href: "/checkout/success?order_id=77",
    });
    expect(d.walletPayOrder).toHaveBeenCalledWith(77);
  });

  it("stays with a top-up warning when the balance is short", async () => {
    const d = deps({
      walletPayOrder: vi.fn(async () => ({ ok: false as const, reason: "insufficient" as const, message: "Insufficient balance" })),
    });
    expect(await settleOrder({ ...base, method: "wallet" }, d)).toEqual({
      kind: "stay",
      tone: "warn",
      message: "Wallet balance is too low. Top up via your DVA on the Wallet page, then re-place the order.",
    });
  });

  it("stays with the server's error otherwise", async () => {
    const d = deps({
      walletPayOrder: vi.fn(async () => ({ ok: false as const, reason: "other" as const, message: "" })),
    });
    expect(await settleOrder({ ...base, method: "wallet" }, d)).toEqual({
      kind: "stay",
      tone: "error",
      message: "Wallet payment failed.",
    });
  });
});

describe("settleOrder: Paystack", () => {
  it("needs an email before opening the popup", async () => {
    const d = deps();
    expect(await settleOrder({ ...base, email: null }, d)).toEqual({
      kind: "stay",
      tone: "warn",
      message: "We need an email on file to charge a card. Add one on the Edit profile page and try again.",
    });
    expect(d.payWithPaystack).not.toHaveBeenCalled();
  });

  it("charges the server total in kobo and lands on the success target", async () => {
    const d = deps();
    expect(await settleOrder(base, d)).toEqual({ kind: "navigate", href: "/checkout/success?order_id=77" });
    expect(d.payWithPaystack).toHaveBeenCalledWith({
      email: "ada@example.test",
      amountKobo: 130050,
      reference: `BE-77-${NOW.toString(36)}`,
      metadata: { order_id: 77 },
    });
    expect(d.confirmPaystackPayment).toHaveBeenCalledWith(77, "BE-77-ref");
  });

  it("stays when the customer closes the popup", async () => {
    const d = deps({ payWithPaystack: vi.fn(async () => ({ status: "cancelled" as const })) });
    expect(await settleOrder(base, d)).toEqual({
      kind: "stay",
      tone: "warn",
      message: "Payment cancelled. Order #77 is on hold. Re-place it when you're ready.",
    });
    expect(d.confirmPaystackPayment).not.toHaveBeenCalled();
  });

  it("stays with the popup's error", async () => {
    const d = deps({ payWithPaystack: vi.fn(async () => ({ status: "error" as const, message: "Paystack script not loaded" })) });
    expect(await settleOrder(base, d)).toEqual({ kind: "stay", tone: "error", message: "Paystack script not loaded" });
  });

  it("retries the confirm with a growing pause and succeeds", async () => {
    const confirm = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, message: "Network down" })
      .mockResolvedValueOnce({ ok: false, message: "Network down" })
      .mockResolvedValue({ ok: true });
    const d = deps({ confirmPaystackPayment: confirm });
    expect(await settleOrder(base, d)).toEqual({ kind: "navigate", href: "/checkout/success?order_id=77" });
    expect(confirm).toHaveBeenCalledTimes(3);
    expect(d.sleep).toHaveBeenNthCalledWith(1, 1500);
    expect(d.sleep).toHaveBeenNthCalledWith(2, 3000);
  });

  it("sends a captured but unconfirmed payment to the order page, never back to pay again", async () => {
    const confirm = vi.fn().mockResolvedValue({ ok: false, message: "Network down" });
    const d = deps({ confirmPaystackPayment: confirm });
    expect(await settleOrder(base, d)).toEqual({
      kind: "navigate",
      href: "/orders/77",
      error: "We received your payment but couldn't activate order #77 yet. Please don't pay again; contact support with reference BE-77-ref.",
    });
    expect(confirm).toHaveBeenCalledTimes(CONFIRM_ATTEMPTS);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/lib/checkout/settle-order.test.ts`
Expected: FAIL, `Failed to resolve import "./settle-order"`.

- [ ] **Step 4: Write the helper**

`src/lib/checkout/settle-order.ts`:

```ts
import {
  payWithPaystack,
  type PaystackPaymentInput,
  type PaystackResult,
} from "@/lib/paystack";
import {
  confirmPaystackPayment,
  walletPayOrder,
  type ConfirmPaystackResult,
  type WalletPayResult,
} from "@/lib/api/orders";

/**
 * What happens after /order/place has created an order, shared by food
 * checkout and /send. The API calls and the Paystack popup come in as
 * deps so every branch can be tested without a browser.
 */

export type SettleMethod =
  | "digital_payment"
  | "wallet"
  | "offline_payment"
  | "cash_on_delivery";

export type SettleInput = {
  orderId: number;
  /** total_ammount from /order/place: what Paystack is asked to capture. */
  amount: number;
  method: SettleMethod;
  /** Where the customer lands once the order is settled. */
  successHref: string;
  /** Needed to charge a card. */
  email: string | null;
  offlineMethodId: number | null;
};

export type SettleDeps = {
  payWithPaystack: (input: PaystackPaymentInput) => Promise<PaystackResult>;
  confirmPaystackPayment: (orderId: number, reference: string) => Promise<ConfirmPaystackResult>;
  walletPayOrder: (orderId: number) => Promise<WalletPayResult>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
};

export type SettleOutcome =
  /** Leave the form. Show `error` first when present. */
  | { kind: "navigate"; href: string; error?: string }
  /** Stay on the form and let the customer try again. */
  | { kind: "stay"; tone: "warn" | "error"; message: string };

/** Confirm calls after a captured Paystack payment, including the first. */
export const CONFIRM_ATTEMPTS = 4;

export const defaultSettleDeps: SettleDeps = {
  payWithPaystack,
  confirmPaystackPayment,
  walletPayOrder,
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
};

export async function settleOrder(
  input: SettleInput,
  deps: SettleDeps,
): Promise<SettleOutcome> {
  const { orderId } = input;

  // Offline orders are created at order_status 'failed' and only become
  // real once /checkout/offline/{id} submits the transfer details
  // (Order::scopeFailed hides them until then), so go straight there.
  if (input.method === "offline_payment") {
    return {
      kind: "navigate",
      href:
        `/checkout/offline/${orderId}` +
        (input.offlineMethodId ? `?method=${input.offlineMethodId}` : ""),
    };
  }

  // Placement already recorded cash on delivery; nothing to take now.
  if (input.method === "cash_on_delivery") {
    return { kind: "navigate", href: input.successHref };
  }

  if (input.method === "digital_payment") {
    if (!input.email) {
      return {
        kind: "stay",
        tone: "warn",
        message: "We need an email on file to charge a card. Add one on the Edit profile page and try again.",
      };
    }

    const reference = `BE-${orderId}-${deps.now().toString(36)}`;
    const pop = await deps.payWithPaystack({
      email: input.email,
      // Kobo, from the server's total, so every fee is included.
      amountKobo: Math.round(input.amount * 100),
      reference,
      metadata: { order_id: orderId },
    });

    if (pop.status === "cancelled") {
      return {
        kind: "stay",
        tone: "warn",
        message: `Payment cancelled. Order #${orderId} is on hold. Re-place it when you're ready.`,
      };
    }
    if (pop.status === "error") {
      return { kind: "stay", tone: "error", message: pop.message };
    }

    // The money is captured by now, so a dropped connection must not read
    // as a failed payment. The endpoint is idempotent (already_paid is 200).
    let confirm = await deps.confirmPaystackPayment(orderId, pop.reference);
    for (let attempt = 1; !confirm.ok && attempt < CONFIRM_ATTEMPTS; attempt++) {
      await deps.sleep(attempt * 1500);
      confirm = await deps.confirmPaystackPayment(orderId, pop.reference);
    }
    if (!confirm.ok) {
      return {
        kind: "navigate",
        href: `/orders/${orderId}`,
        error: `We received your payment but couldn't activate order #${orderId} yet. Please don't pay again; contact support with reference ${pop.reference}.`,
      };
    }
    return { kind: "navigate", href: input.successHref };
  }

  if (input.method === "wallet") {
    const pay = await deps.walletPayOrder(orderId);
    if (pay.ok) return { kind: "navigate", href: input.successHref };
    if (pay.reason === "insufficient") {
      return {
        kind: "stay",
        tone: "warn",
        message: "Wallet balance is too low. Top up via your DVA on the Wallet page, then re-place the order.",
      };
    }
    return { kind: "stay", tone: "error", message: pay.message || "Wallet payment failed." };
  }

  return { kind: "stay", tone: "error", message: "Please pick a payment method and try again." };
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/lib/checkout/settle-order.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 6: Switch food checkout to the helper**

In `src/components/checkout/checkout-flow.tsx`, find:

```tsx
import {
  placeOrder,
  confirmPaystackPayment,
  walletPayOrder,
} from "@/lib/api/orders";
```

Replace with:

```tsx
import { placeOrder } from "@/lib/api/orders";
```

Find:

```tsx
import { payWithPaystack } from "@/lib/paystack";
```

Replace with:

```tsx
import { defaultSettleDeps, settleOrder } from "@/lib/checkout/settle-order";
```

Then replace lines 469-568 inclusive, the whole post-placement chain inside `handlePlace`. The block starts with the line

```tsx
    // Offline payment. The order exists but is NOT real yet: /order/place
```

and ends with the line

```tsx
    toast.error("Please pick a payment method and try again.");
```

(it holds the offline redirect, the Paystack popup and confirm retry, and the wallet charge; the `if (!res.ok) { ... }` block above it and the closing `}` of `handlePlace` below it stay). Replace it with:

```tsx
    const outcome = await settleOrder(
      {
        orderId: res.orderId,
        amount: res.amount,
        method: payment,
        successHref: `/checkout/success?order_id=${res.orderId}`,
        email: address.contactPersonEmail ?? user?.email ?? null,
        offlineMethodId,
      },
      defaultSettleDeps,
    );

    if (outcome.kind === "navigate") {
      // Cleared even when the confirm failed, so a retry can't charge the
      // customer twice for the same order.
      clear();
      if (outcome.error) toast.error(outcome.error);
      router.replace(outcome.href);
      return;
    }
    setPhase(phase);
    if (outcome.tone === "warn") toast.warn(outcome.message);
    else toast.error(outcome.message);
```

Behaviour check against the old code, branch by branch: offline clears the cart and redirects with `?method=`; missing email, popup cancel, popup error, wallet short and wallet error all restore the phase and toast; confirm failure clears, toasts the reference and goes to `/orders/{id}`; success clears and goes to `/checkout/success?order_id=`. Only the cancel toast's punctuation changes.

- [ ] **Step 7: Typecheck, lint and test**

Run: `npx tsc --noEmit; npx eslint src/lib/checkout/settle-order.ts src/components/checkout/checkout-flow.tsx; npm test`
Expected: tsc clean; `settle-order.ts` clean; `checkout-flow.tsx` shows exactly the Step 1 baseline rules, each 4 lines higher (158, 239, 266) because the orders import shrinks from five lines to one; every vitest file passes.

- [ ] **Step 8: Commit**

```powershell
cd C:\laragon\www\biteexpress-web-app-parcel; git add src/lib/checkout/settle-order.ts src/lib/checkout/settle-order.test.ts src/components/checkout/checkout-flow.tsx; git commit -m "Move post-order payment handling into a shared settleOrder helper" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 7: Web, the /send building blocks

These components hold no decisions (every rule lives in Tasks 4 and 5), so their check is typecheck and lint rather than a unit test; vitest runs in node and the repo has no component tests.

**Files:**
- Create: `src/components/parcel/parcel-step.tsx`, `category-step.tsx`, `contact-fields.tsx`, `instruction-picker.tsx`, `payer-picker.tsx`, `tip-picker.tsx`, `parcel-price-card.tsx`
- Modify: `src/components/checkout/address-picker-checkout.tsx:186` (export one function)

**Interfaces:**
- Produces:
  - `ParcelStep(props: { step: 1 | 2 | 3; title: string; summary?: string | null; open: boolean; done: boolean; locked: boolean; onOpen: () => void; children: React.ReactNode })`
  - `CategoryList = { kind: "loading" } | { kind: "ready"; categories: ParcelCategory[] } | { kind: "error"; message: string }`; `CategoryStep(props: { list: CategoryList; selectedId: number | null; onSelect: (c: ParcelCategory) => void })`
  - `ContactFields(props: { idPrefix: string; value: ParcelContact; onChange: (next: ParcelContact) => void; errors: ContactErrors; showEmail: boolean })`
  - `InstructionPicker(props: { instructions: ParcelInstruction[]; selectedId: number | null; onSelect: (id: number | null) => void; note: string; onNoteChange: (note: string) => void })`
  - `PayerPicker(props: { value: ParcelPayer; onChange: (p: ParcelPayer) => void; receiverAllowed: boolean })`
  - `TIP_AMOUNTS: readonly number[]`; `TipPicker(props: { value: number; onChange: (amount: number) => void })`
  - `ParcelPriceCard(props: { quote: ParcelQuoteView; onRetry: () => void })`
  - `toCheckoutFromPicked(p: DeliveryLocation): CheckoutAddress` now exported from `address-picker-checkout.tsx`
- Consumes: Task 2 types (`ParcelCategory`, `ParcelInstruction`), Task 4 (`ParcelContact`, `ContactErrors`), Task 5 (`ParcelPayer`, `ParcelQuoteView`), `cn` from `src/lib/cn.ts`.

- [ ] **Step 1: Record the lint baseline for the one existing file**

Run: `npx eslint src/components/checkout/address-picker-checkout.tsx`
Note the output (the edit adds one keyword and must add no rule hit).

- [ ] **Step 2: Export the picked-address mapper**

In `src/components/checkout/address-picker-checkout.tsx`, find:

```tsx
function toCheckoutFromPicked(p: DeliveryLocation): CheckoutAddress {
```

Replace with:

```tsx
/** Exported for /send, whose pickup defaults to the home-page location. */
export function toCheckoutFromPicked(p: DeliveryLocation): CheckoutAddress {
```

- [ ] **Step 3: Write the step shell**

`src/components/parcel/parcel-step.tsx`:

```tsx
"use client";

import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  step: 1 | 2 | 3;
  title: string;
  /** Shown under the title while the step is collapsed. */
  summary?: string | null;
  open: boolean;
  done: boolean;
  locked: boolean;
  onOpen: () => void;
  children: React.ReactNode;
};

/**
 * One collapsible step of /send. A finished step collapses to its
 * summary and reopens when tapped; a locked step cannot open until the
 * steps before it are valid.
 */
export function ParcelStep({
  step,
  title,
  summary,
  open,
  done,
  locked,
  onOpen,
  children,
}: Props) {
  const showCheck = done && !open;
  return (
    <section
      className={cn(
        "rounded-3xl border border-ink-200 bg-white shadow-soft transition-opacity",
        locked && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={locked || open}
        aria-expanded={open}
        className="flex w-full items-center gap-4 p-5 text-left disabled:cursor-default sm:p-6"
      >
        <span
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-xs font-semibold",
            showCheck ? "bg-brand-red text-white" : "bg-canvas-sunken text-brand-red",
          )}
        >
          {showCheck ? <Check size={16} strokeWidth={2.4} /> : `0${step}`}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-serif text-xl tracking-[-0.012em] text-ink-900">
            {title}
          </span>
          {!open && summary && (
            <span className="mt-0.5 block truncate text-sm text-ink-500">{summary}</span>
          )}
        </span>
        {!open && !locked && (
          <ChevronDown size={18} className="shrink-0 text-ink-400" aria-hidden="true" />
        )}
      </button>
      {open && <div className="border-t border-ink-200/70 p-5 sm:p-6">{children}</div>}
    </section>
  );
}
```

- [ ] **Step 4: Write the category cards**

`src/components/parcel/category-step.tsx`:

```tsx
"use client";

import Image from "next/image";
import { Loader2, Package } from "lucide-react";
import type { ParcelCategory } from "@/lib/api/parcel";
import { cn } from "@/lib/cn";

export type CategoryList =
  | { kind: "loading" }
  | { kind: "ready"; categories: ParcelCategory[] }
  | { kind: "error"; message: string };

type Props = {
  list: CategoryList;
  selectedId: number | null;
  onSelect: (category: ParcelCategory) => void;
};

export function CategoryStep({ list, selectedId, onSelect }: Props) {
  if (list.kind === "loading") {
    return (
      <p className="flex items-center gap-2 text-sm text-ink-500">
        <Loader2 size={14} className="animate-spin" />
        Loading parcel types…
      </p>
    );
  }
  if (list.kind === "error") {
    return <p role="alert" className="text-sm text-error">{list.message}</p>;
  }
  if (list.categories.length === 0) {
    return (
      <p className="text-sm text-ink-500">No parcel types are set up for your area yet.</p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {list.categories.map((c) => {
        const checked = c.id === selectedId;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c)}
            aria-pressed={checked}
            className={cn(
              "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-200",
              checked
                ? "border-transparent bg-white shadow-[0_0_0_2px_rgba(222,22,0,0.5),0_18px_42px_-18px_rgba(222,22,0,0.35)]"
                : "border-ink-200 bg-white hover:-translate-y-px hover:border-brand-red/30 hover:shadow-soft",
            )}
          >
            <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-canvas-sunken text-ink-500">
              {c.image_full_url ? (
                <Image src={c.image_full_url} alt="" fill sizes="48px" className="object-cover" />
              ) : (
                <Package size={20} />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-ink-900">{c.name}</span>
              {c.description && (
                <span className="mt-0.5 line-clamp-2 block text-xs text-ink-500">
                  {c.description}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Write the contact fields**

`src/components/parcel/contact-fields.tsx`:

```tsx
"use client";

import type { ContactErrors, ParcelContact } from "@/lib/parcel/parcel-form";
import { cn } from "@/lib/cn";

type Props = {
  idPrefix: string;
  value: ParcelContact;
  onChange: (next: ParcelContact) => void;
  errors: ContactErrors;
  showEmail: boolean;
};

export function ContactFields({ idPrefix, value, onChange, errors, showEmail }: Props) {
  const set =
    (field: keyof ParcelContact) => (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ ...value, [field]: e.target.value });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field
        id={`${idPrefix}-name`}
        label="Contact name"
        value={value.name}
        onChange={set("name")}
        error={errors.name}
        autoComplete="name"
      />
      <Field
        id={`${idPrefix}-phone`}
        label="Phone"
        value={value.phone}
        onChange={set("phone")}
        error={errors.phone}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="0801 234 5678"
      />
      {showEmail && (
        <Field
          id={`${idPrefix}-email`}
          label="Email (optional)"
          value={value.email}
          onChange={set("email")}
          error={errors.email}
          type="email"
          autoComplete="email"
        />
      )}
      <Field id={`${idPrefix}-house`} label="House (optional)" value={value.house} onChange={set("house")} />
      <Field id={`${idPrefix}-floor`} label="Floor (optional)" value={value.floor} onChange={set("floor")} />
      <Field id={`${idPrefix}-road`} label="Road (optional)" value={value.road} onChange={set("road")} />
    </div>
  );
}

function Field({
  id,
  label,
  error,
  ...input
}: { id: string; label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-500">
        {label}
      </label>
      <input
        id={id}
        {...input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "h-11 w-full rounded-xl border bg-white px-3 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-red/50 focus:ring-2 focus:ring-brand-red/20",
          error ? "border-error" : "border-ink-200",
        )}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Write the instruction, payer and tip pickers**

`src/components/parcel/instruction-picker.tsx`:

```tsx
"use client";

import type { ParcelInstruction } from "@/lib/api/parcel";
import { cn } from "@/lib/cn";

type Props = {
  instructions: ParcelInstruction[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  note: string;
  onNoteChange: (note: string) => void;
};

/**
 * Preset rider instructions plus a free note, sent together as one
 * delivery instruction. Tapping the selected preset clears it.
 */
export function InstructionPicker({ instructions, selectedId, onSelect, note, onNoteChange }: Props) {
  return (
    <div className="space-y-3">
      {instructions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {instructions.map((i) => {
            const active = i.id === selectedId;
            return (
              <button
                key={i.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? null : i.id)}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-pill border px-4 py-2 text-sm font-medium transition-all duration-200",
                  active
                    ? "border-transparent bg-ink-900 text-white"
                    : "border-ink-200 bg-white text-ink-900 hover:border-brand-red/30 hover:text-brand-red",
                )}
              >
                {i.instruction}
              </button>
            );
          })}
        </div>
      )}
      <div>
        <label htmlFor="parcel-note" className="mb-1 block text-xs font-medium uppercase tracking-wider text-ink-500">
          Note for the rider (optional)
        </label>
        <textarea
          id="parcel-note"
          rows={2}
          maxLength={200}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="For example: call when you arrive"
          className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 outline-none placeholder:text-ink-400 focus:border-brand-red/50 focus:ring-2 focus:ring-brand-red/20"
        />
      </div>
    </div>
  );
}
```

`src/components/parcel/payer-picker.tsx`:

```tsx
"use client";

import type { ParcelPayer } from "@/lib/parcel/parcel-payment";
import { cn } from "@/lib/cn";

const OPTIONS: Array<{ id: ParcelPayer; label: string; hint: string }> = [
  { id: "sender", label: "Me", hint: "Pay now, online or from your wallet." },
  { id: "receiver", label: "Receiver", hint: "The receiver pays the rider in cash on delivery." },
];

type Props = {
  value: ParcelPayer;
  onChange: (payer: ParcelPayer) => void;
  receiverAllowed: boolean;
};

export function PayerPicker({ value, onChange, receiverAllowed }: Props) {
  const options = OPTIONS.filter((o) => o.id === "sender" || receiverAllowed);
  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Who pays" className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const checked = o.id === value;
          return (
            <label
              key={o.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all duration-200",
                checked
                  ? "border-transparent bg-white shadow-[0_0_0_2px_rgba(222,22,0,0.5),0_18px_42px_-18px_rgba(222,22,0,0.35)]"
                  : "border-ink-200 bg-white hover:-translate-y-px hover:border-brand-red/30 hover:shadow-soft",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  checked ? "border-brand-red bg-brand-red" : "border-ink-300 bg-white",
                )}
              >
                {checked && <span className="h-2 w-2 rounded-full bg-white" />}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink-900">{o.label}</span>
                <span className="mt-0.5 block text-xs text-ink-500">{o.hint}</span>
              </span>
              <input
                type="radio"
                name="parcel-payer"
                checked={checked}
                onChange={() => onChange(o.id)}
                className="sr-only"
              />
            </label>
          );
        })}
      </div>
      {!receiverAllowed && (
        <p className="text-xs text-ink-500">
          Cash on delivery is off in this area, so the receiver can&apos;t pay for this parcel.
        </p>
      )}
    </div>
  );
}
```

`src/components/parcel/tip-picker.tsx`:

```tsx
"use client";

/** The same amounts and look as the tip control on /checkout. */
export const TIP_AMOUNTS: readonly number[] = [0, 200, 500, 1000];

type Props = {
  value: number;
  onChange: (amount: number) => void;
};

export function TipPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {TIP_AMOUNTS.map((amt) => {
        const active = value === amt;
        return (
          <button
            key={amt}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(amt)}
            className={
              "inline-flex h-11 items-center justify-center rounded-pill border px-5 text-sm font-medium transition-all duration-200 " +
              (active
                ? "border-transparent bg-ink-900 text-white shadow-[0_8px_22px_-8px_rgba(13,13,15,0.55)]"
                : "border-ink-200 bg-white text-ink-900 hover:-translate-y-px hover:border-brand-red/30 hover:text-brand-red hover:shadow-soft")
            }
          >
            {amt === 0 ? "No tip" : `₦${amt.toLocaleString()}`}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 7: Write the price card**

`src/components/parcel/parcel-price-card.tsx`:

```tsx
"use client";

import { Loader2, RotateCw } from "lucide-react";
import type { ParcelQuoteView } from "@/lib/parcel/parcel-payment";

type Props = {
  quote: ParcelQuoteView;
  onRetry: () => void;
};

/**
 * Every figure here is read from the get-Tax preview; the web adds
 * nothing up. The delivery row already includes any surge.
 */
export function ParcelPriceCard({ quote, onRetry }: Props) {
  return (
    <div className="overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-card">
      <div className="border-b border-ink-200/70 px-5 pb-3 pt-5">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-500">
          Price
        </p>
      </div>
      <div className="bg-canvas-sunken/50 p-5 text-sm">
        {quote.kind === "ready" && (
          <dl className="space-y-2.5">
            <Row label="Delivery" value={quote.quote.deliveryCharge} free={quote.quote.deliveryCharge === 0} />
            {quote.quote.additionalCharge > 0 && (
              <Row label="Service charge" value={quote.quote.additionalCharge} />
            )}
            {quote.quote.taxAmount > 0 && <Row label="VAT" value={quote.quote.taxAmount} />}
            {quote.quote.dmTips > 0 && <Row label="Rider tip" value={quote.quote.dmTips} />}
            <div className="flex items-center justify-between border-t border-ink-200/70 pt-3 text-base font-semibold text-ink-900">
              <dt>Total to pay</dt>
              <dd>₦{Math.round(quote.quote.total).toLocaleString()}</dd>
            </div>
          </dl>
        )}
        {quote.kind === "loading" && (
          <p className="flex items-center gap-2 text-ink-500">
            <Loader2 size={13} className="animate-spin" />
            Working out the price
          </p>
        )}
        {quote.kind === "error" && (
          <div className="space-y-3">
            <p role="alert" className="text-error">{quote.message}</p>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-10 items-center gap-2 rounded-pill border border-ink-200 bg-white px-4 text-sm font-medium text-ink-900 transition-colors hover:border-brand-red/30 hover:text-brand-red"
            >
              <RotateCw size={14} />
              Try again
            </button>
          </div>
        )}
        {quote.kind === "idle" && (
          <p className="text-ink-500">Finish the steps to see the price.</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, free = false }: { label: string; value: number; free?: boolean }) {
  return (
    <div className="flex items-center justify-between text-ink-700">
      <dt>{label}</dt>
      <dd className="font-medium text-ink-900">
        {free ? "Free" : `₦${Math.round(value).toLocaleString()}`}
      </dd>
    </div>
  );
}
```

- [ ] **Step 8: Typecheck and lint**

Run: `npx tsc --noEmit; npx eslint src/components/parcel src/components/checkout/address-picker-checkout.tsx`
Expected: tsc clean; nothing reported for `src/components/parcel`; `address-picker-checkout.tsx` matches its Step 1 baseline.

- [ ] **Step 9: Commit**

```powershell
cd C:\laragon\www\biteexpress-web-app-parcel; git add src/components/parcel src/components/checkout/address-picker-checkout.tsx; git commit -m "Add the building blocks of the send-a-parcel page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 8: Web, the /send flow and route

Wiring only: every decision is a Task 4 or Task 5 function with its own tests. The check is typecheck, lint and build; Task 13 exercises it in a browser.

**Files:**
- Create: `src/components/parcel/send-parcel-flow.tsx`, `src/app/send/page.tsx`

**Interfaces:**
- Produces: `SendParcelFlow()` (client component); route `/send`.
- Consumes: everything from Tasks 2 to 7, plus `useLocation`, `useAuth`, `fetchProfile`, `checkZone`, `fetchOfflineMethods`, `canUseOfflinePayment`, `normalizePhone`, `toast`, `NoLocation`, `AddressPicker`, `AddressPickerCheckout`, `PaymentPicker`, `RouteGuard`, `Container`.

- [ ] **Step 1: Write the flow**

`src/components/parcel/send-parcel-flow.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, MapPin, Package } from "lucide-react";
import { useLocation } from "@/lib/location-store";
import { useAuth } from "@/lib/auth-store";
import { fetchProfile } from "@/lib/api/auth";
import { checkZone, type ZoneCheck } from "@/lib/api/zones";
import { fetchConfig, type AppConfig } from "@/lib/api/config";
import { fetchOfflineMethods } from "@/lib/api/offline-payment";
import {
  fetchParcelCategories,
  fetchParcelInstructions,
  type ParcelCategory,
  type ParcelInstruction,
} from "@/lib/api/parcel";
import { fetchRoadDistanceKm, parcelDistanceKm } from "@/lib/api/directions";
import { fetchParcelQuote, type OrderQuoteResult } from "@/lib/api/order-quote";
import { placeParcelOrder, type PlaceParcelOrderInput } from "@/lib/api/orders";
import {
  canUseOfflinePayment,
  type OfflinePaymentMethod,
} from "@/lib/offline-payment-rules";
import { defaultSettleDeps, settleOrder } from "@/lib/checkout/settle-order";
import { normalizePhone } from "@/lib/phone";
import { toast } from "@/lib/toast";
import {
  EMPTY_CONTACT,
  buildReceiverDetails,
  deliveryInstruction,
  dropoffZoneResult,
  furthestStep,
  hasErrors,
  parcelModuleIn,
  pickupZoneResult,
  validateContact,
  type DropoffZone,
  type ParcelContact,
  type ParcelPoint,
  type PickupZone,
  type StepNumber,
} from "@/lib/parcel/parcel-form";
import {
  allowedMethods,
  allowedPayers,
  effectivePayer,
  effectivePayment,
  parcelPlaceErrorMessage,
  parcelQuoteKey,
  placeBlocker,
  walletShortfall,
  type ParcelPayer,
  type ParcelPaymentMethod,
  type ParcelQuoteView,
  type PaymentGates,
} from "@/lib/parcel/parcel-payment";
import { NoLocation } from "@/components/browse/no-location";
import { AddressPicker } from "@/components/address/address-picker";
import {
  AddressPickerCheckout,
  toCheckoutFromPicked,
  type CheckoutAddress,
} from "@/components/checkout/address-picker-checkout";
import { PaymentPicker, type PaymentMethod } from "@/components/checkout/payment-picker";
import { ParcelStep } from "./parcel-step";
import { CategoryStep, type CategoryList } from "./category-step";
import { ContactFields } from "./contact-fields";
import { InstructionPicker } from "./instruction-picker";
import { PayerPicker } from "./payer-picker";
import { TipPicker } from "./tip-picker";
import { ParcelPriceCard } from "./parcel-price-card";

/**
 * A result tagged with the inputs it was fetched for. When the key no
 * longer matches the current inputs the result is stale and reads as
 * "still loading", so no effect ever has to reset state synchronously.
 */
type Keyed<T> = { key: string; value: T };

/**
 * /send. Three steps: what is being sent, pickup and drop-off, review
 * and pay. Every address is zone-checked when picked; the price comes
 * from the get-Tax preview for the current inputs, and "Place order"
 * stays disabled until that preview has landed.
 */
export function SendParcelFlow() {
  const router = useRouter();
  const hydrateLoc = useLocation((s) => s.hydrate);
  const locHydrated = useLocation((s) => s.hydrated);
  const stored = useLocation((s) => s.location);
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);

  const [area, setArea] = useState<Keyed<ZoneCheck> | null>(null);
  const [categories, setCategories] = useState<Keyed<CategoryList> | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [offlineMethods, setOfflineMethods] = useState<OfflinePaymentMethod[]>([]);
  const [instructions, setInstructions] = useState<ParcelInstruction[]>([]);

  const [category, setCategory] = useState<ParcelCategory | null>(null);
  const [pickupChoice, setPickupChoice] = useState<CheckoutAddress | null>(null);
  const [senderDraft, setSenderDraft] = useState<Partial<ParcelContact>>({});
  const [dropoff, setDropoff] = useState<ParcelPoint | null>(null);
  const [receiver, setReceiver] = useState<ParcelContact>(EMPTY_CONTACT);
  const [showErrors, setShowErrors] = useState(false);
  const [pickupCheck, setPickupCheck] = useState<Keyed<PickupZone> | null>(null);
  const [dropCheck, setDropCheck] = useState<Keyed<DropoffZone> | null>(null);
  const [road, setRoad] = useState<Keyed<number | null> | null>(null);

  const [instructionId, setInstructionId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [payerChoice, setPayerChoice] = useState<ParcelPayer>("sender");
  const [paymentChoice, setPaymentChoice] = useState<ParcelPaymentMethod | null>(null);
  const [offlineMethodId, setOfflineMethodId] = useState<number | null>(null);
  const [tip, setTip] = useState(0);
  const [quote, setQuote] = useState<Keyed<OrderQuoteResult> | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [openStep, setOpenStep] = useState<StepNumber>(1);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    hydrateLoc();
  }, [hydrateLoc]);

  // Fresh wallet balance, as checkout does.
  useEffect(() => {
    if (!token) return;
    fetchProfile().then((res) => {
      if (res.ok) setUser(res.user);
    });
  }, [token, setUser]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchConfig(), fetchOfflineMethods(), fetchParcelInstructions()]).then(
      ([cfg, methods, instr]) => {
        if (cancelled) return;
        setConfig(cfg.ok ? cfg.config : null);
        setOfflineMethods(methods.ok ? methods.methods : []);
        setInstructions(instr.ok ? instr.instructions : []);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Which parcel module the customer's current location offers.
  const storedLat = stored?.lat;
  const storedLng = stored?.lng;
  const areaKey = stored ? `${stored.lat},${stored.lng}` : null;
  useEffect(() => {
    if (storedLat === undefined || storedLng === undefined) return;
    let cancelled = false;
    const key = `${storedLat},${storedLng}`;
    checkZone(storedLat, storedLng).then((check) => {
      if (!cancelled) setArea({ key, value: check });
    });
    return () => {
      cancelled = true;
    };
  }, [storedLat, storedLng]);
  const areaCheck = area && area.key === areaKey ? area.value : null;
  const parcelModule = areaCheck?.kind === "in-zone" ? parcelModuleIn(areaCheck.zones) : null;
  const moduleId = parcelModule?.moduleId ?? null;

  useEffect(() => {
    if (moduleId === null) return;
    let cancelled = false;
    fetchParcelCategories(moduleId).then((res) => {
      if (cancelled) return;
      setCategories({
        key: String(moduleId),
        value: res.ok
          ? { kind: "ready", categories: res.categories }
          : { kind: "error", message: res.message },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [moduleId]);
  const categoryList: CategoryList =
    categories && categories.key === String(moduleId) ? categories.value : { kind: "loading" };

  // Pickup: the current delivery location until the customer picks a
  // saved address. Contact from the profile until they edit it.
  const pickupAddress: CheckoutAddress | null =
    pickupChoice ?? (stored ? toCheckoutFromPicked(stored) : null);
  const pickup: ParcelPoint | null = pickupAddress
    ? {
        text: pickupAddress.text,
        lat: pickupAddress.lat,
        lng: pickupAddress.lng,
        addressType: pickupAddress.addressType,
      }
    : null;
  const profileName = user ? [user.f_name, user.l_name].filter(Boolean).join(" ") : "";
  const sender: ParcelContact = {
    ...EMPTY_CONTACT,
    name: profileName,
    phone: user?.phone ?? "",
    ...senderDraft,
  };

  const pickupLat = pickup?.lat;
  const pickupLng = pickup?.lng;
  const pickupKey = pickup && moduleId !== null ? `${pickup.lat},${pickup.lng}|${moduleId}` : null;
  useEffect(() => {
    if (pickupLat === undefined || pickupLng === undefined || moduleId === null) return;
    let cancelled = false;
    const key = `${pickupLat},${pickupLng}|${moduleId}`;
    checkZone(pickupLat, pickupLng).then((check) => {
      if (!cancelled) setPickupCheck({ key, value: pickupZoneResult(check, moduleId) });
    });
    return () => {
      cancelled = true;
    };
  }, [pickupLat, pickupLng, moduleId]);
  const pickupZone = pickupCheck && pickupCheck.key === pickupKey ? pickupCheck.value : null;

  const dropLat = dropoff?.lat;
  const dropLng = dropoff?.lng;
  const dropKey = dropoff ? `${dropoff.lat},${dropoff.lng}` : null;
  useEffect(() => {
    if (dropLat === undefined || dropLng === undefined) return;
    let cancelled = false;
    const key = `${dropLat},${dropLng}`;
    checkZone(dropLat, dropLng).then((check) => {
      if (!cancelled) setDropCheck({ key, value: dropoffZoneResult(check) });
    });
    return () => {
      cancelled = true;
    };
  }, [dropLat, dropLng]);
  const dropZone = dropCheck && dropCheck.key === dropKey ? dropCheck.value : null;

  // Road distance for the leg, asked for only once both ends are served
  // (the proxy is a paid Google call). Straight line when it fails.
  const legReady = pickupZone?.ok === true && dropZone?.ok === true;
  const legKey = pickup && dropoff ? `${pickup.lat},${pickup.lng}>${dropoff.lat},${dropoff.lng}` : null;
  useEffect(() => {
    if (!legReady) return;
    if (pickupLat === undefined || pickupLng === undefined) return;
    if (dropLat === undefined || dropLng === undefined) return;
    let cancelled = false;
    const key = `${pickupLat},${pickupLng}>${dropLat},${dropLng}`;
    fetchRoadDistanceKm({ lat: pickupLat, lng: pickupLng }, { lat: dropLat, lng: dropLng }).then(
      (km) => {
        if (!cancelled) setRoad({ key, value: km });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [legReady, pickupLat, pickupLng, dropLat, dropLng]);
  const distance =
    pickup && dropoff && road && road.key === legKey
      ? parcelDistanceKm(road.value, pickup, dropoff)
      : null;

  const senderErrors = validateContact(pickup, sender);
  const receiverErrors = validateContact(dropoff, receiver);
  const addressesValid =
    !hasErrors(senderErrors) && !hasErrors(receiverErrors) && legReady;
  const maxStep = furthestStep(category !== null, addressesValid);
  const currentStep: StepNumber = openStep <= maxStep ? openStep : maxStep;

  const gates: PaymentGates | null =
    pickupZone && pickupZone.ok
      ? {
          cashOnDelivery: config?.cash_on_delivery ?? false,
          // A config hiccup must not hide the main way to pay; the
          // backend still enforces the switch.
          digitalPayment: config?.digital_payment ?? true,
          zone: pickupZone.zone,
          offlineUsable: canUseOfflinePayment({
            offlinePaymentStatus: config?.offline_payment_status ?? 0,
            zoneOfflinePayment: pickupZone.zone.offline_payment,
            methods: offlineMethods,
          }),
        }
      : null;
  const payer: ParcelPayer = gates ? effectivePayer(payerChoice, gates) : "sender";
  const payment: ParcelPaymentMethod | null = gates
    ? effectivePayment(payer, paymentChoice, gates)
    : null;
  const senderMethods: PaymentMethod[] = gates
    ? allowedMethods("sender", gates).filter(
        (m): m is PaymentMethod => m !== "cash_on_delivery",
      )
    : [];
  // Placement drops the tip when tips are off; the preview would not.
  const tipsEnabled = config?.dm_tips_status === 1;
  const effectiveTip = tipsEnabled ? tip : 0;
  const chosenOfflineMethodId = offlineMethodId ?? offlineMethods[0]?.id ?? null;
  const instructionText = instructions.find((i) => i.id === instructionId)?.instruction ?? null;

  const orderInput: PlaceParcelOrderInput | null =
    category &&
    pickup &&
    dropoff &&
    pickupZone &&
    pickupZone.ok &&
    dropZone &&
    dropZone.ok &&
    moduleId !== null &&
    distance !== null &&
    payment !== null &&
    addressesValid
      ? {
          moduleId,
          zoneIds: pickupZone.zoneIds,
          pickup,
          sender: {
            name: sender.name.trim(),
            phone: normalizePhone(sender.phone) ?? sender.phone.trim(),
            email: user?.email ?? null,
            house: sender.house.trim(),
            floor: sender.floor.trim(),
            road: sender.road.trim(),
          },
          receiverDetails: buildReceiverDetails(dropoff, receiver, dropZone.zoneId),
          distance,
          parcelCategoryId: category.id,
          chargePayer: payer,
          paymentMethod: payment,
          dmTips: effectiveTip,
          deliveryInstruction: deliveryInstruction(instructionText, note),
        }
      : null;

  const quoteKey =
    orderInput && dropoff
      ? `${parcelQuoteKey({
          categoryId: orderInput.parcelCategoryId,
          pickup: orderInput.pickup,
          dropoff,
          distanceKm: orderInput.distance,
          payer,
          tip: effectiveTip,
        })}#${retryNonce}`
      : null;

  useEffect(() => {
    if (!quoteKey || !orderInput) return;
    let cancelled = false;
    const key = quoteKey;
    fetchParcelQuote(orderInput).then((res) => {
      if (!cancelled) setQuote({ key, value: res });
    });
    return () => {
      cancelled = true;
    };
    // The key carries every input the price depends on. orderInput is a
    // fresh object each render and would refetch on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  const quoteView: ParcelQuoteView = !quoteKey
    ? { kind: "idle" }
    : !quote || quote.key !== quoteKey
      ? { kind: "loading" }
      : quote.value.ok
        ? { kind: "ready", quote: quote.value.quote }
        : { kind: "error", message: quote.value.message };

  const walletBalance = user?.wallet_balance ?? null;
  const blocker = placeBlocker({
    stepsValid: orderInput !== null,
    quote: quoteView,
    payment,
    walletBalance,
  });
  const shortfall =
    payment === "wallet" && quoteView.kind === "ready"
      ? walletShortfall(quoteView.quote.total, walletBalance)
      : 0;

  function chooseCategory(c: ParcelCategory) {
    setCategory(c);
    setOpenStep(2);
  }

  function choosePickup(a: CheckoutAddress) {
    setPickupChoice(a);
    setSenderDraft((d) => ({
      ...d,
      ...(a.contactPersonName ? { name: a.contactPersonName } : {}),
      ...(a.contactPersonNumber ? { phone: a.contactPersonNumber } : {}),
    }));
  }

  function continueToReview() {
    setShowErrors(true);
    if (addressesValid) setOpenStep(3);
  }

  async function handlePlace() {
    if (!orderInput || blocker !== null || placing) return;
    const email = user?.email ?? null;
    if (orderInput.paymentMethod === "digital_payment" && !email) {
      toast.warn(
        "We need an email on file to charge a card. Add one on the Edit profile page and try again.",
      );
      return;
    }

    setPlacing(true);
    const res = await placeParcelOrder(orderInput);
    if (!res.ok) {
      setPlacing(false);
      toast.error(parcelPlaceErrorMessage(res.code, orderInput.paymentMethod, res.message));
      return;
    }

    const outcome = await settleOrder(
      {
        orderId: res.orderId,
        amount: res.amount,
        method: orderInput.paymentMethod,
        successHref: `/orders/${res.orderId}`,
        email,
        offlineMethodId: chosenOfflineMethodId,
      },
      defaultSettleDeps,
    );
    if (outcome.kind === "navigate") {
      if (outcome.error) toast.error(outcome.error);
      router.replace(outcome.href);
      return;
    }
    setPlacing(false);
    if (outcome.tone === "warn") toast.warn(outcome.message);
    else toast.error(outcome.message);
  }

  if (!locHydrated) return <CenterSpinner label="Loading…" />;
  if (!stored || !stored.zoneCheck) return <NoLocation reason="no-pick" />;
  if (stored.zoneCheck.status === "out-of-zone") return <NoLocation reason="out-of-zone" />;
  if (stored.zoneCheck.status === "temp-unavailable") return <NoLocation reason="temp-unavailable" />;
  if (!areaCheck) return <CenterSpinner label="Checking your area…" />;
  if (areaCheck.kind === "error" || areaCheck.kind === "skipped") return <AreaError />;
  if (moduleId === null) return <NotAvailable />;

  const stepTwoSummary = pickup && dropoff ? `${pickup.text} to ${dropoff.text}` : null;

  return (
    <div className="fade-up grid gap-8 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-4">
        <ParcelStep
          step={1}
          title="What you're sending"
          summary={category?.name ?? null}
          open={currentStep === 1}
          done={category !== null}
          locked={false}
          onOpen={() => setOpenStep(1)}
        >
          <CategoryStep
            list={categoryList}
            selectedId={category?.id ?? null}
            onSelect={chooseCategory}
          />
        </ParcelStep>

        <ParcelStep
          step={2}
          title="Pickup and drop-off"
          summary={stepTwoSummary}
          open={currentStep === 2}
          done={addressesValid}
          locked={maxStep < 2}
          onOpen={() => setOpenStep(2)}
        >
          <div className="space-y-8">
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
                <MapPin size={14} />
                Pickup
              </h3>
              <AddressPickerCheckout picked={stored} value={pickupAddress} onChange={choosePickup} />
              <ZoneNote
                checking={pickupKey !== null && pickupZone === null}
                error={pickupZone && !pickupZone.ok ? pickupZone.message : null}
              />
              <div className="mt-4">
                <ContactFields
                  idPrefix="sender"
                  value={sender}
                  onChange={setSenderDraft}
                  errors={showErrors ? senderErrors : {}}
                  showEmail={false}
                />
              </div>
            </div>

            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
                <Package size={14} />
                Drop-off
              </h3>
              <AddressPicker
                variant="light"
                persistToStore={false}
                onPick={(loc) =>
                  setDropoff({
                    text: loc.formattedAddress,
                    lat: loc.lat,
                    lng: loc.lng,
                    addressType: "Delivery",
                  })
                }
              />
              {dropoff && <p className="mt-2 text-sm text-ink-600">{dropoff.text}</p>}
              {showErrors && receiverErrors.address && (
                <p role="alert" className="mt-2 text-sm text-error">
                  {receiverErrors.address}
                </p>
              )}
              <ZoneNote
                checking={dropKey !== null && dropZone === null}
                error={dropZone && !dropZone.ok ? dropZone.message : null}
              />
              <div className="mt-4">
                <ContactFields
                  idPrefix="receiver"
                  value={receiver}
                  onChange={setReceiver}
                  errors={showErrors ? receiverErrors : {}}
                  showEmail
                />
              </div>
            </div>

            <button
              type="button"
              onClick={continueToReview}
              className="btn-flame inline-flex h-12 items-center justify-center gap-2 rounded-pill px-6 text-sm font-medium text-white"
            >
              Continue
              <ArrowRight size={15} strokeWidth={2.2} />
            </button>
          </div>
        </ParcelStep>

        <ParcelStep
          step={3}
          title="Review and pay"
          open={currentStep === 3}
          done={false}
          locked={maxStep < 3}
          onOpen={() => setOpenStep(3)}
        >
          <div className="space-y-8">
            <Block title="Instructions for the rider">
              <InstructionPicker
                instructions={instructions}
                selectedId={instructionId}
                onSelect={setInstructionId}
                note={note}
                onNoteChange={setNote}
              />
            </Block>
            <Block title="Who pays">
              <PayerPicker
                value={payer}
                onChange={setPayerChoice}
                receiverAllowed={gates !== null && allowedPayers(gates).includes("receiver")}
              />
            </Block>
            <Block title="Payment">
              {payer === "receiver" ? (
                <p className="rounded-2xl border border-ink-200 bg-canvas-sunken p-4 text-sm text-ink-700">
                  The receiver pays the rider in cash when the parcel arrives.
                </p>
              ) : (
                <PaymentPicker
                  value={payment && payment !== "cash_on_delivery" ? payment : null}
                  onChange={setPaymentChoice}
                  allow={senderMethods}
                  walletBalance={walletBalance}
                  orderTotal={quoteView.kind === "ready" ? quoteView.quote.total : null}
                  offlineEnabled={senderMethods.includes("offline_payment")}
                  offlineMethods={offlineMethods}
                  offlineMethodId={chosenOfflineMethodId}
                  onOfflineMethodChange={setOfflineMethodId}
                />
              )}
            </Block>
            {tipsEnabled && (
              <Block title="Tip your rider">
                <TipPicker value={tip} onChange={setTip} />
              </Block>
            )}
          </div>
        </ParcelStep>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <ParcelPriceCard quote={quoteView} onRetry={() => setRetryNonce((n) => n + 1)} />
        <button
          type="button"
          onClick={handlePlace}
          disabled={placing || blocker !== null}
          className="btn-flame inline-flex h-14 w-full items-center justify-center gap-2 rounded-pill px-7 text-base font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {placing ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Placing your parcel…
            </>
          ) : (
            <>
              <Package size={16} />
              Place order
              <ArrowRight size={16} strokeWidth={2.2} />
            </>
          )}
        </button>
        {!placing && blocker && (
          <p className="text-center text-xs leading-relaxed text-ink-500">{blocker}</p>
        )}
        {shortfall > 0 && (
          <div className="rounded-2xl border border-error/30 bg-error/5 p-4 text-sm leading-relaxed text-ink-700">
            Top up on the{" "}
            <Link href="/wallet" className="font-medium text-brand-red underline">
              Wallet page
            </Link>
            , or pick another way to pay.
          </div>
        )}
      </aside>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-ink-900">{title}</h3>
      {children}
    </div>
  );
}

function ZoneNote({ checking, error }: { checking: boolean; error: string | null }) {
  if (checking) {
    return (
      <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-500">
        <Loader2 size={12} className="animate-spin" />
        Checking this address…
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="mt-2 text-sm text-error">
        {error}
      </p>
    );
  }
  return null;
}

function NotAvailable() {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-ink-200 bg-white p-8 text-center shadow-soft">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ink-100 text-ink-600">
        <Package size={20} strokeWidth={1.8} />
      </div>
      <h2 className="mt-4 font-serif text-2xl text-ink-900">
        Parcel delivery isn&apos;t available in your area yet
      </h2>
      <p className="mt-2 text-sm text-ink-600">You can still order from shops near you.</p>
      <Link
        href="/browse"
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-brand-red px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-red-600"
      >
        Browse shops
      </Link>
    </div>
  );
}

function AreaError() {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-ink-200 bg-white p-8 text-center shadow-soft">
      <h2 className="font-serif text-2xl text-ink-900">We couldn&apos;t check your area</h2>
      <p className="mt-2 text-sm text-ink-600">Refresh the page to try again.</p>
    </div>
  );
}

function CenterSpinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-[30vh] items-center justify-center gap-2 text-ink-500">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}
```

- [ ] **Step 2: Write the route**

`src/app/send/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { RouteGuard } from "@/components/auth/route-guard";
import { SendParcelFlow } from "@/components/parcel/send-parcel-flow";

export const metadata: Metadata = {
  title: "Send a parcel",
};

export default function SendPage() {
  return (
    <section className="aurora-bg relative isolate py-12 md:py-16">
      <Container>
        <header className="fade-up mb-8">
          <span className="inline-flex items-center gap-2 rounded-pill border border-ink-200 bg-white/80 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-ink-700 backdrop-blur">
            Parcel
          </span>
          <h1 className="mt-4 font-serif text-display-lg text-ink-900 md:text-display-xl">
            Send a parcel
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-600 md:text-lg">
            A rider collects it and drops it across town. You see the full price before you pay.
          </p>
        </header>
        <RouteGuard>
          <SendParcelFlow />
        </RouteGuard>
      </Container>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck, lint and build**

Run: `npx tsc --noEmit; npx eslint src/components/parcel src/app/send; npm run build`
Expected: tsc clean; eslint prints nothing (in particular no `react-hooks/set-state-in-effect`: every setter in an effect runs in a `.then`); the build lists `/send`. If lint reports `react-hooks/set-state-in-effect`, move that setter into the promise callback or derive the value from a key; do not add a disable comment for it.

- [ ] **Step 4: Commit**

```powershell
cd C:\laragon\www\biteexpress-web-app-parcel; git add src/components/parcel/send-parcel-flow.tsx src/app/send/page.tsx; git commit -m "Let signed-in customers send a parcel from /send" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 9: Web, the module picker entry

**Files:**
- Create: `src/lib/module-entry.ts`, `src/lib/module-entry.test.ts`
- Modify: `src/components/browse/module-picker.tsx:8` (imports), `:91-99`, `:121`, `:133`

**Interfaces:**
- Produces: `ModuleEntry = { href: string; subtitle: string; showCount: boolean }`; `moduleEntry(m: Pick<Module, "id" | "module_type" | "stores_count">): ModuleEntry`
- Consumes: `Module` (`src/lib/api/modules.ts`).

- [ ] **Step 1: Record the lint baseline**

Run: `npx eslint src/components/browse/module-picker.tsx`
Expected today: `react-hooks/set-state-in-effect` at 39:7 and `react/no-unescaped-entities` at 77:44. Note the output.

- [ ] **Step 2: Write the failing test**

`src/lib/module-entry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { moduleEntry } from "./module-entry";

describe("moduleEntry", () => {
  it("sends the parcel module to /send, with no shop count", () => {
    expect(moduleEntry({ id: 6, module_type: "parcel", stores_count: 0 })).toEqual({
      href: "/send",
      subtitle: "Send a package across town",
      showCount: false,
    });
  });

  it("keeps shop modules on /browse/{id} with their count", () => {
    expect(moduleEntry({ id: 1, module_type: "food", stores_count: 12 })).toEqual({
      href: "/browse/1",
      subtitle: "Explore 12 shops",
      showCount: true,
    });
  });

  it("marks a shop module with no shops as coming soon", () => {
    expect(moduleEntry({ id: 2, module_type: "grocery", stores_count: 0 })).toEqual({
      href: "/browse/2",
      subtitle: "Coming soon",
      showCount: false,
    });
    expect(moduleEntry({ id: 3, module_type: "pharmacy" }).subtitle).toBe("Coming soon");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/lib/module-entry.test.ts`
Expected: FAIL, `Failed to resolve import "./module-entry"`.

- [ ] **Step 4: Write the implementation**

`src/lib/module-entry.ts`:

```ts
import type { Module } from "@/lib/api/modules";

export type ModuleEntry = { href: string; subtitle: string; showCount: boolean };

/**
 * Where a module card on /browse leads. The parcel module has no shops,
 * so it goes to /send instead of a store list. It only reaches this list
 * when a zone offers it, because /api/v1/module is filtered by zone.
 */
export function moduleEntry(m: Pick<Module, "id" | "module_type" | "stores_count">): ModuleEntry {
  if (m.module_type === "parcel") {
    return { href: "/send", subtitle: "Send a package across town", showCount: false };
  }
  const count = m.stores_count ?? 0;
  return {
    href: `/browse/${m.id}`,
    subtitle: count > 0 ? `Explore ${count} shops` : "Coming soon",
    showCount: count > 0,
  };
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/lib/module-entry.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Use it in the module picker**

In `src/components/browse/module-picker.tsx`, find:

```tsx
import { fetchModules, type Module } from "@/lib/api/modules";
```

Replace with:

```tsx
import { fetchModules, type Module } from "@/lib/api/modules";
import { moduleEntry } from "@/lib/module-entry";
```

Find:

```tsx
function ModuleCard({ module: m }: { module: Module }) {
  const count = m.stores_count ?? 0;
  const hasStores = count > 0;
  return (
    <Link
      href={`/browse/${m.id}`}
```

Replace with:

```tsx
function ModuleCard({ module: m }: { module: Module }) {
  const count = m.stores_count ?? 0;
  const entry = moduleEntry(m);
  return (
    <Link
      href={entry.href}
```

Find:

```tsx
        {hasStores && (
```

Replace with:

```tsx
        {entry.showCount && (
```

Find:

```tsx
            {hasStores ? `Explore ${count} shops` : "Coming soon"}
```

Replace with:

```tsx
            {entry.subtitle}
```

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit; npx eslint src/lib/module-entry.ts src/components/browse/module-picker.tsx`
Expected: tsc clean; `module-entry.ts` clean; `module-picker.tsx` shows exactly the Step 1 baseline.

- [ ] **Step 8: Commit**

```powershell
cd C:\laragon\www\biteexpress-web-app-parcel; git add src/lib/module-entry.ts src/lib/module-entry.test.ts src/components/browse/module-picker.tsx; git commit -m "Open the parcel module on /send from the module picker" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 10: Web, parcel-aware order page

**Files:**
- Create: `src/lib/parcel/parcel-order.ts`, `src/lib/parcel/parcel-order.test.ts`
- Modify: `src/components/orders/order-detail-view.tsx:6-16`, `:47`, `:68-82`, `:258-274`, `:293`, `:333-339`, `:350`, `:356`, `:391-406`, `:469-477`, `:482`, `:495`, `:507`, `:621-639`, `:658-667`

**Interfaces:**
- Produces:
  - `LatLng = { lat: number; lng: number }`; `toLatLng(lat, lng): LatLng | null`
  - `isParcelOrder(o: Pick<OrderSummary, "order_type">): boolean`
  - `receiverName(o: Pick<OrderSummary, "receiver_details">): string | null`
  - `orderHeading(o): string` ("Parcel to {name}", "Your parcel", store name or "Your order")
  - `mapPoints(o): { destination: LatLng | null; pickup: LatLng | null }`
  - `AddressCard = { label: "Pickup" | "Drop-off" | "Delivery"; address: string; name: string | null; phone: string | null }`; `addressCards(o): AddressCard[]`
  - `Milestone = { status: MilestoneStatus; label: string }`; `milestonesFor(o): Milestone[]`; `milestoneIndex(milestones: readonly Milestone[], status: OrderStatus): number`
  - `payerLabel(payer: string | null | undefined): string`
- Consumes: `OrderSummary`, `OrderStatus` (orders.ts, with Task 3's parcel fields), `MilestoneStatus` (tracking.ts).

- [ ] **Step 1: Record the lint baseline**

Run: `npx eslint src/components/orders/order-detail-view.tsx`
Note the output; the edited file must add no new rule hit.

- [ ] **Step 2: Write the failing test**

`src/lib/parcel/parcel-order.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { OrderSummary } from "@/lib/api/orders";
import {
  addressCards,
  isParcelOrder,
  mapPoints,
  milestoneIndex,
  milestonesFor,
  orderHeading,
  payerLabel,
  receiverName,
  toLatLng,
} from "./parcel-order";

function order(over: Partial<OrderSummary>): OrderSummary {
  return {
    id: 100231,
    order_amount: 1300,
    order_status: "pending",
    payment_status: "unpaid",
    created_at: "2026-09-29T10:00:00Z",
    ...over,
  };
}

const sender = {
  address: "12 Allen Avenue, Ikeja",
  contact_person_name: "Ada Obi",
  contact_person_number: "+2348012345678",
  latitude: "6.6018",
  longitude: "3.3515",
};

const parcel = order({
  order_type: "parcel",
  store: null,
  delivery_address: sender,
  receiver_details: {
    address: "5 Awolowo Road, Ikoyi",
    latitude: "6.4541",
    longitude: "3.4218",
    contact_person_name: "Bola Ade",
    contact_person_number: "+2348098765432",
  },
  charge_payer: "receiver",
});

const food = order({
  order_type: "delivery",
  store: { name: "Mama Put", latitude: "6.5", longitude: "3.3" },
  delivery_address: sender,
});

describe("toLatLng", () => {
  it("reads string coordinates and rejects missing or zero ones", () => {
    expect(toLatLng("6.4541", "3.4218")).toEqual({ lat: 6.4541, lng: 3.4218 });
    expect(toLatLng(6.5, 3.3)).toEqual({ lat: 6.5, lng: 3.3 });
    expect(toLatLng(undefined, "3.3")).toBeNull();
    expect(toLatLng("", "3.3")).toBeNull();
    expect(toLatLng("abc", "3.3")).toBeNull();
    expect(toLatLng("0", "0")).toBeNull();
  });
});

describe("isParcelOrder and receiverName", () => {
  it("tells parcels from shop orders", () => {
    expect(isParcelOrder(parcel)).toBe(true);
    expect(isParcelOrder(food)).toBe(false);
    expect(isParcelOrder(order({}))).toBe(false);
  });

  it("reads the receiver's name, trimmed", () => {
    expect(receiverName(parcel)).toBe("Bola Ade");
    expect(receiverName(order({ receiver_details: { contact_person_name: "  " } }))).toBeNull();
    expect(receiverName(food)).toBeNull();
  });
});

describe("orderHeading", () => {
  it("names the receiver for a parcel", () => {
    expect(orderHeading(parcel)).toBe("Parcel to Bola Ade");
    expect(orderHeading(order({ order_type: "parcel", receiver_details: null }))).toBe("Your parcel");
  });

  it("keeps the shop name for a shop order", () => {
    expect(orderHeading(food)).toBe("Mama Put");
    expect(orderHeading(order({ store: null }))).toBe("Your order");
  });
});

describe("mapPoints", () => {
  it("sends a parcel's rider to the drop-off, with the pickup as the second pin", () => {
    expect(mapPoints(parcel)).toEqual({
      destination: { lat: 6.4541, lng: 3.4218 },
      pickup: { lat: 6.6018, lng: 3.3515 },
    });
  });

  it("keeps a shop order on the delivery address and the store", () => {
    expect(mapPoints(food)).toEqual({
      destination: { lat: 6.6018, lng: 3.3515 },
      pickup: { lat: 6.5, lng: 3.3 },
    });
  });
});

describe("addressCards", () => {
  it("labels a parcel's sender Pickup and its receiver Drop-off", () => {
    expect(addressCards(parcel)).toEqual([
      { label: "Pickup", address: "12 Allen Avenue, Ikeja", name: "Ada Obi", phone: "+2348012345678" },
      { label: "Drop-off", address: "5 Awolowo Road, Ikoyi", name: "Bola Ade", phone: "+2348098765432" },
    ]);
  });

  it("keeps a shop order's single Delivery card, or none without an address", () => {
    expect(addressCards(food)).toEqual([
      { label: "Delivery", address: "12 Allen Avenue, Ikeja", name: "Ada Obi", phone: "+2348012345678" },
    ]);
    expect(addressCards(order({ delivery_address: null }))).toEqual([]);
  });
});

describe("milestonesFor and milestoneIndex", () => {
  it("drops the shop steps for a parcel", () => {
    expect(milestonesFor(parcel).map((m) => m.label)).toEqual([
      "Order placed",
      "Confirmed",
      "Out for delivery",
      "Delivered",
    ]);
  });

  it("keeps the shop timeline for a shop order", () => {
    expect(milestonesFor(food).map((m) => m.label)).toEqual([
      "Order placed",
      "Confirmed by shop",
      "Being prepared",
      "Out for delivery",
      "Delivered",
    ]);
  });

  it("places statuses with no row of their own", () => {
    const p = milestonesFor(parcel);
    expect(milestoneIndex(p, "processing")).toBe(1);
    expect(milestoneIndex(p, "picked_up")).toBe(2);
    expect(milestoneIndex(p, "accepted")).toBe(2);
    expect(milestoneIndex(p, "delivered")).toBe(3);
    const f = milestonesFor(food);
    expect(milestoneIndex(f, "processing")).toBe(2);
    expect(milestoneIndex(f, "picked_up")).toBe(3);
    expect(milestoneIndex(f, "price_check")).toBe(0);
  });
});

describe("payerLabel", () => {
  it("says who pays", () => {
    expect(payerLabel("sender")).toBe("You");
    expect(payerLabel("receiver")).toBe("Receiver, cash on delivery");
    expect(payerLabel(null)).toBe("Not set");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/lib/parcel/parcel-order.test.ts`
Expected: FAIL, `Failed to resolve import "./parcel-order"`.

- [ ] **Step 4: Write the helpers**

`src/lib/parcel/parcel-order.ts`:

```ts
import type { OrderStatus, OrderSummary } from "@/lib/api/orders";
import type { MilestoneStatus } from "@/lib/tracking";

/**
 * How an order reads on the tracking page and in the orders list. For a
 * parcel, delivery_address is the SENDER (pickup) and receiver_details
 * is the drop-off, the reverse of what a shop order's fields suggest.
 */

export type LatLng = { lat: number; lng: number };

export function toLatLng(
  lat: string | number | null | undefined,
  lng: string | number | null | undefined,
): LatLng | null {
  if (lat === null || lat === undefined || lat === "") return null;
  if (lng === null || lng === undefined || lng === "") return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  if (nLat === 0 && nLng === 0) return null;
  return { lat: nLat, lng: nLng };
}

export function isParcelOrder(o: Pick<OrderSummary, "order_type">): boolean {
  return o.order_type === "parcel";
}

export function receiverName(o: Pick<OrderSummary, "receiver_details">): string | null {
  const name = o.receiver_details?.contact_person_name?.trim();
  return name ? name : null;
}

export function orderHeading(
  o: Pick<OrderSummary, "order_type" | "receiver_details" | "store">,
): string {
  if (isParcelOrder(o)) {
    const name = receiverName(o);
    return name ? `Parcel to ${name}` : "Your parcel";
  }
  return o.store?.name ?? "Your order";
}

/** Where the rider map points: the drop-off for a parcel, the customer for a shop order. */
export function mapPoints(
  o: Pick<OrderSummary, "order_type" | "receiver_details" | "delivery_address" | "store">,
): { destination: LatLng | null; pickup: LatLng | null } {
  if (isParcelOrder(o)) {
    return {
      destination: toLatLng(o.receiver_details?.latitude, o.receiver_details?.longitude),
      pickup: toLatLng(o.delivery_address?.latitude, o.delivery_address?.longitude),
    };
  }
  return {
    destination: toLatLng(o.delivery_address?.latitude, o.delivery_address?.longitude),
    pickup: toLatLng(o.store?.latitude, o.store?.longitude),
  };
}

export type AddressCard = {
  label: "Pickup" | "Drop-off" | "Delivery";
  address: string;
  name: string | null;
  phone: string | null;
};

export function addressCards(
  o: Pick<OrderSummary, "order_type" | "receiver_details" | "delivery_address">,
): AddressCard[] {
  const from = o.delivery_address;
  if (!isParcelOrder(o)) {
    return from
      ? [
          {
            label: "Delivery",
            address: from.address ?? "",
            name: from.contact_person_name || null,
            phone: from.contact_person_number || null,
          },
        ]
      : [];
  }
  const cards: AddressCard[] = [];
  if (from) {
    cards.push({
      label: "Pickup",
      address: from.address ?? "",
      name: from.contact_person_name || null,
      phone: from.contact_person_number || null,
    });
  }
  const to = o.receiver_details;
  if (to) {
    cards.push({
      label: "Drop-off",
      address: to.address ?? "",
      name: to.contact_person_name || null,
      phone: to.contact_person_number || null,
    });
  }
  return cards;
}

export type Milestone = { status: MilestoneStatus; label: string };

const SHOP_MILESTONES: Milestone[] = [
  { status: "pending", label: "Order placed" },
  { status: "confirmed", label: "Confirmed by shop" },
  { status: "processing", label: "Being prepared" },
  { status: "handover", label: "Out for delivery" },
  { status: "delivered", label: "Delivered" },
];

/** No shop confirms or prepares a parcel. */
const PARCEL_MILESTONES: Milestone[] = [
  { status: "pending", label: "Order placed" },
  { status: "confirmed", label: "Confirmed" },
  { status: "handover", label: "Out for delivery" },
  { status: "delivered", label: "Delivered" },
];

export function milestonesFor(o: Pick<OrderSummary, "order_type">): Milestone[] {
  return isParcelOrder(o) ? PARCEL_MILESTONES : SHOP_MILESTONES;
}

/** The milestone reached. Statuses with no row of their own show as the row they belong to. */
export function milestoneIndex(milestones: readonly Milestone[], status: OrderStatus): number {
  const direct = milestones.findIndex((m) => m.status === status);
  if (direct >= 0) return direct;
  if (status === "picked_up" || status === "accepted") {
    return milestones.findIndex((m) => m.status === "handover");
  }
  if (status === "processing") {
    return milestones.findIndex((m) => m.status === "confirmed");
  }
  return 0;
}

export function payerLabel(payer: string | null | undefined): string {
  if (payer === "receiver") return "Receiver, cash on delivery";
  if (payer === "sender") return "You";
  return "Not set";
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/lib/parcel/parcel-order.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 6: Wire the order page**

In `src/components/orders/order-detail-view.tsx`, make these edits in order.

(a) Find:

```tsx
  MapPin,
  Phone,
  ShoppingBag,
```

Replace with:

```tsx
  MapPin,
  Package,
  Phone,
  ShoppingBag,
```

(b) Find:

```tsx
import { OrderStatusPill } from "./order-status-pill";
```

Replace with:

```tsx
import {
  addressCards,
  isParcelOrder,
  mapPoints,
  milestoneIndex,
  milestonesFor,
  orderHeading,
  payerLabel,
  type Milestone,
} from "@/lib/parcel/parcel-order";
import { OrderStatusPill } from "./order-status-pill";
```

(c) Find the whole `TIMELINE` constant with its comment:

```tsx
/** Ordered list of milestones we light up in the timeline. The
 *  backend's order_status can advance through several of these in
 *  one step (e.g. confirmed → handover), so we walk the array and
 *  mark every one up to AND including the current status. */
const TIMELINE: Array<{
  status: OrderStatus | "paid";
  label: string;
  icon: React.ReactNode;
}> = [
  { status: "pending", label: "Order placed", icon: <ShoppingBag size={14} /> },
  { status: "confirmed", label: "Confirmed by shop", icon: <Clock size={14} /> },
  { status: "processing", label: "Being prepared", icon: <Clock size={14} /> },
  { status: "handover", label: "Out for delivery", icon: <Bike size={14} /> },
  { status: "delivered", label: "Delivered", icon: <ShoppingBag size={14} /> },
];
```

Replace with:

```tsx
/** Icons for the timeline milestones. Which milestones show, and their
 *  labels, come from milestonesFor(): a parcel has no shop steps. The
 *  backend's order_status can advance through several milestones in
 *  one step, so the timeline marks every one up to the current status. */
const MILESTONE_ICONS: Record<MilestoneStatus, React.ReactNode> = {
  pending: <ShoppingBag size={14} />,
  confirmed: <Clock size={14} />,
  processing: <Clock size={14} />,
  handover: <Bike size={14} />,
  delivered: <ShoppingBag size={14} />,
};
```

(d) Find:

```tsx
  // Live rider map shows only while the order is in-flight AND we
  // have an assigned rider AND a usable delivery lat/lng. The
  // pickup pin is dropped only when the store has coordinates.
  const showMap =
    rider !== null &&
    (order.order_status === "handover" ||
      order.order_status === "picked_up" ||
      order.order_status === "accepted") &&
    parseLatLng(
      order.delivery_address?.latitude,
      order.delivery_address?.longitude,
    ) !== null;
  const destination = parseLatLng(
    order.delivery_address?.latitude,
    order.delivery_address?.longitude,
  );
  const pickup = parseLatLng(order.store?.latitude, order.store?.longitude);
```

Replace with:

```tsx
  // Live rider map shows only while the order is in-flight AND we
  // have an assigned rider AND a usable destination. For a parcel the
  // destination is the drop-off and the second pin is the pickup; for
  // a shop order they are the delivery address and the store. The
  // distance line below measures to the same destination.
  const { destination, pickup } = mapPoints(order);
  const showMap =
    rider !== null &&
    (order.order_status === "handover" ||
      order.order_status === "picked_up" ||
      order.order_status === "accepted") &&
    destination !== null;
```

(e) Find:

```tsx
                {order.store?.name ?? "Your order"}
```

Replace with:

```tsx
                {orderHeading(order)}
```

(f) Find:

```tsx
          rows={order.timelines ?? []}
        />
```

Replace with:

```tsx
          rows={order.timelines ?? []}
          milestones={milestonesFor(order)}
        />
```

(g) Find:

```tsx
        <ItemsCard lines={lines} />
```

Replace with:

```tsx
        {isParcelOrder(order) ? <ParcelCard order={order} /> : <ItemsCard lines={lines} />}
```

(h) Find:

```tsx
        <DeliveryAddressCard order={order} />
```

Replace with:

```tsx
        <AddressCards order={order} />
```

(i) In the `Timeline` signature, find:

```tsx
  rows,
}: {
```

Replace with:

```tsx
  rows,
  milestones,
}: {
```

and find:

```tsx
  rows: readonly TimelineRow[];
}) {
```

Replace with:

```tsx
  rows: readonly TimelineRow[];
  milestones: readonly Milestone[];
}) {
```

(j) Find:

```tsx
  const currentIndex = TIMELINE.findIndex((m) => m.status === status);
  // picked_up / accepted aren't in TIMELINE but map to handover for display
  const effectiveIndex =
    currentIndex >= 0
      ? currentIndex
      : status === "picked_up" || status === "accepted"
        ? TIMELINE.findIndex((m) => m.status === "handover")
        : 0;
```

Replace with:

```tsx
  const effectiveIndex = milestoneIndex(milestones, status);
```

(k) Find `        {TIMELINE.map((m, idx) => {` and replace with `        {milestones.map((m, idx) => {`.

(l) Find `                {m.icon}` and replace with `                {MILESTONE_ICONS[m.status]}`.

(m) Find `                {(subEvents[m.status as MilestoneStatus] ?? []).map((s) => (` and replace with `                {(subEvents[m.status] ?? []).map((s) => (`.

(n) Find the whole `DeliveryAddressCard` function:

```tsx
function DeliveryAddressCard({ order }: { order: OrderTrack }) {
  const addr = order.delivery_address;
  if (!addr) return null;
  return (
    <CardLite>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-900">
        <MapPin size={14} />
        Delivery
      </h2>
      <p className="text-sm text-ink-700">{addr.address}</p>
      {addr.contact_person_name && (
        <p className="mt-2 text-xs text-ink-500">
          {addr.contact_person_name}
          {addr.contact_person_number ? ` · ${addr.contact_person_number}` : ""}
        </p>
      )}
    </CardLite>
  );
}
```

Replace with:

```tsx
/** One card per address: "Delivery" for a shop order, "Pickup" and
 *  "Drop-off" for a parcel. Same markup the Delivery card always had. */
function AddressCards({ order }: { order: OrderTrack }) {
  return (
    <>
      {addressCards(order).map((card) => (
        <CardLite key={card.label}>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-900">
            <MapPin size={14} />
            {card.label}
          </h2>
          <p className="text-sm text-ink-700">{card.address}</p>
          {card.name && (
            <p className="mt-2 text-xs text-ink-500">
              {card.name}
              {card.phone ? ` · ${card.phone}` : ""}
            </p>
          )}
        </CardLite>
      ))}
    </>
  );
}

/** Takes the items card's place on a parcel order, which has no lines. */
function ParcelCard({ order }: { order: OrderTrack }) {
  const instruction = order.delivery_instruction?.trim() || null;
  return (
    <CardLite>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-900">
        <Package size={14} />
        Parcel
      </h2>
      <dl className="space-y-2 text-sm">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-ink-500">Type</dt>
          <dd className="text-right font-medium text-ink-900">
            {order.parcel_category?.name ?? "Parcel"}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-ink-500">Instructions</dt>
          <dd className="text-right text-ink-900">{instruction ?? "None"}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-ink-500">Who pays</dt>
          <dd className="text-right text-ink-900">{payerLabel(order.charge_payer)}</dd>
        </div>
      </dl>
    </CardLite>
  );
}
```

(o) Delete the now-unused `parseLatLng` function:

```tsx
function parseLatLng(
  lat: string | number | undefined,
  lng: string | number | undefined,
): { lat: number; lng: number } | null {
  const nLat = lat === undefined ? NaN : Number(lat);
  const nLng = lng === undefined ? NaN : Number(lng);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) return null;
  if (nLat === 0 && nLng === 0) return null;
  return { lat: nLat, lng: nLng };
}
```

Shop orders render exactly as before: same heading, same five milestones and labels, same map points, same single Delivery card.

- [ ] **Step 7: Typecheck, lint and test**

Run: `npx tsc --noEmit; npx eslint src/lib/parcel/parcel-order.ts src/components/orders/order-detail-view.tsx; npx vitest run src/lib/parcel/parcel-order.test.ts src/lib/tracking.test.ts`
Expected: tsc clean (no references to `TIMELINE`, `parseLatLng` or `DeliveryAddressCard` remain); `parcel-order.ts` clean; `order-detail-view.tsx` no new rule hit versus Step 1; tests PASS.

- [ ] **Step 8: Commit**

```powershell
cd C:\laragon\www\biteexpress-web-app-parcel; git add src/lib/parcel/parcel-order.ts src/lib/parcel/parcel-order.test.ts src/components/orders/order-detail-view.tsx; git commit -m "Show parcel orders with their pickup, drop-off and receiver" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 11: Web, parcel rows in the orders list

**Files:**
- Modify: `src/lib/parcel/parcel-order.ts` (append), `src/lib/parcel/parcel-order.test.ts` (append)
- Modify: `src/components/orders/orders-view.tsx:13` (imports), `:131-133`, `:170`

**Interfaces:**
- Produces: `orderListTitle(o: Pick<OrderSummary, "order_type" | "receiver_details" | "store">): string`
- Consumes: `isParcelOrder`, `receiverName` (Task 10).

- [ ] **Step 1: Record the lint baseline**

Run: `npx eslint src/components/orders/orders-view.tsx`
Note the output.

- [ ] **Step 2: Write the failing test**

Append to `src/lib/parcel/parcel-order.test.ts` (and add `orderListTitle` to its import list):

```ts
describe("orderListTitle", () => {
  it("names the receiver for a parcel instead of an unknown shop", () => {
    expect(orderListTitle(parcel)).toBe("Parcel to Bola Ade");
    expect(orderListTitle(order({ order_type: "parcel", receiver_details: null }))).toBe("Parcel");
  });

  it("keeps the shop name, or the old fallback, for shop orders", () => {
    expect(orderListTitle(food)).toBe("Mama Put");
    expect(orderListTitle(order({ store: null }))).toBe("Unknown shop");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/lib/parcel/parcel-order.test.ts`
Expected: FAIL, `orderListTitle is not a function`.

- [ ] **Step 4: Write the helper**

Append to `src/lib/parcel/parcel-order.ts`:

```ts

export function orderListTitle(
  o: Pick<OrderSummary, "order_type" | "receiver_details" | "store">,
): string {
  if (isParcelOrder(o)) {
    const name = receiverName(o);
    return name ? `Parcel to ${name}` : "Parcel";
  }
  return o.store?.name ?? "Unknown shop";
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/lib/parcel/parcel-order.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 6: Use it in the list**

In `src/components/orders/orders-view.tsx`, find:

```tsx
import { OrderStatusPill } from "./order-status-pill";
```

Replace with:

```tsx
import { isParcelOrder, orderListTitle } from "@/lib/parcel/parcel-order";
import { OrderStatusPill } from "./order-status-pill";
```

Find:

```tsx
  const logo = order.store?.logo_full_url ?? null;
  const storeName = order.store?.name ?? "Unknown shop";
```

Replace with:

```tsx
  const logo = order.store?.logo_full_url ?? null;
  // A parcel has no store, so its row shows the package icon below and
  // names the receiver instead.
  const storeName = orderListTitle(order);
  const parcel = isParcelOrder(order);
```

Find:

```tsx
          {typeof order.details_count === "number" && (
```

Replace with:

```tsx
          {!parcel && typeof order.details_count === "number" && (
```

(A parcel has no order lines, so "0 items" would be wrong.)

- [ ] **Step 7: Typecheck and lint**

Run: `npx tsc --noEmit; npx eslint src/lib/parcel/parcel-order.ts src/components/orders/orders-view.tsx`
Expected: tsc clean; `parcel-order.ts` clean; `orders-view.tsx` matches the Step 1 baseline.

- [ ] **Step 8: Commit**

```powershell
cd C:\laragon\www\biteexpress-web-app-parcel; git add src/lib/parcel/parcel-order.ts src/lib/parcel/parcel-order.test.ts src/components/orders/orders-view.tsx; git commit -m "Label parcel orders in the orders list by their receiver" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 12: Full verification

**Files:** none changed.

- [ ] **Step 1: Web suite, types, lint and build**

```powershell
cd C:\laragon\www\biteexpress-web-app-parcel
npm test
npx tsc --noEmit
npx eslint src/lib/api/config.ts src/lib/api/parcel.ts src/lib/api/directions.ts src/lib/api/orders.ts src/lib/api/order-quote.ts src/lib/parcel src/lib/checkout src/lib/module-entry.ts src/components/parcel src/app/send
npx eslint src/components/checkout/checkout-flow.tsx src/components/checkout/address-picker-checkout.tsx src/components/browse/module-picker.tsx src/components/orders/order-detail-view.tsx src/components/orders/orders-view.tsx
npm run build
```

Expected: every vitest file passes; tsc clean; the first eslint prints nothing; the second prints only the hits recorded as baselines in Tasks 6, 7, 9, 10 and 11; the build succeeds and lists `/send`.

- [ ] **Step 2: Backend suites, one at a time**

```powershell
cd C:\laragon\www\dashboard.bite.express
$env:OPENSSL_CONF='C:\laragon\bin\php\php-8.3.28-Win32-vs16-x64\extras\ssl\openssl.cnf'; php vendor/bin/phpunit tests/Feature/Parcel
$env:OPENSSL_CONF='C:\laragon\bin\php\php-8.3.28-Win32-vs16-x64\extras\ssl\openssl.cnf'; php vendor/bin/phpunit tests/Feature/DeliveryPricing
$env:OPENSSL_CONF='C:\laragon\bin\php\php-8.3.28-Win32-vs16-x64\extras\ssl\openssl.cnf'; php vendor/bin/phpunit -d memory_limit=1024M tests/Feature/PriceCheck
$env:OPENSSL_CONF='C:\laragon\bin\php\php-8.3.28-Win32-vs16-x64\extras\ssl\openssl.cnf'; php vendor/bin/phpunit tests/Feature/BitePass/BitePassOrderPricingFeatureTest.php
$env:OPENSSL_CONF='C:\laragon\bin\php\php-8.3.28-Win32-vs16-x64\extras\ssl\openssl.cnf'; php vendor/bin/phpunit tests/Feature/Whatsapp/WhatsappOrderPlacementIntegrationTest.php
git status --short
```

Expected: all green. `git status --short` lists nothing but possibly `resources/lang/en/messages.php`; revert it with `git checkout -- resources/lang/en/messages.php`.

- [ ] **Step 3: Clean trees**

```powershell
git -C C:\laragon\www\dashboard.bite.express status --short; git -C C:\laragon\www\biteexpress-web-app-parcel status --short
```

Expected: both empty. Nothing is pushed.

---

## Task 13: Live pass in Edge (evidence only, never pushes)

Proves the parts no unit test reaches: the real browser flow, the preview total against the placed total, tracking, and food checkout through `settleOrder`. Uses the local dev DB (`biteexpress`), whose parcel module is id 6 with zones 2 to 5 (Kaduna and Sokoto), all with `cash_on_delivery = 0` and `offline_payment = 0`. The run switches one zone on and restores it at the end.

**Files:** none in either repo. Scratch files only, under your session scratchpad; set `$Scratch` to that directory's path in every PowerShell call below.

- [ ] **Step 1: Pick free ports**

```powershell
Get-NetTCPConnection -State Listen -LocalPort 8210,3100 -ErrorAction SilentlyContinue | Select-Object LocalPort, OwningProcess
```

Expected: nothing. If a port is taken, pick another and use it consistently below (a second `php -S` on a taken port starts "fine" and answers nothing).

- [ ] **Step 2: Prepare local data**

Write `$Scratch\live-prep.php`:

```php
<?php

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

if (DB::getDatabaseName() !== 'biteexpress') {
    throw new RuntimeException('Refusing to run: not the local dev database.');
}

$zoneId = 3; // Kaduna North; offers module 6 (parcel).
$snapshotPath = getenv('LIVE_SNAPSHOT');

file_put_contents($snapshotPath, json_encode([
    'zone' => DB::table('zones')->where('id', $zoneId)->first(['id', 'cash_on_delivery', 'offline_payment']),
    'settings' => DB::table('business_settings')->whereIn('key', ['cash_on_delivery', 'offline_payment_status'])->get(['key', 'value']),
]));

DB::table('zones')->where('id', $zoneId)->update(['cash_on_delivery' => 1, 'offline_payment' => 1]);
DB::table('business_settings')->where('key', 'cash_on_delivery')->update(['value' => json_encode(['status' => 1])]);
DB::table('business_settings')->where('key', 'offline_payment_status')->update(['value' => '1']);

$user = User::where('email', 'parcel-live@example.test')->first()
    ?? User::factory()->create([
        'f_name' => 'Parcel',
        'l_name' => 'Live',
        'email' => 'parcel-live@example.test',
        'phone' => '+2348000000999',
        'password' => bcrypt('ParcelLive123'),
        'ref_by' => null,
    ]);
$user->wallet_balance = 50000;
$user->save();
foreach (['status' => 1, 'is_phone_verified' => 1, 'is_email_verified' => 1] as $column => $value) {
    if (Schema::hasColumn('users', $column)) {
        DB::table('users')->where('id', $user->id)->update([$column => $value]);
    }
}

echo "zone {$zoneId} switched on; customer {$user->id} +2348000000999 / ParcelLive123 wallet 50000\n";
```

Run it and clear the local cache:

```powershell
cd C:\laragon\www\dashboard.bite.express; $env:LIVE_SNAPSHOT="$Scratch\live-snapshot.json"; php artisan tinker "$Scratch\live-prep.php"; php artisan cache:clear
```

Expected: the echo line, and `live-snapshot.json` written.

- [ ] **Step 3: Serve the backend (branch `parcel-preview-surge`) with opcache and the CA bundle**

```powershell
cd C:\laragon\www\dashboard.bite.express; git branch --show-current
$api = Start-Process php -ArgumentList '-d','zend_extension=php_opcache.dll','-d','opcache.enable=1','-d','opcache.enable_cli=1','-d','curl.cainfo=C:\laragon\etc\ssl\cacert.pem','-d','openssl.cafile=C:\laragon\etc\ssl\cacert.pem','-S','127.0.0.1:8210','-t','.' -WorkingDirectory C:\laragon\www\dashboard.bite.express -PassThru -WindowStyle Hidden -RedirectStandardError "$Scratch\api.err.log"
$api.Id | Set-Content "$Scratch\api.pid"
(Invoke-WebRequest http://127.0.0.1:8210/api/v1/module -UseBasicParsing).StatusCode
```

Expected: branch `parcel-preview-surge`; status 200. The repo root is served (`-t .`), not `public/`, because this fork routes through the root `index.php`.

- [ ] **Step 4: Serve the web app against it**

```powershell
cd C:\laragon\www\biteexpress-web-app-parcel
Copy-Item C:\laragon\www\biteexpress-web-app\.env.local .env.local
(Get-Content .env.local) -replace '^NEXT_PUBLIC_API_BASE_URL=.*$','NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8210' -replace '^NEXT_PUBLIC_SITE_URL=.*$','NEXT_PUBLIC_SITE_URL=http://localhost:3100' | Set-Content -Encoding utf8 .env.local
$web = Start-Process node -ArgumentList 'node_modules\next\dist\bin\next','dev','-p','3100' -WorkingDirectory C:\laragon\www\biteexpress-web-app-parcel -PassThru -WindowStyle Hidden -RedirectStandardOutput "$Scratch\web.out.log" -RedirectStandardError "$Scratch\web.err.log"
$web.Id | Set-Content "$Scratch\web.pid"
```

Expected: `web.out.log` shows the dev server ready on 3100. `.env.local` is gitignored.

- [ ] **Step 5: Drive Edge**

Use the Playwright MCP browser tools if they run Edge; otherwise a scratchpad Node script with `playwright-core`'s `chromium.launchPersistentContext(dir, { executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' })`. Save screenshots under a lowercase `c:\laragon\www\...` folder that already exists, or under the scratchpad. Record the console error count on each page.

1. On `http://localhost:3100/`, pick an address in Kaduna North as the delivery location. Sign in on `/signin` with `+2348000000999` / `ParcelLive123`.
2. `/browse`: the parcel module card reads "Send a package across town" and links to `/send`. Screenshot.
3. Parcel A, receiver pays cash: on `/send` pick a category; keep the pickup; drop-off another Kaduna address; receiver name and phone; choose a preset instruction and a note; Who pays: Receiver. Screenshot the price card, note its total, place the order. Expected landing: `/orders/{id}` with "Parcel to {receiver}", Pickup and Drop-off cards, the Parcel card (type, instruction, "Receiver, cash on delivery") and a timeline without "Being prepared". Screenshot.
4. Parcel B, sender pays from wallet: same flow, Who pays: Me, Payment: Wallet balance. Note the price card total, place, land on `/orders/{id}`. Screenshot.
5. Error paths while on `/send`: pick a drop-off outside every zone (for example Lagos) and confirm the inline "We don't deliver to this address yet" note appears at pick time. Screenshot.
6. `/orders`: both parcels read "Parcel to {receiver}" with the package icon and no "0 items". Screenshot.
7. Food order 1, wallet: add an item from any open store in Kaduna North, check out with Wallet balance. Expected: `/checkout/success?order_id=...` and an emptied cart.
8. Food order 2, Pay Offline (zone 3 now allows it): check out with Pay Offline. Expected: `/checkout/offline/{id}?method=...`. If no offline method is configured locally, instead choose Pay Online and close the Paystack popup: expected toast "Payment cancelled. Order #... is on hold. Re-place it when you're ready." and the checkout form re-enabled. Record which path ran.

- [ ] **Step 6: Prove preview equals placement from the DB**

Write `$Scratch\live-evidence.php`:

```php
<?php

use App\Models\Order;

$ids = array_filter(array_map('intval', explode(',', (string) getenv('LIVE_ORDER_IDS'))));
foreach (Order::whereIn('id', $ids)->get() as $o) {
    echo json_encode($o->only([
        'id', 'order_type', 'order_status', 'payment_method', 'payment_status', 'charge_payer',
        'order_amount', 'delivery_charge', 'original_delivery_charge', 'additional_charge',
        'total_tax_amount', 'dm_tips', 'distance', 'delivery_instruction', 'receiver_details',
    ])), "\n";
}
```

In one PowerShell call (environment variables do not survive between calls), set `LIVE_ORDER_IDS` to the four order ids from Step 5 in the order Parcel A, Parcel B, food 1, food 2, and run the script. The ids below are examples; use the real ones:

```powershell
cd C:\laragon\www\dashboard.bite.express; $env:LIVE_ORDER_IDS='100231,100232,100233,100234'; php artisan tinker "$Scratch\live-evidence.php"
```

Expected: each parcel's `order_amount` equals the total its price card showed; Parcel A `charge_payer=receiver`, `payment_method=cash_on_delivery`; Parcel B `payment_method=wallet`, `payment_status=paid`; `receiver_details` carries the twelve keys with a numeric `zone_id`; food 1 `payment_status=paid`.

- [ ] **Step 7: Optional, map points on a moving parcel**

Only if a local rider with a recent location exists: through `php artisan tinker --execute`, record Parcel B's `delivery_man_id` and `order_status`, then set them to that rider's id and `'picked_up'` with `DB::table('orders')->where('id', $parcelB)->update([...])`, reload Parcel B's order page, confirm the map renders with the drop-off as destination and the pickup as the second pin, and the "Your rider is ... away" line measures to the drop-off. Screenshot, then set the two columns back to their earlier values.

- [ ] **Step 8: Stop servers and restore**

```powershell
$webPid = [int](Get-Content "$Scratch\web.pid"); $apiPid = [int](Get-Content "$Scratch\api.pid")
Get-CimInstance Win32_Process -Filter "ParentProcessId=$webPid" | ForEach-Object { Stop-Process -Id $_.ProcessId }
Stop-Process -Id $webPid; Stop-Process -Id $apiPid
```

Write `$Scratch\live-restore.php`:

```php
<?php

use Illuminate\Support\Facades\DB;

if (DB::getDatabaseName() !== 'biteexpress') {
    throw new RuntimeException('Refusing to run: not the local dev database.');
}

$snapshot = json_decode(file_get_contents(getenv('LIVE_SNAPSHOT')), true);
DB::table('zones')->where('id', $snapshot['zone']['id'])->update([
    'cash_on_delivery' => $snapshot['zone']['cash_on_delivery'],
    'offline_payment' => $snapshot['zone']['offline_payment'],
]);
foreach ($snapshot['settings'] as $row) {
    DB::table('business_settings')->where('key', $row['key'])->update(['value' => $row['value']]);
}
echo "restored zone {$snapshot['zone']['id']} and " . count($snapshot['settings']) . " settings\n";
```

```powershell
cd C:\laragon\www\dashboard.bite.express; $env:LIVE_SNAPSHOT="$Scratch\live-snapshot.json"; php artisan tinker "$Scratch\live-restore.php"; php artisan cache:clear; git status --short
```

Expected: the restore line. If `resources/lang/en/messages.php` is listed (browser traffic runs `translate()`), `git checkout -- resources/lang/en/messages.php`. The test customer and the four orders stay in the local dev DB as a record of the run.

- [ ] **Step 9: Report**

Hand back: the four order ids, the evidence JSON, each price-card total next to its `order_amount`, which food payment path ran in step 5.8, screenshot paths, console error counts per page, and anything that did not match. No commit and no push in this task.
