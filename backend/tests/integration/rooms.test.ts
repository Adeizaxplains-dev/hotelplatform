import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PERMISSIONS } from "../../src/modules/rbac/permissions.js";
import { hasPermission, STAFF_ROLES, type Role } from "../../src/modules/rbac/roles.js";
import { makePng } from "../fixtures.js";
import { Client, addStaff, createHotel, platformClient, startHarness, stopHarness, type Harness, type Hotel } from "./harness.js";

let h: Harness;
let ops: Client;
let A: Hotel;
let B: Hotel;
const staff = {} as Record<string, { client: Client; id: string }>;

const typeBody = (over: Record<string, unknown> = {}) => ({ name: "Deluxe Room", maxAdults: 2, basePrice: 8_500_000, ...over });

beforeAll(async () => {
  h = await startHarness();
  ops = await platformClient(h);
  A = await createHotel(h, ops, "roomsa", "MANAGEMENT");
  B = await createHotel(h, ops, "roomsb", "MANAGEMENT");
  for (const role of ["HOTEL_MANAGER", "RECEPTIONIST", "HOUSEKEEPER", "ACCOUNTANT"]) staff[role] = await addStaff(h, A, role);
});
afterAll(stopHarness);

describe("room types", () => {
  it("creates, reads, updates and lists with a generated slug and integer kobo price", async () => {
    const res = await A.owner.post("/room-types", typeBody({ amenityKeys: ["wifi", "ac", "breakfast"], bedConfig: "1 King bed", sizeSqm: 32 }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: "Deluxe Room", slug: "deluxe-room", basePrice: 8_500_000, maxAdults: 2, maxChildren: 0, isActive: true, roomCount: 0 });
    const id = res.body.data.id as string;
    expect((await A.owner.get(`/room-types/${id}`)).body.data.amenityKeys).toEqual(["wifi", "ac", "breakfast"]);
    const upd = await A.owner.patch(`/room-types/${id}`, { shortDescription: "Spacious and calm", isFeatured: true });
    expect(upd.body.data).toMatchObject({ shortDescription: "Spacious and calm", isFeatured: true });
    expect((await A.owner.get("/room-types")).body.data.some((t: { id: string }) => t.id === id)).toBe(true);
  });

  it("makes slugs unique within a hotel but lets two hotels share one", async () => {
    const a2 = await A.owner.post("/room-types", typeBody());
    expect(a2.body.data.slug).toBe("deluxe-room-2");
    const b1 = await B.owner.post("/room-types", typeBody());
    expect(b1.body.data.slug).toBe("deluxe-room");
    expect((await A.owner.post("/room-types", typeBody({ name: "Other", slug: "deluxe-room" }))).status).toBe(409);
  });

  it.each([
    ["float price", { basePrice: 85000.5 }], ["negative price", { basePrice: -1 }], ["string price", { basePrice: "85000" }],
    ["unknown amenity", { amenityKeys: ["jacuzzi-on-the-moon"] }], ["duplicate amenity", { amenityKeys: ["wifi", "wifi"] }],
    ["zero adults", { maxAdults: 0 }], ["HTML in name", { name: "<b>Suite</b>" }], ["HTML in description", { description: "<script>x</script>" }],
    ["tenantId", { tenantId: "000000000000000000000001" }], ["isActive typo field", { isActve: true }], ["bad slug", { slug: "Not A Slug!" }],
    ["too many images", { imageAssetIds: Array(13).fill("000000000000000000000001") }],
  ])("rejects %s", async (_n, extra) => {
    expect((await A.owner.post("/room-types", typeBody(extra))).status).toBe(400);
  });

  it("records price changes in the audit log with before and after", async () => {
    const t = (await A.owner.post("/room-types", typeBody({ name: "Priced" }))).body.data;
    await A.owner.patch(`/room-types/${t.id}`, { basePrice: 9_900_000 });
    const trail = (await A.owner.get("/audit?action=ROOM_PRICE_CHANGED")).body.data as Array<{ resourceId: string; before: { basePrice: number }; after: { basePrice: number } }>;
    const e = trail.find((x) => x.resourceId === t.id)!;
    expect(e.before.basePrice).toBe(8_500_000);
    expect(e.after.basePrice).toBe(9_900_000);
  });

  it("cannot be deleted while rooms use it; can be once they are gone", async () => {
    const t = (await A.owner.post("/room-types", typeBody({ name: "Guarded" }))).body.data;
    const room = (await A.owner.post("/rooms", { roomNumber: "G1", roomTypeId: t.id })).body.data;
    expect((await A.owner.del(`/room-types/${t.id}`)).status).toBe(409);
    await A.owner.del(`/rooms/${room.id}`);
    expect((await A.owner.del(`/room-types/${t.id}`)).status).toBe(200);
    expect((await A.owner.get(`/room-types/${t.id}`)).status).toBe(404);
  });

  it("searches by name and filters by active", async () => {
    await A.owner.post("/room-types", typeBody({ name: "Zebra Suite", isActive: false }));
    const found = await A.owner.get("/room-types?search=zebra");
    expect(found.body.data.map((t: { name: string }) => t.name)).toEqual(["Zebra Suite"]);
    const inactive = await A.owner.get("/room-types?active=false");
    expect(inactive.body.data.every((t: { isActive: boolean }) => !t.isActive)).toBe(true);
  });

  it("only accepts images that belong to this hotel", async () => {
    const mine = (await A.owner.upload("/media", makePng(400, 300))).body.data.id as string;
    const theirs = (await B.owner.upload("/media", makePng(400, 300))).body.data.id as string;
    const ok = await A.owner.post("/room-types", typeBody({ name: "With Photo", imageAssetIds: [mine] }));
    expect(ok.status).toBe(201);
    expect(ok.body.data.images[0].assetId).toBe(mine);
    expect((await A.owner.post("/room-types", typeBody({ name: "Stolen Photo", imageAssetIds: [theirs] }))).status).toBe(400);
    expect((await A.owner.patch(`/room-types/${ok.body.data.id}`, { imageAssetIds: [mine, theirs] })).status).toBe(400);
  });
});

describe("rooms", () => {
  let typeId: string;
  beforeAll(async () => {
    typeId = (await A.owner.post("/room-types", typeBody({ name: "Standard Room", basePrice: 5_000_000 }))).body.data.id;
  });

  it("creates rooms with default statuses and lists them with the type name", async () => {
    const res = await A.owner.post("/rooms", { roomNumber: "101", roomTypeId: typeId, floor: 1 });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ roomNumber: "101", roomTypeName: "Standard Room", floor: 1, status: "AVAILABLE", housekeepingStatus: "CLEAN", isActive: true });
    const list = await A.owner.get("/rooms?limit=100");
    expect(list.body.data.find((r: { roomNumber: string }) => r.roomNumber === "101").roomTypeName).toBe("Standard Room");
  });

  it("room numbers are unique within a hotel but can repeat across hotels", async () => {
    expect((await A.owner.post("/rooms", { roomNumber: "101", roomTypeId: typeId })).status).toBe(409);
    const bType = (await B.owner.post("/room-types", typeBody({ name: "Standard Room" }))).body.data.id;
    expect((await B.owner.post("/rooms", { roomNumber: "101", roomTypeId: bType })).status).toBe(201);
    const a102 = (await A.owner.post("/rooms", { roomNumber: "102", roomTypeId: typeId })).body.data.id;
    expect((await A.owner.patch(`/rooms/${a102}`, { roomNumber: "101" })).status).toBe(409);
  });

  it("only accepts a room type from the same hotel", async () => {
    const bType = (await B.owner.get("/room-types")).body.data[0].id;
    expect((await A.owner.post("/rooms", { roomNumber: "X1", roomTypeId: bType })).status).toBe(400);
    const a = (await A.owner.post("/rooms", { roomNumber: "X2", roomTypeId: typeId })).body.data.id;
    expect((await A.owner.patch(`/rooms/${a}`, { roomTypeId: bType })).status).toBe(400);
  });

  it("filters by type, status and search; paginates", async () => {
    await A.owner.post("/rooms", { roomNumber: "205", roomTypeId: typeId, status: "MAINTENANCE" });
    expect((await A.owner.get("/rooms?status=MAINTENANCE")).body.data.map((r: { roomNumber: string }) => r.roomNumber)).toEqual(["205"]);
    expect((await A.owner.get("/rooms?search=205")).body.data).toHaveLength(1);
    expect((await A.owner.get(`/rooms?roomTypeId=${typeId}&limit=2&page=1`)).body.data).toHaveLength(2);
    expect((await A.owner.get("/rooms?status=EXPLODED")).status).toBe(400);
  });

  it.each([
    ["housekeepingStatus (housekeepers' field)", { housekeepingStatus: "DIRTY" }], ["tenantId", { tenantId: "000000000000000000000001" }],
    ["bad number", { roomNumber: "<b>1</b>" }], ["_id", { _id: "000000000000000000000001" }],
  ])("rejects %s on create", async (_n, extra) => {
    expect((await A.owner.post("/rooms", { roomNumber: "Z9", roomTypeId: typeId, ...extra })).status).toBe(400);
  });

  it("enforces the plan's maxRooms limit and lets the operator raise it", async () => {
    const hotel = await createHotel(h, ops, "limitrooms", "WEBSITE");
    const t = (await hotel.owner.post("/room-types", typeBody())).body.data.id;
    await ops.put(`/platform/tenants/${hotel.id}/limits`, { maxRooms: 2 });
    expect((await hotel.owner.post("/rooms", { roomNumber: "1", roomTypeId: t })).status).toBe(201);
    expect((await hotel.owner.post("/rooms", { roomNumber: "2", roomTypeId: t })).status).toBe(201);
    const blocked = await hotel.owner.post("/rooms", { roomNumber: "3", roomTypeId: t });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe("LIMIT_REACHED");
    await ops.put(`/platform/tenants/${hotel.id}/limits`, { maxRooms: 3 });
    expect((await hotel.owner.post("/rooms", { roomNumber: "3", roomTypeId: t })).status).toBe(201);
  });

  it("deletes a room and audits it", async () => {
    const id = (await A.owner.post("/rooms", { roomNumber: "DEL1", roomTypeId: typeId })).body.data.id;
    expect((await A.owner.del(`/rooms/${id}`)).status).toBe(200);
    expect((await A.owner.get(`/rooms/${id}`)).status).toBe(404);
    expect((await A.owner.get("/audit?action=ROOM_DELETED")).body.data.some((e: { resourceId: string }) => e.resourceId === id)).toBe(true);
  });
});

describe("Hotel A cannot reach Hotel B's rooms and room types (the isolation tests deferred from Phase 1)", () => {
  it("lists only its own", async () => {
    const aTypes = (await A.owner.get("/room-types?limit=100")).body.data.map((t: { id: string }) => t.id);
    const bTypes = (await B.owner.get("/room-types?limit=100")).body.data.map((t: { id: string }) => t.id);
    expect(aTypes.length).toBeGreaterThan(0);
    expect(bTypes.length).toBeGreaterThan(0);
    expect(aTypes.filter((id: string) => bTypes.includes(id))).toEqual([]);
    const aRooms = (await A.owner.get("/rooms?limit=100")).body.data.map((r: { id: string }) => r.id);
    const bRooms = (await B.owner.get("/rooms?limit=100")).body.data.map((r: { id: string }) => r.id);
    expect(aRooms.filter((id: string) => bRooms.includes(id))).toEqual([]);
  });

  it("reading, changing or deleting B's records by id is a 404, and B's data is untouched", async () => {
    const bType = (await B.owner.get("/room-types")).body.data[0];
    const bRoom = (await B.owner.get("/rooms")).body.data[0];
    expect((await A.owner.get(`/room-types/${bType.id}`)).status).toBe(404);
    expect((await A.owner.patch(`/room-types/${bType.id}`, { basePrice: 1 })).status).toBe(404);
    expect((await A.owner.del(`/room-types/${bType.id}`)).status).toBe(404);
    expect((await A.owner.get(`/rooms/${bRoom.id}`)).status).toBe(404);
    expect((await A.owner.patch(`/rooms/${bRoom.id}`, { status: "OUT_OF_SERVICE" })).status).toBe(404);
    expect((await A.owner.del(`/rooms/${bRoom.id}`)).status).toBe(404);
    expect((await B.owner.get(`/room-types/${bType.id}`)).body.data.basePrice).toBe(bType.basePrice);
    expect((await B.owner.get(`/rooms/${bRoom.id}`)).body.data.status).toBe("AVAILABLE");
  });

  it("A's token does not work at B's address, and tenantId in query or body is refused", async () => {
    expect((await A.owner.as(B.host).get("/rooms")).status).toBe(403);
    expect((await A.owner.get(`/rooms?tenantId=${B.id}`)).status).toBe(400);
  });
});

describe("who may do what (rooms.*), through the real middleware", () => {
  const cases: Array<[string, string, (c: Client) => Promise<number>]> = [
    ["read", "rooms.read", (c) => c.get("/room-types").then((r) => r.status)],
    ["create", "rooms.create", (c) => c.post("/room-types", typeBody({ name: `T${Math.random()}` })).then((r) => r.status)],
  ];
  for (const role of ["HOTEL_MANAGER", "RECEPTIONIST", "HOUSEKEEPER", "ACCOUNTANT"] as const) {
    for (const [name, perm, call] of cases) {
      it(`${role} ${name}: allowed only if the role holds ${perm}`, async () => {
        const status = await call(staff[role]!.client);
        const allowed = hasPermission(role as Role, perm as (typeof PERMISSIONS)[number]);
        expect(status === 403 ? false : true, `${role} ${perm} got ${status}`).toBe(allowed);
        if (allowed) expect([200, 201]).toContain(status);
      });
    }
  }

  it("a receptionist can read but not change rooms; a housekeeper can read rooms", async () => {
    const t = (await A.owner.get("/room-types")).body.data[0].id as string;
    expect((await staff["RECEPTIONIST"]!.client.get(`/room-types/${t}`)).status).toBe(200);
    expect((await staff["RECEPTIONIST"]!.client.patch(`/room-types/${t}`, { basePrice: 1 })).status).toBe(403);
    expect((await staff["RECEPTIONIST"]!.client.del(`/room-types/${t}`)).status).toBe(403);
    expect((await staff["HOUSEKEEPER"]!.client.get("/rooms")).status).toBe(200);
    expect((await staff["HOUSEKEEPER"]!.client.post("/rooms", { roomNumber: "HK1", roomTypeId: t })).status).toBe(403);
    expect((await staff["ACCOUNTANT"]!.client.get("/rooms")).status).toBe(403);
  });

  it("the plan feature is checked too: rooms are part of every plan, but an override can switch them off", async () => {
    const hotel = await createHotel(h, ops, "norooms", "WEBSITE");
    expect((await hotel.owner.get("/room-types")).status).toBe(200);
    await ops.put(`/platform/tenants/${hotel.id}/feature-overrides`, { feature: "rooms", enabled: false });
    const res = await hotel.owner.get("/room-types");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FEATURE_NOT_AVAILABLE");
  });

  it("the amenity catalogue is available to editors", async () => {
    const res = await A.owner.get("/catalog/amenities");
    expect(res.body.data.find((a: { key: string }) => a.key === "wifi").label).toBe("Free Wi-Fi");
    expect((await new Client(h.app, A.host).get("/catalog/amenities")).status).toBe(401);
  });
});

describe("staff search (Phase 1 regression)", () => {
  it("finds staff by name or email text", async () => {
    const res = await A.owner.get("/users?search=receptionist");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

void STAFF_ROLES;
