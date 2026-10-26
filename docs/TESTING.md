# Testing

| Suite | Command | Tests |
|---|---|---|
| Backend unit (no database) | `npm --prefix backend run test:unit` | 99 |
| Backend integration (real MongoDB) | `npm --prefix backend run test:integration` | 237 (1 needs real MongoDB, see below) |
| Frontend (Vitest + Testing Library) | `npm --prefix frontend test` | 145 |

`npm --prefix backend test` runs both backend projects.

## Integration tests need MongoDB

Set `TEST_DATABASE_URL` (default `mongodb://127.0.0.1:27017/hotel_platform_test`). The database name **must end in `_test`**:
the tests delete data and refuse to run otherwise. CI provides a `mongo:7` service. Locally: `docker run -p 27017:27017 mongo:7`.

The tests drive the real Express app through its real middleware chain (no mocked auth). Hotels are created the real way:
platform API → invite email → owner sets a password → signs in. Probe routes run the real `requirePermission` and
`requireFeature` middleware for every role × permission and every plan × feature.

## What the security suites prove

* **Tenant isolation** (`tenancy.test.ts`): Hotel A cannot list, read, change or disable Hotel B's users (404), cannot switch tenant with ids in query/body/headers or a forged `X-Forwarded-Host`, A's token and cookie fail on B's address, platform and hotel tokens do not cross, unknown/unverified hosts 404, suspension is per hotel, and the database tripwire rejects every unscoped query/aggregate/update on every tenant-owned model.
* **RBAC** (`rbac.test.ts`): every role × every permission matches the matrix; managers cannot create or touch owners/peers; nobody changes their own role; mass-assignment fields are rejected; disabling kills sessions at once.
* **Entitlements** (`entitlements.test.ts`): every plan × every feature; add-on and removal overrides; expiry; limits; upgrade/downgrade without data loss.
* **Authentication** (`auth.test.ts`, `hardening.test.ts`, `unit/tokens.test.ts`): login, no account enumeration, lockout, throttling, refresh rotation and reuse detection, logout, reset flow, token forgery (`alg:none`, wrong secret, expired, wrong audience/issuer), Secure cookie in production.
* **Rooms, CMS and public site** (`rooms/cms/media/public.test.ts`): Hotel A cannot see, change or delete Hotel B's room types, rooms, facilities, gallery or images (404); another hotel's image id is refused; per-hotel unique numbers and slugs; limits; upload validation by content; public API leaks nothing internal; suspended and unknown addresses.
* **Frontend** (`tests/*.test.tsx`): public site rendering, XSS (editor text stays text), SEO tags, lightbox focus and keyboard, brand-colour contrast over 500 random colours, money conversion without rounding errors, admin forms and permission gating, upload pre-checks.
* **Audit** (`platform.test.ts`): events recorded with actor, no secrets stored, rows immutable.

## Mutation checks performed

Breaking each of these on purpose made the suite fail (Phase 2: skipping image-ownership checks, trusting the declared file type, showing hidden items publicly, accepting another hotel's room type, ignoring `maxRooms`, allowing HTML): ignoring the tenant in `authenticate`, trusting `X-Forwarded-Host`,
ignoring role rank, skipping plan enforcement, skipping refresh-reuse detection, un-pinning the staff query.

## Known gaps

* One test (simultaneous refreshes with one token) needs real MongoDB atomicity; it is skipped only when `TEST_DB_KIND=ferretdb`.
* Concurrent double-booking and payment idempotency tests arrive with Phases 3 and 4.
* No browser-level (end-to-end UI) tests yet (Phase 6) and no visual or accessibility audit in a real browser.
