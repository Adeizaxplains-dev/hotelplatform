import { describe, expect, it } from "vitest";
import { resolveMediaProvider } from "../../src/config/env.js";
import { AMENITIES, AMENITY_KEYS, FEATURE_ICONS } from "../../src/modules/rooms/amenities.js";
import { toPublicImage } from "../../src/modules/media/imageUrls.js";
import { slugify, uniqueSlug } from "../../src/shared/slug.js";
import { toUpdateOps } from "../../src/shared/upsert.js";
import { hexColor, httpsUrl, mapEmbedUrl, plainText, timeOfDay, whatsapp } from "../../src/shared/validation.js";
import { makeEnv } from "../helpers.js";

describe("slugify / uniqueSlug", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Deluxe Ocean-View Suite!")).toBe("deluxe-ocean-view-suite");
    expect(slugify("  Café   Près  ")).toBe("cafe-pres");
    expect(slugify("../../etc/passwd")).toBe("etc-passwd");
    expect(slugify("!!!")).toBe("item");
    expect(slugify("x".repeat(200)).length).toBeLessThanOrEqual(60);
  });
  it("finds the first free suffix", async () => {
    const taken = new Set(["suite", "suite-2", "suite-3"]);
    expect(await uniqueSlug("suite", async (s) => taken.has(s))).toBe("suite-4");
    expect(await uniqueSlug("villa", async (s) => taken.has(s))).toBe("villa");
  });
});

describe("toUpdateOps (PATCH → Mongo paths)", () => {
  it("flattens nested objects, unsets nulls, replaces arrays and skips undefined", () => {
    const ops = toUpdateOps({ tagline: "Hi", contact: { phone: null, city: "Lagos" }, hero: { imageAssetIds: ["a", "b"] }, skip: undefined });
    expect(ops.$set).toEqual({ tagline: "Hi", "contact.city": "Lagos", "hero.imageAssetIds": ["a", "b"] });
    expect(ops.$unset).toEqual({ "contact.phone": 1 });
  });
});

describe("validators", () => {
  it("plainText rejects markup and control characters but allows ordinary punctuation", () => {
    const t = plainText(100);
    for (const bad of ["<b>x</b>", "<script>alert(1)</script>", "hi <img src=x>", "a\u0000b", "<!-- c -->"]) expect(t.safeParse(bad).success, bad).toBe(false);
    for (const good of ["Rooms & suites", "5 < 10 guests", "Tolu's \"favourite\" spot", "Line one\nLine two", "₦85,000 per night"]) expect(t.safeParse(good).success, good).toBe(true);
  });
  it("hexColor needs 6 digits and uppercases", () => {
    expect(hexColor.parse("#7c2d12")).toBe("#7C2D12");
    for (const bad of ["red", "#fff", "7c2d12", "#7c2d1", "#gggggg", "#7c2d12; background:url(x)"]) expect(hexColor.safeParse(bad).success, bad).toBe(false);
  });
  it("whatsapp is stored as digits with country code", () => {
    expect(whatsapp.parse("+234 (801) 234-5678")).toBe("2348012345678");
    expect(whatsapp.safeParse("0801234567").success).toBe(false);
    expect(whatsapp.safeParse("abc").success).toBe(false);
  });
  it("httpsUrl requires https, the right host, and no credentials; look-alikes fail", () => {
    const fb = httpsUrl(["facebook.com", "fb.com"]);
    expect(fb.safeParse("https://www.facebook.com/hotel").success).toBe(true);
    for (const bad of ["http://facebook.com/x", "https://facebook.com.evil.com/x", "https://evilfacebook.com/x", "javascript:alert(1)", "https://u:p@facebook.com/x", "ftp://facebook.com/x"]) expect(fb.safeParse(bad).success, bad).toBe(false);
  });
  it("mapEmbedUrl accepts only Google Maps embed links", () => {
    expect(mapEmbedUrl.safeParse("https://www.google.com/maps/embed?pb=abc").success).toBe(true);
    for (const bad of ["https://www.google.com/maps/place/x", "https://google.com/maps/embed?x", "https://evil.com/maps/embed", "http://www.google.com/maps/embed?x", "<iframe src=x>"]) expect(mapEmbedUrl.safeParse(bad).success, bad).toBe(false);
  });
  it("timeOfDay is 24-hour", () => {
    expect(timeOfDay.safeParse("09:30").success).toBe(true);
    for (const bad of ["24:00", "9:30", "12:60", "noon"]) expect(timeOfDay.safeParse(bad).success, bad).toBe(false);
  });
});

describe("toPublicImage", () => {
  const cloud = { provider: "cloudinary" as const, url: "https://res.cloudinary.com/demo/image/upload/v1/hotels/abc/x.jpg", width: 2000, height: 1000, alt: undefined };
  it("builds responsive Cloudinary variants and never upscales", () => {
    const i = toPublicImage(cloud, "Pool");
    expect(i.alt).toBe("Pool");
    expect(i.url).toContain("/upload/f_auto,q_auto,c_limit,w_1200/");
    expect(i.srcSet).toContain("w_480");
    expect(i.srcSet).toContain("1920w");
    const small = toPublicImage({ ...cloud, width: 600 });
    expect(small.srcSet).not.toContain("1200w");
    expect(small.srcSet).toContain("480w");
  });
  it("returns local and memory images untouched", () => {
    const i = toPublicImage({ provider: "local", url: "/api/v1/uploads/k/x.png", width: 400, height: 300, alt: "A" });
    expect(i).toEqual({ url: "/api/v1/uploads/k/x.png", width: 400, height: 300, alt: "A" });
  });
});

describe("catalogues", () => {
  it("amenity keys are unique and every amenity has a label and icon", () => {
    expect(new Set(AMENITY_KEYS).size).toBe(AMENITIES.length);
    for (const a of AMENITIES) expect(a.label.length > 2 && a.icon.length > 1).toBe(true);
    expect(new Set(FEATURE_ICONS).size).toBe(FEATURE_ICONS.length);
  });
});

describe("image storage selection", () => {
  const base = { NODE_ENV: "development" as const, CLOUDINARY_CLOUD_NAME: undefined, CLOUDINARY_API_KEY: undefined, CLOUDINARY_API_SECRET: undefined, MEDIA_PROVIDER: undefined };
  it("uses Cloudinary when configured, local in development, nothing in production", () => {
    expect(resolveMediaProvider({ ...base, CLOUDINARY_CLOUD_NAME: "c", CLOUDINARY_API_KEY: "k", CLOUDINARY_API_SECRET: "s" })).toBe("cloudinary");
    expect(resolveMediaProvider(base)).toBe("local");
    expect(resolveMediaProvider({ ...base, NODE_ENV: "production" as never })).toBe("none");
  });
  it("refuses Cloudinary without credentials, and local storage in production", () => {
    expect(() => resolveMediaProvider({ ...base, MEDIA_PROVIDER: "cloudinary" })).toThrow(/CLOUDINARY/);
    expect(() => makeEnv({ NODE_ENV: "production", CLIENT_URL: "https://x.example.com", MEDIA_PROVIDER: "local" })).toThrow(/development only/);
  });
});
