import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PERMISSIONS } from "../../src/modules/rbac/permissions.js";
import { STAFF_ROLES, hasPermission, type Role } from "../../src/modules/rbac/roles.js";
import { Client, PASSWORD, addStaff, createHotel, platformClient, startHarness, stopHarness, type Harness, type Hotel } from "./harness.js";

let h: Harness;
let ops: Client;
let hotel: Hotel;
const staff = {} as Record<string, { client: Client; email: string; id: string }>;

beforeAll(async () => {
  h = await startHarness();
  ops = await platformClient(h);
  hotel = await createHotel(h, ops, "rbachotel", "MANAGEMENT");
  for (const role of STAFF_ROLES.filter((r) => r !== "HOTEL_OWNER")) staff[role] = await addStaff(h, hotel, role);
});
afterAll(stopHarness);

const client = (role: Role): Client => (role === "HOTEL_OWNER" ? hotel.owner : staff[role]!.client);

describe("every role × every permission, through the real middleware chain", () => {
  for (const role of STAFF_ROLES) {
    it(`${role}: allowed exactly what the matrix says`, async () => {
      const c = client(role);
      for (const permission of PERMISSIONS) {
        const res = await c.get(`/_probe/permission/${permission}`);
        const expected = hasPermission(role, permission);
        expect(res.status, `${role} ${permission}`).toBe(expected ? 200 : 403);
        if (!expected) expect(res.body.error.code).toBe("FORBIDDEN");
      }
    });
  }

  it("a signed-out caller is 401 on every permission", async () => {
    for (const permission of ["rooms.read", "payments.refund", "staff.create"]) {
      expect((await new Client(h.app, hotel.host).get(`/_probe/permission/${permission}`)).status).toBe(401);
    }
  });

  it("a guest (CUSTOMER) signed in at the hotel has no admin permission at all", async () => {
    const guest = new Client(h.app, hotel.host);
    const reg = await guest.post("/auth/register", { name: "Guest Person", email: "guest@rbac.example.com", password: PASSWORD });
    expect(reg.status).toBe(201);
    expect((await guest.login("guest@rbac.example.com")).status).toBe(200);
    for (const permission of PERMISSIONS) expect((await guest.get(`/_probe/permission/${permission}`)).status, permission).toBe(403);
    expect((await guest.get("/users")).status).toBe(403);
    expect((await guest.get("/audit")).status).toBe(403);
  });

  it("platform permissions are never granted to a hotel owner", async () => {
    for (const p of ["platform.tenants.read", "platform.tenants.create", "platform.tenants.update", "platform.audit.read"]) {
      expect((await hotel.owner.get(`/_probe/permission/${p}`)).status, p).toBe(403);
    }
  });
});

describe("staff management and privilege escalation", () => {
  it("a receptionist, accountant, housekeeper and restaurant manager cannot manage staff at all", async () => {
    for (const role of ["RECEPTIONIST", "ACCOUNTANT", "HOUSEKEEPER", "RESTAURANT_MANAGER", "STAFF"] as const) {
      const c = staff[role]!.client;
      expect((await c.get("/users")).status, role).toBe(403);
      expect((await c.post("/users", { name: "Some One", email: "x@y.com", role: "STAFF" })).status, role).toBe(403);
      expect((await c.patch(`/users/${staff["STAFF"]!.id}`, { name: "Renamed" })).status, role).toBe(403);
      expect((await c.post(`/users/${staff["STAFF"]!.id}/disable`)).status, role).toBe(403);
    }
  });

  it("a receptionist cannot change the owner", async () => {
    const owner = (await hotel.owner.get("/users?role=HOTEL_OWNER")).body.data[0];
    const r = staff["RECEPTIONIST"]!.client;
    expect((await r.patch(`/users/${owner.id}`, { name: "Hijacked" })).status).toBe(403);
    expect((await r.post(`/users/${owner.id}/disable`)).status).toBe(403);
  });

  it("a manager can create junior staff but never an owner or another manager", async () => {
    const m = staff["HOTEL_MANAGER"]!.client;
    expect((await m.post("/users", { name: "New Recep", email: "newrecep@rbac.example.com", role: "RECEPTIONIST" })).status).toBe(201);
    for (const role of ["HOTEL_OWNER", "HOTEL_MANAGER"]) {
      const res = await m.post("/users", { name: "Too Senior", email: `${role}@rbac.example.com`, role });
      expect(res.status, role).toBe(403);
    }
  });

  it("a manager cannot modify or disable the owner or a peer manager, nor promote anyone to their level or above", async () => {
    const m = staff["HOTEL_MANAGER"]!.client;
    const owner = (await hotel.owner.get("/users?role=HOTEL_OWNER")).body.data[0];
    expect((await m.patch(`/users/${owner.id}`, { name: "X Owner" })).status).toBe(403);
    expect((await m.post(`/users/${owner.id}/disable`)).status).toBe(403);

    const peer = await addStaff(h, hotel, "HOTEL_MANAGER");
    expect((await m.patch(`/users/${peer.id}`, { name: "Peer Renamed" })).status).toBe(403);
    expect((await m.post(`/users/${peer.id}/disable`)).status).toBe(403);

    const target = staff["RECEPTIONIST"]!.id;
    expect((await m.patch(`/users/${target}`, { role: "HOTEL_OWNER" })).status).toBe(403);
    expect((await m.patch(`/users/${target}`, { role: "HOTEL_MANAGER" })).status).toBe(403);
    expect((await m.patch(`/users/${target}`, { role: "ACCOUNTANT" })).status).toBe(200); // sideways is fine
    await m.patch(`/users/${target}`, { role: "RECEPTIONIST" });
  });

  it("nobody can change or disable their own account's role or status", async () => {
    const ownerId = (await hotel.owner.get("/users?role=HOTEL_OWNER")).body.data[0].id;
    expect((await hotel.owner.patch(`/users/${ownerId}`, { role: "STAFF" })).status).toBe(403);
    expect((await hotel.owner.post(`/users/${ownerId}/disable`)).status).toBe(403);
    const mid = staff["HOTEL_MANAGER"]!;
    expect((await mid.client.patch(`/users/${mid.id}`, { role: "HOTEL_OWNER" })).status).toBe(403);
    expect((await mid.client.post(`/users/${mid.id}/disable`)).status).toBe(403);
  });

  it("an owner can create, promote, and a promoted manager immediately gains manager rights", async () => {
    const created = await hotel.owner.post("/users", { name: "Future Boss", email: "future@rbac.example.com", role: "STAFF" });
    expect(created.status).toBe(201);
    const fb = await addStaffExisting("future@rbac.example.com");
    expect((await fb.get("/users")).status).toBe(403);
    expect((await hotel.owner.patch(`/users/${created.body.data.id}`, { role: "HOTEL_MANAGER" })).status).toBe(200);
    expect((await fb.get("/users")).status).toBe(200); // role is read from the database on every request
    expect((await hotel.owner.get("/audit?action=ROLE_CHANGED")).body.data.length).toBeGreaterThan(0);
  });

  it("disabling a user kills their sessions at once, and re-enabling lets them sign in again", async () => {
    const victim = await addStaff(h, hotel, "STAFF");
    expect((await victim.client.get("/auth/me")).status).toBe(200);
    expect((await hotel.owner.post(`/users/${victim.id}/disable`)).status).toBe(200);
    expect((await victim.client.get("/auth/me")).status).toBe(401); // the session was revoked, so the old token no longer identifies anyone
    expect((await victim.client.post("/auth/refresh")).status).toBe(401);
    expect((await new Client(h.app, hotel.host).post("/auth/login", { email: victim.email, password: PASSWORD })).body.error.code).toBe("ACCOUNT_DISABLED");
    expect((await hotel.owner.post(`/users/${victim.id}/enable`)).status).toBe(200);
    expect((await new Client(h.app, hotel.host).login(victim.email)).status).toBe(200);
  });

  it("the staff list never includes guests", async () => {
    const roles = new Set((await hotel.owner.get("/users?limit=100")).body.data.map((u: { role: string }) => u.role));
    expect(roles.has("CUSTOMER")).toBe(false);
  });

  it("the roles endpoint marks which roles the caller may assign", async () => {
    const asManager = (await staff["HOTEL_MANAGER"]!.client.get("/users/roles")).body.data as Array<{ role: string; assignable: boolean }>;
    expect(asManager.find((r) => r.role === "HOTEL_OWNER")!.assignable).toBe(false);
    expect(asManager.find((r) => r.role === "RECEPTIONIST")!.assignable).toBe(true);
    const asOwner = (await hotel.owner.get("/users/roles")).body.data as Array<{ assignable: boolean }>;
    expect(asOwner.every((r) => r.assignable)).toBe(true);
  });
});

describe("mass assignment", () => {
  it.each([
    ["tenantId", { tenantId: "000000000000000000000001" }],
    ["isActive", { isActive: false }],
    ["passwordHash", { passwordHash: "$argon2id$x" }],
    ["createdBy", { createdBy: "000000000000000000000001" }],
    ["emailVerifiedAt", { emailVerifiedAt: "2020-01-01" }],
    ["failedLoginCount", { failedLoginCount: 0 }],
    ["_id", { _id: "000000000000000000000001" }],
    ["__proto__", JSON.parse('{"__proto__": {"role": "HOTEL_OWNER"}}')],
  ])("PATCH /users/:id rejects %s", async (_n, extra) => {
    const res = await hotel.owner.patch(`/users/${staff["STAFF"]!.id}`, { name: "Valid Name", ...extra });
    expect(res.status).toBe(400);
  });

  it.each([
    ["isActive", { isActive: false }], ["tenantId", { tenantId: "000000000000000000000001" }], ["password", { password: "Chosen-By-Attacker-1" }],
  ])("POST /users rejects %s", async (_n, extra) => {
    const res = await hotel.owner.post("/users", { name: "Valid Name", email: `ma-${Math.random().toString(36).slice(2)}@rbac.example.com`, role: "STAFF", ...extra });
    expect(res.status).toBe(400);
  });

  it("PLATFORM_SUPER_ADMIN and CUSTOMER cannot be assigned through the staff endpoints", async () => {
    for (const role of ["PLATFORM_SUPER_ADMIN", "CUSTOMER"]) {
      expect((await hotel.owner.post("/users", { name: "Nope Nope", email: `r-${role}@rbac.example.com`, role })).status, role).toBe(400);
      expect((await hotel.owner.patch(`/users/${staff["STAFF"]!.id}`, { role })).status, role).toBe(400);
    }
  });

  it("malformed ids are rejected before any query", async () => {
    expect((await hotel.owner.get("/users/not-an-id")).status).toBe(400);
    expect((await hotel.owner.get("/users/%7B%22$ne%22:null%7D")).status).toBe(400);
  });
});

async function addStaffExisting(email: string): Promise<Client> {
  const { linkToken } = await import("./harness.js");
  const c = new Client(h.app, hotel.host);
  await c.post("/auth/reset-password", { token: linkToken(h.email.last(email)!.text), password: PASSWORD });
  await c.login(email);
  return c;
}
