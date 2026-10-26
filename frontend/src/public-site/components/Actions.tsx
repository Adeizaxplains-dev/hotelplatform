import { ArrowRight, MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { telLink, whatsappLink } from "@/lib/format";
import type { PublicSite } from "@/types/site";
import { primaryCta } from "../cta";

export function SmartLink({ href, external, className, children }: { href: string; external: boolean; className: string; children: ReactNode }) {
  return external ? (
    <a href={href} className={className} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{children}</a>
  ) : (
    <Link to={href} className={className}>{children}</Link>
  );
}

/** Primary booking/enquiry action chosen from the hotel's plan and contact details. */
export function PrimaryAction({ site, className, message }: { site: PublicSite; className: string; message?: string }) {
  const cta = primaryCta(site, message);
  return <SmartLink href={cta.href} external={cta.external} className={className}>{cta.label}<ArrowRight className="size-4" aria-hidden="true" /></SmartLink>;
}

export function WhatsAppAction({ site, className, message }: { site: PublicSite; className: string; message?: string }) {
  const n = site.hotel.contact.whatsapp;
  if (!n) return null;
  return (
    <a href={whatsappLink(n, message ?? `Hello ${site.hotel.name}, I'd like to know more.`)} target="_blank" rel="noopener noreferrer" className={className}>
      <MessageCircle className="size-4" aria-hidden="true" />WhatsApp us
    </a>
  );
}

export function CallAction({ site, className }: { site: PublicSite; className: string }) {
  const p = site.hotel.contact.phone;
  if (!p) return null;
  return <a href={telLink(p)} className={className}><Phone className="size-4" aria-hidden="true" />Call {p}</a>;
}
