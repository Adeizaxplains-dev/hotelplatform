# Phase 16 continuation — platform billing controls

## Included in this patch
- `PUT /api/v1/platform/tenants/:id/trial`: platform-super-admin only, guarded by existing `platform.tenants.update` permission. Supports START (defaults to 14 days unless `endsAt` is supplied), EXTEND (requires future `endsAt` and current TRIALING state), and END (sets status EXPIRED).
- `PUT /api/v1/platform/tenants/:id/subscription`: platform-super-admin only, guarded by existing permission. Updates tenant plan, billing subscription status/period, appends plan history, and audits the action.
- Both endpoints require a reason for the audit record.

## Request examples

Start trial:
```json
{"action":"START","reason":"Operator approved trial"}
```

Extend trial:
```json
{"action":"EXTEND","endsAt":"2026-12-01T00:00:00.000Z","reason":"Approved extension"}
```

End trial:
```json
{"action":"END","reason":"Trial ended by operator"}
```

Manually set subscription:
```json
{"plan":"MANAGEMENT","status":"ACTIVE","currentPeriodStart":"2026-10-22T00:00:00.000Z","currentPeriodEnd":"2026-11-22T00:00:00.000Z","reason":"Manual activation after payment review"}
```

## Important limitations
This is a backend-only billing-control patch. It does not yet add controls to the frontend super-admin interface, nor does it implement the requested Termii SMS invitation/OTP workflow. Build/tests were not run because dependencies are not installed in this extracted workspace. Install dependencies and run `npm run typecheck`, `npm test`, and `npm run build` from `backend` before deploying.

The original uploaded `.env` file is intentionally excluded from the output archive because it contains credentials. Keep your local `.env` in your existing project; do not overwrite it with an archive copy.
