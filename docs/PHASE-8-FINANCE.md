# Phase 8 — Finance & Guest Administration

Invoices are tenant-owned snapshots linked to a reservation. The unique tenant/reservation index prevents more than one invoice per reservation. The invoice number is derived from the reservation reference, and all reads and writes pin the tenant ID.

The invoice balance is calculated from successful payment records linked to that reservation. Never edit the calculated balance manually. The financial report separates currencies rather than converting them and uses the hotel's IANA timezone for date windows.

The guest directory is derived from reservations and groups records by lowercased email. It does not yet provide independent guest-profile editing or deletion.

Before production, verify MongoDB indexes on existing databases, successful and failed Paystack callbacks, partial payment handling, duplicate webhook delivery, data migration, invoice printing in supported browsers, and role/tenant isolation. Refunds are not issued by this phase; do not mark a payment refunded unless a real gateway refund has been confirmed and recorded.
