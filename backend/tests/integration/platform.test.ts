import mongoose from "mongoose";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditLog } from "../../src/modules/audit/audit.model.js";
import { User } from "../../src/modules/users/user.model.js";
import { Client, PASSWORD, addStaff, createHotel, hostOf, linkToken, platformClient, startHarness, stopHarness, type Harness } from "./harness.js";

let h: Harness;
let ops: Client;

beforeAll(async () => {
  h = await startHarness();
  ops = await platformClient(h);
});
afterAll(stopHarness);

const body = (over: Record<string, unknown> = {}) => ({ name: "Grand Palm Hotel", slug: "grandpalm", plan: "BOOKING", ownerName: "Ada Nwosu", ownerEmail: "ada@grandpalm.com", ...over });

describe("creating a hotel", () => {
  it("creates the hotel, its history and an owner who is invited by email (no password is ever shared)", async () => {
    const res = await ops.post("/platform/tenants", body());
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ slug: "grandpalm", plan: "BOOKING", status: "ACTIVE", ownerCount: 1 });
    expect(res.body.data.subscriptions).toHaveLength(1);

    const mail = h.email.last("ada@grandpalm.com")!;
    expect(mail.text).toContain(`http://${hostOf("grandpalm")}/reset-password?token=`);
    expect(JSON.stringify(res.body)).not.toMatch(/password|token/i);

    // before accepting, the owner cannot sign in with anything
    expect((await new Client(h.app, hostOf("grandpalm")).post("/auth/login", { email: "ada@grandpalm.com", password: PASSWORD })).status).toBe(401);

    const owner = new Client(h.app, hostOf("grandpalm"));
    expect((await owner.post("/auth/reset-password", { token: linkToken(mail.text), password: PASSWORD })).status).toBe(200);
    const login = await owner.login("ada@grandpalm.com");
    expect(login.body.data.user).toMatchObject({ role: "HOTEL_OWNER", emailVerified: true });
  });

  it("rejects duplicate, reserved, malformed addresses and unknown plans", async () => {
    expect((await ops.post("/platform/tenants", body({ ownerEmail: "other@x.com" }))).status).toBe(409);
    expect((await ops.post("/platform/tenants", body({ slug: "admin" }))).status).toBe(400);
    for (const slug of ["ab", "-bad-", "Bad_Slug", "has.dot", "x".repeat(41), "sp ace"]) {
      expect((await ops.post("/platform/tenants", body({ slug, ownerEmail: `o${Math.random().toString(36).slice(2)}@x.com` }))).status, slug).toBe(400);
    }
    expect((await ops.post("/platform/tenants", body({ slug: "newone", plan: "PLATINUM" }))).status).toBe(400);
  });

  it("rejects extra fields so a caller cannot smuggle in status, tenant ids or roles", async () => {
    for (const extra of [{ status: "SUSPENDED" }, { tenantId: "000000000000000000000001" }, { role: "PLATFORM_SUPER_ADMIN" }, { limitOverrides: { maxRooms: 99999 } }]) {
      expect((await ops.post("/platform/tenants", body({ slug: "smuggle", ownerEmail: "s@x.com", ...extra }))).status).toBe(400);
    }
  });

  it("leaves nothing half-built when creation fails part-way", async () => {
    const { Tenant } = await import("../../src/modules/tenants/tenant.model.js");
    // an owner email longer than the schema allows makes the user insert fail AFTER the tenant row exists
    const res = await ops.post("/platform/tenants", body({ slug: "halfbuilt", ownerEmail: `${"a".repeat(250)}@x.com` }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await Tenant.findOne({ slug: "halfbuilt" })).toBeNull();
  });

  it("only a platform operator can create hotels", async () => {
    const hotel = await createHotel(h, ops, "creatorcheck", "MANAGEMENT");
    expect((await hotel.owner.post("/platform/tenants", body({ slug: "viaowner", ownerEmail: "v@x.com" }))).status).toBe(403);
    expect((await new Client(h.app, "platform.test").post("/platform/tenants", body({ slug: "viaanon", ownerEmail: "w@x.com" }))).status).toBe(401);
  });

  it("lists and paginates hotels", async () => {
    await createHotel(h, ops, "pagetwo", "WEBSITE");
    const res = await ops.get("/platform/tenants?limit=2&page=1");
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(3);
    expect((await ops.get("/platform/tenants?limit=500")).status).toBe(400);
  });
});

describe("audit trail", () => {
  it("records tenant, plan, status and user changes with who did it", async () => {
    const hotel = await createHotel(h, ops, "audited", "MANAGEMENT");
    await ops.put(`/platform/tenants/${hotel.id}/plan`, { plan: "BOOKING" });
    await ops.put(`/platform/tenants/${hotel.id}/plan`, { plan: "MANAGEMENT" });
    await ops.patch(`/platform/tenants/${hotel.id}/status`, { status: "SUSPENDED", reason: "Test" });
    await ops.patch(`/platform/tenants/${hotel.id}/status`, { status: "ACTIVE" });
    const staff = await addStaff(h, hotel, "STAFF");
    await hotel.owner.patch(`/users/${staff.id}`, { role: "RECEPTIONIST" });
    await hotel.owner.post(`/users/${staff.id}/disable`);

    const platform = (await ops.get(`/platform/audit?tenantId=${hotel.id}&limit=100`)).body.data as Array<{ action: string; actorUserId?: string; tenantId: string }>;
    const actions = new Set(platform.map((e) => e.action));
    for (const a of ["TENANT_CREATED", "PLAN_CHANGED", "TENANT_SUSPENDED", "TENANT_ACTIVATED", "USER_CREATED", "ROLE_CHANGED", "USER_DISABLED", "PASSWORD_CHANGED", "LOGIN_SUCCEEDED"]) expect(actions.has(a), a).toBe(true);
    expect(platform.every((e) => e.tenantId === hotel.id)).toBe(true);
    expect(platform.find((e) => e.action === "TENANT_CREATED")!.actorUserId).toBeTruthy();

    const own = (await hotel.owner.get("/audit?limit=100")).body.data as Array<{ action: string; before?: { role?: string }; after?: { role?: string } }>;
    const change = own.find((e) => e.action === "ROLE_CHANGED")!;
    expect(change.before?.role).toBe("STAFF");
    expect(change.after?.role).toBe("RECEPTIONIST");
  });

  it("records failed and locked sign-ins", async () => {
    const hotel = await createHotel(h, ops, "securitylog", "MANAGEMENT");
    for (let i = 0; i < 6; i++) await new Client(h.app, hotel.host).post("/auth/login", { email: hotel.ownerEmail, password: "Wrong-Password-1" });
    const { Tenant } = await import("../../src/modules/tenants/tenant.model.js");
    const t = (await Tenant.findOne({ slug: "securitylog" }).lean())!;
    const rows = await AuditLog.find({ tenantId: t._id });
    const seen = new Set(rows.map((r) => r.action));
    expect(seen.has("LOGIN_FAILED")).toBe(true);
    expect(seen.has("ACCOUNT_LOCKED")).toBe(true);
  });

  it("never contains passwords, tokens or hashes", async () => {
    const all = await AuditLog.find({}).setOptions({ skipTenantScope: true }).lean();
    expect(all.length).toBeGreaterThan(10);
    const text = JSON.stringify(all);
    expect(text).not.toMatch(/argon2|passwordHash|refreshToken|hp_rt|Correct-Horse/i);
    for (const e of all) expect(JSON.stringify([e.before, e.after])).not.toMatch(/"token"|"password"/i);
  });

  it("is append-only: rows cannot be changed or deleted through the model", async () => {
    const row = (await AuditLog.findOne({ tenantId: null }))!;
    await expect(AuditLog.updateOne({ tenantId: row.tenantId, _id: row._id }, { $set: { action: "NOPE" } }).exec()).rejects.toThrow(/immutable/i);
    await expect(AuditLog.updateMany({ tenantId: row.tenantId }, { $set: { action: "NOPE" } }).exec()).rejects.toThrow(/immutable/i);
    await expect(AuditLog.deleteOne({ tenantId: row.tenantId, _id: row._id }).exec()).rejects.toThrow(/immutable/i);
    await expect(AuditLog.deleteMany({ tenantId: row.tenantId }).exec()).rejects.toThrow(/immutable/i);
    await expect(AuditLog.findOneAndUpdate({ tenantId: row.tenantId, _id: row._id }, { $set: { action: "NOPE" } }).exec()).rejects.toThrow(/immutable/i);
    row.action = "CHANGED";
    await expect(row.save()).rejects.toThrow(/immutable/i);
    expect((await AuditLog.findOne({ tenantId: row.tenantId, _id: row._id }))!.action).not.toBe("CHANGED");
  });

  it("platform audit is only for the operator and supports filtering", async () => {
    const hotel = await createHotel(h, ops, "auditacl", "MANAGEMENT");
    expect((await hotel.owner.get("/platform/audit")).status).toBe(403);
    const filtered = await ops.get("/platform/audit?action=TENANT_CREATED&limit=100");
    expect(filtered.body.data.length).toBeGreaterThan(0);
    expect(filtered.body.data.every((e: { action: string }) => e.action === "TENANT_CREATED")).toBe(true);
    expect((await ops.get("/platform/audit?action=lowercase")).status).toBe(400);
  });
});

describe("platform operator accounts", () => {
  it("only exist without a tenant, and tenant users can never hold the platform role", async () => {
    const hotel = await createHotel(h, ops, "invariant", "WEBSITE");
    await expect(User.create({ tenantId: new mongoose.Types.ObjectId(hotel.id), name: "Bad Actor", email: "bad@x.com", role: "PLATFORM_SUPER_ADMIN", passwordHash: "x" })).rejects.toThrow(/Platform roles/);
    await expect(User.create({ tenantId: null, name: "Orphan", email: "orphan@x.com", role: "HOTEL_OWNER", passwordHash: "x" })).rejects.toThrow(/Platform roles/);
  });

  it("the operator cannot be reached through hotel staff endpoints", async () => {
    const hotel = await createHotel(h, ops, "opsisolated", "MANAGEMENT");
    const operator = await User.findOne({ tenantId: null, email: "ops@platform.test" });
    expect((await hotel.owner.get(`/users/${operator!._id}`)).status).toBe(404);
    expect((await hotel.owner.patch(`/users/${operator!._id}`, { role: "HOTEL_OWNER" })).status).toBe(404);
  });
});
