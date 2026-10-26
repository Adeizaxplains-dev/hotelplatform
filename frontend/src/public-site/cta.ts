import { telLink, whatsappLink } from "@/lib/format";
import type { PublicSite } from "@/types/site";

export interface Cta { label: string; href: string; external: boolean }

const has = (site: PublicSite, f: string) => site.features.includes(f);

/** The single most useful way for a visitor to act, given the hotel's plan and the contact details it has filled in. */
export function primaryCta(site: PublicSite, message?: string): Cta {
  const c = site.hotel.contact;
  if (has(site, "booking")) return { label: "Book now", href: "/booking", external: false };
  if (c.whatsapp) return { label: "Enquire on WhatsApp", href: whatsappLink(c.whatsapp, message ?? `Hello ${site.hotel.name}, I'd like to make an enquiry.`), external: true };
  if (c.phone) return { label: "Call to reserve", href: telLink(c.phone), external: true };
  return { label: "Contact us", href: "/contact", external: false };
}
