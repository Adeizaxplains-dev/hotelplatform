import { ArrowRight, Maximize2, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { PublicRoomType } from "@/types/site";
import { Img, Placeholder } from "./Img";

export const Price = ({ room, className }: { room: PublicRoomType; className?: string }) => (
  <p className={cn("text-ink", className)}>
    <span className="text-sm text-muted">From </span>
    <span className="font-display text-xl font-semibold">{formatMoney(room.price.amount, room.price.currency)}</span>
    <span className="text-sm text-muted"> / night</span>
  </p>
);

export function RoomMeta({ room }: { room: PublicRoomType }) {
  const guests = room.maxAdults + room.maxChildren;
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
      <span className="inline-flex items-center gap-1.5"><Users className="size-4" aria-hidden="true" />{guests} guest{guests === 1 ? "" : "s"}</span>
      {room.bedConfig && <span>{room.bedConfig}</span>}
      {room.sizeSqm && <span className="inline-flex items-center gap-1.5"><Maximize2 className="size-4" aria-hidden="true" />{room.sizeSqm} m²</span>}
    </p>
  );
}

/** Grid card used on the Rooms page. */
export function RoomCard({ room }: { room: PublicRoomType }) {
  const cover = room.images[0];
  return (
    <article className="group flex flex-col">
      <Link to={`/rooms/${room.slug}`} className="block overflow-hidden rounded-2xl bg-brand-soft" aria-label={`View ${room.name}`}>
        <div className="aspect-[4/3] overflow-hidden">
          {cover ? <Img image={cover} sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" className="transition-transform duration-700 motion-safe:group-hover:scale-105" /> : <Placeholder label={room.name} />}
        </div>
      </Link>
      <div className="mt-4 flex flex-1 flex-col gap-2">
        <h3 className="text-2xl font-semibold"><Link to={`/rooms/${room.slug}`} className="hover:text-brand-text">{room.name}</Link></h3>
        <RoomMeta room={room} />
        {room.shortDescription && <p className="text-muted">{room.shortDescription}</p>}
        <div className="mt-auto flex items-center justify-between gap-3 pt-3">
          <Price room={room} />
          <Link to={`/rooms/${room.slug}`} className="inline-flex items-center gap-1.5 font-semibold text-brand-text" aria-hidden="true" tabIndex={-1}>View<ArrowRight className="size-4" /></Link>
        </div>
      </div>
    </article>
  );
}

/** Large alternating row used for the featured rooms on the home page. */
export function RoomFeature({ room, reverse }: { room: PublicRoomType; reverse: boolean }) {
  const cover = room.images[0];
  return (
    <article className="grid items-center gap-6 lg:grid-cols-12 lg:gap-12">
      <Link to={`/rooms/${room.slug}`} className={cn("group block overflow-hidden rounded-3xl bg-brand-soft lg:col-span-7", reverse && "lg:order-2")} aria-label={`View ${room.name}`}>
        <div className="aspect-[16/10] overflow-hidden">
          {cover ? <Img image={cover} sizes="(min-width: 1024px) 700px, 100vw" className="transition-transform duration-700 motion-safe:group-hover:scale-105" /> : <Placeholder label={room.name} />}
        </div>
      </Link>
      <div className="lg:col-span-5">
        <h3 className="text-3xl font-semibold leading-tight sm:text-4xl">{room.name}</h3>
        <div className="mt-3"><RoomMeta room={room} /></div>
        {(room.shortDescription || room.description) && <p className="mt-4 line-clamp-4 text-lg text-muted">{room.shortDescription ?? room.description}</p>}
        {room.amenities.length > 0 && <p className="mt-4 text-sm text-ink">{room.amenities.slice(0, 4).map((a) => a.label).join("  ·  ")}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Price room={room} />
          <Link to={`/rooms/${room.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 font-semibold text-on-brand hover:bg-brand-hover">View room<ArrowRight className="size-4" aria-hidden="true" /></Link>
        </div>
      </div>
    </article>
  );
}
