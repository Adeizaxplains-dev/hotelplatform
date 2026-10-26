# Architecture (Phases 0–3 in progress)

A **modular monolith**: one API process, one frontend app, one MongoDB database. Multiple hotels are tenants
inside the same codebase and database; request tenant context is resolved from the verified hostname.

## Request pipeline (implemented)

```
request → request id → structured logging → helmet → origin guard + CORS (known sites only)
        → /api/v1/health (exempt from rate limiting)
        → rate limit → JSON body (size-limited) → cookies → Mongo-operator rejection
        → TENANT CONTEXT (from the verified hostname)
        → per route: active tenant → authenticate (token + live session + current user + tenant match)
                     → permission (RBAC) → feature entitlement → validation (strict Zod)
                     → controller → service → tenant-pinned queries → audit
        → 404 → central error handler
```

Authentication follows tenant resolution (the spec lists them the other way round) because sign-in itself needs to
know which hotel the address belongs to; `authenticate` then requires the token's tenant to equal the address's tenant.

## Backend (`backend/src`)

| Folder | Purpose |
|---|---|
| `config/` | `env.ts` Zod-validated environment (fails fast, never echoes values); `bootstrap.ts` loads `.env` and validates |
| `middleware/` | requestId, requestLogger, security (helmet + CORS), rateLimit, sanitize, validate, notFound, errorHandler |
| `modules/health/` | liveness and readiness |
| `modules/auth/` | login, refresh rotation, reset/invite/verify tokens, sessions |
| `modules/tenants/` | tenants, domains, plan history, platform operator API |
| `modules/users/` | hotel staff management |
| `modules/rbac/` | roles, permissions, rank rules |
| `modules/entitlements/` | plans, features, limits, overrides |
| `modules/audit/` | immutable audit log |
| `modules/hotel/` | hotel profile (contact, policies, branding, SEO) and website content |
| `modules/rooms/` | room types, rooms, amenity catalogue |
| `modules/reservations/` | public availability, reservation lifecycle, room-night inventory allocations |
| `modules/website/` | facilities and gallery |
| `modules/media/` | image upload validation, ownership, library |
| `modules/public/` | the public, unauthenticated website read API |
| `database/` | Mongoose connection, status and ping |
| `shared/` | typed errors, response contract helpers, logger, version |
| `integrations/` | email abstraction (console + in-memory); image storage abstraction (Cloudinary, local disk, in-memory); Paystack arrives in Phase 4 |

`createApp({ env, logger, email?, ... })` builds a service container (`container.ts`) and takes everything by injection, so tests build isolated apps.

### Response contract

Success `{ "success": true, "data": ... }`. Error `{ "success": false, "error": { "code", "message", "details?", "requestId" } }`.
Status codes: 400 validation, 401, 403, 404, 409, 413 payload too large, 422 business rule / payment, 429, 500, 503.

## Frontend (`frontend/src`)

React 19, React Router (lazy routes), TanStack Query, Tailwind v4 tokens in `styles/index.css`.
`services/apiClient.ts` is the only place that calls `fetch`; it never reads or writes web storage.
`components/ui` and `components/feedback` hold the design-system primitives built so far
(Button, Input, Badge/StatusBadge, Card, Spinner, Skeleton, Alert, EmptyState, ErrorState, BrandMark).
The `public-site/` and `admin/` contain the Phase 2 website/configuration flows and the first Phase 3 booking/reservation workflows; several `features/*` folders remain placeholders for later phases.

## Decisions taken in Phase 1

1. **Same-origin API** (relative `/api/v1`, Vite proxy in development, host rewrite in production) so the refresh cookie is first-party.
2. **Tenant from the verified hostname only** (platform domain, `<slug>.<platform domain>`, verified custom domains). See [TENANCY.md](TENANCY.md).
3. **Roles, permissions and plans are code**, not collections: reviewed, versioned and tested; a hotel stores only its plan and overrides.
4. **Invites instead of passwords**: staff and owners set their own password through a one-time email link.
5. **Subscription** is an append-only history of plan changes; billing of the SaaS fee itself is not implemented.

## Frontend structure (Phase 2)

`public-site/` is the hotel website (shell, pages, components); `admin/` is the hotel back office (layout, pages, image picker); both render inside the same app and the
server's answer to "what address is this?" decides which one a visitor gets. See [WEBSITE.md](WEBSITE.md).
