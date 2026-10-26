# Phase 14 — Production deployment assets

## Added

- Production multi-stage Dockerfile for the TypeScript API, running as the unprivileged Node user.
- Static frontend Docker image with Nginx SPA fallback, same-origin `/api/` reverse proxy, and basic browser security headers.
- Docker Compose wiring for API + frontend; MongoDB remains external by design.
- Production preflight script that checks required environment configuration and warns about optional integrations without printing secrets.
- MongoDB backup and explicitly guarded restore scripts.
- Deployment, proxy, health-check, backup, release-gate, and rollback guidance.

## Important limitations

- No Docker build or live deployment has been run in this environment.
- A container build does not replace dependency-backed typecheck, lint, tests, and build (`npm run check`).
- TLS termination and DNS are expected at a trusted edge and must be configured by the operator.
- Proxy hop count must match actual infrastructure; validate client IP and secure cookie behavior.
- SaaS subscription webhook handling and automatic recurring renewal remain incomplete and are launch blockers for automatic billing.
