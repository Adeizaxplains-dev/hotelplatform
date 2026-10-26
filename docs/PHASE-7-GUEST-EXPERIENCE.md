# Phase 7 — Guest experience and notifications

## Included

- Guest notification outbox with tenant-scoped unique event keys, attempt counts, and `PENDING` / `SENDING` / `SENT` / `FAILED` states.
- Reservation request emails are queued after a reservation and its room-night inventory are created.
- Guest status updates are queued when staff confirm, cancel, check in, check out, or mark a reservation as a no-show.
- A payment receipt notification is queued after server-side payment verification. The notification is idempotent and can retry failed sends when the same event is processed again.
- Email failure does not roll back a valid reservation or payment. Failed sends are retained in MongoDB for future retry/operations tooling.
- Booking confirmation page now shows guest, reservation and payment status, and offers browser print / save-to-PDF.
- Production console email provider now fails clearly rather than reporting success while not sending any email.
- Fixed a duplicate import in the payment routes file discovered during the phase review.

## Important limitations

- The included `ConsoleEmailService` is not a real delivery provider. In production it throws, so notifications are recorded as failed until a real SMTP/API provider is configured and injected.
- This phase does not yet include an admin UI to inspect/retry failed outbox records; the persistence model is the foundation for that screen in a follow-up phase.
- There is no WhatsApp delivery integration in this phase.
- No production readiness claim is made until the complete test suite and deployment checks pass.

## Suggested verification

1. Configure a real email provider and inject it as the `EmailService` implementation.
2. Create a website reservation and confirm a `GuestNotification` row exists with a stable event key.
3. Confirm the email provider receives one reservation request email.
4. Repeat a reservation status request / payment verification and confirm it does not duplicate an already sent event.
5. Force provider failure and confirm the outbox row becomes `FAILED`; re-run the same event and confirm it can retry.
6. Run backend typecheck, lint, unit/integration tests and frontend production build against a test MongoDB before deploying.
