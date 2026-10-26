# Phase 15 — Final Acceptance & Launch Preparation

## Changes

- Added Paystack subscription webhook endpoint at `/api/v1/billing/webhook`, mounted before JSON body parsing and tenant-host resolution so the exact raw request body is available for signature validation.
- Subscription webhook processing accepts only signed `charge.success` events and uses server-side Paystack verification before applying a plan.
- Made subscription verification repair an already-successful billing payment when the plan/subscription write was interrupted, instead of returning early and leaving a tenant on the wrong plan.
- Added an explicit UTC calendar-month helper and tests for month-end dates (including leap years) for subscription periods.
- Documented a release acceptance gate and added a static `release:acceptance` asset/wiring check.
- Added `release:check` to run project checks, database checks, production preflight, and the release asset check in sequence.

## Known release blockers / limitations

- Dependencies and the full test/typecheck/build suite must be run in a connected environment; this package must not be treated as production-certified based on syntax checks alone.
- Subscription payments still require a new checkout each month; automatic recurring charges, scheduled lifecycle processing, and complete renewal recovery are not implemented.
- Paystack test-mode webhook delivery, duplicate-event behavior, tenant-isolation tests, booking concurrency, refunds, database backup/restore, and a real staging deployment must be verified before launch.
- A webhook acknowledges an unknown subscription reference without activating a plan. Investigate provider logs and internal billing records if this occurs.
- Manual acceptance sign-off remains mandatory. A successful static release asset check is not a launch approval.
