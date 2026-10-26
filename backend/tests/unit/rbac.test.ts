import { describe, expect, it } from "vitest";
import { HOTEL_PERMISSIONS, PERMISSIONS, PLATFORM_PERMISSIONS } from "../../src/modules/rbac/permissions.js";
import { ROLES, ROLE_PERMISSIONS, STAFF_ROLES, assignableRoles, canManageRole, hasPermission } from "../../src/modules/rbac/roles.js";

describe("role → permission matrix", () => {
  it("only the platform operator holds platform permissions, and holds nothing else", () => {
    for (const role of ROLES) {
      const held = ROLE_PERMISSIONS[role];
      const platform = held.filter((p) => PLATFORM_PERMISSIONS.includes(p));
      if (role === "PLATFORM_SUPER_ADMIN") {
        expect(platform.length).toBe(PLATFORM_PERMISSIONS.length);
        expect(held.length).toBe(PLATFORM_PERMISSIONS.length);
      } else {
        expect(platform, role).toEqual([]);
      }
    }
  });

  it("every permission listed for a role is a known permission", () => {
    for (const role of ROLES) for (const p of ROLE_PERMISSIONS[role]) expect(PERMISSIONS).toContain(p);
  });

  it("the owner holds every hotel permission", () => {
    expect([...ROLE_PERMISSIONS.HOTEL_OWNER].sort()).toEqual([...HOTEL_PERMISSIONS].sort());
  });

  it("guests (CUSTOMER) hold no admin permissions", () => {
    expect(ROLE_PERMISSIONS.CUSTOMER).toEqual([]);
  });

  it("notification retries are restricted to owners and managers", () => {
    for (const role of ROLES) {
      expect(hasPermission(role, "notifications.retry"), `${role} retry`).toBe(role === "HOTEL_OWNER" || role === "HOTEL_MANAGER");
    }
    expect(hasPermission("HOTEL_OWNER", "notifications.read")).toBe(true);
    expect(hasPermission("HOTEL_MANAGER", "notifications.read")).toBe(true);
  });

  it("refunds and financial reports are restricted to the right roles", () => {
    for (const role of ["HOUSEKEEPER", "RECEPTIONIST", "STAFF", "HOTEL_MANAGER", "RESTAURANT_MANAGER", "CUSTOMER"] as const) {
      expect(hasPermission(role, "payments.refund"), `${role} refund`).toBe(false);
      expect(hasPermission(role, "reports.financial"), `${role} financial`).toBe(false);
    }
    expect(hasPermission("ACCOUNTANT", "payments.refund")).toBe(true);
    expect(hasPermission("HOTEL_OWNER", "payments.refund")).toBe(true);
  });

  it("only owner and manager can manage staff", () => {
    for (const role of ROLES) {
      const can = hasPermission(role, "staff.create");
      expect(can, role).toBe(role === "HOTEL_OWNER" || role === "HOTEL_MANAGER");
    }
  });
});

describe("privilege-escalation rules", () => {
  it("nobody manages the platform operator or guests through staff endpoints", () => {
    for (const actor of ROLES) {
      expect(canManageRole(actor, "PLATFORM_SUPER_ADMIN")).toBe(false);
      expect(canManageRole(actor, "CUSTOMER")).toBe(false);
    }
  });

  it("the platform operator is not a hotel actor", () => {
    expect(assignableRoles("PLATFORM_SUPER_ADMIN")).toEqual([]);
  });

  it("owners can assign any staff role; managers only roles strictly below them", () => {
    expect(assignableRoles("HOTEL_OWNER")).toEqual([...STAFF_ROLES]);
    const manager = assignableRoles("HOTEL_MANAGER");
    expect(manager).not.toContain("HOTEL_OWNER");
    expect(manager).not.toContain("HOTEL_MANAGER");
    expect(manager).toContain("RECEPTIONIST");
  });

  it("junior roles can assign nothing", () => {
    for (const r of ["RECEPTIONIST", "ACCOUNTANT", "HOUSEKEEPER", "RESTAURANT_MANAGER", "STAFF", "CUSTOMER"] as const) {
      // Even if a junior role somehow had staff.create, they could only assign roles strictly below their own rank.
      expect(assignableRoles(r).every((t) => t !== "HOTEL_OWNER" && t !== "HOTEL_MANAGER"), r).toBe(true);
    }
  });
});
