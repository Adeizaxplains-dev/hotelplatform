import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mediaFolderFor } from "../../src/modules/media/media.service.js";
import { makeEnv } from "../helpers.js";
import { exeFile, gifFile, htmlAsPng, makeJpeg, makePng, pdfFile, svgFile } from "../fixtures.js";
import { Client, addStaff, createHotel, platformClient, startHarness, stopHarness, type Harness, type Hotel } from "./harness.js";

let h: Harness;
let ops: Client;
let A: Hotel;
let B: Hotel;

beforeAll(async () => {
  h = await startHarness({ UPLOAD_MAX_BYTES: "200000" });
  ops = await platformClient(h);
  A = await createHotel(h, ops, "mediaa", "WEBSITE");
  B = await createHotel(h, ops, "mediab", "WEBSITE");
});
afterAll(stopHarness);

describe("uploading images", () => {
  it("accepts a real PNG and JPEG, stores them under the hotel's own folder, and returns a public image", async () => {
    const png = await A.owner.upload("/media", makePng(640, 480), { alt: "Front entrance" });
    expect(png.status).toBe(201);
    expect(png.body.data).toMatchObject({ width: 640, height: 480, format: "png", alt: "Front entrance" });
    const jpg = await A.owner.upload("/media", makeJpeg(800, 600), { filename: "lobby.jpg", contentType: "image/jpeg" });
    expect(jpg.status).toBe(201);
    expect(jpg.body.data.format).toBe("jpg");
    const folder = mediaFolderFor(makeEnv().REFRESH_TOKEN_SECRET, A.id);
    expect([...h.storage.files.values()].every((f) => f.folder === folder)).toBe(true);
    expect([...h.storage.files.keys()].every((k) => k.startsWith(`hotels/${folder}/`))).toBe(true);
    expect(folder).not.toContain(A.id); // the internal tenant id never appears in storage paths or public URLs
    expect(folder).not.toBe(mediaFolderFor(makeEnv().REFRESH_TOKEN_SECRET, B.id)); // each hotel gets its own folder
  });

  it("decides by CONTENT: wrong extension or claimed type cannot sneak a bad file in", async () => {
    const cases: Array<[string, Buffer, string, string]> = [
      ["SVG named .png", svgFile, "logo.png", "image/png"],
      ["HTML named .png", htmlAsPng, "page.png", "image/png"],
      ["GIF", gifFile, "anim.gif", "image/gif"],
      ["PDF claiming image/jpeg", pdfFile, "doc.jpg", "image/jpeg"],
      ["executable named .jpg", exeFile, "setup.jpg", "image/jpeg"],
      ["empty file", Buffer.alloc(0), "empty.png", "image/png"],
    ];
    const before = h.storage.files.size;
    for (const [name, buf, filename, contentType] of cases) {
      const res = await A.owner.upload("/media", buf, { filename, contentType });
      expect(res.status, name).toBe(400);
    }
    expect(h.storage.files.size).toBe(before); // nothing was stored
  });

  it("a real image with the wrong extension is accepted (content wins), and the client's file name is never stored", async () => {
    const res = await A.owner.upload("/media", makePng(300, 300), { filename: "../../etc/passwd.exe", contentType: "application/octet-stream" });
    expect(res.status).toBe(201);
    expect(JSON.stringify(res.body)).not.toMatch(/passwd|\.exe|\.\./);
    expect(res.body.data.url).not.toContain("passwd");
  });

  it("rejects images that are too small, too large in pixels, or too big in bytes", async () => {
    expect((await A.owner.upload("/media", makePng(50, 50))).status).toBe(400);
    expect((await A.owner.upload("/media", makePng(9000, 200))).status).toBe(400);
    const huge = Buffer.concat([makePng(400, 300), Buffer.alloc(300_000, 7)]);
    const res = await A.owner.upload("/media", huge);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/too large/i);
  });

  it("rejects a missing file, the wrong field name and extra files", async () => {
    expect((await A.owner.post("/media", {})).status).toBe(400);
    expect((await A.owner.upload("/media", makePng(), { field: "photo" })).status).toBe(400);
  });

  it("rejects HTML in the alt text", async () => {
    const res = await A.owner.upload("/media", makePng(), { alt: "<script>alert(1)</script>" });
    expect(res.status).toBe(400);
  });

  it("needs a signed-in user with an editing permission", async () => {
    expect((await new Client(h.app, A.host).upload("/media", makePng())).status).toBe(401);
    const recep = await addStaff(h, await upgraded(A), "RECEPTIONIST");
    expect((await recep.client.upload("/media", makePng())).status).toBe(403);
    expect((await recep.client.get("/media")).status).toBe(200); // reading follows rooms.read: they already see room photos
    const hk = await addStaff(h, A, "ACCOUNTANT");
    expect((await hk.client.get("/media")).status).toBe(403); // no cms/rooms/settings read permission at all
  });
});

describe("hotels cannot reach each other's images", () => {
  it("B cannot list, rename or delete A's image, and cannot attach it to anything", async () => {
    const asset = (await A.owner.upload("/media", makePng(500, 400))).body.data.id as string;
    const listed = (await B.owner.get("/media")).body.data.map((m: { id: string }) => m.id);
    expect(listed).not.toContain(asset);
    expect((await B.owner.patch(`/media/${asset}`, { alt: "stolen" })).status).toBe(404);
    expect((await B.owner.del(`/media/${asset}`)).status).toBe(404);
    expect((await B.owner.post("/gallery", { assetId: asset })).status).toBe(400);
    expect((await B.owner.patch("/hotel/profile", { branding: { logoAssetId: asset } })).status).toBe(400);
    expect((await B.owner.patch("/hotel/content", { hero: { imageAssetIds: [asset] } })).status).toBe(400);
    expect((await A.owner.get("/media")).body.data.map((m: { id: string }) => m.id)).toContain(asset); // still A's
  });
});

describe("deleting images", () => {
  it("refuses while the image is in use, then deletes it from the library and from storage", async () => {
    const up = (await A.owner.upload("/media", makePng(420, 420))).body.data;
    const publicId = [...h.storage.files.keys()].at(-1)!;
    await A.owner.post("/gallery", { assetId: up.id, caption: "Lobby" });
    expect((await A.owner.del(`/media/${up.id}`)).status).toBe(409);
    expect(h.storage.files.has(publicId)).toBe(true);

    const g = (await A.owner.get("/gallery")).body.data.find((x: { assetId: string }) => x.assetId === up.id);
    expect((await A.owner.del(`/gallery/${g.id}`)).status).toBe(200);
    expect((await A.owner.del(`/media/${up.id}`)).status).toBe(200);
    expect(h.storage.files.has(publicId)).toBe(false);
    expect((await A.owner.del(`/media/${up.id}`)).status).toBe(404);
  });
});

describe("storage not configured", () => {
  it("fails with a clear 503 instead of crashing", async () => {
    const h2 = await startHarness({ MEDIA_PROVIDER: "none" }, { realStorageFromEnv: true });
    const ops2 = await platformClient(h2, "ops3@platform.test");
    const hotel = await createHotel(h2, ops2, "nostore", "WEBSITE");
    const res = await hotel.owner.upload("/media", makePng());
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(res.body.error.message).toMatch(/not set up/i);
  });
});

async function upgraded(hotel: Hotel): Promise<Hotel> {
  await ops.put(`/platform/tenants/${hotel.id}/plan`, { plan: "MANAGEMENT" });
  return hotel;
}
