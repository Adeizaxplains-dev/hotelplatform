# Phase 7 change log

- Added a tenant-scoped, idempotent guest notification outbox.
- Added guest email events for reservation request, reservation status changes, and verified payment receipts.
- Email delivery failures are recorded without rolling back bookings or payments.
- Production console email now fails explicitly instead of silently pretending delivery succeeded.
- Booking confirmation now includes guest/status details and print / save-to-PDF action.
- Removed a duplicate import in the payment routes module.

Verification is pending dependency installation and execution of the full test/build suite.
