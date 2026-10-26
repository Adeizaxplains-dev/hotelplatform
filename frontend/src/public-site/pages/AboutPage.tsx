import { hotelJsonLd } from "@/lib/jsonld";
import { HotelPhoto } from "../components/Img";
import { PrimaryAction } from "../components/Actions";
import { btnPrimary } from "../components/buttonStyles";
import { Seo } from "../components/Seo";
import { Container } from "../components/Section";
import { NamedIcon } from "../icons";
import { useSite } from "../SiteContext";

export default function AboutPage() {
  const site = useSite();
  const { hotel, content } = site;
  const seo = content.pageSeo.about;
  const body = content.about.body ?? hotel.description;
  return (
    <>
      <Seo page="About" titleOverride={seo?.title} description={seo?.description ?? hotel.description} imageUrl={content.about.image?.url} path="/about" jsonLd={hotelJsonLd(site, `${window.location.origin}/`)} />
      <Container className="py-14 sm:py-20">
        <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">{content.about.heading ?? `About ${hotel.name}`}</h1>
        <div className="mt-12 grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7">
            {body ? <div className="grid gap-5 text-xl leading-relaxed text-muted">{body.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}</div> : <p className="text-lg text-muted">This hotel is still writing its story. In the meantime, get in touch and we'll be glad to help.</p>}
            {content.about.highlights.length > 0 && (
              <dl className="mt-12 grid grid-cols-2 gap-8 border-t border-ink/10 pt-10 sm:grid-cols-3">
                {content.about.highlights.map((h) => <div key={h.label}><dd className="font-display text-5xl font-semibold text-brand-text">{h.value}</dd><dt className="mt-1 font-semibold text-muted">{h.label}</dt></div>)}
              </dl>
            )}
          </div>
          <div className="lg:col-span-5"><div className="aspect-[4/5] overflow-hidden rounded-3xl"><HotelPhoto image={content.about.image} label={`${hotel.name} interiors`} index={1} priority sizes="(min-width: 1024px) 460px, 100vw" /></div></div>
        </div>
      </Container>

      {content.whyChooseUs.length > 0 && (
        <section className="bg-brand-soft py-20" aria-labelledby="values-h">
          <Container>
            <h2 id="values-h" className="text-3xl font-semibold tracking-tight sm:text-4xl">What we stand for</h2>
            <ul className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {content.whyChooseUs.map((w) => <li key={w.title}><NamedIcon name={w.icon} className="size-7 text-brand-text" /><h3 className="mt-4 text-xl font-semibold">{w.title}</h3><p className="mt-2 text-muted">{w.text}</p></li>)}
            </ul>
          </Container>
        </section>
      )}
      <Container className="py-20 text-center"><p className="font-display text-3xl font-semibold">We'd love to host you.</p><div className="mt-6 flex justify-center"><PrimaryAction site={site} className={btnPrimary} /></div></Container>
    </>
  );
}
