# Phase 8 — Finance and Guest Administration

## Added
- Tenant-scoped invoice snapshots generated idempotently from a reservation, with a stable invoice number (`INV-<reservation reference>`).
- Invoice listing/search and single-invoice retrieval. Invoice paid amount and outstanding balance are derived from successful payment records rather than editable fields.
- Reservation-backed guest directory grouped by normalized email, including recent reservation history.
- Hotel-timezone financial report with payment collection, invoices issued, reservation bookings, and outstanding invoice balances grouped by currency.
- Admin screens for guest directory, invoices, and financial reports, protected by permission and plan-feature checks.

## Financial safety notes
- This is an operational report, not a statutory accounting ledger. It does not include expenses, taxes, chargebacks, payout settlement timing, or confirmed refunds.
- The invoice generator currently creates one accommodation line from the reservation total. Tax, discounts, deposits, and manual adjustments are not modeled.
- Guest profiles are derived from reservation data and grouped by email; no independent guest master record is created.
- Invoice issuance is idempotent per reservation. Concurrent duplicate attempts return the existing invoice when the duplicate reservation index wins.
- Successful payments are the source of truth for collected totals; pending and failed attempts are excluded.

## Routes
- `GET /api/v1/invoices?page=1&limit=25&q=`
- `POST /api/v1/invoices` with `{ "reservationId": "<ObjectId>" }`
- `GET /api/v1/invoices/:id`
- `GET /api/v1/guests?page=1&limit=25&q=`
- `GET /api/v1/reports/financial?from=YYYY-MM-DD&to=YYYY-MM-DD`

## Verification
The source was checked for TypeScript/TSX transpilation diagnostics and ZIP integrity. Full typechecking, lint, automated tests, and a production build require installing project dependencies and running the project's own scripts. Do not deploy to production until those checks and payment/invoice reconciliation scenarios pass.
