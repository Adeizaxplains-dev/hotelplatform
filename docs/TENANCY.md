# Multi-tenancy

One database, one codebase. A **tenant** is a hotel. Isolation is enforced in four independent layers, so a
mistake in one does not leak data.

## 1. The tenant comes only from the verified address

`middleware/tenantContext.ts` resolves the request's hostname (`req.hostname`, which honours `TRUST_PROXY`):

| Hostname | Result |
|---|---|
| `PLATFORM_DOMAIN` (or `www.` of it; `localhost` / `127.0.0.1` outside production) | **platform** scope (no hotel) |
| `<slug>.<PLATFORM_DOMAIN>` | that hotel |
| a **verified** custom domain (e.g. `www.grandhotel.com`) | the hotel it is mapped to |
| anything else (including unverified domains, `a.b.<slug>...`, look-alikes) | **unknown**: tenant routes return `404 TENANT_NOT_FOUND` |

A tenant id in the URL, query string, request body, header or browser storage is never read. Strict Zod schemas also
reject unknown fields such as `tenantId`.

## 2. Tokens are bound to a hotel

The access token carries the user, session and tenant ids (and nothing about role). `authenticate()` rejects a token
whose tenant differs from the hotel at the address being called (`403 TENANT_ACCESS_DENIED`). A platform token on a
hotel address, a hotel token on the platform address, and hotel A's token on hotel B's address all fail. The refresh
cookie is host-only (no `Domain`), `Path=/api/v1/auth`, `HttpOnly`, `SameSite=Strict`, `Secure` in production, and the
session row is looked up by tenant too, so one hotel's cookie never refreshes another's session.

## 3. Every query is pinned to a tenant (tripwire)

Tenant-owned models use `tenantScope()` (`database/plugins/tenantScope.ts`). Any `find`, `update`, `delete`, `count` or
`aggregate` whose filter does not set `tenantId` to a single concrete value throws `TenantScopeError` before reaching
MongoDB. `Room.findById(id)` therefore fails loudly in development and tests instead of leaking data. `{ $ne }`, `{ $in }`,
`undefined` and `$or` alternatives are rejected too. Cross-tenant platform work must say so with
`.setOptions({ skipTenantScope: true })` (used only by the platform audit view). `tenantRepository(Model, tenantId)` wraps
the common operations so service code cannot forget the filter. Do not `populate()` into tenant-owned models.

## 4. Resources are looked up inside the tenant

Looking up another hotel's record by id returns **404**, not 403, so existence is not revealed. Unique indexes include
the tenant (`{ tenantId, email }`), so the same email is two independent accounts in two hotels.

## Collections

Tenant-scoped: `users` (tenantId may be `null` for platform operators), `sessions`, `verificationtokens`, `auditlogs`,
`subscriptions`, `featureoverrides`. Platform-level (queried before the tenant is known): `tenants`, `tenantdomains`.
Rooms, guests, reservations, payments and the rest become tenant-scoped the same way as they are built, each with its own isolation test.

## Deployment requirements

* **Same-origin API.** The browser must call the API on the hotel's own address (`/api/v1` relative), e.g. through a
  Netlify/Vercel rewrite or one reverse proxy. That makes the refresh cookie first-party and lets the API see the hotel's host.
* Set `TRUST_PROXY` to the number of proxies in front of the API, and make sure the proxy forwards the original host as
  `X-Forwarded-Host`. **Verify this on your host before launch** (see Known issues).
* Wildcard DNS and TLS for `*.PLATFORM_DOMAIN`. Custom domains need DNS and a certificate on your proxy.

## Not implemented

* DNS-proof verification of custom domains (the platform operator marks them verified).
* Per-request tenant cache (the tenant is read from the database on each request).
