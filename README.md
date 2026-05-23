# BiteExpress Customer Web App

The customer-facing web app for [BiteExpress](https://bite.express) — Nigeria's home for fast food delivery, groceries, pharmacy and more.

This is **not** the marketing site ([biteexpress-web](https://github.com/biteexpress-ng/bite.express) → bite.express). This is the authenticated shopping experience, deployed at **app.bite.express**.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (CSS-first `@theme` config, brand tokens mirrored from the marketing site)
- **next-intl 4.x** (no-routing mode, English-only at launch)
- **Zustand** for auth + cart state
- **Bearer-token auth** in `localStorage` (compatible with the existing 6amMart Laravel backend at `dashboard.bite.express`)
- **Paystack** inline popup for payments (loaded via `<Script>` in the root layout — `window.PaystackPop`)
- **@react-google-maps/api** for address autocomplete + delivery-zone geometry checks
- **Laravel Echo + pusher-js** wired to **Laravel Reverb** for real-time order tracking

## Local dev

```bash
cp .env.example .env.local
# Fill in NEXT_PUBLIC_API_BASE_URL, Google Maps key, Paystack public key, Reverb config
npm install
npm run dev
```

Open <http://localhost:3000>.

## Environment variables

See `.env.example`. The minimum to boot:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical app URL (`https://app.bite.express` in prod) |
| `NEXT_PUBLIC_API_BASE_URL` | 6amMart Laravel API base (`https://dashboard.bite.express`) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Browser-key restricted to `*.bite.express` + `localhost` |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Paystack public key (`pk_live_…` / `pk_test_…`) |
| `NEXT_PUBLIC_REVERB_APP_KEY` | Laravel Reverb app key |
| `NEXT_PUBLIC_REVERB_HOST` | Reverb host (`reverb.bite.express`) |
| `NEXT_PUBLIC_REVERB_PORT` | `443` in prod |
| `NEXT_PUBLIC_REVERB_SCHEME` | `https` in prod |

## Architecture notes

- **Auth.** `src/lib/auth.ts` is the single source of truth for the token in `localStorage` (key: `biteexpress.auth`). `src/lib/auth-store.ts` (Zustand) wraps it for React. `AuthProvider` mounts cross-tab `storage` listeners + a `biteexpress:auth-expired` listener that fires on 401 responses from the API client.
- **API.** `src/lib/api-client.ts` injects the bearer token, canonical headers (`X-software-id: 33571750`, `X-localization`, `origin`, `Accept`), and optional geo headers (`zoneId`/`moduleId`/`lat`/`lng`). Returns an `ApiResult` discriminated union (`ok` / `skipped` / `failed`).
- **Brand.** Tokens are duplicated from `biteexpress-web/src/app/globals.css` rather than extracted into a shared package — the two apps deploy on different cadences and we want them decoupled.
- **Routing.** Customer header is always opaque white (the marketing site goes transparent over the dark hero — that pattern is **not** ported here).

## Related repos

- **[biteexpress-ng/bite.express](https://github.com/biteexpress-ng/bite.express)** — public marketing site (`bite.express`)
- **dashboard.bite.express** — Laravel admin + API backend (private)
- **biteexpress-user-app** / **biteexpress-rider-app** — Flutter apps consuming the same API

## Status

V0 foundation — see the welcome page for the current feature gate.
