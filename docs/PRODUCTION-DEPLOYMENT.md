# Phase 14 — Production deployment runbook

This project is a multi-tenant application. A successful container build is not proof that the application is safe to launch. Follow the sequence below in a staging environment first.

## Recommended topology

- Managed MongoDB (Atlas or equivalent), with TLS, least-privilege database user, backups, and network restrictions.
- API container from `backend/Dockerfile`.
- Static React frontend from `frontend/Dockerfile`, reverse-proxying `/api/` to the API and preserving the original tenant hostname.
- A trusted edge/load balancer providing HTTPS for the platform domain and hotel subdomains.
- Cloudinary (or another supported durable media provider) and a real email delivery provider.
- Paystack test credentials until payment, refund, webhook, and reconciliation workflows pass end-to-end tests.

`docker-compose.yml` intentionally does not start MongoDB. Production data should live in a managed database or a separately managed, backed-up database service. It also does not terminate TLS: publish the web container only behind a TLS-enabled edge proxy.

## Required configuration

1. Copy `.env.example` to `.env` for a single-host Docker deployment. Keep `.env` out of source control and restrict permissions (`chmod 600 .env`). On managed platforms, set variables in the platform's secret manager instead.
2. Set `NODE_ENV=production`, `DATABASE_URL`, two different random secrets of at least 32 characters, `CLIENT_URL` to HTTPS origins only, `PLATFORM_DOMAIN` to the bare base domain, and `TRUST_PROXY` to the actual trusted proxy hop count.
3. Configure Cloudinary for durable uploads. Local disk storage is not supported in production; the `none` provider means uploads may be unavailable.
4. Configure and verify SMTP. The current email implementation supports SMTP or console logging; console logging is not guest email delivery.
5. Set Paystack live keys only after test-mode payment, webhook, reconciliation, and refund tests pass. Configure SaaS plan prices in kobo only after approving pricing. Do not expose secret keys through `VITE_*` variables.
6. Make sure DNS routes the platform domain and hotel subdomains to the same frontend edge, and that API requests preserve the original `Host`/`X-Forwarded-Host` so tenant resolution continues to work. Configure any custom hotel domains through the existing supported domain-registration workflow.

## Preflight and release checks

Run from the repository root with production environment variables loaded into the shell (the script prints no values):

```bash
node scripts/production-preflight.mjs
npm run install:all
npm run check
npm run db:check
```

Integration tests require a dedicated test database whose database name ends in `_test`; never point `TEST_DATABASE_URL` at production. Review warnings from the preflight. Run the production build and smoke tests in staging before switching DNS or enabling live keys.

For a container build:

```bash
docker compose build --no-cache
docker compose up -d
docker compose ps
```

Check `https://<your-domain>/api/v1/health/ready` and `https://<your-domain>/healthz`. The readiness endpoint must only be exposed if your hosting policy permits public health checks; consider an edge access rule if needed.

## Proxy and cookie checks

`TRUST_PROXY` affects Express's client IP and secure-request detection. Do not copy the default value blindly. Count only trusted proxies and test that the application sees HTTPS requests as secure, that rate limiting uses the expected client address, and that refresh cookies have the intended Secure/SameSite/HttpOnly attributes. Never trust arbitrary client-supplied forwarded headers from a directly exposed API.

## Data migration and backups

- Inspect indexes and existing data before deploying schema/index changes.
- Take a verified backup before every production migration.
- Use `scripts/backup-mongodb.sh` to create a gzip archive and checksum when `mongodump` is installed.
- Restore only to a verified target using `scripts/restore-mongodb.sh` and its explicit confirmation variable. Perform a restore drill into a separate database before launch.
- Store backups encrypted, outside the application host, with retention and access controls. A backup is not verified until restoration has been tested.

## Launch gate

Do not launch live payments until all of the following are true:

- `npm run check` passes in CI on the exact release commit.
- Tenant isolation, role permissions, overlapping reservations, payment idempotency, refund uncertainty, subscription billing, and webhook handling have integration tests.
- A staging smoke test covers booking → payment verification → invoice → check-in → checkout, plus cancellation/refund and email failure/retry paths.
- The production database is backed up and a restore drill succeeds.
- Monitoring, log retention, alert ownership, support contact, incident response, and rollback steps are documented.
- Payment settlement ownership and hotel onboarding/contract terms are approved.

Phase 14 provides deployment assets and a runbook; it is not a production-readiness certification. Phase 13's subscription webhook and recurring-renewal gaps remain release blockers for automatic subscription billing.
