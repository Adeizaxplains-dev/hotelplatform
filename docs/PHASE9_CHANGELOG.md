# Phase 9 — Financial controls and reconciliation

## Added
- Tenant-scoped refund-request records with a unique one-refund-request-per-payment constraint.
- Full-refund request integration with Paystack, including amount conversion to minor units and explicit handling of ambiguous provider outcomes.
- Authenticated `payments.read` endpoints for read-only payment reconciliation and refund history; `payments.refund` is required to initiate refunds.
- Reconciliation compares local successful records with Paystack's current transaction verification response and flags reference, status, amount, currency, and customer-email differences.
- Processed refunds are shown separately in the financial report and deducted from the successful-payment amount used to calculate invoice balances.
- Admin payment controls screen with date-range reconciliation, refund history, and permission-aware full-refund actions.
- Unit tests for Paystack refund request payloads and provider rejections.

## Safety limits and remaining work
- Only full refunds are supported; partial refunds are not.
- Refunds that remain `PROCESSING` or `UNKNOWN` need manual confirmation in Paystack. This phase does not yet poll for asynchronous refund completion or consume refund webhooks.
- An `UNKNOWN` outcome must not be retried automatically because the gateway may already have accepted the request.
- Reconciliation is read-only and limited to 25 records per request; a maximum 31-calendar-day window prevents excessive provider calls.
- No live Paystack transaction, refund, database integration test, full typecheck, or production build was run in this environment. Do not enable live refunds until the project is built and tested against Paystack test mode and a database replica of production indexes.
