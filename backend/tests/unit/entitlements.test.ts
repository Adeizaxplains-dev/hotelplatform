import { describe, expect, it } from "vitest";
import { FEATURES, PLAN_FEATURES, PLAN_KEYS, computeEntitlements, enabledFeatures } from "../../src/modules/entitlements/features.js";

const days = (n: number) => new Date(Date.now() + n * 86_400_000);

describe("plan defaults", () => {
  it("each plan includes the previous one", () => {
    for (const f of PLAN_FEATURES.WEBSITE) expect(PLAN_FEATURES.BOOKING).toContain(f);
    for (const f of PLAN_FEATURES.BOOKING) expect(PLAN_FEATURES.MANAGEMENT).toContain(f);
  });

  it("WEBSITE has no booking, payments, reservations, staff or reports", () => {
    const e = computeEntitlements("WEBSITE");
    for (const f of ["booking", "reservations", "guests", "payments", "invoices", "reports", "staff", "housekeeping", "auditLogs"] as const) expect(e.features[f], f).toBe(false);
    for (const f of ["website", "cms", "rooms", "gallery"] as const) expect(e.features[f], f).toBe(true);
  });

  it("BOOKING adds booking features but not management", () => {
    const e = computeEntitlements("BOOKING");
    for (const f of ["booking", "reservations", "guests", "payments", "invoices", "reports"] as const) expect(e.features[f], f).toBe(true);
    for (const f of ["staff", "housekeeping", "expenses", "offers", "events", "restaurant", "auditLogs"] as const) expect(e.features[f], f).toBe(false);
  });

  it("MANAGEMENT has every feature", () => {
    expect(enabledFeatures(computeEntitlements("MANAGEMENT"))).toEqual([...FEATURES]);
  });

  it("every plan covers every feature key explicitly (no undefined)", () => {
    for (const plan of PLAN_KEYS) expect(Object.keys(computeEntitlements(plan).features).sort()).toEqual([...FEATURES].sort());
  });
});

describe("overrides", () => {
  it("an override can switch a feature on (add-on) or off", () => {
    expect(computeEntitlements("WEBSITE", [{ feature: "booking", enabled: true }]).features.booking).toBe(true);
    expect(computeEntitlements("MANAGEMENT", [{ feature: "staff", enabled: false }]).features.staff).toBe(false);
  });

  it("expired overrides are ignored, future ones apply", () => {
    expect(computeEntitlements("WEBSITE", [{ feature: "booking", enabled: true, expiresAt: days(-1) }]).features.booking).toBe(false);
    expect(computeEntitlements("WEBSITE", [{ feature: "booking", enabled: true, expiresAt: days(5) }]).features.booking).toBe(true);
  });

  it("limit overrides replace plan limits; null means unlimited; junk is ignored", () => {
    expect(computeEntitlements("WEBSITE", [], { maxRooms: 5 }).limits.maxRooms).toBe(5);
    expect(computeEntitlements("WEBSITE", [], { maxRooms: null }).limits.maxRooms).toBeNull();
    expect(computeEntitlements("WEBSITE", [], { maxRooms: -3 }).limits.maxRooms).toBe(20);
    expect(computeEntitlements("WEBSITE", [], { maxRooms: 2.5 }).limits.maxRooms).toBe(20);
    expect(computeEntitlements("WEBSITE", [], { bogus: 1 } as never).limits.maxRooms).toBe(20);
  });
});
