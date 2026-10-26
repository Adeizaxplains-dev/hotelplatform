/** Every permission the platform knows. Roles are just named bundles of these (see roles.ts). */
export const PERMISSIONS = [
  "rooms.read", "rooms.create", "rooms.update", "rooms.delete",
  "reservations.read", "reservations.create", "reservations.update", "reservations.cancel",
  "guests.read", "guests.create", "guests.update",
  "payments.read", "payments.create", "payments.refund",
  "invoices.read", "invoices.create",
  "staff.read", "staff.create", "staff.update", "staff.disable",
  "housekeeping.read", "housekeeping.update",
  "reports.read", "reports.financial",
  "settings.read", "settings.update",
  "cms.read", "cms.update",
  "restaurant.read", "restaurant.update",
  "notifications.read", "notifications.retry",
  "audit.read",
  // Platform (SaaS operator) permissions: never granted to hotel roles.
  "platform.tenants.read", "platform.tenants.create", "platform.tenants.update", "platform.audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PLATFORM_PERMISSIONS: readonly Permission[] = PERMISSIONS.filter((p) => p.startsWith("platform."));
export const HOTEL_PERMISSIONS: readonly Permission[] = PERMISSIONS.filter((p) => !p.startsWith("platform."));
