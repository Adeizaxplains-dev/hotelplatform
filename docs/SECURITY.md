# Security

Only controls that exist and are tested are listed. Status per area: **COMPLETE** means implemented and covered by
automated tests in this repository; **PARTIAL** and **NOT IMPLEMENTED** are called out.

## Platform foundation (Phase 0): COMPLETE

Validated environment (fail fast, no secret echo), helmet, strict origin allow-list, rate limiting with the error
contract, body size limit, NoSQL operator rejection (`$` and dotted keys) plus Mongoose `sanitizeFilter`, Zod validation
middleware, central error handler (no stack traces or internals), request ids, structured logs with redaction (query strings
and auth headers are never logged).

## Authentication and sessions (Phase 1): COMPLETE

| Control | Where |
|---|---|
| Passwords: Argon2id, min 10 / max 128 chars, common-password and email-derived checks | `shared/password.ts` |
| Same error for unknown email, wrong password and locked account; dummy hash keeps timing similar | `auth.service.ts` |
| Lockout: 5 wrong passwords lock the account for 15 minutes; per IP+email throttle (10 / 15 min) | `auth.service.ts`, `auth.routes.ts` |
| Short-lived access token (HS256, issuer/audience/algorithm pinned); role is never read from it | `token.service.ts` |
| Refresh token: opaque, stored only as HMAC, rotated on every use, **reuse revokes the session** | `auth.service.ts` |
| Refresh cookie: HttpOnly, SameSite=Strict, path-scoped, host-only, Secure in production | `auth.controller.ts` |
| Access token kept in memory only (never localStorage/sessionStorage/cookies); silent refresh is single-flight | `frontend/src/services` |
| Logout, logout-all, session revocation on password reset and on disabling a user | `auth.service.ts`, `user.service.ts` |
| Password reset and invites: single-use, 1 h / 72 h, newer link voids older, response never reveals if an email exists | `oneTimeToken.service.ts` |
| Email verification token flow (`/auth/verify-email`) | `auth.service.ts` |
| CSRF: the only cookie-authenticated routes are `/auth/*`; cookie is SameSite=Strict and path-scoped, and browser requests with a foreign Origin are refused (403) before any handler | `middleware/security.ts` |

## Tenant isolation, RBAC, entitlements (Phase 1): COMPLETE for what exists

See [TENANCY.md](TENANCY.md) and [RBAC.md](RBAC.md). Isolation is proven for users, sessions, audit logs, tokens, cookies, hosts and
custom domains, and for the shared tenant-scoped repository mechanism. The room, reservation, guest and payment isolation
tests are **NOT IMPLEMENTED** because those resources do not exist yet; each will get its own test when built.

## Website, content and media (Phase 2): COMPLETE for what exists

| Control | Where | Tested |
|---|---|---|
| Upload validated by magic bytes, size and pixel limits; client name and type never trusted; SVG/GIF/PDF/HTML/EXE refused | `media.service.ts` | yes |
| Hotel-scoped image ownership: another hotel's image id is refused when attached to rooms, gallery, content or branding | `media.service.ts` | yes (mutation-checked) |
| Opaque per-hotel storage folder; tenant id never in public URLs | `media.service.ts` | yes |
| Plain-text-only content (HTML rejected), https-only host-checked social links, Google-embed-only map URL, strict schemas | `shared/validation.ts` | yes |
| Public API is an allow-list: no ids, tenant ids, room numbers, hidden items | `public.service.ts` | yes |
| Room, room type, facility, gallery isolation between hotels (404 on cross-hotel ids), per-hotel unique numbers and slugs | rooms/website services | yes |
| Plan limits `maxRooms`, `maxGalleryImages` enforced | rooms/website services | yes |
| JSON-LD escaping (`<`, `>`, `&`) so editor text cannot close the script tag; editor text rendered as text | `lib/jsonld.ts`, React | yes |
| Local image files served with `nosniff`, no directory listing, development only | `app.ts` | live-checked |
| Unique indexes the rules rely on are verified to exist (a duplicate index declaration once silently dropped one) | models | yes |

Not covered: scanning uploaded images for malware or decodability (Cloudinary rejects undecodable files; the local provider only checks headers).

## Audit log (Phase 1): COMPLETE

Append-only (`updateOne`, `deleteOne`, `save` on existing rows all throw). Before/after snapshots are scrubbed of anything
password/token/secret/hash-like. Recorded: sign-in success/failure/lock/logout, reuse detection, password reset and change,
registration, user create/update/role change/disable/enable, tenant create/suspend/activate, plan change, overrides, limits, domains.

## Known limits

* Rate-limit counters are in memory per process; use a shared store before running several API instances.
* Concurrent refreshes with the same token are safe on MongoDB (atomic single-document update). The test for this is skipped on the FerretDB stand-in because that database is not atomic here.
* The first request after a hotel is suspended or a role changes is enforced immediately (nothing is cached); this costs a few database reads per request, to be optimised in Phase 6.
* Email delivery is NOT IMPLEMENTED beyond a console provider; in production no password-reset or invite email is actually sent until an email provider is added (Phase 4).
* `TRUST_PROXY` must match the real number of proxies.
* Expired sessions and one-time tokens are not yet purged (a scheduled job is planned for Phase 6).
