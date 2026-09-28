# Web parcel orders: design

**Date:** 2026-09-29
**Status:** Draft, awaiting review
**Repos:** `biteexpress-web-app` (app.bite.express, branch `parcel-orders`), `dashboard.bite.express` (one backend change)

## 1. Goal

A signed-in customer on app.bite.express can send a package across town the way the BiteExpress app allows, see an accurate price before paying, and track it afterwards with the pickup and drop-off shown correctly.

### Decisions made during brainstorming

| Question | Decision |
|---|---|
| Scope | App parity, no extras: category, sender and receiver with zone-checked addresses, instructions, who pays, the same payment methods as food checkout, accurate fee preview, parcel-aware tracking. No scheduling. No cancel (the web has no cancel UI by design). |
| Price accuracy | Fix both gaps: the backend preview includes surge for parcels, and the web uses road distance from the backend directions proxy, falling back to straight-line. |
| Layout | One `/send` page with three collapsible steps. |
| Architecture | Approach A: a new flow that shares the post-order payment code with food checkout through an extracted helper. |
| Launch switch | None. The entry only appears where a zone offers the parcel module, which admin already controls. |

### Out of scope

Scheduled pickups; cancelling or returning a parcel from the web; guest parcel orders; parcel coupons (the web has no coupon entry); changes to the Flutter app.

## 2. Current state (verified 2026-09-29)

**Backend** (`dashboard.bite.express`)
- `POST /api/v1/customer/order/place` (`PlaceNewOrder::new_place_order`) accepts `order_type=parcel`. Parcel requires `parcel_category_id`, `receiver_details` (a JSON string) and `charge_payer` (`sender` or `receiver`); `store_id` is not required. `distance`, `address`, `latitude`, `longitude` describe the pickup (sender) point. The sender contact is stored in `delivery_address`.
- `receiver_details` keys (Flutter AddressModel): `address, latitude, longitude, zone_id, contact_person_name, contact_person_number, contact_person_email, road, house, floor, address_type, additional_address`.
- Zone checks at placement (`getZoneAndStore`, PlaceNewOrder.php ~783-798): the pickup zone must be in the `zoneId` header, contain the pickup point, and have a `module_type='parcel'` module (error code `zone` / `out_of_coverage_area`); `receiver_details.zone_id` must contain the drop point (error code `receiverZone`).
- Charge (`getDeliveryCharge`, ~1041-1075): `max(distance x per_km, minimum) + vehicle extra charge`, per-km and minimum from the category when its minimum is set, otherwise from business settings; then surge. Total adds a service charge on the charge, tax (tax payer `parcel`), tips, minus coupon. COD ceiling from the zone-module pivot.
- `POST /api/v1/customer/order/get-Tax` (`getCalculatedTax`, ~1737) has a parcel branch, but it skips `getZoneAndStore`, so `$zone` is null (~1795, ~1854) and surge is not applied. **The preview understates the real charge whenever surge is active.**
- `GET /api/v1/parcel-category` (needs a `moduleId` header): id, name, description, image_full_url, parcel_per_km_shipping_charge, parcel_minimum_shipping_charge.
- `GET /api/v1/customer/order/parcel-instructions` (paginated `{total_size, limit, offset, data}`).
- `GET /api/v1/config/direction-api` proxies the Google Routes API (duration, distanceMeters, encodedPolyline).
- `GET /api/v1/customer/order/details` returns the whole order object for parcel orders, not line items.

**Web app**
- The module picker links every module, including parcel, to `/browse/{id}`; nothing special-cases parcel.
- `checkout-flow.tsx` `handlePlace` (~327-529) re-checks the zone, then runs the price-check, wallet, offline, bank-transfer and Paystack paths inline after the order is created.
- `placeOrder` (`src/lib/api/orders.ts`) always sends `is_buy_now`, `cart`, `store_id`; `PlaceOrderInput.orderType` already allows `"parcel"` but has no parcel fields. `order-quote.ts` only allows delivery or take_away.
- Reusable: `AddressPicker` (Places autocomplete, `onPick`, `persistToStore=false`), `address-picker-checkout.tsx` (saved or picked address), `checkZone` (`src/lib/api/zones.ts`, returns zones with `modules[].module_type` and the COD/digital/offline flags), `distanceKm`, `isRefusalBody` (203 COD-ceiling refusals).
- Tracking a parcel order today: the header shows "Your order"; the map's destination is `delivery_address` (the pickup for parcel) and the pickup pin is `store` (null); the items card says "Item details not available."; the address card labels the sender address "Delivery"; the orders list shows "Unknown shop". Order types lack `order_type`, `receiver_details`, `parcel_category`, `charge_payer`.

## 3. Backend: surge in the parcel preview

- In `getCalculatedTax`, resolve the pickup zone for parcel orders the same way placement does (pickup coordinates, `zoneId` header, zone must have a parcel module), so `getDeliveryCharge` receives the zone and applies surge. Service charge and tax then follow from the same numbers as placement.
- If the pickup is not in a parcel zone, return the same error placement returns (code `zone` / `out_of_coverage_area`, same status) instead of quoting.
- No other backend change.
- Effect on the Flutter app: its parcel preview gains surge when surge is active. With no surge, nothing changes.
- Tests (PHPUnit): preview with surge active includes it; preview with no surge is unchanged; pickup outside every parcel zone is refused; the preview total equals the total recorded when the same parcel order is placed.

## 4. Web: the `/send` flow

**Entry.** In the module picker, a module with `module_type === "parcel"` links to `/send` instead of `/browse/{id}`. `/send` is behind the existing `RouteGuard` (sign-in required). The parcel module id and the pickup zone come from the customer's current delivery location (`location-store`, zone check result). If there is no location, show the existing `NoLocation` gate. If the customer's zones offer no parcel module, show a short "Parcel delivery isn't available in your area yet" state with a link back to browse.

**Step 1: what you're sending.** Category cards from `GET parcel-category` (image, name, description). Selecting one completes the step.

**Step 2: pickup and drop-off.** Two panels, each: address, contact name, phone, optional house, floor, road.
- Pickup defaults to the current delivery location, name and phone from the customer's profile; saved addresses are offered (reuse `address-picker-checkout`).
- Drop-off uses the Places autocomplete; receiver email optional.
- Each address is zone-checked when picked (`checkZone`). Pickup must be in a zone whose modules include parcel; drop-off must be in a served zone (its zone id becomes `receiver_details.zone_id`). Errors show inline beside the field.
- Phone numbers are validated in the same format the rest of the web app accepts.

**Step 3: review and pay.**
- Instructions: select from `parcel-instructions` plus an optional note, sent together as the delivery instruction the way the app does.
- Who pays: "Me" (`sender`) or "Receiver" (`receiver`). Receiver forces cash on delivery and hides the other methods.
- Payment methods: the same set as food checkout, filtered by the pickup zone's COD/digital/offline flags; wallet shows its balance and the shortfall the way checkout does.
- Rider tip: the same control as checkout, when tips are enabled.
- Price: a breakdown from the `get-Tax` preview (delivery fee including surge, service charge, VAT, tip, total), refreshed whenever category, either address, payer or tip changes. Fee figures are read from the preview response; the web never recomputes fees.
- Distance: road distance from `config/direction-api` between pickup and drop-off; if that call fails, straight-line `distanceKm`, silently.

**Step behaviour.** Steps collapse when complete and reopen when tapped; a step unlocks only when the previous one is valid.

**Placing.** A new `placeParcelOrder()` in `src/lib/api/orders.ts` sends `order_type=parcel`, the pickup as address/latitude/longitude/distance, the sender contact, `receiver_details` as a JSON string, `parcel_category_id`, `charge_payer`, payment method, `dm_tips`, and the `zoneId`/`moduleId` headers; no cart and no store id. A 203 COD-ceiling refusal is handled with the existing `isRefusalBody`. On success the shared payment helper (section 5) runs, then the customer lands on `/orders/{id}`.

## 5. Web: shared payment helper

- Extract the post-creation payment handling from `checkout-flow.tsx` `handlePlace` into `src/lib/checkout/settle-order.ts`: `settleOrder({ orderId, amount, method, ... }, deps)` covering the Paystack popup and confirmation, wallet charge, redirects to the bank-transfer and offline pages, and cash on delivery. It returns the navigation target (or a failure the caller shows). API calls and the Paystack launcher are passed in as `deps` so it is unit-testable in node.
- Food checkout calls `settleOrder` instead of its inline code. Nothing else in food checkout changes: zone re-check, price-check handling and the quote stay where they are.
- Because food checkout has no component tests, the live pass must place one food order by cash and one by wallet through the extracted path.

## 6. Web: parcel-aware tracking

- Order types gain `order_type`, `receiver_details`, `parcel_category`, `charge_payer`.
- Order page: header reads "Parcel to {receiver name}"; two labelled address cards, Pickup (sender, from `delivery_address`) and Drop-off (receiver with phone); the rider map's destination is the drop-off and its second pin is the pickup; the "X km away" line measures to the drop-off; a parcel card replaces the items card (category, instructions, who pays); timeline "Confirmed by shop" reads "Confirmed" and "Being prepared" is hidden for parcels.
- Orders list: package icon and "Parcel to {receiver name}" instead of "Unknown shop".
- Push notifications already cover parcel orders (same status sender); no change.

## 7. Error handling

- Zone failures at either address are caught at pick time, not at "Place order"; placement errors (`zone`, `receiverZone`, COD ceiling) are still mapped to readable messages in case the zone changes between steps.
- A preview failure disables "Place order" and shows a retry, so the customer never pays an unquoted price.
- Directions failure falls back to straight-line distance silently.
- No native alert/confirm; errors use the existing toast and inline patterns. Copy has no em or en dashes.

## 8. Testing

- Backend PHPUnit: section 3's cases.
- Web vitest (pure modules): step validation (missing fields, phone format); payer rules (receiver means COD only; zone flags remove methods); the `receiver_details` payload keys; distance fallback; `settleOrder` for all five payment outcomes with fake deps; parcel tracking helpers (Pickup/Drop-off labels, map points, "Parcel to" title, orders-list label).
- Typecheck, lint (new errors only), build.
- Live pass in Edge: send a parcel with the receiver paying cash and one with the sender paying from wallet; confirm the preview total equals the placed order's total and tracking shows pickup and drop-off correctly; place one food order by cash and one by wallet through the extracted payment path.

## 9. Rollout

1. Backend first (the only customer-visible change is that the app's parcel preview includes surge when active).
2. Web app second. The `/send` entry appears only where a zone offers the parcel module.
