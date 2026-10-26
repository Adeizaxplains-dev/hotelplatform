import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/feedback/Skeleton";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";
import { ApiError } from "@/services/apiClient";
import { publicApi } from "@/services/publicApi";
import { PrimaryAction, WhatsAppAction } from "../components/Actions";
import { btnOutline, btnPrimary } from "../components/buttonStyles";
import { Img } from "../components/Img";
import { HOTEL_PHOTOS, photoForLabel } from "../photoDefaults";
import { Lightbox } from "../components/Lightbox";
import { Price, RoomMeta } from "../components/RoomCards";
import { Seo } from "../components/Seo";
import { Container } from "../components/Section";
import { NamedIcon } from "../icons";
import { useSite } from "../SiteContext";

export default function RoomDetailPage() {
  const { slug = "" } = useParams();
  const site = useSite();
  const q = useQuery({ queryKey: ["public", "room-type", slug], queryFn: () => publicApi.roomType(slug), retry: false, staleTime: 30_000 });
  const [active, setActive] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);

  if (q.isPending) return <Container className="py-14"><Skeleton className="aspect-[16/9] w-full rounded-3xl" /><Skeleton className="mt-8 h-10 w-1/2" /></Container>;
  if (q.isError) {
    const missing = q.error instanceof ApiError && (q.error.code === "NOT_FOUND" || q.error.status === 404);
    return (
      <Container className="py-24 text-center">
        <Seo page="Room not found" path={`/rooms/${slug}`} />
        {missing ? (<><h1 className="text-4xl font-semibold">We couldn't find that room</h1><p className="mt-3 text-muted">It may have been renamed or is no longer available.</p><Link to="/rooms" className={cn(btnPrimary, "mt-8")}>See all rooms</Link></>) : <ErrorState description="We couldn't load this room. Please try again." onRetry={() => void q.refetch()} retrying={q.isFetching} />}
      </Container>
    );
  }

  const room = q.data;
  const roomImages = room.images.length > 0 ? room.images : [photoForLabel(room.name), HOTEL_PHOTOS[1]!, HOTEL_PHOTOS[4]!];
  const main = roomImages[active] ?? roomImages[0]!;
  const message = `Hello ${site.hotel.name}, I'd like to book the ${room.name}.`;
  const bookHref = site.features.includes("booking") ? `/booking?room=${encodeURIComponent(room.slug)}` : null;

  return (
    <Container className="py-10 sm:py-14">
      <Seo page={room.name} titleOverride={room.seo.title} description={room.seo.description ?? room.shortDescription ?? `${room.name} at ${site.hotel.name}`} imageUrl={room.images[0]?.url} path={`/rooms/${room.slug}`} />
      <Link to="/rooms" className="inline-flex items-center gap-2 font-semibold text-brand-text hover:underline"><ArrowLeft className="size-4" aria-hidden="true" />All rooms</Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-7">
          <button type="button" onClick={() => setViewer(active)} className="block w-full overflow-hidden rounded-3xl bg-brand-soft" aria-label="Open photo viewer">
            <div className="aspect-[4/3]"><Img image={main} priority sizes="(min-width: 1024px) 700px, 100vw" alt={main.alt || room.name} /></div>
          </button>
          {roomImages.length > 1 && (
            <ul className="mt-3 grid grid-cols-5 gap-2 sm:gap-3">
              {roomImages.map((img, i) => (
                <li key={img.url}>
                  <button type="button" onClick={() => setActive(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === active} className={cn("block aspect-square w-full overflow-hidden rounded-xl ring-offset-2", i === active ? "ring-2 ring-brand" : "opacity-80 hover:opacity-100")}>
                    <Img image={img} sizes="120px" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{room.name}</h1>
            <div className="mt-4"><RoomMeta room={room} /></div>
            <Price room={room} className="mt-6" />
            <div className="mt-6 flex flex-wrap gap-3">
              {bookHref ? <Link to={bookHref} className={btnPrimary}>Book this room</Link> : <PrimaryAction site={site} className={btnPrimary} message={message} />}
              <WhatsAppAction site={site} className={btnOutline} message={message} />
            </div>
            <p className="mt-6 text-sm text-muted">Check-in from {formatTime(site.hotel.policies.checkInTime)}. Check-out by {formatTime(site.hotel.policies.checkOutTime)}.</p>
          </div>
        </div>
      </div>

      {room.description && <section className="mt-16 max-w-3xl" aria-labelledby="about-room"><h2 id="about-room" className="text-2xl font-semibold">About this room</h2><div className="mt-4 grid gap-4 text-lg text-muted">{room.description.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}</div></section>}

      {room.amenities.length > 0 && (
        <section className="mt-14" aria-labelledby="amen-h">
          <h2 id="amen-h" className="text-2xl font-semibold">What's included</h2>
          <ul className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {room.amenities.map((a) => <li key={a.key} className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-brand-soft text-brand-text"><NamedIcon name={a.icon} className="size-5" /></span>{a.label}</li>)}
          </ul>
        </section>
      )}
      {viewer !== null && <Lightbox images={roomImages.map((image) => ({ image }))} index={viewer} onIndex={(i) => { setViewer(i); setActive(i); }} onClose={() => setViewer(null)} />}
    </Container>
  );
}
