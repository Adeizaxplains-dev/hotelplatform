# Phase 16 full-stack integration audit

## Verified defect fixed

- **Public availability returned `VALIDATION_ERROR` for valid dates and guest counts.** `backend/src/database/connection.ts` globally enables Mongoose `sanitizeFilter`. In `reservation.service.ts`, the server-built capacity predicates `{ $gte: adults }` and `{ $gte: children }` were not marked trusted, so Mongoose treated the operator object as a numeric literal and raised a `CastError` at `RoomType.maxChildren`.
- Marked server-generated MongoDB operator predicates with `mongoose.trusted()` in the reservation availability/inventory/status paths. Also corrected the same pattern in payment, billing, notification, finance, operations, and user queries where operator filters were used with `sanitizeFilter=true`.
- Added an integration test for `GET /reservations/availability` that asserts a normal two-adult, zero-child search returns a room type and available room count.

## Integration map reviewed

- Frontend `publicApi` maps to `/public/*`, `/reservations/availability`, `POST /reservations`, and `/payments/initialize|verify`; these routers are mounted by `backend/src/app.ts`.
- Frontend `adminApi` paths were checked against the mounted `/auth`, `/hotel`, `/room-types`, `/rooms`, `/catalog`, `/facilities`, `/gallery`, `/media`, `/reservations`, `/payments`, `/billing`, `/notifications`, `/housekeeping`, `/reports`, `/invoices`, and `/guests` routers.
- API clients use the shared `/api/v1` base and `credentials: include`; the frontend does not need separate ad hoc base URLs for each module.
- Public tenant resolution is hostname-based. Do not remove tenant middleware or disable `sanitizeFilter` as a shortcut; both are security boundaries.

## Validation status and next steps

- Static source inspection completed.
- The integration test was added but **could not be executed in this environment** because dependency installation did not complete and TypeScript could not find `@types/node`. Run `npm ci` at the repository root (or `npm --prefix backend ci` and `npm --prefix frontend ci`) and then `npm run check`.
- Run the local availability request again with the hotel hostname, then test reservation creation, payment initialization/verification, and the admin reservation list against the same tenant.
