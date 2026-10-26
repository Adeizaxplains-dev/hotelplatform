import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FEATURES, PLAN_FEATURES, type Feature, type PlanKey } from "../../src/modules/entitlements/features.js";
import { Client, PASSWORD, createHotel, platformClient, startHarness, stopHarness, type Harness, type Hotel } from "./harness.js";

let h: Harness;
let ops: Client;
const hotels = {} as Record<PlanKey, Hotel>;

beforeAll(async () => {
  h = await startHarness();
  ops = await platformClient(h);
  hotels.WEBSITE = await createHotel(h, ops, "planweb", "WEBSITE");
  hotels.BOOKING = await createHotel(h, ops, "planbook", "BOOKING");
  hotels.MANAGEMENT = await createHotel(h, ops, "planmgmt", "MANAGEMENT");
});
afterAll(stopHarness);

const probe = (hotel: Hotel, feature: Feature) => hotel.owner.get(`/_probe/feature/${feature}`);

describe("each plan enforces its own features on the backend", () => {
  for (const plan of ["WEBSITE", "BOOKING", "MANAGEMENT"] as const) {
    it(`${plan}: every feature is allowed or refused exactly per the plan`, async () => {
      for (const feature of FEATURES) {
        const res = await probe(hotels[plan], feature);
        const included = PLAN_FEATURES[plan].includes(feature);
        expect(res.status, `${plan} ${feature}`).toBe(included ? 200 : 403);
        if (!included) expect(res.body.error.code).toBe("FEATURE_NOT_AVAILABLE");
      }
    });
  }

  it("WEBSITE hotel: cannot register guests, create staff or read audit logs (real endpoints)", async () => {
    const web = hotels.WEBSITE;
    const reg = await new Client(h.app, web.host).post("/auth/register", { name: "A Guest", email: "g@web.example.com", password: PASSWORD });
    expect(reg.body.error.code).toBe("FEATURE_NOT_AVAILABLE");
    expect((await web.owner.post("/users", { name: "Some Staff", email: "s@web.example.com", role: "STAFF" })).body.error.code).toBe("FEATURE_NOT_AVAILABLE");
    expect((await web.owner.get("/users")).status).toBe(403);
    expect((await web.owner.get("/audit")).body.error.code).toBe("FEATURE_NOT_AVAILABLE");
  });

  it("BOOKING hotel: guests can register, but management features stay closed", async () => {
    const b = hotels.BOOKING;
    expect((await new Client(h.app, b.host).post("/auth/register", { name: "A Guest", email: "g@book.example.com", password: PASSWORD })).status).toBe(201);
    expect((await b.owner.post("/users", { name: "Some Staff", email: "s@book.example.com", role: "STAFF" })).body.error.code).toBe("FEATURE_NOT_AVAILABLE");
    expect((await b.owner.get("/audit")).body.error.code).toBe("FEATURE_NOT_AVAILABLE");
  });

  it("MANAGEMENT hotel: staff and audit are open", async () => {
    const m = hotels.MANAGEMENT;
    expect((await m.owner.post("/users", { name: "Some Staff", email: "s@mgmt.example.com", role: "STAFF" })).status).toBe(201);
    expect((await m.owner.get("/audit")).status).toBe(200);
  });

  it("the public site info lists exactly the plan's features", async () => {
    for (const plan of ["WEBSITE", "BOOKING", "MANAGEMENT"] as const) {
      const res = await new Client(h.app, hotels[plan].host).get("/tenants/current");
      expect([...res.body.data.features].sort()).toEqual([...PLAN_FEATURES[plan]].sort());
    }
  });
});

describe("feature overrides (plan + add-ons)", () => {
  it("an add-on switches a feature on for one hotel, and removing it switches it off", async () => {
    const web = hotels.WEBSITE;
    expect((await probe(web, "booking")).status).toBe(403);
    const set = await ops.put(`/platform/tenants/${web.id}/feature-overrides`, { feature: "booking", enabled: true, reason: "Paid add-on" });
    expect(set.status).toBe(200);
    expect((await probe(web, "booking")).status).toBe(200);
    expect((await new Client(h.app, web.host).post("/auth/register", { name: "Now Allowed", email: "now@web.example.com", password: PASSWORD })).status).toBe(201);
    expect((await probe(hotels.BOOKING, "staff")).status).toBe(403); // other hotels are untouched
    expect((await ops.del(`/platform/tenants/${web.id}/feature-overrides/booking`)).status).toBe(200);
    expect((await probe(web, "booking")).status).toBe(403);
  });

  it("an override can also switch a plan feature OFF", async () => {
    const m = hotels.MANAGEMENT;
    await ops.put(`/platform/tenants/${m.id}/feature-overrides`, { feature: "staff", enabled: false });
    expect((await m.owner.post("/users", { name: "Blocked Staff", email: "blocked@mgmt.example.com", role: "STAFF" })).body.error.code).toBe("FEATURE_NOT_AVAILABLE");
    await ops.del(`/platform/tenants/${m.id}/feature-overrides/staff`);
    expect((await m.owner.post("/users", { name: "Allowed Staff", email: "allowed@mgmt.example.com", role: "STAFF" })).status).toBe(201);
  });

  it("expired overrides are ignored; future-dated ones apply", async () => {
    const web = hotels.WEBSITE;
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    await ops.put(`/platform/tenants/${web.id}/feature-overrides`, { feature: "events", enabled: true, expiresAt: past });
    expect((await probe(web, "events")).status).toBe(403);
    await ops.put(`/platform/tenants/${web.id}/feature-overrides`, { feature: "events", enabled: true, expiresAt: future });
    expect((await probe(web, "events")).status).toBe(200);
    await ops.del(`/platform/tenants/${web.id}/feature-overrides/events`);
  });

  it("only the platform operator can set overrides; unknown features are rejected", async () => {
    expect((await hotels.WEBSITE.owner.put(`/platform/tenants/${hotels.WEBSITE.id}/feature-overrides`, { feature: "booking", enabled: true })).status).toBe(403);
    expect((await ops.put(`/platform/tenants/${hotels.WEBSITE.id}/feature-overrides`, { feature: "teleportation", enabled: true })).status).toBe(400);
  });
});

describe("usage limits", () => {
  it("maxStaff is enforced and can be raised per hotel", async () => {
    const m = hotels.MANAGEMENT;
    const count = (await m.owner.get("/users?limit=100&active=true")).body.meta.total as number;
    expect((await ops.put(`/platform/tenants/${m.id}/limits`, { maxStaff: count })).status).toBe(200);
    const blocked = await m.owner.post("/users", { name: "One Too Many", email: "toomany@mgmt.example.com", role: "STAFF" });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe("LIMIT_REACHED");
    await ops.put(`/platform/tenants/${m.id}/limits`, { maxStaff: count + 1 });
    expect((await m.owner.post("/users", { name: "Just Fits", email: "fits@mgmt.example.com", role: "STAFF" })).status).toBe(201);
    expect((await m.owner.post("/users", { name: "Over Again", email: "over@mgmt.example.com", role: "STAFF" })).body.error.code).toBe("LIMIT_REACHED");
    await ops.put(`/platform/tenants/${m.id}/limits`, { maxStaff: null }); // unlimited
    expect((await m.owner.post("/users", { name: "Unlimited Now", email: "unl@mgmt.example.com", role: "STAFF" })).status).toBe(201);
  });

  it("maxAdmins limits owners and managers", async () => {
    const m = hotels.MANAGEMENT;
    const admins = (await m.owner.get("/users?limit=100&active=true")).body.data.filter((u: { role: string }) => u.role === "HOTEL_OWNER" || u.role === "HOTEL_MANAGER").length;
    await ops.put(`/platform/tenants/${m.id}/limits`, { maxStaff: null, maxAdmins: admins });
    expect((await m.owner.post("/users", { name: "Another Mgr", email: "mgr@mgmt.example.com", role: "HOTEL_MANAGER" })).body.error.code).toBe("LIMIT_REACHED");
  });

  it("maxUsers limits guest registration", async () => {
    const b = hotels.BOOKING;
    await ops.put(`/platform/tenants/${b.id}/limits`, { maxUsers: 0 });
    expect((await new Client(h.app, b.host).post("/auth/register", { name: "Late Guest", email: "late@book.example.com", password: PASSWORD })).body.error.code).toBe("LIMIT_REACHED");
  });

  it("invalid limit values are rejected", async () => {
    expect((await ops.put(`/platform/tenants/${hotels.BOOKING.id}/limits`, { maxStaff: -1 })).status).toBe(400);
    expect((await ops.put(`/platform/tenants/${hotels.BOOKING.id}/limits`, { maxStaff: 1.5 })).status).toBe(400);
    expect((await ops.put(`/platform/tenants/${hotels.BOOKING.id}/limits`, { notALimit: 3 })).status).toBe(400);
  });
});

describe("upgrade and downgrade without migrating data", () => {
  it("WEBSITE → BOOKING → MANAGEMENT turns features on; the same data is still there; downgrading hides but does not delete", async () => {
    const hotel = await createHotel(h, ops, "growing", "WEBSITE");
    const before = (await hotel.owner.get("/auth/me")).body.data;
    expect(before.features).not.toContain("booking");

    expect((await ops.put(`/platform/tenants/${hotel.id}/plan`, { plan: "BOOKING" })).body.data.plan).toBe("BOOKING");
    expect((await new Client(h.app, hotel.host).post("/auth/register", { name: "First Guest", email: "first@growing.example.com", password: PASSWORD })).status).toBe(201);

    await ops.put(`/platform/tenants/${hotel.id}/plan`, { plan: "MANAGEMENT" });
    const staffRes = await hotel.owner.post("/users", { name: "First Staff", email: "staff@growing.example.com", role: "STAFF" });
    expect(staffRes.status).toBe(201);
    const after = (await hotel.owner.get("/auth/me")).body.data;
    expect(after.user.id).toBe(before.user.id); // same owner account, same session: no migration
    expect(after.features).toContain("staff");

    await ops.put(`/platform/tenants/${hotel.id}/plan`, { plan: "BOOKING" }); // downgrade
    expect((await hotel.owner.get("/users")).body.error.code).toBe("FEATURE_NOT_AVAILABLE");
    await ops.put(`/platform/tenants/${hotel.id}/plan`, { plan: "MANAGEMENT" });
    expect((await hotel.owner.get(`/users/${staffRes.body.data.id}`)).status).toBe(200); // the data survived

    const detail = (await ops.get(`/platform/tenants/${hotel.id}`)).body.data;
    expect(detail.subscriptions.map((s: { plan: string }) => s.plan)).toEqual(["MANAGEMENT", "BOOKING", "MANAGEMENT", "BOOKING", "WEBSITE"]);
  });
});
