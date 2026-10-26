# Cross-stack tests

**Status: NOT IMPLEMENTED (Phase 6).**

Unit and API tests live next to their code (`backend/tests`, `frontend/src/**/*.test.*`) and run in CI.
This folder is reserved for end-to-end tests that drive the browser against a running API and database
(booking flow, payment webhook, tenant isolation through the UI).
