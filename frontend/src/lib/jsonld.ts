import type { PublicSite } from "@/types/site";

/**
 * JSON-LD is placed inside a <script> tag. `<` is escaped so editor-supplied text can never close the tag
 * and inject markup (the classic structured-data XSS).
 */
export const safeJsonLd = (data: unknown): string => JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

export function hotelJsonLd(site: PublicSite, url: string): Record<string, unknown> {
  const { hotel } = site;
  const c = hotel.contact;
  const image = site.content.hero.images[0]?.url ?? hotel.seo.ogImage?.url;
  return {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: hotel.name,
    url,
    ...(hotel.description ? { description: hotel.description } : {}),
    ...(image ? { image: new URL(image, url).href } : {}),
    ...(c.phone ? { telephone: c.phone } : {}),
    ...(c.email ? { email: c.email } : {}),
    ...(c.address || c.city ? { address: { "@type": "PostalAddress", ...(c.address ? { streetAddress: c.address } : {}), ...(c.city ? { addressLocality: c.city } : {}), ...(c.state ? { addressRegion: c.state } : {}), ...(c.country ? { addressCountry: c.country } : {}) } } : {}),
    ...(c.latitude !== null && c.longitude !== null ? { geo: { "@type": "GeoCoordinates", latitude: c.latitude, longitude: c.longitude } } : {}),
    checkinTime: hotel.policies.checkInTime,
    checkoutTime: hotel.policies.checkOutTime,
  };
}
