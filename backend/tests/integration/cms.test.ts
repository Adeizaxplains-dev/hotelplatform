import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makePng } from "../fixtures.js";
import { Client, addStaff, createHotel, platformClient, startHarness, stopHarness, type Harness, type Hotel } from "./harness.js";

let h: Harness;
let ops: Client;
let A: Hotel;
let B: Hotel;
let manager: { client: Client };
let receptionist: { client: Client };

beforeAll(async () => {
  h = await startHarness();
  ops = await platformClient(h);
  A = await createHotel(h, ops, "cmsa", "MANAGEMENT");
  B = await createHotel(h, ops, "cmsb", "MANAGEMENT");
  manager = await addStaff(h, A, "HOTEL_MANAGER");
  receptionist = await addStaff(h, A, "RECEPTIONIST");
});
afterAll(stopHarness);

describe("database constraints that business rules rely on", () => {
  it("the one-per-hotel settings documents really have a UNIQUE tenantId index (a duplicate index declaration once dropped it silently)", async () => {
    const { HotelProfile } = await import("../../src/modules/hotel/hotelProfile.model.js");
    const { WebsiteContent } = await import("../../src/modules/website/websiteContent.model.js");
    for (const M of [HotelProfile, WebsiteContent]) {
      const idx = await M.collection.indexes();
      const tenantIdx = idx.filter((i) => Object.keys(i.key).length === 1 && i.key["tenantId"] === 1);
      expect(tenantIdx.length, M.modelName).toBe(1);
      expect(tenantIdx[0]!.unique, M.modelName).toBe(true);
    }
  });

  it("room types and rooms are unique per hotel at the database level", async () => {
    const { Room } = await import("../../src/modules/rooms/room.model.js");
    const { RoomType } = await import("../../src/modules/rooms/roomType.model.js");
    const has = async (M: typeof Room | typeof RoomType, key: Record<string, number>) => (await M.collection.indexes()).some((i) => i.unique && JSON.stringify(i.key) === JSON.stringify(key));
    expect(await has(Room, { tenantId: 1, roomNumber: 1 })).toBe(true);
    expect(await has(RoomType, { tenantId: 1, slug: 1 })).toBe(true);
  });
});

describe("hotel profile (contact, policies, branding, SEO)", () => {
  it("starts with defaults and is created on first read", async () => {
    const res = await A.owner.get("/hotel/profile");
    expect(res.status).toBe(200);
    expect(res.body.data.branding).toMatchObject({ primaryColor: "#0B6E6E", typography: "modern" });
    expect(res.body.data.policies).toMatchObject({ checkInTime: "14:00", checkOutTime: "12:00" });
    expect(res.body.data.tenantId).toBeUndefined();
  });

  it("updates sections independently, normalises values, and null clears a field", async () => {
    const r1 = await A.owner.patch("/hotel/profile", {
      tagline: "Calm in the heart of Lagos",
      contact: { phone: "+234 801 234 5678", whatsapp: "+234 (801) 234-5678", email: "Hello@CMSA.example.com", city: "Lagos", latitude: 6.4281, longitude: 3.4219 },
      branding: { primaryColor: "#7c2d12", typography: "classic" },
    });
    expect(r1.status).toBe(200);
    expect(r1.body.data.contact).toMatchObject({ whatsapp: "2348012345678", email: "hello@cmsa.example.com", city: "Lagos", latitude: 6.4281 });
    expect(r1.body.data.branding).toMatchObject({ primaryColor: "#7C2D12", typography: "classic", accentColor: "#B8863B" });

    const r2 = await A.owner.patch("/hotel/profile", { contact: { phone: null }, policies: { checkInTime: "15:00" } });
    expect(r2.body.data.contact.phone).toBeUndefined();
    expect(r2.body.data.contact.city).toBe("Lagos"); // untouched by the second patch
    expect(r2.body.data.policies).toMatchObject({ checkInTime: "15:00", checkOutTime: "12:00" });
    expect(r2.body.data.tagline).toBe("Calm in the heart of Lagos");
  });

  it.each([
    ["bad colour", { branding: { primaryColor: "red" } }], ["3-digit colour", { branding: { primaryColor: "#fff" } }],
    ["bad time", { policies: { checkInTime: "25:00" } }], ["http link", { social: { instagram: "http://instagram.com/x" } }],
    ["wrong site", { social: { instagram: "https://evil.com/x" } }], ["look-alike host", { social: { facebook: "https://facebook.com.evil.com/x" } }],
    ["javascript link", { social: { x: "javascript:alert(1)" } }], ["credentials in link", { social: { tiktok: "https://user:pw@tiktok.com/x" } }],
    ["map not embed", { contact: { mapEmbedUrl: "https://www.google.com/maps/place/x" } }], ["map other host", { contact: { mapEmbedUrl: "https://evil.com/maps/embed?x" } }],
    ["short whatsapp", { contact: { whatsapp: "12345" } }], ["lat out of range", { contact: { latitude: 120 } }],
    ["HTML tagline", { tagline: "<img src=x onerror=alert(1)>" }], ["title template without %s", { seo: { titleTemplate: "My hotel" } }],
    ["tenantId", { tenantId: "000000000000000000000001" }], ["unknown section", { admin: { role: "owner" } }], ["empty", {}],
  ])("rejects %s", async (_n, body) => {
    expect((await A.owner.patch("/hotel/profile", body)).status).toBe(400);
  });

  it("accepts a Google Maps embed link and https social links on the right sites", async () => {
    const res = await A.owner.patch("/hotel/profile", {
      contact: { mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12" },
      social: { instagram: "https://www.instagram.com/cmsa", facebook: "https://facebook.com/cmsa", youtube: "https://youtu.be/abc" },
    });
    expect(res.status).toBe(200);
  });

  it("records the change in the audit log", async () => {
    expect((await A.owner.get("/audit?action=SETTINGS_UPDATED")).body.data.length).toBeGreaterThan(0);
  });

  it("branding images must belong to this hotel", async () => {
    const mine = (await A.owner.upload("/media", makePng(300, 300))).body.data.id as string;
    const res = await A.owner.patch("/hotel/profile", { branding: { logoAssetId: mine }, seo: { ogImageAssetId: mine } });
    expect(res.status).toBe(200);
    expect(res.body.data.assets[mine].url).toContain("hotels/");
    expect(res.body.data.assets[mine].url).not.toContain(A.id);
    const theirs = (await B.owner.upload("/media", makePng(300, 300))).body.data.id as string;
    expect((await A.owner.patch("/hotel/profile", { branding: { faviconAssetId: theirs } })).status).toBe(400);
  });

  it("each hotel has its own profile", async () => {
    expect((await B.owner.get("/hotel/profile")).body.data.tagline).toBeUndefined();
    await B.owner.patch("/hotel/profile", { tagline: "B's tagline" });
    expect((await A.owner.get("/hotel/profile")).body.data.tagline).toBe("Calm in the heart of Lagos");
  });
});

describe("website content", () => {
  const content = {
    hero: { headline: "Rest well. Wake happy.", subheadline: "Boutique stays near the lagoon." },
    about: { heading: "Our story", body: "Family-run since 2009.\n\nEvery guest is treated like family.", highlights: [{ label: "Since", value: "2009" }, { label: "Rooms", value: "48" }] },
    whyChooseUs: [{ title: "Quiet rooms", text: "Triple-glazed windows.", icon: "Sparkles" }],
    testimonials: [{ quote: "Spotless and so peaceful.", guestName: "Tolu A.", source: "Google", rating: 5 }],
    faqs: [{ question: "Is breakfast included?", answer: "Yes, on most rates." }],
    pageSeo: { home: { title: "Hotel in Lagos", description: "Boutique hotel near the lagoon." } },
  };

  it("saves structured copy and returns it", async () => {
    const res = await A.owner.patch("/hotel/content", content);
    expect(res.status).toBe(200);
    expect(res.body.data.hero.headline).toBe("Rest well. Wake happy.");
    expect(res.body.data.about.highlights).toHaveLength(2);
    expect(res.body.data.testimonials[0]).toMatchObject({ guestName: "Tolu A.", rating: 5 });
    expect((await A.owner.get("/hotel/content")).body.data.pageSeo.home.title).toBe("Hotel in Lagos");
  });

  it("updating one section leaves the others alone; arrays are replaced; null clears", async () => {
    await A.owner.patch("/hotel/content", { whyChooseUs: [] });
    const res = await A.owner.patch("/hotel/content", { hero: { subheadline: null } });
    expect(res.body.data.whyChooseUs).toEqual([]);
    expect(res.body.data.hero.subheadline).toBeUndefined();
    expect(res.body.data.hero.headline).toBe("Rest well. Wake happy.");
    expect(res.body.data.about.heading).toBe("Our story");
  });

  it.each([
    ["HTML in headline", { hero: { headline: "<script>alert(1)</script>" } }], ["HTML in about", { about: { body: "Hi <b>there</b>" } }],
    ["HTML in testimonial", { testimonials: [{ quote: "<img src=x onerror=alert(1)>", guestName: "X" }] }],
    ["rating 6", { testimonials: [{ quote: "ok", guestName: "X", rating: 6 }] }], ["unknown icon", { whyChooseUs: [{ title: "T", text: "t", icon: "Skull" }] }],
    ["too many FAQs", { faqs: Array(13).fill({ question: "q", answer: "a" }) }], ["too many images", { hero: { imageAssetIds: Array(6).fill("000000000000000000000001") } }],
    ["extra field", { hero: { headline: "x", html: "<b>" } }], ["tenantId", { tenantId: "000000000000000000000001" }],
    ["control characters", { hero: { headline: "bad\u0000text" } }], ["empty", {}],
  ])("rejects %s", async (_n, body) => {
    expect((await A.owner.patch("/hotel/content", body)).status).toBe(400);
  });

  it("hero images must be this hotel's own", async () => {
    const mine = (await A.owner.upload("/media", makePng(1600, 900))).body.data.id as string;
    expect((await A.owner.patch("/hotel/content", { hero: { imageAssetIds: [mine] } })).status).toBe(200);
    const theirs = (await B.owner.upload("/media", makePng(1600, 900))).body.data.id as string;
    expect((await A.owner.patch("/hotel/content", { hero: { imageAssetIds: [theirs] } })).status).toBe(400);
  });
});

describe("facilities and gallery", () => {
  it("creates, edits, hides and deletes facilities, scoped to the hotel", async () => {
    const f = await A.owner.post("/facilities", { name: "Rooftop pool", description: "Open 7am to 9pm.", icon: "Waves" });
    expect(f.status).toBe(201);
    const id = f.body.data.id as string;
    expect((await A.owner.patch(`/facilities/${id}`, { isActive: false })).body.data.isActive).toBe(false);
    expect((await B.owner.get("/facilities")).body.data.some((x: { id: string }) => x.id === id)).toBe(false);
    expect((await B.owner.patch(`/facilities/${id}`, { name: "Hacked" })).status).toBe(404);
    expect((await B.owner.del(`/facilities/${id}`)).status).toBe(404);
    expect((await A.owner.post("/facilities", { name: "Bad <b>name</b>" })).status).toBe(400);
    expect((await A.owner.post("/facilities", { name: "Ok", icon: "NotAnIcon" })).status).toBe(400);
    expect((await A.owner.del(`/facilities/${id}`)).status).toBe(200);
  });

  it("gallery: add, categorise, reorder via sortOrder, remove; B cannot touch A's", async () => {
    const asset = (await A.owner.upload("/media", makePng(800, 600))).body.data.id as string;
    const g = await A.owner.post("/gallery", { assetId: asset, caption: "Pool at dusk", category: "facilities", sortOrder: 2 });
    expect(g.status).toBe(201);
    expect(g.body.data.image.url).toContain("hotels/");
    const id = g.body.data.id as string;
    expect((await A.owner.patch(`/gallery/${id}`, { sortOrder: 1, category: "exterior" })).body.data).toMatchObject({ sortOrder: 1, category: "exterior" });
    expect((await B.owner.patch(`/gallery/${id}`, { caption: "x" })).status).toBe(404);
    expect((await B.owner.del(`/gallery/${id}`)).status).toBe(404);
    expect((await A.owner.post("/gallery", { assetId: asset, category: "nonsense" })).status).toBe(400);
    expect((await A.owner.del(`/gallery/${id}`)).status).toBe(200);
  });

  it("enforces maxGalleryImages", async () => {
    const hotel = await createHotel(h, ops, "galleryl", "WEBSITE");
    await ops.put(`/platform/tenants/${hotel.id}/limits`, { maxGalleryImages: 1 });
    const a1 = (await hotel.owner.upload("/media", makePng(300, 300))).body.data.id;
    const a2 = (await hotel.owner.upload("/media", makePng(300, 300))).body.data.id;
    expect((await hotel.owner.post("/gallery", { assetId: a1 })).status).toBe(201);
    const blocked = await hotel.owner.post("/gallery", { assetId: a2 });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe("LIMIT_REACHED");
  });
});

describe("who may edit what", () => {
  it("manager edits content and facilities but not the hotel profile; receptionist edits nothing", async () => {
    expect((await manager.client.patch("/hotel/content", { hero: { headline: "Manager headline" } })).status).toBe(200);
    expect((await manager.client.post("/facilities", { name: "Gym" })).status).toBe(201);
    expect((await manager.client.get("/hotel/profile")).status).toBe(200); // settings.read
    expect((await manager.client.patch("/hotel/profile", { tagline: "Nope" })).status).toBe(403); // no settings.update
    expect((await receptionist.client.get("/hotel/content")).status).toBe(403);
    expect((await receptionist.client.patch("/hotel/content", { hero: { headline: "x" } })).status).toBe(403);
    expect((await receptionist.client.get("/hotel/profile")).status).toBe(403);
    expect((await receptionist.client.post("/facilities", { name: "Gym2" })).status).toBe(403);
    expect((await receptionist.client.post("/gallery", { assetId: "000000000000000000000001" })).status).toBe(403);
    expect((await new Client(h.app, A.host).get("/hotel/profile")).status).toBe(401);
  });

  it("an override can switch the CMS or gallery off for one hotel", async () => {
    const hotel = await createHotel(h, ops, "nocms", "WEBSITE");
    await ops.put(`/platform/tenants/${hotel.id}/feature-overrides`, { feature: "cms", enabled: false });
    expect((await hotel.owner.get("/hotel/content")).body.error.code).toBe("FEATURE_NOT_AVAILABLE");
    expect((await hotel.owner.get("/facilities")).body.error.code).toBe("FEATURE_NOT_AVAILABLE");
    expect((await hotel.owner.get("/hotel/profile")).status).toBe(200); // website feature still on
  });
});
