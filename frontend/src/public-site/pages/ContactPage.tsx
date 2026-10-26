import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { addressLine, directionsUrl, formatTime, mailLink, telLink, whatsappLink } from "@/lib/format";
import { hotelJsonLd } from "@/lib/jsonld";
import { Seo } from "../components/Seo";
import { Container } from "../components/Section";
import { useSite } from "../SiteContext";

/** Google Maps embed (the link is validated server-side to be a google.com/maps/embed URL), or a directions link. */
export function MapBlock() {
  const { hotel } = useSite();
  const c = hotel.contact;
  if (c.mapEmbedUrl) {
    return (
      <div className="aspect-[4/3] overflow-hidden rounded-3xl bg-brand-soft">
        <iframe src={c.mapEmbedUrl} title={`Map showing the location of ${hotel.name}`} loading="lazy" referrerPolicy="no-referrer" className="size-full border-0" allowFullScreen />
      </div>
    );
  }
  const dir = directionsUrl(c, hotel.name);
  return (
    <div className="grid aspect-[4/3] place-items-center rounded-3xl bg-brand-soft p-8 text-center">
      <div><MapPin className="mx-auto size-10 text-brand-text" aria-hidden="true" /><p className="mt-3 text-lg font-semibold">{addressLine(c) || hotel.name}</p>{dir && <a href={dir} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block font-semibold text-brand-text underline">Open in Google Maps</a>}</div>
    </div>
  );
}

const row = "flex items-start gap-4";
const icon = "mt-1 size-5 shrink-0 text-brand-text";

export default function ContactPage() {
  const site = useSite();
  const { hotel, content } = site;
  const c = hotel.contact;
  const seo = content.pageSeo.contact;
  const policies = hotel.policies;
  return (
    <Container className="py-14 sm:py-20">
      <Seo page="Contact" titleOverride={seo?.title} description={seo?.description ?? `Contact ${hotel.name}: address, phone, WhatsApp and directions.`} path="/contact" jsonLd={hotelJsonLd(site, `${window.location.origin}/`)} />
      <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">Contact us</h1>
      <div className="mt-14 grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <ul className="grid gap-6 text-lg">
            {addressLine(c) && <li className={row}><MapPin className={icon} aria-hidden="true" /><span>{addressLine(c)}</span></li>}
            {c.phone && <li className={row}><Phone className={icon} aria-hidden="true" /><a href={telLink(c.phone)} className="font-semibold hover:underline">{c.phone}</a></li>}
            {c.whatsapp && <li className={row}><MessageCircle className={icon} aria-hidden="true" /><a href={whatsappLink(c.whatsapp, `Hello ${hotel.name}, I'd like to know more.`)} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">Chat on WhatsApp</a></li>}
            {c.email && <li className={row}><Mail className={icon} aria-hidden="true" /><a href={mailLink(c.email)} className="font-semibold hover:underline">{c.email}</a></li>}
            <li className={row}><Clock className={icon} aria-hidden="true" /><span>Check-in from {formatTime(policies.checkInTime)}<br />Check-out by {formatTime(policies.checkOutTime)}</span></li>
          </ul>
          {!c.phone && !c.whatsapp && !c.email && !addressLine(c) && <p className="text-lg text-muted">This hotel hasn't added its contact details yet.</p>}
        </div>
        <div className="lg:col-span-7"><MapBlock /></div>
      </div>

      {(policies.cancellation || policies.houseRules || policies.children || policies.pets) && (
        <section className="mt-20" aria-labelledby="pol-h">
          <h2 id="pol-h" className="text-3xl font-semibold tracking-tight">Good to know</h2>
          <dl className="mt-8 grid gap-8 sm:grid-cols-2">
            {([["Cancellation", policies.cancellation], ["House rules", policies.houseRules], ["Children", policies.children], ["Pets", policies.pets]] as const).filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="font-semibold">{k}</dt><dd className="mt-2 text-muted">{v}</dd></div>)}
          </dl>
        </section>
      )}

      {content.faqs.length > 0 && (
        <section className="mt-20 max-w-3xl" aria-labelledby="faq-h">
          <h2 id="faq-h" className="text-3xl font-semibold tracking-tight">Questions</h2>
          <div className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
            {content.faqs.map((f) => (
              <details key={f.question} className="group py-5"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">{f.question}<span aria-hidden="true" className="text-2xl text-brand-text transition-transform group-open:rotate-45">+</span></summary><p className="mt-3 text-lg text-muted">{f.answer}</p></details>
            ))}
          </div>
        </section>
      )}
    </Container>
  );
}
