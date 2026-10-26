# Phase 15 — Final Acceptance & Launch Gate

Phase 15 is a release gate, not a declaration that production readiness has already been proven. A release owner must complete and record every applicable item below against a staging deployment using isolated test data.

## Automated checks

Run from the repository root:

```bash
npm ci --prefix backend
npm ci --prefix frontend
npm run check
npm run db:check
npm run preflight:production
```

`npm run check` runs backend/frontend typechecks, lint, tests, and production builds. `db:check` must point to a non-production database unless an approved maintenance window is explicitly in place. Production preflight validates configuration only; it does not prove that a live provider, DNS, TLS, or backup works.

## Booking and room inventory

- [ ] Two concurrent requests for the same room and overlapping dates cannot both complete.
- [ ] Non-overlapping reservations for the same room can both complete.
- [ ] Cancellation/no-show releases only the inventory owned by that reservation.
- [ ] Failed reservation creation does not leave permanent room-night records.
- [ ] Check-in is rejected for a dirty, maintenance, inactive, or already-occupied room.
- [ ] Checkout leaves the room dirty and requires housekeeping before it can be checked in again.
- [ ] Repeated status changes cannot repeat side effects or bypass the transition rules.

## Guest payments and refunds

- [ ] Paystack test transactions verify exact reference, amount in kobo, currency, and customer email.
- [ ] Browser callback and webhook delivery in either order produce one successful payment outcome.
- [ ] Duplicate, delayed, malformed, and invalid-signature webhooks do not duplicate side effects.
- [ ] A payment marked successful but interrupted before reservation reconciliation can be repaired by retry.
- [ ] Refund requests are not automatically resubmitted when the gateway outcome is unknown.
- [ ] Refund state and net financial totals match the gateway dashboard.

## SaaS billing

- [ ] The `/api/v1/billing/webhook` URL is configured in Paystack test mode and signature validation is exercised.
- [ ] Successful subscription checkout updates the correct tenant only after server-side verification.
- [ ] Duplicate callback/webhook delivery does not create duplicate plan-history rows or regress the current plan.
- [ ] Expired trial and paid-period behavior matches the documented plan policy.
- [ ] Monthly prices are configured as positive safe-integer kobo amounts and reviewed by the business owner.
- [ ] Automatic recurring charging is not advertised as available: current billing is manual monthly checkout, not automatic renewal.

## Tenant isolation and access control

- [ ] Cross-tenant read/write attempts are tested for rooms, reservations, payments, refunds, invoices, guests, notifications, staff, reports, and billing.
- [ ] Platform-only endpoints reject hotel users; hotel endpoints reject unauthenticated users.
- [ ] Sensitive routes are checked at the API layer, not only hidden in the UI.
- [ ] Logs and audit records do not contain passwords, tokens, payment secrets, or full payment credentials.

## Production operations

- [ ] HTTPS, DNS, custom domains, proxy trust, CORS, and cookie settings are tested on the real staging hostnames.
- [ ] A real email provider and durable image storage are configured and tested.
- [ ] A backup is created and restored into a separate database; recovery time and data loss expectations are documented.
- [ ] Monitoring alerts on application errors, database connectivity, failed jobs, payment webhook failures, and storage failures.
- [ ] A rollback procedure and responsible operator are identified.
- [ ] Paystack live mode remains disabled until test evidence is reviewed and approved.

## Sign-off record

Record the release commit, environment, test date, tester, unresolved defects, and explicit approval before launch. Any failed payment-integrity, tenant-isolation, booking-concurrency, backup-restore, or production build check is a **no-go** until corrected and rerun.
