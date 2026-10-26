# Phase 6 — Production hardening progress

## Implemented in this development milestone

- Payment verification is repeatable: if a payment record is already successful, verification rechecks/reconciles the linked reservation instead of returning before repairing it.
- Conditional payment updates handle concurrent callback and webhook requests; a verifier that loses the update race re-reads the persisted successful payment before reconciling.
- A partial unique index on `(tenantId, reservationId)` for `status: INITIALIZED` blocks duplicate active payment attempts at the database layer. Review/reconcile existing duplicate attempts before applying this index to an existing production database.
- Room reservations are created before room-night inventory locks to reduce the risk of orphan inventory locks if the process stops mid-request. The unique room/night index remains the final overlapping-booking guard.
- Operations reporting uses hotel-local calendar-day boundaries based on the tenant's IANA timezone. Date boundaries account for daylight-saving changes where applicable.
- Tenant creation validates configured timezones.
- Added unit tests for date validity, hotel-local dates, UTC boundaries and daylight-saving transitions.

## Verification status

- ZIP archive integrity: checked after packaging.
- TypeScript syntax transpilation: 221 source/test files checked with TypeScript's transpile API; no syntax diagnostics.
- Full typecheck, lint, test suite, build, and database-backed integration tests: **not run** because project dependencies could not be installed in the previous environment.

## Required before production

1. Run `npm run install:all` and `npm run check` in an environment with package registry access and a dedicated test database.
2. Review MongoDB index creation on a staging copy first. The new partial unique index can fail if duplicate `INITIALIZED` payments already exist for a reservation.
3. Add/verify end-to-end tests for repeated and concurrent Paystack callbacks/webhooks, delayed success events, cancelled reservations with successful payments, and gateway/database failures.
4. Implement and review per-hotel Paystack settlement ownership, refunds, payment reconciliation/operations, monitoring, backups, and incident procedures before accepting live money.
