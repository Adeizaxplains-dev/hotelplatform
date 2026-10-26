# Phase 13 — SaaS subscription and billing

## Implemented

- Added a tenant-scoped SaaS subscription record with `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELLED`, and `EXPIRED` lifecycle states.
- New hotels created through platform administration receive a 14-day trial for the plan selected at creation.
- Trial expiry is enforced when entitlement calculations run: the hotel is downgraded to the basic `WEBSITE` plan and its subscription is marked `EXPIRED`.
- Added a separate tenant-scoped SaaS billing payment model. These records are separate from guest accommodation payments.
- Added Paystack checkout initialization and server-side transaction verification for monthly hotel subscription payments.
- Only activates a subscription after the provider's verified amount, currency, reference, and customer email match the stored checkout record.
- Added an idempotency guard on successful billing payment records and history protection for subscription plan history entries.
- Added owner-only billing APIs and a subscription dashboard with trial status, available plans, checkout, callback verification, and payment history.
- Monthly plan prices are configured in integer kobo through `SAAS_WEBSITE_MONTHLY_KOBO`, `SAAS_BOOKING_MONTHLY_KOBO`, and `SAAS_MANAGEMENT_MONTHLY_KOBO`. If a price is missing or invalid, checkout is disabled for that plan rather than assuming a price.
- Added unit tests for safe pricing configuration parsing.

## API endpoints

All endpoints are mounted at `/api/v1/billing` on the hotel's tenant hostname and require an authenticated hotel user. Starting a trial, checking out, verifying a payment, and viewing billing history require the `settings.update` permission (currently hotel-owner level).

- `GET /plans` — plan catalog and configured prices.
- `GET /current` — current subscription/trial state.
- `POST /trial` — start a one-time 14-day trial when none exists.
- `POST /checkout` — initialize a monthly subscription payment; body: `{ "plan": "WEBSITE" | "BOOKING" | "MANAGEMENT" }`.
- `POST /verify` — verify a payment; body: `{ "reference": "..." }`.
- `GET /history` — paginated SaaS subscription payment history.

## Configuration

Set the three `SAAS_*_MONTHLY_KOBO` values only after the commercial prices are approved. For example, ₦15,000/month is `1500000` kobo. The existing `PAYSTACK_SECRET_KEY` is used; never put secret keys in frontend variables.

## Important limitations / release blockers

- This phase uses one-time monthly checkout transactions, not automatic recurring card debits. Renewal reminders, grace periods, and scheduled dunning are not implemented.
- The guest-payment webhook is not yet extended to process `SAAS-` references. The browser callback verifies subscription payments; add signed webhook support and reconciliation before production use.
- Expired trials and paid periods are downgraded to the basic website when entitlement checks run; there is no background scheduler or grace period. Production should add a scheduled lifecycle worker and monitoring.
- Subscription refunds, cancellation-at-period-end workflows, invoices/tax, and platform revenue reporting are not implemented.
- Existing tenants created before this phase do not automatically receive a trial record. Their existing plan remains in place until the platform operator migrates them or the owner starts billing.
- MongoDB indexes must be built and verified in the target database before deployment.
- Full dependency-backed typecheck, lint, tests, and production builds have not been completed in this environment.
