import mongoose, { Schema, model } from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { tenantRepository } from "../../src/database/tenantRepository.js";
import { TenantScopeError, tenantScope } from "../../src/database/plugins/tenantScope.js";
import { AuditLog } from "../../src/modules/audit/audit.model.js";
import { Session } from "../../src/modules/auth/session.model.js";
import { Subscription, FeatureOverride } from "../../src/modules/tenants/tenant.model.js";
import { User } from "../../src/modules/users/user.model.js";
import { Client, PASSWORD, addStaff, createHotel, linkToken, platformClient, startHarness, stopHarness, type Harness, type Hotel } from "./harness.js";

let h: Harness;
let ops: Client;
let A: Hotel;
let B: Hotel;
let aStaff: { client: Client; email: string; id: string };
let bStaff: { client: Client; email: string; id: string };

beforeAll(async () => {
  h = await startHarness();
  ops = await platformClient(h);
  A = await createHotel(h, ops, "hotela", "MANAGEMENT");
  B = await createHotel(h, ops, "hotelb", "MANAGEMENT");
  aStaff = await addStaff(h, A, "RECEPTIONIST");
  bStaff = await addStaff(h, B, "RECEPTIONIST");
});
afterAll(stopHarness);

describe("Hotel A cannot reach Hotel B's data through the API", () => {
  it("lists only its own staff", async () => {
    const res = await A.owner.get("/users");
    expect(res.status).toBe(200);
    const emails = res.body.data.map((u: { email: string }) => u.email);
    expect(emails).toContain(A.ownerEmail);
    expect(emails).toContain(aStaff.email);
    expect(emails).not.toContain(B.ownerEmail);
    expect(emails).not.toContain(bStaff.email);
  });

  it("IDOR: reading, changing or disabling a user of Hotel B by id is a 404 (not even a hint it exists)", async () => {
    expect((await A.owner.get(`/users/${bStaff.id}`)).status).toBe(404);
    expect((await A.owner.patch(`/users/${bStaff.id}`, { name: "Hacked" })).status).toBe(404);
    expect((await A.owner.patch(`/users/${bStaff.id}`, { role: "HOTEL_MANAGER" })).status).toBe(404);
    expect((await A.owner.post(`/users/${bStaff.id}/disable`)).status).toBe(404);
    expect((await A.owner.post(`/users/${bStaff.id}/enable`)).status).toBe(404);
    const stillThere = await B.owner.get(`/users/${bStaff.id}`);
    expect(stillThere.body.data).toMatchObject({ name: "RECEPTIONIST", isActive: true, role: "RECEPTIONIST" });
  });

  it("a tenantId in the query, body or header cannot switch hotels", async () => {
    expect((await A.owner.get(`/users?tenantId=${B.id}`)).status).toBe(400);
    expect((await A.owner.post("/users", { name: "Sneaky Person", email: "sneak@x.com", role: "STAFF", tenantId: B.id })).status).toBe(400);
    for (const header of ["X-Tenant-Id", "X-Tenant", "Tenant-Id", "X-Hotel-Id"]) {
      const res = await A.owner.get("/users", { [header]: B.id });
      expect(res.status, header).toBe(200);
      const emails = res.body.data.map((u: { email: string }) => u.email);
      expect(emails, header).not.toContain(B.ownerEmail);
    }
  });

  it("a forged X-Forwarded-Host / Origin cannot change the hotel (no trusted proxy configured)", async () => {
    const res = await A.owner.get("/users", { "X-Forwarded-Host": B.host, "X-Original-Host": B.host, Forwarded: `host=${B.host}` });
    expect(res.status).toBe(200);
    expect(res.body.data.map((u: { email: string }) => u.email)).not.toContain(B.ownerEmail);
  });

  it("Hotel A's access token is useless on Hotel B's address (TENANT_ACCESS_DENIED)", async () => {
    const onB = A.owner.as(B.host);
    for (const path of ["/users", "/auth/me", "/audit"]) {
      const res = await onB.get(path);
      expect(res.status, path).toBe(403);
      expect(res.body.error.code, path).toBe("TENANT_ACCESS_DENIED");
    }
  });

  it("Hotel A's refresh cookie is rejected on Hotel B's address", async () => {
    expect((await A.owner.as(B.host).post("/auth/refresh")).status).toBe(401);
  });

  it("each hotel's audit trail contains only its own events", async () => {
    const a = await A.owner.get("/audit?limit=100");
    expect(a.status).toBe(200);
    expect(a.body.data.length).toBeGreaterThan(0);
    const aIds = new Set(a.body.data.map((e: { resourceId?: string }) => e.resourceId));
    expect(aIds.has(bStaff.id)).toBe(false);
    const b = await B.owner.get("/audit?limit=100");
    expect(new Set(b.body.data.map((e: { resourceId?: string }) => e.resourceId)).has(aStaff.id)).toBe(false);
  });

  it("the same email is two separate accounts in two hotels", async () => {
    const shared = "shared.person@example.com";
    const ra = await A.owner.post("/users", { name: "Shared Person", email: shared, role: "STAFF" });
    const rb = await B.owner.post("/users", { name: "Shared Person", email: shared, role: "STAFF" });
    expect(ra.status).toBe(201);
    expect(rb.status).toBe(201);
    expect(ra.body.data.id).not.toBe(rb.body.data.id);
    const ca = new Client(h.app, A.host);
    await ca.post("/auth/reset-password", { token: linkToken(h.email.outbox.filter((m) => m.to === shared)[0]!.text), password: "Passphrase-For-Hotel-A" });
    expect((await ca.login(shared, "Passphrase-For-Hotel-A")).status).toBe(200);
    expect((await new Client(h.app, B.host).login(shared, "Passphrase-For-Hotel-A")).status).toBe(401); // B's account has no password yet
    expect((await new Client(h.app, B.host).login(shared, PASSWORD)).status).toBe(401);
  });
});

describe("platform vs hotel boundary", () => {
  it("hotel users get 403 on every platform endpoint", async () => {
    for (const c of [A.owner.as("platform.test"), A.owner]) {
      expect((await c.get("/platform/tenants")).status).toBe(403);
      expect((await c.post("/platform/tenants", {})).status).toBe(403);
    }
    expect((await A.owner.get(`/platform/tenants/${B.id}`)).status).toBe(403);
    expect((await A.owner.put(`/platform/tenants/${A.id}/plan`, { plan: "MANAGEMENT" })).status).toBe(403);
    expect((await A.owner.get("/platform/audit")).status).toBe(403);
  });

  it("the platform operator's token does not work on a hotel's address", async () => {
    const res = await ops.as(A.host).get("/users");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("TENANT_ACCESS_DENIED");
  });

  it("unauthenticated callers get 401, not data", async () => {
    expect((await new Client(h.app, A.host).get("/users")).status).toBe(401);
    expect((await new Client(h.app, "platform.test").get("/platform/tenants")).status).toBe(401);
  });
});

describe("host resolution", () => {
  it("unknown hotel addresses are 404 TENANT_NOT_FOUND", async () => {
    for (const host of ["nothere.platform.test", "evil.com", "a.b.hotela.platform.test", "hotela.platform.test.evil.com"]) {
      const res = await new Client(h.app, host).get("/tenants/current");
      expect(res.status, host).toBe(404);
      expect(res.body.error.code, host).toBe("TENANT_NOT_FOUND");
    }
  });

  it("reserved addresses cannot be used as hotel slugs", async () => {
    for (const slug of ["www", "api", "admin", "platform", "app"]) {
      const res = await ops.post("/platform/tenants", { name: "Reserved", slug, plan: "WEBSITE", ownerName: "Own Er", ownerEmail: "o@reserved.com" });
      expect(res.status, slug).toBe(400);
    }
  });

  it("a custom domain resolves only once verified, and only to its own hotel", async () => {
    const add = await ops.post(`/platform/tenants/${A.id}/domains`, { hostname: "www.grandhotel-a.com", verified: false });
    expect(add.status).toBe(201);
    expect((await new Client(h.app, "www.grandhotel-a.com").get("/tenants/current")).status).toBe(404);

    await ops.del(`/platform/tenants/${A.id}/domains/www.grandhotel-a.com`);
    await ops.post(`/platform/tenants/${A.id}/domains`, { hostname: "www.grandhotel-a.com", verified: true });
    const res = await new Client(h.app, "www.grandhotel-a.com").get("/tenants/current");
    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe("hotela");

    // and the owner signs in through the custom domain, but that session is not valid on Hotel B
    const viaDomain = new Client(h.app, "www.grandhotel-a.com");
    expect((await viaDomain.login(A.ownerEmail)).status).toBe(200);
    expect((await viaDomain.as(B.host).get("/users")).status).toBe(403);
  });

  it("a domain cannot be attached to two hotels, and platform subdomains cannot be claimed as custom domains", async () => {
    expect((await ops.post(`/platform/tenants/${B.id}/domains`, { hostname: "www.grandhotel-a.com", verified: true })).status).toBe(409);
    expect((await ops.post(`/platform/tenants/${B.id}/domains`, { hostname: "hotela.platform.test", verified: true })).status).toBe(400);
    expect((await ops.post(`/platform/tenants/${B.id}/domains`, { hostname: "platform.test", verified: true })).status).toBe(400);
  });

  it("the context endpoint tells the frontend what kind of address this is, without erroring or leaking", async () => {
    const hotel = await new Client(h.app, A.host).get("/tenants/context");
    expect(hotel.body.data.scope).toBe("tenant");
    expect(Object.keys(hotel.body.data.hotel).sort()).toEqual(["features", "name", "slug", "status"]);
    expect((await new Client(h.app, "platform.test").get("/tenants/context")).body.data).toEqual({ scope: "platform", hotel: null });
    const unknown = await new Client(h.app, "nothere.platform.test").get("/tenants/context");
    expect(unknown.status).toBe(200);
    expect(unknown.body.data).toEqual({ scope: "unknown", hotel: null });
  });

  it("the public tenant info is minimal", async () => {
    const res = await new Client(h.app, A.host).get("/tenants/current");
    expect(Object.keys(res.body.data).sort()).toEqual(["features", "name", "slug", "status"]);
  });
});

describe("suspension", () => {
  it("blocks sign-in and existing sessions for that hotel only, and can be reversed", async () => {
    const c = new Client(h.app, B.host);
    await c.login(B.ownerEmail);
    expect((await ops.patch(`/platform/tenants/${B.id}/status`, { status: "SUSPENDED" })).status).toBe(400); // reason required
    expect((await ops.patch(`/platform/tenants/${B.id}/status`, { status: "SUSPENDED", reason: "Unpaid invoice" })).status).toBe(200);

    expect((await new Client(h.app, B.host).post("/auth/login", { email: B.ownerEmail, password: PASSWORD })).body.error.code).toBe("TENANT_SUSPENDED");
    expect((await c.get("/users")).body.error.code).toBe("TENANT_SUSPENDED");
    expect((await c.post("/auth/refresh")).status).toBe(403);
    const info = await new Client(h.app, B.host).get("/tenants/current");
    expect(info.body.data).toMatchObject({ status: "SUSPENDED", features: [] });

    expect((await A.owner.get("/users")).status).toBe(200); // Hotel A unaffected

    await ops.patch(`/platform/tenants/${B.id}/status`, { status: "ACTIVE" });
    expect((await new Client(h.app, B.host).login(B.ownerEmail)).status).toBe(200);
  });
});

describe("database tripwire (defence in depth)", () => {
  const aId = () => new mongoose.Types.ObjectId(A.id);
  const bId = () => new mongoose.Types.ObjectId(B.id);

  it("rejects any unscoped query on every tenant-owned model", async () => {
    for (const M of [User, Session, AuditLog, Subscription, FeatureOverride] as const) {
      const m = M as unknown as mongoose.Model<unknown>;
      await expect(m.find({}).exec(), `${m.modelName}.find`).rejects.toBeInstanceOf(TenantScopeError);
      await expect(m.findOne({}).exec(), `${m.modelName}.findOne`).rejects.toBeInstanceOf(TenantScopeError);
      await expect(m.findById(new mongoose.Types.ObjectId()).exec(), `${m.modelName}.findById`).rejects.toBeInstanceOf(TenantScopeError);
      await expect(m.countDocuments({}).exec(), `${m.modelName}.countDocuments`).rejects.toBeInstanceOf(TenantScopeError);
      await expect(m.aggregate([{ $group: { _id: null, n: { $sum: 1 } } }]).exec(), `${m.modelName}.aggregate`).rejects.toBeInstanceOf(TenantScopeError);
    }
  });

  it("rejects unscoped writes", async () => {
    await expect(User.updateMany({}, { $set: { name: "x" } }).exec()).rejects.toBeInstanceOf(TenantScopeError);
    await expect(User.updateOne({ email: "a@b.co" }, { $set: { name: "x" } }).exec()).rejects.toBeInstanceOf(TenantScopeError);
    await expect(User.deleteMany({ role: "STAFF" }).exec()).rejects.toBeInstanceOf(TenantScopeError);
    await expect(User.findOneAndUpdate({ email: "a@b.co" }, { $set: { name: "x" } }).exec()).rejects.toBeInstanceOf(TenantScopeError);
  });

  it("rejects operator tricks in place of a concrete tenant", async () => {
    await expect(User.find({ tenantId: { $ne: aId() } } as never).exec()).rejects.toBeInstanceOf(TenantScopeError);
    await expect(User.find({ tenantId: { $in: [aId(), bId()] } } as never).exec()).rejects.toBeInstanceOf(TenantScopeError);
    await expect(User.find({ tenantId: undefined } as never).exec()).rejects.toBeInstanceOf(TenantScopeError);
    await expect(User.find({ $or: [{ tenantId: aId() }, { tenantId: bId() }] } as never).exec()).rejects.toBeInstanceOf(TenantScopeError);
  });

  it("a pinned query returns only that hotel's rows", async () => {
    const a = await User.find({ tenantId: aId() });
    expect(a.length).toBeGreaterThan(0);
    expect(a.every((u) => String(u.tenantId) === A.id)).toBe(true);
    expect((await User.find({ tenantId: aId(), email: B.ownerEmail })).length).toBe(0);
    expect((await User.findOne({ tenantId: aId(), _id: bStaff.id }))).toBeNull();
  });

  it("platform-wide operations must opt out explicitly", async () => {
    const all = await User.find({}).setOptions({ skipTenantScope: true });
    expect(all.length).toBeGreaterThan(4);
  });
});

describe("tenant-owned resources (rooms, reservations, guests, payments will use this)", () => {
  // The real room/reservation/guest/payment models arrive in Phases 2-4 and each gets its own isolation test.
  // This proves the shared mechanism they all use, with a stand-in tenant-owned model.
  const roomSchema = new Schema({ roomNumber: String, price: Number });
  tenantScope(roomSchema);
  roomSchema.index({ tenantId: 1, roomNumber: 1 }, { unique: true });
  const Room = (mongoose.models["TestRoom"] ?? model("TestRoom", roomSchema)) as mongoose.Model<{ roomNumber: string; price: number }>;

  it("repository calls are pinned to one hotel", async () => {
    await Room.init();
    const ta = new mongoose.Types.ObjectId(A.id);
    const tb = new mongoose.Types.ObjectId(B.id);
    const roomsA = tenantRepository(Room, ta);
    const roomsB = tenantRepository(Room, tb);
    const a101 = await roomsA.create({ roomNumber: "101", price: 50000 });
    const b101 = await roomsB.create({ roomNumber: "101", price: 99000 }); // same number in another hotel is fine

    expect(await roomsA.findById(b101._id)).toBeNull();
    expect(await roomsB.findById(a101._id)).toBeNull();
    expect((await roomsA.find()).map((r) => r.price)).toEqual([50000]);
    expect(await roomsA.updateById(b101._id, { $set: { price: 1 } })).toBeNull();
    await roomsA.deleteById(b101._id);
    expect((await roomsB.findById(b101._id))?.price).toBe(99000);
    await expect(roomsA.create({ roomNumber: "101", price: 1 })).rejects.toMatchObject({ code: 11000 }); // unique per hotel
  });

  it("the tripwire protects the stand-in model too", async () => {
    await expect(Room.find({}).exec()).rejects.toBeInstanceOf(TenantScopeError);
    await expect(Room.findById(new mongoose.Types.ObjectId()).exec()).rejects.toBeInstanceOf(TenantScopeError);
  });
});
