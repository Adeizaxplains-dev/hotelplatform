# Roles, permissions and plan entitlements

Generated from `backend/src/modules/rbac` and `backend/src/modules/entitlements`. The backend is the only
enforcement point: the frontend merely hides what a user cannot do.

## Roles

`PLATFORM_SUPER_ADMIN` (the SaaS operator, no hotel), `HOTEL_OWNER`, `HOTEL_MANAGER`, `RECEPTIONIST`,
`ACCOUNTANT`, `HOUSEKEEPER`, `RESTAURANT_MANAGER`, `STAFF`, and `CUSTOMER` (a guest account).

Roles are named bundles of permissions defined in code (reviewed, versioned, tested), not database rows.
A user has exactly one role, and it is **read from the database on every request**, so a role change or
disable takes effect immediately. Custom per-hotel roles are not implemented.

## Hotel permissions by role

| Permission | Owner | Manager | Reception | Accountant | Housekeeper | Restaurant | Staff |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `rooms.read` | ✔ | ✔ | ✔ |  | ✔ |  | ✔ |
| `rooms.create` | ✔ | ✔ |  |  |  |  |  |
| `rooms.update` | ✔ | ✔ |  |  |  |  |  |
| `rooms.delete` | ✔ | ✔ |  |  |  |  |  |
| `reservations.read` | ✔ | ✔ | ✔ | ✔ |  |  | ✔ |
| `reservations.create` | ✔ | ✔ | ✔ |  |  |  |  |
| `reservations.update` | ✔ | ✔ | ✔ |  |  |  |  |
| `reservations.cancel` | ✔ | ✔ | ✔ |  |  |  |  |
| `guests.read` | ✔ | ✔ | ✔ | ✔ |  |  | ✔ |
| `guests.create` | ✔ | ✔ | ✔ |  |  |  |  |
| `guests.update` | ✔ | ✔ | ✔ |  |  |  |  |
| `payments.read` | ✔ | ✔ | ✔ | ✔ |  |  |  |
| `payments.create` | ✔ | ✔ | ✔ | ✔ |  |  |  |
| `payments.refund` | ✔ |  |  | ✔ |  |  |  |
| `invoices.read` | ✔ | ✔ | ✔ | ✔ |  |  |  |
| `invoices.create` | ✔ | ✔ | ✔ | ✔ |  |  |  |
| `staff.read` | ✔ | ✔ |  |  |  |  |  |
| `staff.create` | ✔ | ✔ |  |  |  |  |  |
| `staff.update` | ✔ | ✔ |  |  |  |  |  |
| `staff.disable` | ✔ | ✔ |  |  |  |  |  |
| `housekeeping.read` | ✔ | ✔ | ✔ |  | ✔ |  |  |
| `housekeeping.update` | ✔ | ✔ |  |  | ✔ |  |  |
| `reports.read` | ✔ | ✔ |  | ✔ |  |  |  |
| `reports.financial` | ✔ |  |  | ✔ |  |  |  |
| `settings.read` | ✔ | ✔ |  |  |  |  |  |
| `settings.update` | ✔ |  |  |  |  |  |  |
| `cms.read` | ✔ | ✔ |  |  |  | ✔ |  |
| `cms.update` | ✔ | ✔ |  |  |  |  |  |
| `restaurant.read` | ✔ | ✔ |  |  |  | ✔ |  |
| `restaurant.update` | ✔ | ✔ |  |  |  | ✔ |  |
| `audit.read` | ✔ | ✔ |  |  |  |  |  |


Guests (`CUSTOMER`) hold no management permissions. The platform operator holds only `platform.*` permissions
(`platform.tenants.read|create|update`, `platform.audit.read`), which no hotel role ever receives.

## Privilege escalation rules

Permissions say what a role may do. A separate **rank** says whom it may do it to:

Rank: Platform 1000, Owner 100, Manager 80, Reception 50, Accountant 50, Housekeeper 20, Restaurant 50, Staff 20, Guest 0.

* You can create, edit or disable a user only if their role ranks **below** yours. Owners may also manage other owners.
* You can assign only roles you may manage. Nobody can assign `PLATFORM_SUPER_ADMIN` or `CUSTOMER` through the staff endpoints.
* Nobody can change their own role or disable their own account.
* A hotel always keeps at least one active owner (`LAST_OWNER`).
* Staff are invited by email and set their own password; no one ever creates or shares someone else's password.

## Plan entitlements

| Feature | WEBSITE | BOOKING | MANAGEMENT |
|---|:-:|:-:|:-:|
| `website` | ✔ | ✔ | ✔ |
| `cms` | ✔ | ✔ | ✔ |
| `rooms` | ✔ | ✔ | ✔ |
| `gallery` | ✔ | ✔ | ✔ |
| `booking` |  | ✔ | ✔ |
| `reservations` |  | ✔ | ✔ |
| `guests` |  | ✔ | ✔ |
| `payments` |  | ✔ | ✔ |
| `invoices` |  | ✔ | ✔ |
| `reports` |  | ✔ | ✔ |
| `staff` |  |  | ✔ |
| `housekeeping` |  |  | ✔ |
| `expenses` |  |  | ✔ |
| `offers` |  |  | ✔ |
| `events` |  |  | ✔ |
| `restaurant` |  |  | ✔ |
| `auditLogs` |  |  | ✔ |

Effective entitlements for a hotel = plan defaults + that hotel's active **overrides** (a feature switched on as a
paid add-on, or off, optionally until a date). Expired overrides are ignored.

### Limits (sample values: confirm commercially)

| Limit | WEBSITE | BOOKING | MANAGEMENT |
|---|:-:|:-:|:-:|
| `maxRooms` | 20 | 50 | 300 |
| `maxStaff` | 1 | 1 | 50 |
| `maxAdmins` | 1 | 1 | 5 |
| `maxGalleryImages` | 30 | 100 | 500 |
| `maxUsers` | unlimited | unlimited | unlimited |

Limits can be overridden per hotel (`null` = unlimited). `maxStaff` counts active staff accounts, `maxAdmins` active
owners and managers, `maxUsers` every active account including guests. Exceeding one returns `422 LIMIT_REACHED`.
`maxRooms` and `maxGalleryImages` are defined now and enforced when rooms and gallery exist (Phase 2).

Changing plan only changes the hotel's `plan` field (and appends to its subscription history). No data is moved,
copied or rewritten, so upgrades and downgrades are instant and lossless; a downgrade hides features, it never deletes data.
