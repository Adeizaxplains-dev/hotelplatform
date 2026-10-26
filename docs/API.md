# API

Base URL: `/api/v1`. Responses use `{ "success": true, "data": ..., "meta"?: ... }` or
`{ "success": false, "error": { "code", "message", "details"?, "requestId" } }`.
The hotel (or platform) is determined by the request's **hostname**, never by a parameter.
"Perm" is the required permission; "Feature" the required plan feature. Everything marked **auth** needs `Authorization: Bearer <access token>`.
Interactive OpenAPI documentation is NOT IMPLEMENTED yet (Phase 6); this file lists only routes that exist.

## Health
| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/health/ready` | Readiness: pings MongoDB, 503 if down |

## Auth (`/auth`) — sets/clears the `hp_rt` refresh cookie
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | no | Guest account (role fixed to `CUSTOMER`). Needs feature `booking` and a hotel address. Body: `name, email, password, phone?` |
| POST | `/auth/login` | no | `{ email, password }` → `{ accessToken, expiresIn, user }` + cookie. 401 `INVALID_CREDENTIALS`, 403 `ACCOUNT_DISABLED` / `TENANT_SUSPENDED` |
| POST | `/auth/refresh` | cookie | Rotates the refresh cookie, returns a new access token |
| POST | `/auth/logout` | cookie | Revokes this session (idempotent) |
| POST | `/auth/logout-all` | auth | Revokes every session of the user |
| POST | `/auth/forgot-password` | no | Always 200; emails a one-time link if the account exists |
| POST | `/auth/reset-password` | no | `{ token, password }` (also used to accept invites). Revokes all sessions |
| POST | `/auth/verify-email` | no | `{ token }` |
| GET | `/auth/me` | auth | User, permissions, enabled features, hotel |

## Hotel info (public)
| Method | Path | Notes |
|---|---|---|
| GET | `/tenants/context` | `{ scope: platform\|tenant\|unknown, hotel }`; never errors |
| GET | `/tenants/current` | Hotel name, slug, status, enabled features; 404 outside a hotel address |

## Staff (`/users`) — Feature `staff`; hotel addresses only
| Method | Path | Perm | Notes |
|---|---|---|---|
| GET | `/users/roles` | `staff.read` | Roles, their permissions, and which the caller may assign |
| GET | `/users` | `staff.read` | `?page&limit&role&active&search` (staff only, never guests) |
| POST | `/users` | `staff.create` | `{ name, email, phone?, role }` → invites by email |
| GET | `/users/:id` | `staff.read` | 404 for another hotel's user |
| PATCH | `/users/:id` | `staff.update` | `{ name?, phone?, role? }` |
| POST | `/users/:id/disable` · `/enable` | `staff.disable` | Disabling revokes sessions |

## Audit
| Method | Path | Perm / Feature | Notes |
|---|---|---|---|
| GET | `/audit` | `audit.read` / `auditLogs` | The hotel's own trail. `?page&limit&action` |


## Website content (Phase 2) — hotel addresses only, signed in

Images are referenced by id. An id that belongs to another hotel is refused exactly like an unknown one (400). Prices are **integer kobo**.
All text is plain text: HTML-looking input is rejected (400). Every body is strict: unknown fields are rejected.

| Method | Path | Perm / Feature | Notes |
|---|---|---|---|
| GET · PATCH | `/hotel/profile` | `settings.read` · `settings.update` / `website` | Tagline, contact, social, policies, branding, SEO. PATCH merges sections; `null` clears a value |
| GET · PATCH | `/hotel/content` | `cms.read` · `cms.update` / `cms` | Hero, about, why-choose-us, testimonials, FAQs, per-page SEO. Arrays are replaced |
| GET · POST | `/room-types` | `rooms.read` · `rooms.create` / `rooms` | `?page&limit&active&search`. Slug generated and unique per hotel |
| GET · PATCH · DELETE | `/room-types/:id` | `rooms.read` · `rooms.update` · `rooms.delete` | Delete is refused (409) while rooms use the type; price changes are audited |
| GET · POST | `/rooms` | `rooms.read` · `rooms.create` / `rooms` | `?roomTypeId&status&active&search`. Enforces `maxRooms`; number unique per hotel |
| GET · PATCH · DELETE | `/rooms/:id` | `rooms.read` · `rooms.update` · `rooms.delete` | `housekeepingStatus` is not editable here (Phase 5) |
| GET · POST · PATCH · DELETE | `/facilities[/:id]` | `cms.read` · `cms.update` / `cms` | |
| GET · POST · PATCH · DELETE | `/gallery[/:id]` | `cms.read` · `cms.update` / `gallery` | Enforces `maxGalleryImages` |
| POST | `/media` | any of `cms.update`, `rooms.update`, `settings.update` / `website` | Multipart, field `file` (+ optional `alt`). JPG/PNG/WebP by content, 5 MB default, 100–8000 px |
| GET · PATCH · DELETE | `/media[/:id]` | read: any of `cms/rooms/settings.read` | Delete refused (409) while the image is in use |
| GET | `/catalog/amenities` · `/catalog/icons` | any read permission | Fixed lists to choose from |

## Public website API (Phase 2) — no sign-in; the hotel comes from the address

Cached for 30 s (`Cache-Control: public`, `Vary: Host`). Suspended hotels get 403 `TENANT_SUSPENDED`; a plan without the feature gets 403 `FEATURE_NOT_AVAILABLE`.
Responses are explicit allow-lists: no ids, tenant ids, room numbers, hidden or inactive items.

| Method | Path | Feature | Notes |
|---|---|---|---|
| GET | `/public/site` | `website` | Everything the home page and site chrome need in one request |
| GET | `/public/room-types` · `/public/room-types/:slug` | `rooms` | Active room types only |
| GET | `/public/facilities` | `cms` | |
| GET | `/public/gallery?category=` | `gallery` | |
| GET | `/uploads/<folder>/<file>` | — | Development image files only (`MEDIA_PROVIDER=local`) |

## Platform operator (`/platform`) — `PLATFORM_SUPER_ADMIN` on the platform address only
| Method | Path | Perm | Notes |
|---|---|---|---|
| GET | `/platform/tenants` | `platform.tenants.read` | Paginated |
| POST | `/platform/tenants` | `platform.tenants.create` | Creates hotel + owner invite |
| GET | `/platform/tenants/:id` | `platform.tenants.read` | Detail with entitlements, overrides, domains, plan history |
| PATCH | `/platform/tenants/:id/status` | `platform.tenants.update` | `{ status, reason? }` (reason required to suspend) |
| PUT | `/platform/tenants/:id/plan` | `platform.tenants.update` | `{ plan }` |
| PUT · DELETE | `/platform/tenants/:id/feature-overrides[/:feature]` | `platform.tenants.update` | Add-ons / removals |
| PUT | `/platform/tenants/:id/limits` | `platform.tenants.update` | Per-hotel limit overrides |
| POST · DELETE | `/platform/tenants/:id/domains[/:hostname]` | `platform.tenants.update` | Custom domains (operator marks verified) |
| GET | `/platform/audit` | `platform.audit.read` | All hotels; `?tenantId&action&page&limit` |

Errors: 400 validation, 401 unauthenticated, 403 forbidden / `TENANT_ACCESS_DENIED` / `FEATURE_NOT_AVAILABLE` / `TENANT_SUSPENDED`,
404, 409, 413, 422 (`LIMIT_REACHED`, business rules), 429 `RATE_LIMITED`, 500, 503.


## Reservations (Phase 3 foundation)

The booking engine is now implemented as a first-pass foundation. Public booking routes require the hotel's `booking` feature; staff routes require `reservations` plus the listed permission. All data is scoped by the hotel resolved from the hostname. Reservation prices are stored as integer minor currency units (kobo for NGN). Paystack also expects integer minor units, so the same amount is sent and compared without multiplying by 100. Frontend and guest-facing messages convert to major units only when displaying a price.

| Method | Path | Auth / Feature | Notes |
|---|---|---|---|
| GET | `/reservations/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&adults=2&children=0&roomTypeSlug=` | Public / `booking` | Returns active room types, availability, nightly price, and total for a 1–30 night stay |
| POST | `/reservations` | Public / `booking` | `{ checkIn, checkOut, roomTypeSlug, adults, children, guest: { fullName, email, phone }, specialRequests? }`; creates a `PENDING` reservation request, currently unpaid |
| GET | `/reservations?page&limit&status&search&checkInFrom&checkInTo` | `reservations.read` / `reservations` | Hotel staff reservation list |
| GET | `/reservations/:id` | `reservations.read` / `reservations` | Tenant-pinned detail |
| PATCH | `/reservations/:id/status` | `reservations.update` / `reservations` | `{ status: CONFIRMED\|CANCELLED\|CHECKED_IN\|CHECKED_OUT\|NO_SHOW }`; cancellation additionally requires `reservations.cancel` |

Room-night allocations use a unique `(tenantId, roomId, night)` index to prevent overlapping allocations under concurrent requests. Cancelled and no-show reservations release inventory; check-in marks the room occupied; check-out releases the stay allocation and marks the room dirty. A room with reservation history cannot be hard-deleted.

## Payments (Phase 4 — initial Paystack integration)
| Method | Path | Auth / Feature | Notes |
|---|---|---|---|
| POST | `/payments/initialize` | Public / `booking` | `{ reservationReference }`; amount and guest email are loaded from the tenant-scoped reservation on the server; returns Paystack authorization URL and payment reference |
| GET | `/payments/verify?reference=` | Public / `booking` | Verifies the reference directly with Paystack and checks status, amount, currency, and customer email before marking the reservation paid/confirmed |

The frontend payment callback calls server-side verification; a browser redirect alone never marks a payment successful. Initial payment attempts expire for retry purposes after 30 minutes. A partial unique index allows only one initialized attempt per reservation, and repeated verification reconciles a previously successful payment with its reservation. **This is not yet production-ready payment settlement:** refunds, automated email receipts, and per-hotel settlement/subaccount configuration remain outstanding. Until per-hotel settlement is implemented, do not use a live platform Paystack key to collect money on behalf of unrelated hotels. Test with Paystack test credentials only.


## Paystack webhook (Phase 4 hardening)

- `POST /api/v1/payments/webhook` is a server-to-server endpoint and does not depend on a hotel hostname.
- It must receive `Content-Type: application/json`; the handler validates `x-paystack-signature` against the exact raw request bytes using `PAYSTACK_SECRET_KEY`.
- Only signed `charge.success` events trigger a payment verification against Paystack's verify API. Other valid event types are acknowledged but ignored.
- The payment reference is used only to discover the owning tenant; payment and reservation changes remain tenant-pinned after that lookup.
- Configure the webhook URL in the Paystack dashboard as `https://<your-api-host>/api/v1/payments/webhook`. Keep the secret key private and use a test key while validating the flow.
- The webhook is an additional notification path; the guest callback still performs server-side verification. Both paths must be tested for repeated/delayed events before live payments are enabled.

## Hotel operations (Phase 5)

All endpoints below require a signed-in hotel team member, an active tenant, and the listed feature and permission. Responses are scoped to the hostname-resolved tenant.

| Method | Path | Feature / permission | Notes |
|---|---|---|---|
| GET | `/housekeeping?status=DIRTY\|CLEANING\|CLEAN\|INSPECTED` | `housekeeping` / `housekeeping.read` | Lists active rooms and current room/housekeeping status; status filter optional |
| PATCH | `/housekeeping/:id/status` | `housekeeping` / `housekeeping.update` | `{ status }`; transitions are constrained and audited |
| GET | `/reports/operations?date=YYYY-MM-DD` | `reports` / `reports.read` | Daily occupancy, room counts, arrivals/departures, in-house count, new reservations, housekeeping summary, successful Paystack payments |

Housekeeping transitions: `DIRTY → CLEANING → CLEAN → INSPECTED`; cleaning may be reset to dirty, clean rooms may be marked dirty or sent back to cleaning, and inspected rooms may be marked dirty or sent back to cleaning. Invalid transitions return a validation error. The operations report uses the hotel’s configured IANA timezone to calculate calendar-day boundaries, including daylight-saving transitions where applicable. Payment totals are operational summaries, not a general ledger.

### Guest notification delivery

Reservation requests, reservation status changes, and successful payment verification create tenant-scoped `GuestNotification` outbox records. The outbox uses a unique event key per tenant to avoid sending duplicate messages on repeated payment callbacks or status processing. Failed sends are retained with attempt counts and can be retried when the same event is processed again. A staff-facing outbox review/retry screen is not included yet. Configure a real `EmailService` implementation before production; the console provider deliberately fails in production.


## Phase 8 — invoices, guest directory, financial reporting

- `GET /api/v1/invoices?page=1&limit=25&q=` — list/search invoices; requires `invoices.read` and the `invoices` feature.
- `POST /api/v1/invoices` — issue an invoice from `{ "reservationId": "<ObjectId>" }`; idempotent per reservation; requires `invoices.create`.
- `GET /api/v1/invoices/:id` — invoice details and calculated paid/balance totals; requires `invoices.read`.
- `GET /api/v1/guests?page=1&limit=25&q=` — reservation-backed guest directory; requires `guests.read` and the `guests` feature.
- `GET /api/v1/reports/financial?from=YYYY-MM-DD&to=YYYY-MM-DD` — financial summaries in the hotel's timezone, grouped by currency; requires `reports.read`, `reports.financial`, and the `reports` feature.

The finance report is operational rather than a full accounting ledger. It excludes expenses, taxes, gateway payout fees, chargebacks and confirmed refunds.

## Phase 9 — payment controls

Authenticated hotel staff with `payments.read` and the `payments` entitlement can call:

- `GET /api/v1/payments/reconciliation?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=25` — read-only comparison of locally successful payments against Paystack verification. Date boundaries use the hotel's timezone and each request is limited to 31 calendar days. Gateway failures are returned as `UNVERIFIED`; records are never silently edited.
- `GET /api/v1/payments/refunds?page=1&limit=25` — list refund requests belonging to the current hotel.

Staff with `payments.refund` can call:

- `POST /api/v1/payments/:id/refund` with `{ "reason": "..." }` — requests a **full** refund of a successful payment through Paystack. One refund request per payment is enforced by a unique database index. A network/provider outcome that cannot be confirmed is stored as `UNKNOWN`; it must be checked in Paystack before any manual action. The API intentionally does not automatically retry ambiguous refund requests.

Refund records are operational tracking, not proof of settlement. A request in `PROCESSING` or `UNKNOWN` must not be described to a guest as refunded. Refund completion should be confirmed against Paystack before accounting adjustments are made.


## Guest notification administration (Phase 10)

All endpoints require an authenticated, active hotel tenant. The API is tenant-scoped.

- `GET /api/v1/notifications?page=1&limit=25&status=FAILED` — requires `notifications.read`; lists metadata only, not stored email bodies. Supported status filters: `PENDING`, `SENDING`, `SENT`, `FAILED`.
- `POST /api/v1/notifications/:id/retry` — requires `notifications.retry`; manually retries only a `FAILED` notification that has a persisted message body and fewer than five attempts. The action is audited.

A provider timeout can be ambiguous: a provider may accept an email even if the application did not receive the response. Manual retries can therefore result in duplicate email delivery. Older failed records created before message bodies were persisted cannot be retried through this endpoint.

## SaaS subscription billing (Phase 13)

Hotel-owner subscription endpoints are mounted at `/api/v1/billing` on the hotel hostname. `GET /plans` returns plan keys and configured monthly prices; `GET /current` returns the hotel's subscription/trial state; `POST /trial` starts a one-time 14-day trial; `POST /checkout` initializes a Paystack monthly transaction with `{ "plan": "WEBSITE" | "BOOKING" | "MANAGEMENT" }`; `POST /verify` verifies a provider reference; and `GET /history` lists subscription payments. Purchase and billing-history actions require `settings.update` permission. Prices come from `SAAS_WEBSITE_MONTHLY_KOBO`, `SAAS_BOOKING_MONTHLY_KOBO`, and `SAAS_MANAGEMENT_MONTHLY_KOBO`. Subscription billing records are separate from guest reservation payments.


## SaaS subscription Paystack webhook (Phase 15)

- `POST /api/v1/billing/webhook` is a server-to-server endpoint mounted before JSON parsing and tenant-host resolution. It verifies the exact raw request body using `x-paystack-signature` and the configured Paystack secret key.
- Configure Paystack to send transaction events to `https://<your-api-host>/api/v1/billing/webhook` as well as the guest payment webhook.
- Only `charge.success` events are processed; unrelated signed events are acknowledged without changing billing records. Unknown references are acknowledged without activating a plan. Successful events are checked against Paystack by server-side transaction verification before subscription activation.
- The billing callback and webhook share the same verification path. If a payment was recorded as successful but the subscription update failed, a later retry can reconcile the subscription state.
- Use Paystack test credentials and verify repeated, delayed, invalid-signature, wrong-amount, and interrupted-update cases before live transactions. Automatic recurring charges are not implemented; each billing period still requires a new checkout/payment.
