# Hotel Platform

One multi-tenant platform for hotel websites, online booking and hotel management. Hotels subscribe to
**WEBSITE**, **BOOKING** or **MANAGEMENT** and upgrade without migrating data.

**Current status: Phases 0–5 provide the multi-tenant foundation, authentication/RBAC, hotel website configuration, booking and initial Paystack payment flows, housekeeping and daily operations reporting. Phase 6 adds payment retry/reconciliation hardening, a database-level guard against duplicate active payment attempts, safer room-night allocation ordering, and hotel-local reporting date boundaries. This is still a development build: a full typecheck, lint, test suite and production deployment review are required before live use.** See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/API.md](docs/API.md) for details.

## Requirements

Node.js 22 (see `.nvmrc`), npm, and MongoDB (Atlas or local). Tests need a MongoDB too (see [docs/TESTING.md](docs/TESTING.md)).

## Quick start

```bash
npm run install:all
cp .env.example .env            # then fill DATABASE_URL and the two token secrets
# first platform operator (password is read from the environment, never typed on the command line)
PLATFORM_ADMIN_EMAIL=you@example.com PLATFORM_ADMIN_NAME="Your Name" PLATFORM_ADMIN_PASSWORD='a-long-passphrase' npm --prefix backend run admin:create
npm run dev:api                 # http://localhost:5000
npm run dev:web                 # http://localhost:5173  (proxies /api to the API)
```

To see a finished hotel website straight away:

```bash
npm --prefix backend run seed:demo      # builds "Palm Court Hotel" with rooms, content and representative photo fallbacks
# then open http://palmcourt.localhost:5173   (admin: owner@palmcourt.example.com / Palm-Court-Demo-2026 at /login)
```

Otherwise open http://localhost:5173/login and sign in as the operator, then create a hotel from `/platform`'s API
(`POST /api/v1/platform/tenants`; a management screen is planned). The owner receives an invite link (printed in the API log in
development) and signs in at `http://<slug>.localhost:5173/login`. Hotels use subdomains, so use `*.localhost` in development.

## Commands

| Command | What it does |
|---|---|
| `npm run check` | typecheck + lint + tests + build, both apps (needs MongoDB for the backend integration tests) |
| `npm run typecheck` / `lint` / `test` / `build` | the same steps individually |
| `npm run db:check` | connects to `DATABASE_URL` and pings it (never prints the URL) |

## Layout

```
backend/    Express + TypeScript + Mongoose API (modular monolith)
frontend/   React + Vite + TypeScript + Tailwind app
docs/       Architecture, security, testing, API (only what exists)
tests/      Reserved for end-to-end tests
```

## Roadmap

0 Foundation (done) · 1 Auth + multi-tenancy (done) · 2 Hotel config + CMS + public site (done) · 3 Booking engine (foundation) ·
4 Payments (initial integration) · 5 Management (housekeeping + daily operations foundation) · 6 Production hardening (in progress).


## Phase 4 progress: Paystack webhook

The payment module now exposes `POST /api/v1/payments/webhook`, mounted before the JSON parser and tenant-host middleware so it can validate Paystack's signature over the original request bytes and work with server-to-server calls. Valid `charge.success` notifications are re-verified directly with Paystack before updating the payment and reservation. Signature unit tests were added.

This remains a development milestone, not a production certification. Run `npm run install:all`, then `npm run check`; integration tests require a dedicated MongoDB test database ending in `_test`. Do not enable live payments until the build/tests pass and payment idempotency, webhook retries, reconciliation, settlement ownership, and refund procedures have been reviewed.

## Phase 5 progress: housekeeping and daily operations

- Added tenant-scoped housekeeping list and status-update endpoints with an explicit transition workflow and audit events.
- Added a daily operations report API for occupancy, room inventory, arrivals/departures, in-house reservations, new bookings, housekeeping status counts and successful Paystack payments.
- Added hotel admin screens for housekeeping and the daily operations report, gated by role permissions and plan features.
- The report uses the hotel’s configured IANA timezone for calendar-day boundaries and successful payment records only; full accounting reports remain future work.

Run `npm run check` from the repository root before deployment. The current environment could not complete dependency installation in the prior phase, so this ZIP is a development milestone and has not been certified by a successful full build/test run.


## Phase 6 progress: production hardening

- Payment verification now repairs the reservation on repeat verification if an earlier request persisted a successful payment but failed before reconciling the reservation. Concurrent callback/webhook verification uses conditional payment-state updates and re-reads the persisted success state.
- A partial unique index prevents more than one `INITIALIZED` payment attempt for the same hotel reservation. This index must be applied successfully to the target MongoDB before enabling payments; existing duplicate active attempts must be reconciled first.
- Reservation creation now writes the reservation before room-night locks, reducing the risk of orphan inventory locks after a process crash. The unique room/night index remains the concurrency guard.
- Operations reports use the hotel's configured timezone, including daylight-saving-aware UTC boundaries for hotels in regions that observe daylight saving time. Invalid IANA timezones are rejected when creating a hotel.
- Added focused unit tests for local calendar dates, timezone conversion and daylight-saving boundaries.

**Verification limitation:** dependencies could not be installed in this environment, so the complete TypeScript, lint, test and build commands have not been run. Before deployment, run `npm run install:all` and `npm run check`; inspect existing payment records before creating the new partial unique index. Keep Paystack in test mode until payment settlement ownership, refunds, reconciliation procedures and end-to-end webhook retries have been reviewed.

## Phase 7 — Guest experience and notifications

See `docs/PHASE-7-GUEST-EXPERIENCE.md` for guest reservation/status emails, payment receipts, the idempotent tenant-scoped notification outbox, and current email-provider limitations.


## Phase 8 — Finance & Guest Administration

Phase 8 adds tenant-scoped invoice issuance, reservation-backed guest lookup, and a currency-separated financial report. See `CHANGELOG-PHASE-8.md` and `docs/PHASE-8-FINANCE.md` for route details and production limitations.


## Phase 9 — Financial controls

Phase 9 adds a payment-controls screen for read-only Paystack reconciliation and full-refund request tracking. See `docs/PHASE9_CHANGELOG.md` and `docs/API.md` for endpoint permissions and safety limits. Refunds are live gateway actions when production credentials are configured; test in Paystack test mode first. A refund in `PROCESSING` or `UNKNOWN` is not confirmed as complete, and ambiguous outcomes must be checked in the Paystack dashboard.

## Phase 11 — Integration Testing & Financial Unit Consistency

See [`docs/PHASE-11-CHANGELOG.md`](docs/PHASE-11-CHANGELOG.md). The phase corrects the payment/refund minor-unit conversion and adds regression tests. Run the full release checks before deployment; passing syntax checks alone is not a production-readiness guarantee.

## Phase 12 — Hotel operations consistency

Phase 12 strengthens front-desk check-in/check-out transitions. Check-in now requires an active room that is available and marked clean or inspected; checkout requires the assigned room to be marked occupied. Reservation status changes use conditional database writes so simultaneous staff actions cannot silently overwrite each other. Failed competing transitions return a conflict response, and room state is conditionally rolled back when a reservation transition loses a race. See `CHANGELOG-PHASE-12.md` for limitations and verification status.

## Phase 13 — SaaS subscription and billing

Hotel owners can manage the hotel subscription from `/admin/billing`. New hotels created by the platform receive a 14-day trial. Configure the monthly plan prices in integer kobo using `SAAS_WEBSITE_MONTHLY_KOBO`, `SAAS_BOOKING_MONTHLY_KOBO`, and `SAAS_MANAGEMENT_MONTHLY_KOBO`; missing prices intentionally disable checkout. Guest accommodation payments and SaaS subscription payments use separate database records.

See [`CHANGELOG-PHASE-13.md`](./CHANGELOG-PHASE-13.md) for endpoints, setup, and release blockers. This is not production-certified: subscription webhook handling, renewal automation, and a full dependency-backed verification run are still outstanding.

## Phase 14 — Production deployment assets

Phase 14 adds API/frontend Docker images, a Docker Compose deployment for the application tier, a production configuration preflight, and guarded MongoDB backup/restore scripts. Start with [`docs/PRODUCTION-DEPLOYMENT.md`](docs/PRODUCTION-DEPLOYMENT.md) and [`docs/BACKUP-RESTORE.md`](docs/BACKUP-RESTORE.md). The Compose stack deliberately uses an external MongoDB database and expects TLS/DNS at a trusted edge. Set `TRUST_PROXY` to the real proxy topology; do not copy a sample value blindly.

Run `npm run preflight:production` with the production environment loaded, then run `npm run check` in CI and test deployment in staging. Phase 14 assets have not been deployed or container-built in this environment. Automatic SaaS subscription renewal and subscription webhook handling remain release blockers.

## Phase 15 — final acceptance and launch gate

Phase 15 adds Paystack webhook processing for SaaS subscription payments, recovery of a subscription plan update after an interrupted successful payment, calendar-month boundary tests, and a release acceptance checklist. See `CHANGELOG-PHASE-15.md` and `docs/RELEASE-ACCEPTANCE-PHASE-15.md`.

- Configure Paystack test webhook delivery to `/api/v1/payments/webhook` for guest payments and `/api/v1/billing/webhook` for SaaS subscription payments.
- Run `npm run release:acceptance` for a static release-assets/wiring check.
- Run `npm run release:check` only after dependencies and a suitable test database are available. It includes the full check suite and database/preflight checks.
- A passing static check is not production sign-off. The full test/typecheck/build suite, staging payment tests, tenant-isolation checks, and backup restoration must pass before launch.


## Phase 16 — Frontend photography refresh

- Replaced the old generated Palm Court demo illustration assets with representative photographic fallbacks served by Unsplash's image CDN.
- Added a full-bleed, four-slide homepage carousel featuring bright hotel rooms and suites, with autoplay, manual previous/next controls, slide indicators, pause-on-hover/focus, and reduced-motion support.
- Public room cards/detail pages, the About page, Facilities page, and Gallery page now use photographic fallbacks when hotel-owned images are missing. The gallery explicitly identifies fallback photos as representative.
- Added a compatibility fallback for older demo databases that still contain the previous Palm Court illustration assets.
- Updated demo seeding so new demo databases do not upload the old vector illustrations.

The stock photos are remote CDN images and require internet access. Before publishing a real hotel's website, upload the hotel's own property photography and review the image-source/license notes in `docs/PHOTO-CREDITS.md`. The frontend syntax scan passed, but dependencies are not installed in this environment, so the full typecheck, lint, frontend tests, and production build have not been run.
