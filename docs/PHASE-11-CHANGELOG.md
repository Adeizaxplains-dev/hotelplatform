# Phase 11 — Integration Testing & Financial Unit Consistency

## Critical correction: currency minor units

The domain model, room-price validation, frontend formatters, and public API contract store monetary amounts as integer minor units (kobo for NGN). Payment initialization, verification, refund submission, and reconciliation previously multiplied or compared these values as if they were major units. That could request a payment 100 times larger than the displayed booking amount and would reject a correctly paid gateway transaction.

Phase 11 now:

- Sends stored integer kobo directly to Paystack's `amount` field.
- Compares Paystack's returned amount directly against the stored integer kobo value.
- Sends stored integer kobo directly for full refunds.
- Compares reconciliation amounts in the same minor unit.
- Formats backend guest emails using major currency units derived from minor units.
- Formats the operations report's successful-payment totals with the shared frontend money formatter.
- Adds unit tests for safe integer validation, exact gateway amount matching, and kobo-to-naira display conversion.

## Security / correctness checks to run

From the project root, after installing dependencies and configuring the test MongoDB URL:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The integration suite uses MongoDB and must run against a dedicated test database. Do not point it at production data.

## Release gate

This change has not been certified against a live Paystack account. Verify payment initialization, a successful test transaction, webhook delivery, repeat verification, full refund, and reconciliation in Paystack test mode before enabling live credentials. Confirm room-price entry screens and API values are understood as kobo by the API and converted to naira only for display.
