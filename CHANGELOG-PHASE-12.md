# Phase 12 — Hotel Operations Consistency

## Implemented

- Extracted reservation transition rules into a shared pure helper and added tests for valid and invalid transitions.
- Check-in now conditionally claims an active room only when its status is `AVAILABLE` and housekeeping is `CLEAN` or `INSPECTED`.
- Check-out now requires the assigned room to be `OCCUPIED`, then marks it `AVAILABLE` and `DIRTY` for housekeeping.
- Reservation status changes use a conditional update against the previously observed status. Competing requests return a conflict rather than overwriting a newer status.
- If the reservation transition loses a race after a room status change, the service attempts a conditional room-state rollback.
- Cancellation, no-show, and checkout continue to release room-night inventory after the reservation status is changed. If inventory cleanup fails, the safe failure mode is stale/blocked inventory rather than allowing an overlapping booking.

## Important limitations

- Room and reservation writes are not wrapped in a MongoDB transaction. The conditional updates and compensating write reduce race conditions but do not eliminate every crash window. Production deployment should use a MongoDB replica set and a transaction-based implementation for multi-document state changes.
- This phase does not add a new room reassignment workflow. A reservation with an unavailable or dirty assigned room requires staff to resolve the room state or move the guest through an approved reassignment process.
- Early check-in and late checkout remain staff decisions; date boundaries are not enforced by this transition layer.
- Full automated backend tests, typecheck, lint, and frontend/backend production builds must be run in an environment with dependencies installed.
