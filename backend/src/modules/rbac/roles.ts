import { HOTEL_PERMISSIONS, PLATFORM_PERMISSIONS, type Permission } from "./permissions.js";

export const ROLES = [
  "PLATFORM_SUPER_ADMIN",
  "HOTEL_OWNER",
  "HOTEL_MANAGER",
  "RECEPTIONIST",
  "ACCOUNTANT",
  "HOUSEKEEPER",
  "RESTAURANT_MANAGER",
  "STAFF",
  "CUSTOMER",
] as const;
export type Role = (typeof ROLES)[number];

/** Roles that belong to a hotel's own team (everything except the platform operator and guests). */
export const STAFF_ROLES = ["HOTEL_OWNER", "HOTEL_MANAGER", "RECEPTIONIST", "ACCOUNTANT", "HOUSEKEEPER", "RESTAURANT_MANAGER", "STAFF"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

const p = (...list: Permission[]): readonly Permission[] => list;

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  PLATFORM_SUPER_ADMIN: PLATFORM_PERMISSIONS,
  HOTEL_OWNER: HOTEL_PERMISSIONS,
  HOTEL_MANAGER: p(
    "rooms.read", "rooms.create", "rooms.update", "rooms.delete",
    "reservations.read", "reservations.create", "reservations.update", "reservations.cancel",
    "guests.read", "guests.create", "guests.update",
    "payments.read", "payments.create",
    "invoices.read", "invoices.create",
    "staff.read", "staff.create", "staff.update", "staff.disable",
    "housekeeping.read", "housekeeping.update",
    "reports.read", "settings.read", "cms.read", "cms.update",
    "restaurant.read", "restaurant.update", "notifications.read", "notifications.retry", "audit.read"
  ),
  RECEPTIONIST: p(
    "rooms.read",
    "reservations.read", "reservations.create", "reservations.update", "reservations.cancel",
    "guests.read", "guests.create", "guests.update",
    "payments.read", "payments.create",
    "invoices.read", "invoices.create",
    "housekeeping.read"
  ),
  ACCOUNTANT: p("reservations.read", "guests.read", "payments.read", "payments.create", "payments.refund", "invoices.read", "invoices.create", "reports.read", "reports.financial"),
  HOUSEKEEPER: p("rooms.read", "housekeeping.read", "housekeeping.update"),
  RESTAURANT_MANAGER: p("restaurant.read", "restaurant.update", "cms.read"),
  STAFF: p("rooms.read", "reservations.read", "guests.read"),
  CUSTOMER: p(),
};

/**
 * Seniority, used ONLY to stop privilege escalation: you may create or change someone only if their
 * role ranks below yours (owners may also manage other owners). Permissions alone never grant that.
 */
export const ROLE_RANK: Record<Role, number> = {
  PLATFORM_SUPER_ADMIN: 1000,
  HOTEL_OWNER: 100,
  HOTEL_MANAGER: 80,
  RECEPTIONIST: 50,
  ACCOUNTANT: 50,
  RESTAURANT_MANAGER: 50,
  HOUSEKEEPER: 20,
  STAFF: 20,
  CUSTOMER: 0,
};

export const isRole = (v: string): v is Role => (ROLES as readonly string[]).includes(v);

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** May `actor` assign `target` role to someone (or manage someone who currently holds it)? */
export function canManageRole(actor: Role, target: Role): boolean {
  if (actor === "PLATFORM_SUPER_ADMIN" || target === "PLATFORM_SUPER_ADMIN" || target === "CUSTOMER") return false;
  if (actor === "HOTEL_OWNER") return true;
  return ROLE_RANK[target] < ROLE_RANK[actor];
}

/** Roles `actor` may hand out through the staff endpoints. */
export function assignableRoles(actor: Role): StaffRole[] {
  return STAFF_ROLES.filter((r) => canManageRole(actor, r));
}
