import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makePng } from "../fixtures.js";
import { Client, createHotel, platformClient, startHarness, stopHarness, type Harness, type Hotel } from "./harness.js";

let h: Harness;
let ops: Client;
let A: Hotel;
let B: Hotel;
let empty: Hotel;
const anon = (host: string) => new Client(h.app, host);

beforeAll(async () => {
  h = await startHarness();
  ops = await platformClient(h);
  A = await createHotel(h, ops, "palmcourt", "BOOKING");
  B = await createHotel(h, ops, "bluelagoon", "WEBSITE");
  empty = await createHotel(h, ops, "freshhotel", "WEBSITE");

  const img = async (c: Client, w = 1600, ht = 900) => (await c.upload("/media", makePng(w, ht), { alt: "A photo" })).body.data.id as string;
  const [hero, room1, room2, g1, g2] = [await img(A.owner), await img(A.owner, 800, 600), await img(A.owner, 800, 600), await img(A.owner, 900, 600), await img(A.owner, 900, 600)];
  await A.owner.patch("/hotel/profile", {
    tagline: "Calm in the city", description: "A quiet hotel near the lagoon.",
    contact: { phone: "+2348012345678", whatsapp: "2348012345678", email: "hi@palm.example.com", address: "12 Marina Road", city: "Lagos", country: "Nigeria", latitude: 6.45, longitude: 3.4 },
    branding: { primaryColor: "#7C2D12", typography: "classic" }, policies: { checkInTime: "15:00", checkOutTime: "11:00", cancellation: "Free cancellation up to 48 hours before." },
  });
  await A.owner.patch("/hotel/content", { hero: { headline: "Rest well", subheadline: "Boutique stays", imageAssetIds: [hero] }, whyChooseUs: [{ title: "Quiet", text: "Very quiet.", icon: "Sparkles" }], testimonials: [{ quote: "Lovely stay.", guestName: "Ada" }] });
  const deluxe = (await A.owner.post("/room-types", { name: "Deluxe Room", maxAdults: 2, basePrice: 8_500_000, amenityKeys: ["wifi", "ac"], imageAssetIds: [room1], isFeatured: true, shortDescription: "Light and airy" })).body.data;
  await A.owner.post("/room-types", { name: "Hidden Suite", maxAdults: 4, basePrice: 25_000_000, isActive: false });
  await A.owner.post("/room-types", { name: "Standard Room", maxAdults: 2, basePrice: 5_000_000, imageAssetIds: [room2] });
  await A.owner.post("/rooms", { roomNumber: "SECRET-101", roomTypeId: deluxe.id });
  await A.owner.post("/facilities", { name: "Rooftop pool", icon: "Waves" });
  await A.owner.post("/facilities", { name: "Closed spa", isActive: false });
  await A.owner.post("/gallery", { assetId: g1, caption: "Pool", category: "facilities" });
  await A.owner.post("/gallery", { assetId: g2, caption: "Lobby", category: "exterior", isActive: false });
  await B.owner.post("/room-types", { name: "Lagoon View", maxAdults: 2, basePrice: 7_000_000 });
});
afterAll(stopHarness);

describe("GET /public/site", () => {
  it("returns the hotel's own public view, with branding, content, rooms, facilities and gallery", async () => {
    const res = await anon(A.host).get("/public/site");
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.hotel).toMatchObject({ name: "Hotel palmcourt", slug: "palmcourt", currency: "NGN", tagline: "Calm in the city" });
    expect(d.hotel.branding).toMatchObject({ primaryColor: "#7C2D12", typography: "classic" });
    expect(d.hotel.policies).toMatchObject({ checkInTime: "15:00", checkOutTime: "11:00" });
    expect(d.hotel.contact).toMatchObject({ whatsapp: "2348012345678", city: "Lagos" });
    expect(d.content.hero).toMatchObject({ headline: "Rest well" });
    expect(d.content.hero.images[0]).toMatchObject({ width: 1600, height: 900, alt: "A photo" });
    expect(d.featuredRooms.map((r: { name: string }) => r.name)).toEqual(["Deluxe Room", "Standard Room"]); // featured first, hidden one excluded
    expect(d.facilities.map((f: { name: string }) => f.name)).toEqual(["Rooftop pool"]);
    expect(d.gallery.map((g: { caption: string }) => g.caption)).toEqual(["Pool"]);
    expect(d.features).toContain("booking");
  });

  it("room cards carry integer kobo prices with the hotel's currency, resolved amenities and images", async () => {
    const deluxe = (await anon(A.host).get("/public/site")).body.data.featuredRooms[0];
    expect(deluxe.price).toEqual({ amount: 8_500_000, currency: "NGN" });
    expect(deluxe.amenities).toEqual([{ key: "wifi", label: "Free Wi-Fi", icon: "Wifi" }, { key: "ac", label: "Air conditioning", icon: "Snowflake" }]);
    expect(deluxe.images).toHaveLength(1);
  });

  it("never leaks ids, tenant ids, room numbers, hidden items or internal fields", async () => {
    const text = JSON.stringify((await anon(A.host).get("/public/site")).body);
    for (const secret of [A.id, B.id, "SECRET-101", "Hidden Suite", "Closed spa", "Lobby", "tenantId", "_id", "isActive", "sortOrder", "uploadedBy", "publicId", "passwordHash"]) {
      expect(text, secret).not.toContain(secret);
    }
  });

  it("each hotel's address shows only that hotel's data", async () => {
    const b = (await anon(B.host).get("/public/site")).body.data;
    expect(b.featuredRooms.map((r: { name: string }) => r.name)).toEqual(["Lagoon View"]);
    expect(b.hotel.slug).toBe("bluelagoon");
    expect(JSON.stringify(b)).not.toMatch(/Deluxe|Rooftop|palmcourt/);
  });

  it("a brand-new hotel with no content still returns a complete, safe default", async () => {
    const res = await anon(empty.host).get("/public/site");
    expect(res.status).toBe(200);
    expect(res.body.data.hotel.branding).toMatchObject({ primaryColor: "#0B6E6E", typography: "modern", logo: null });
    expect(res.body.data.featuredRooms).toEqual([]);
    expect(res.body.data.content.hero.images).toEqual([]);
    expect(res.body.data.hotel.policies.checkInTime).toBe("14:00");
  });

  it("is cacheable for a short time and varies by host", async () => {
    const res = await anon(A.host).get("/public/site");
    expect(res.headers["cache-control"]).toMatch(/public, max-age=30/);
    expect(res.headers["vary"]).toMatch(/Host/i);
  });

  it("falls back to the first room photo for the hero when none is chosen", async () => {
    const hotel = await createHotel(h, ops, "herofallback", "WEBSITE");
    const photo = (await hotel.owner.upload("/media", makePng(800, 600))).body.data.id;
    await hotel.owner.post("/room-types", { name: "Only Room", maxAdults: 1, basePrice: 1_000_000, imageAssetIds: [photo] });
    expect((await anon(hotel.host).get("/public/site")).body.data.content.hero.images).toHaveLength(1);
  });

  it("omits what the plan does not include (override switches rooms off)", async () => {
    const hotel = await createHotel(h, ops, "partial", "WEBSITE");
    await hotel.owner.post("/room-types", { name: "Hidden By Plan", maxAdults: 1, basePrice: 1 });
    await ops.put(`/platform/tenants/${hotel.id}/feature-overrides`, { feature: "rooms", enabled: false });
    const d = (await anon(hotel.host).get("/public/site")).body.data;
    expect(d.featuredRooms).toEqual([]);
    expect(d.features).not.toContain("rooms");
    expect((await anon(hotel.host).get("/public/room-types")).body.error.code).toBe("FEATURE_NOT_AVAILABLE");
  });
});

describe("room, facility and gallery endpoints", () => {
  it("lists active room types and returns one by slug", async () => {
    const list = (await anon(A.host).get("/public/room-types")).body.data;
    expect(list.map((r: { slug: string }) => r.slug)).toEqual(["deluxe-room", "standard-room"]);
    const one = await anon(A.host).get("/public/room-types/deluxe-room");
    expect(one.body.data).toMatchObject({ name: "Deluxe Room", maxAdults: 2 });
  });

  it("404s for hidden rooms, other hotels' slugs and unknown slugs; 400 for malformed slugs", async () => {
    expect((await anon(A.host).get("/public/room-types/hidden-suite")).status).toBe(404);
    expect((await anon(B.host).get("/public/room-types/deluxe-room")).status).toBe(404);
    expect((await anon(A.host).get("/public/room-types/nope")).status).toBe(404);
    expect((await anon(A.host).get("/public/room-types/Bad%20Slug!")).status).toBe(400);
    expect((await anon(A.host).get("/public/room-types/%7B%22%24ne%22%3Anull%7D")).status).toBe(400);
  });

  it("filters the gallery by category and rejects unknown categories", async () => {
    expect((await anon(A.host).get("/public/gallery?category=facilities")).body.data).toHaveLength(1);
    expect((await anon(A.host).get("/public/gallery?category=exterior")).body.data).toHaveLength(0); // the only exterior photo is hidden
    expect((await anon(A.host).get("/public/gallery?category=bogus")).status).toBe(400);
    expect((await anon(A.host).get("/public/gallery?category[$ne]=x")).status).toBe(400);
  });

  it("facilities list shows only active ones", async () => {
    expect((await anon(A.host).get("/public/facilities")).body.data.map((f: { name: string }) => f.name)).toEqual(["Rooftop pool"]);
  });
});

describe("availability of the public API", () => {
  it("checks public availability with trusted server-side capacity operators", async () => {
    const res = await anon(A.host).get("/reservations/availability?checkIn=2026-11-10&checkOut=2026-11-12&adults=2&children=0");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ checkIn: "2026-11-10", checkOut: "2026-11-12", nights: 2 });
    expect(res.body.data.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ slug: "deluxe-room", availableRooms: 1, available: true, nights: 2 }),
    ]));
    // An adult-capacity match should not return inactive room types.
    expect(res.body.data.items.some((item: { slug: string }) => item.slug === "hidden-suite")).toBe(false);
  });

  it("needs no sign-in, but unknown addresses and the platform address get 404", async () => {
    expect((await anon("nothere.platform.test").get("/public/site")).status).toBe(404);
    expect((await anon("platform.test").get("/public/site")).status).toBe(404);
  });

  it("a suspended hotel's site is closed (403 TENANT_SUSPENDED) and comes back when reactivated", async () => {
    await ops.patch(`/platform/tenants/${B.id}/status`, { status: "SUSPENDED", reason: "Unpaid" });
    const res = await anon(B.host).get("/public/site");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("TENANT_SUSPENDED");
    expect((await anon(A.host).get("/public/site")).status).toBe(200);
    await ops.patch(`/platform/tenants/${B.id}/status`, { status: "ACTIVE" });
    expect((await anon(B.host).get("/public/site")).status).toBe(200);
  });

  it("works on a verified custom domain", async () => {
    await ops.post(`/platform/tenants/${A.id}/domains`, { hostname: "www.palmcourt-hotel.com", verified: true });
    const res = await anon("www.palmcourt-hotel.com").get("/public/site");
    expect(res.status).toBe(200);
    expect(res.body.data.hotel.slug).toBe("palmcourt");
  });

  it("a visitor cannot read the admin lists through public routes (those are separate and need sign-in)", async () => {
    for (const path of ["/rooms", "/room-types", "/media", "/hotel/profile", "/gallery", "/facilities"]) expect((await anon(A.host).get(path)).status, path).toBe(401);
  });
});
