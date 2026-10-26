# Phase 10 — Reliability, Automation & Release Readiness

## Implemented
- Added tenant-scoped guest notification administration endpoints.
- Added a staff screen to inspect notification status, attempts, recipient, subject, timestamps, and provider errors.
- Added manual retry for notifications in `FAILED` status only; `SENT`, `SENDING`, `PENDING`, and uncertain outcomes are not retryable through this endpoint.
- Added a five-attempt ceiling to automatic claims and manual retries.
- Persisted the email text/HTML body for future retries while excluding bodies from ordinary list responses.
- Added an audit record for manual retry attempts.
- Added `notifications.read` and `notifications.retry` permissions for hotel owners and managers.
- Added API and frontend navigation at `/admin/notifications`.

## Operational cautions
- Retrying after a provider timeout can still send a duplicate if the provider accepted the earlier message. The UI asks for confirmation and the action is audited.
- Older failed notifications created before body persistence may not be retryable; the API reports this instead of inventing message content.
- Email bodies can contain personal guest data. Restrict access, secure the database, and define a retention policy.
- A real production email provider and background worker are still needed for dependable delivery. The console provider is not a delivery service.

## Verification status
- ZIP integrity will be checked for this artifact.
- Full typecheck, test suite, and production build require installing the repository dependencies and remain unverified unless explicitly reported otherwise.
