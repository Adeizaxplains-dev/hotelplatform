import { ArrowLeft, ArrowRight, MapPin, Quote, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { directionsUrl, formatTime } from "@/lib/format";
import { hotelJsonLd } from "@/lib/jsonld";
import { PrimaryAction, WhatsAppAction, CallAction } from "../components/Actions";
import { btnGhostLight, btnLight } from "../components/buttonStyles";
import { HotelPhoto, Img } from "../components/Img";
import { HERO_PHOTOS, SAMPLE_GALLERY, isLegacyDemoArtwork } from "../photoDefaults";
import { Lightbox } from "../components/Lightbox";
import { RoomFeature } from "../components/RoomCards";
import { Seo } from "../components/Seo";
import { Container, SectionHeading } from "../components/Section";
import { NamedIcon } from "../icons";
import { useSite } from "../SiteContext";
import { MapBlock } from "./ContactPage";

export default function HomePage() {
  const site = useSite();
  const { hotel, content, featuredRooms, facilities, gallery } = site;
  // Two or more hotel-uploaded photos are used as the hotel's own slideshow. If only one
  // photo exists, keep it first and use clearly documented representative photos for the rest.
  const uploadedHeroPhotos = content.hero.images.filter((image) => !isLegacyDemoArtwork(image));
  const heroSlides = uploadedHeroPhotos.length >= 2
    ? uploadedHeroPhotos
    : uploadedHeroPhotos.length === 1
      ? [uploadedHeroPhotos[0]!, ...HERO_PHOTOS.slice(0, 3)]
      : HERO_PHOTOS;
  const heroImage = heroSlides[0]!;
  const heroSlideCount = heroSlides.length;
  const headline = content.hero.headline ?? `Welcome to ${hotel.name}`;
  const sub = content.hero.subheadline ?? hotel.tagline ?? hotel.description;
  const [viewer, setViewer] = useState<number | null>(null);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const currentHeroSlide = activeHeroSlide % heroSlideCount;
  useEffect(() => {
    const prefersReducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (heroSlideCount < 2 || heroPaused || prefersReducedMotion) return;
    const timer = window.setInterval(() => setActiveHeroSlide((current) => (current + 1) % heroSlideCount), 6500);
    return () => window.clearInterval(timer);
  }, [heroSlideCount, heroPaused]);
  const seo = content.pageSeo.home;
  const c = hotel.contact;

  const facts = [
    { label: "Check-in", value: `From ${formatTime(hotel.policies.checkInTime)}` },
    { label: "Check-out", value: `By ${formatTime(hotel.policies.checkOutTime)}` },
    ...(c.city ? [{ label: "Location", value: c.city }] : []),
  ];

  return (
    <>
      <Seo titleOverride={seo?.title ?? (hotel.tagline ? `${hotel.name}: ${hotel.tagline}` : null)} description={seo?.description} imageUrl={heroImage?.url} path="/" jsonLd={hotelJsonLd(site, `${window.location.origin}/`)} />

      {/* Full-bleed photographic room-and-suite slideshow. */}
      <section
        className="relative isolate flex min-h-[92svh] items-end overflow-hidden bg-ink text-white"
        aria-roledescription="carousel"
        aria-label="Hotel rooms and suites"
        onMouseEnter={() => setHeroPaused(true)}
        onMouseLeave={() => setHeroPaused(false)}
        onFocusCapture={() => setHeroPaused(true)}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeroPaused(false); }}
      >
        {heroSlides.map((photo, index) => (
          <div key={`${photo.url}-${index}`} className={`absolute inset-0 -z-20 transition-opacity duration-1000 motion-reduce:transition-none ${index === currentHeroSlide ? "opacity-100" : "opacity-0"}`} aria-hidden={index !== currentHeroSlide} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${heroSlides.length}`}>
            <Img image={photo} priority={index === 0} sizes="100vw" alt={photo.alt || "Bright hotel suite interior"} className="absolute inset-0" />
          </div>
        ))}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/35 to-black/30" aria-hidden="true" />
        <Container className="relative z-10 pb-24 pt-44 sm:pb-32">
          <div className="rise max-w-3xl">
            {hotel.tagline && content.hero.headline && <p className="mb-5 inline-flex items-center gap-3 text-base font-semibold text-white/90"><span className="h-px w-10 bg-accent" aria-hidden="true" />{hotel.tagline}</p>}
            <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">{headline}</h1>
            {sub && <p className="mt-6 max-w-xl text-lg text-white/90 sm:text-xl">{sub}</p>}
            <div className="mt-9 flex flex-wrap gap-3">
              <PrimaryAction site={site} className={btnLight} />
              <WhatsAppAction site={site} className={btnGhostLight} />
            </div>
          </div>
          {heroSlides.length > 1 && (
            <div className="mt-12 flex items-center gap-3" aria-label="Slideshow controls">
              <button type="button" onClick={() => setActiveHeroSlide((currentHeroSlide - 1 + heroSlideCount) % heroSlideCount)} className="grid size-11 place-items-center rounded-full border border-white/50 bg-black/20 text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label="Previous hotel room photo"><ArrowLeft className="size-5" aria-hidden="true" /></button>
              <div className="flex items-center gap-2" role="group" aria-label="Choose hotel room photo">
                {heroSlides.map((photo, index) => <button key={`${photo.url}-dot-${index}`} type="button" onClick={() => setActiveHeroSlide(index)} aria-label={`Show photo ${index + 1}`} aria-pressed={index === currentHeroSlide} className={`h-2.5 rounded-full transition-all ${index === currentHeroSlide ? "w-8 bg-white" : "w-2.5 bg-white/55 hover:bg-white/80"}`} />)}
              </div>
              <button type="button" onClick={() => setActiveHeroSlide((currentHeroSlide + 1) % heroSlideCount)} className="grid size-11 place-items-center rounded-full border border-white/50 bg-black/20 text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" aria-label="Next hotel room photo"><ArrowRight className="size-5" aria-hidden="true" /></button>
              <span className="sr-only" aria-live="polite">Photo {currentHeroSlide + 1} of {heroSlideCount}</span>
            </div>
          )}
        </Container>
      </section>

      {/* Quick facts */}
      <Container className="relative z-10 -mt-12">
        <dl className="grid divide-y divide-ink/10 rounded-3xl bg-white p-2 shadow-xl shadow-ink/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {facts.slice(0, 3).map((f) => (
            <div key={f.label} className="px-6 py-5"><dt className="text-sm font-semibold text-muted">{f.label}</dt><dd className="mt-1 font-display text-2xl font-semibold">{f.value}</dd></div>
          ))}
        </dl>
      </Container>

      {(content.about.heading || content.about.body || hotel.description) && (
        <section className="py-24 sm:py-32" aria-labelledby="about-h">
          <Container className="grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-6">
              <h2 id="about-h" className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{content.about.heading ?? `About ${hotel.name}`}</h2>
              <div className="mt-6 grid gap-4 text-lg text-muted">
                {(content.about.body ?? hotel.description ?? "").split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
              </div>
              {content.about.highlights.length > 0 && (
                <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-ink/10 pt-8 sm:grid-cols-3">
                  {content.about.highlights.map((h) => <div key={h.label}><dd className="font-display text-4xl font-semibold text-brand-text">{h.value}</dd><dt className="mt-1 text-sm font-semibold text-muted">{h.label}</dt></div>)}
                </dl>
              )}
              <Link to="/about" className="mt-8 inline-flex items-center gap-2 font-semibold text-brand-text hover:underline">Our story<ArrowRight className="size-4" aria-hidden="true" /></Link>
            </div>
            <div className="lg:col-span-6"><div className="aspect-[4/5] overflow-hidden rounded-3xl"><HotelPhoto image={content.about.image} label={`${hotel.name} lobby and interiors`} index={1} sizes="(min-width: 1024px) 520px, 100vw" /></div></div>
          </Container>
        </section>
      )}

      {featuredRooms.length > 0 && (
        <section className="bg-brand-soft py-24 sm:py-32" aria-labelledby="rooms-h">
          <Container>
            <SectionHeading title="Rooms and suites" intro="Comfortable places to rest, each with everything you need." action={<Link to="/rooms" className="inline-flex items-center gap-2 font-semibold text-brand-text hover:underline">See all rooms<ArrowRight className="size-4" aria-hidden="true" /></Link>} />
            <h2 id="rooms-h" className="sr-only">Featured rooms</h2>
            <div className="mt-14 grid gap-16 sm:gap-24">
              {featuredRooms.slice(0, 3).map((r, i) => <RoomFeature key={r.slug} room={r} reverse={i % 2 === 1} />)}
            </div>
          </Container>
        </section>
      )}

      {content.whyChooseUs.length > 0 && (
        <section className="py-24 sm:py-32" aria-labelledby="why-h">
          <Container>
            <h2 id="why-h" className="max-w-xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Why guests choose {hotel.name}</h2>
            <ul className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {content.whyChooseUs.map((w) => (
                <li key={w.title}>
                  <span className="grid size-12 place-items-center rounded-full bg-brand-soft text-brand-text"><NamedIcon name={w.icon} className="size-6" /></span>
                  <h3 className="mt-5 text-xl font-semibold">{w.title}</h3>
                  <p className="mt-2 text-muted">{w.text}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {facilities.length > 0 && (
        <section className="bg-ink py-24 text-white sm:py-32" aria-labelledby="fac-h">
          <Container>
            <SectionHeading title="Everything on site" action={<Link to="/facilities" className="inline-flex items-center gap-2 font-semibold text-white underline-offset-4 hover:underline">All facilities<ArrowRight className="size-4" aria-hidden="true" /></Link>} />
            <h2 id="fac-h" className="sr-only">Facilities</h2>
            <ul className="mt-12 grid gap-px overflow-hidden rounded-3xl bg-white/15 sm:grid-cols-2 lg:grid-cols-3">
              {facilities.slice(0, 6).map((f) => (
                <li key={f.name} className="bg-ink p-8">
                  <NamedIcon name={f.icon} className="size-7 text-accent" />
                  <h3 className="mt-5 text-xl font-semibold">{f.name}</h3>
                  {f.description && <p className="mt-2 text-white/80">{f.description}</p>}
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {(gallery.length > 0 || SAMPLE_GALLERY.length > 0) && (
        <section className="py-24 sm:py-32" aria-labelledby="gal-h">
          <Container>
            <SectionHeading title="A look around" action={<Link to="/gallery" className="inline-flex items-center gap-2 font-semibold text-brand-text hover:underline">Full gallery<ArrowRight className="size-4" aria-hidden="true" /></Link>} />
            <h2 id="gal-h" className="sr-only">Photo gallery</h2>
            {gallery.length === 0 && <p className="mt-3 text-sm text-muted">Representative hotel photography — add your own property photos in the website settings.</p>}
            <ul className="mt-12 columns-2 gap-3 sm:gap-4 lg:columns-3">
              {(gallery.length > 0 ? gallery : SAMPLE_GALLERY).map((g, i) => (
                <li key={`${g.image.url}-${i}`} className="mb-3 break-inside-avoid sm:mb-4">
                  <button type="button" onClick={() => setViewer(i)} className="group block w-full overflow-hidden rounded-2xl" aria-label={`Open photo: ${g.caption ?? g.image.alt ?? `photo ${i + 1}`}`}>
                    <div style={{ aspectRatio: `${g.image.width} / ${g.image.height}` }}><Img image={g.image} sizes="(min-width: 1024px) 360px, 50vw" alt={g.caption ?? g.image.alt} className="transition-transform duration-700 motion-safe:group-hover:scale-105" /></div>
                  </button>
                </li>
              ))}
            </ul>
          </Container>
          {viewer !== null && <Lightbox images={(gallery.length > 0 ? gallery : SAMPLE_GALLERY).map((g) => ({ image: g.image, caption: g.caption }))} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />}
        </section>
      )}

      {content.testimonials.length > 0 && (
        <section className="bg-brand-soft py-24 sm:py-32" aria-labelledby="test-h">
          <Container>
            <h2 id="test-h" className="text-4xl font-semibold tracking-tight sm:text-5xl">What guests say</h2>
            <div className="mt-12 grid gap-10 lg:grid-cols-12">
              {content.testimonials.slice(0, 3).map((t, i) => (
                <figure key={t.guestName + i} className={i === 0 ? "lg:col-span-12" : "lg:col-span-6"}>
                  <Quote className="size-8 text-accent-text" aria-hidden="true" />
                  <blockquote className={i === 0 ? "mt-4 font-display text-2xl font-medium leading-snug sm:text-4xl" : "mt-3 text-xl leading-snug"}>{t.quote}</blockquote>
                  <figcaption className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
                    <span className="font-semibold text-ink">{t.guestName}</span>{t.source && <span>via {t.source}</span>}
                    {t.rating && <span className="inline-flex items-center gap-1" role="img" aria-label={`${t.rating} out of 5 stars`}>{Array.from({ length: t.rating }, (_, k) => <Star key={k} className="size-4 fill-accent text-accent" aria-hidden="true" />)}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </Container>
        </section>
      )}

      {(c.address || c.city || c.mapEmbedUrl) && (
        <section className="py-24 sm:py-32" aria-labelledby="loc-h">
          <Container className="grid gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <h2 id="loc-h" className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Find us</h2>
              <p className="mt-5 flex items-start gap-3 text-lg text-muted"><MapPin className="mt-1 size-5 shrink-0 text-brand-text" aria-hidden="true" />{[c.address, c.city, c.state, c.country].filter(Boolean).join(", ")}</p>
              {directionsUrl(c, hotel.name) && <a href={directionsUrl(c, hotel.name)!} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full border border-ink/25 px-6 font-semibold hover:bg-ink/5">Get directions<ArrowRight className="size-4" aria-hidden="true" /></a>}
            </div>
            <div className="lg:col-span-7"><MapBlock /></div>
          </Container>
        </section>
      )}

      <section className="bg-brand py-20 text-on-brand" aria-labelledby="cta-h">
        <Container className="flex flex-wrap items-center justify-between gap-8">
          <div className="max-w-xl"><h2 id="cta-h" className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Ready when you are</h2><p className="mt-3 text-lg opacity-90">Talk to us directly and we'll help you choose the right room.</p></div>
          <div className="flex flex-wrap gap-3">
            <PrimaryAction site={site} className={btnLight} />
            <WhatsAppAction site={site} className={btnGhostLight} />
            <CallAction site={site} className={btnGhostLight} />
          </div>
        </Container>
      </section>
    </>
  );
}
