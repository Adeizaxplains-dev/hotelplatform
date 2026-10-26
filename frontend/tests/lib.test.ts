import { describe, expect, it } from "vitest";
import { buildBrandTheme, contrast, ensureContrastOn, INK, readableOn, WHITE } from "@/lib/color";
import { addressLine, directionsUrl, formatMoney, formatTime, mailLink, pageTitle, telLink, whatsappLink } from "@/lib/format";
import { hotelJsonLd, safeJsonLd } from "@/lib/jsonld";
import { primaryCta } from "@/public-site/cta";
import { makeSite } from "./siteData";

describe("colour accessibility", () => {
  it("computes WCAG contrast", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrast("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
    expect(contrast(INK, WHITE)).toBeGreaterThan(14);
  });

  it("picks white or ink, whichever reads better on the brand colour", () => {
    expect(readableOn("#0B6E6E")).toBe(WHITE);
    expect(readableOn("#FFD700")).toBe(INK);
    expect(readableOn("#FFFFFF")).toBe(INK);
    expect(readableOn("#000000")).toBe(WHITE);
    expect(readableOn("#F712B3")).toBe("#000000"); // mid-tone pink: neither white nor ink reaches 4.5:1, black does
  });

  it("darkens brand-coloured text until it passes AA on white", () => {
    expect(contrast(ensureContrastOn("#FFD700", WHITE), WHITE)).toBeGreaterThanOrEqual(4.5);
    expect(ensureContrastOn("#0B6E6E", WHITE, 4.5)).toBe("#0B6E6E"); // already fine: unchanged
  });

  // Whatever two colours a hotel picks, text on its buttons and brand-coloured text stay readable.
  it("PROPERTY: for 500 random brand colours, button text and brand text always pass AA", () => {
    let seed = 12345;
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    const hex = () => "#" + Array.from({ length: 3 }, () => Math.floor(rand() * 256).toString(16).padStart(2, "0")).join("").toUpperCase();
    for (let i = 0; i < 500; i++) {
      const primary = hex();
      const t = buildBrandTheme(primary, hex(), "modern");
      expect(contrast(t.onBrand, primary), `on-brand text for ${primary}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.brandText, WHITE), `brand text for ${primary}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.vars["--on-brand-hover"]!, t.vars["--brand-hover"]!), `hover for ${primary}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t.vars["--accent-text"]!, WHITE)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("maps typography to a font stack", () => {
    expect(buildBrandTheme("#0B6E6E", "#B8863B", "classic").vars["--site-display"]).toContain("Fraunces");
    expect(buildBrandTheme("#0B6E6E", "#B8863B", "modern").vars["--site-display"]).toContain("Manrope");
  });
});

describe("formatting", () => {
  it("formats naira from kobo as integers, keeping kobo when present", () => {
    expect(formatMoney(8_500_000, "NGN")).toMatch(/85,000$/);
    expect(formatMoney(8_500_000, "NGN")).toContain("₦");
    expect(formatMoney(8_500_050, "NGN")).toMatch(/85,000\.50$/);
    expect(formatMoney(0, "NGN")).toMatch(/0$/);
  });
  it("formats times, links and addresses", () => {
    expect(formatTime("14:00")).toBe("2:00 pm");
    expect(formatTime("00:30")).toBe("12:30 am");
    expect(formatTime("12:00")).toBe("12:00 pm");
    expect(whatsappLink("+234 801", "Hi there & more")).toBe("https://wa.me/234801?text=Hi%20there%20%26%20more");
    expect(telLink("+234 (801) 234-5678")).toBe("tel:+2348012345678");
    expect(mailLink("a@b.co", "Hello there")).toBe("mailto:a@b.co?subject=Hello%20there");
    expect(addressLine({ address: "12 Marina", city: "Lagos", state: null, country: "Nigeria" })).toBe("12 Marina, Lagos, Nigeria");
  });
  it("builds directions from coordinates or address, and null when there is nothing", () => {
    expect(directionsUrl({ latitude: 6.45, longitude: 3.4, address: null, city: null }, "Palm")).toContain("destination=6.45%2C3.4");
    expect(directionsUrl({ latitude: null, longitude: null, address: "12 Marina", city: "Lagos" }, "Palm")).toContain("Palm%2C%2012%20Marina%2C%20Lagos");
    expect(directionsUrl({ latitude: null, longitude: null, address: null, city: null }, "")).toBeNull();
  });
  it("applies the SEO title template", () => {
    expect(pageTitle("%s | Palm", "Palm Court", "Rooms")).toBe("Rooms | Palm");
    expect(pageTitle(null, "Palm Court", "Rooms")).toBe("Rooms | Palm Court");
    expect(pageTitle("%s | Palm", "Palm Court")).toBe("Palm Court | Palm");
    expect(pageTitle(null, "Palm Court")).toBe("Palm Court");
  });
});

describe("structured data", () => {
  it("escapes everything that could close the script tag or break out", () => {
    const out = safeJsonLd({ name: "</script><script>alert(1)</script>", x: "a&b>c\u2028" });
    expect(out).not.toContain("<");
    expect(out).not.toContain(">");
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>"); // still decodes to the original text
  });
  it("describes the hotel for search engines, only with data it has", () => {
    const ld = hotelJsonLd(makeSite(), "https://palm.example.com/");
    expect(ld).toMatchObject({ "@type": "Hotel", name: "Palm Court Hotel", telephone: "+234 801 234 5678", checkinTime: "14:00" });
    expect(ld["address"]).toMatchObject({ streetAddress: "12 Marina Road", addressLocality: "Lagos" });
    expect(ld["geo"]).toMatchObject({ latitude: 6.45 });
    const bare = hotelJsonLd(makeSite({ hotel: { contact: { phone: null, whatsapp: null, email: null, address: null, city: null, state: null, country: null, mapEmbedUrl: null, latitude: null, longitude: null } } }), "https://x.test/");
    expect(bare).not.toHaveProperty("telephone");
    expect(bare).not.toHaveProperty("address");
  });
});

describe("primary call to action", () => {
  const nobooking = (over = {}) => makeSite({ features: ["website", "cms", "rooms", "gallery"], ...over });
  it("books online when the plan includes booking", () => expect(primaryCta(makeSite())).toEqual({ label: "Book now", href: "/booking", external: false }));
  it("otherwise prefers WhatsApp, then phone, then the contact page", () => {
    expect(primaryCta(nobooking()).href).toContain("wa.me/2348012345678");
    const noWa = nobooking({ hotel: { contact: { ...makeSite().hotel.contact, whatsapp: null } } });
    expect(primaryCta(noWa).href).toMatch(/^tel:/);
    const none = nobooking({ hotel: { contact: { ...makeSite().hotel.contact, whatsapp: null, phone: null } } });
    expect(primaryCta(none)).toEqual({ label: "Contact us", href: "/contact", external: false });
  });
});
