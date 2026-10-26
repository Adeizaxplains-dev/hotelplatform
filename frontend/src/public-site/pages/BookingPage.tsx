import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CalendarDays, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, Textarea } from "@/components/ui/Fields";
import { ApiError } from "@/services/apiClient";
import { publicApi, type AvailabilityResult, type ReservationResult } from "@/services/publicApi";
import { formatTime, mailLink, telLink, whatsappLink } from "@/lib/format";
import { formatMoney } from "@/lib/format";
import { btnOutline, btnPrimary } from "../components/buttonStyles";
import { Seo } from "../components/Seo";
import { Container } from "../components/Section";
import { useSite } from "../SiteContext";

const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return localDate(d); };

export default function BookingPage() {
  const site = useSite();
  const { hotel } = site;
  const [params] = useSearchParams();
  const [checkIn, setCheckIn] = useState(addDays(1));
  const [checkOut, setCheckOut] = useState(addDays(2));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [roomTypeSlug, setRoomTypeSlug] = useState(params.get("room") ?? "");
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [reservation, setReservation] = useState<ReservationResult | null>(null);
  const [guest, setGuest] = useState({ fullName: "", email: "", phone: "", specialRequests: "" });
  const c = hotel.contact;
  const bookingEnabled = site.features.includes("booking");

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setReservation(null); setAvailability(null); setSearching(true);
    try {
      if (checkOut <= checkIn) throw new Error("Check-out must be after check-in.");
      const result = await publicApi.availability({ checkIn, checkOut, adults, children, ...(roomTypeSlug ? { roomTypeSlug } : {}) });
      setAvailability(result);
      if (roomTypeSlug && !result.items.some((item) => item.slug === roomTypeSlug)) setRoomTypeSlug("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't check availability. Please try again.");
    } finally { setSearching(false); }
  }

  async function payForReservation() {
    if (!reservation) return;
    setError(""); setPaying(true);
    try {
      const payment = await publicApi.initializePayment(reservation.reference);
      window.location.assign(payment.authorizationUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't start the payment. Please try again.");
    } finally { setPaying(false); }
  }

  async function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSubmitting(true);
    try {
      if (!roomTypeSlug) throw new Error("Choose a room type first.");
      const result = await publicApi.createReservation({ checkIn, checkOut, roomTypeSlug, adults, children,
        guest: { fullName: guest.fullName.trim(), email: guest.email.trim(), phone: guest.phone.trim() },
        ...(guest.specialRequests.trim() ? { specialRequests: guest.specialRequests.trim() } : {}),
      });
      setReservation(result); setAvailability(null);
    } catch (err) {
      setError(err instanceof ApiError && err.code === "FEATURE_NOT_AVAILABLE"
        ? "Online booking is not included in this hotel's current plan. Please contact the hotel directly."
        : err instanceof Error ? err.message : "We couldn't submit your reservation. Please try again.");
    } finally { setSubmitting(false); }
  }

  const directMessage = `Hello ${hotel.name}, I'd like to enquire about a room from ${checkIn} to ${checkOut}.`;

  return (
    <Container className="max-w-5xl py-14 sm:py-20">
      <Seo page="Book your stay" description={`Check availability and request a stay at ${hotel.name}.`} path="/booking" />
      <div className="max-w-2xl">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand"><CalendarDays className="size-4" aria-hidden="true" /> Direct reservations</p>
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">Book your stay</h1>
        <p className="mt-4 text-lg text-muted">Choose your dates, check available rooms, and send your reservation request directly to {hotel.name}.</p>
      </div>

      {reservation ? (
        <section className="mt-10 max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8" aria-live="polite">
          <CheckCircle2 className="size-10 text-emerald-700" aria-hidden="true" />
          <h2 className="mt-4 text-2xl font-bold">Reservation request received</h2>
          <p className="mt-2 text-muted">{reservation.message}</p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-sm text-muted">Booking reference</dt><dd className="text-xl font-bold">{reservation.reference}</dd></div>
            <div><dt className="text-sm text-muted">Estimated total</dt><dd className="text-xl font-bold">{formatMoney(reservation.price.totalAmount, reservation.price.currency)}</dd></div>
            <div><dt className="text-sm text-muted">Check-in</dt><dd className="font-semibold">{reservation.checkIn}</dd></div>
            <div><dt className="text-sm text-muted">Check-out</dt><dd className="font-semibold">{reservation.checkOut}</dd></div>
            <div><dt className="text-sm text-muted">Guest</dt><dd className="font-semibold">{reservation.guest.fullName}</dd></div>
            <div><dt className="text-sm text-muted">Reservation status</dt><dd className="font-semibold">{reservation.status.replace(/_/g, " ")}</dd></div>
            <div><dt className="text-sm text-muted">Payment status</dt><dd className="font-semibold">{reservation.paymentStatus.replace(/_/g, " ")}</dd></div>
          </dl>
          <p className="mt-5 text-sm text-muted">Keep your reference for your records. Your reservation is confirmed after the hotel confirms it or successful payment is verified.</p>
          <div className="mt-6 flex flex-wrap gap-3 print:hidden"><Button onClick={() => void payForReservation()} loading={paying}>Pay online</Button><Button variant="secondary" onClick={() => window.print()}>Print / save confirmation</Button><Button variant="secondary" onClick={() => { setReservation(null); setAvailability(null); setRoomTypeSlug(""); setGuest({ fullName: "", email: "", phone: "", specialRequests: "" }); }}>Make another request</Button></div>
        </section>
      ) : !bookingEnabled ? (
        <section className="mt-10 rounded-2xl border border-line p-6 sm:p-8">
          <h2 className="text-xl font-bold">Contact the hotel to reserve</h2>
          <p className="mt-2 text-muted">Online booking is not enabled for this hotel yet. Contact the team to confirm availability and rates.</p>
          <ContactActions hotelName={hotel.name} contact={c} message={directMessage} />
        </section>
      ) : (
        <>
          <form onSubmit={search} className="mt-10 grid gap-5 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2 sm:p-7">
            <Input label="Check-in" type="date" value={checkIn} min={addDays(0)} required onChange={(e) => setCheckIn(e.target.value)} />
            <Input label="Check-out" type="date" value={checkOut} min={checkIn || addDays(1)} required onChange={(e) => setCheckOut(e.target.value)} />
            <Select label="Adults" value={adults} onChange={(e) => setAdults(Number(e.target.value))}>{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? "adult" : "adults"}</option>)}</Select>
            <Select label="Children" value={children} onChange={(e) => setChildren(Number(e.target.value))}>{Array.from({ length: 6 }, (_, i) => i).map((n) => <option key={n} value={n}>{n} {n === 1 ? "child" : "children"}</option>)}</Select>
            <div className="sm:col-span-2"><Button type="submit" loading={searching} className="w-full sm:w-auto" icon={<CalendarDays className="size-4" aria-hidden="true" />}>Check availability</Button></div>
          </form>

          {error && <p role="alert" className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{error}</p>}

          {availability && <section className="mt-10" aria-live="polite">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold">Available room types</h2><p className="mt-1 text-muted">{availability.checkIn} to {availability.checkOut} · {availability.nights} {availability.nights === 1 ? "night" : "nights"}</p></div><span className="text-sm text-muted">Rates shown per stay</span></div>
            {availability.items.length === 0 ? <p className="mt-5 rounded-xl border border-line p-5 text-muted">No rooms match those guest requirements and dates. Try different dates or fewer guests.</p> : <div className="mt-5 grid gap-4 md:grid-cols-2">{availability.items.map((item) => <article key={item.slug} className="rounded-2xl border border-line p-5">
              <div className="flex items-start justify-between gap-3"><div><h3 className="text-xl font-bold">{item.name}</h3><p className="mt-1 text-sm text-muted">{item.availableRooms} {item.availableRooms === 1 ? "room" : "rooms"} available</p></div><span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">{item.available ? "Available" : "Sold out"}</span></div>
              <p className="mt-5 text-2xl font-bold">{formatMoney(item.totalAmount, item.currency)} <span className="text-sm font-normal text-muted">total</span></p><p className="text-sm text-muted">{formatMoney(item.nightlyRate, item.currency)} per night</p>
              <Button className="mt-5 w-full" disabled={!item.available} onClick={() => { setRoomTypeSlug(item.slug); setError(""); document.getElementById("guest-details")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Choose this room</Button>
            </article>)}</div>}
          </section>}

          {roomTypeSlug && availability?.items.some((item) => item.slug === roomTypeSlug && item.available) && <form id="guest-details" onSubmit={submitReservation} className="mt-10 grid gap-5 rounded-2xl border border-line p-5 sm:p-7">
            <div><h2 className="text-2xl font-bold">Guest details</h2><p className="mt-1 text-muted">Your reservation is a request. The hotel will confirm it with you.</p></div>
            <div className="grid gap-5 sm:grid-cols-2"><Input label="Full name" autoComplete="name" minLength={2} maxLength={120} required value={guest.fullName} onChange={(e) => setGuest({ ...guest, fullName: e.target.value })} /><Input label="Email address" type="email" autoComplete="email" required maxLength={254} value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} /><Input label="Phone number" type="tel" autoComplete="tel" required minLength={7} maxLength={30} value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} /><Select label="Selected room" value={roomTypeSlug} onChange={(e) => setRoomTypeSlug(e.target.value)}>{availability.items.filter((item) => item.available).map((item) => <option key={item.slug} value={item.slug}>{item.name} — {formatMoney(item.totalAmount, item.currency)}</option>)}</Select></div>
            <Textarea label="Special requests (optional)" maxLength={1000} value={guest.specialRequests} onChange={(e) => setGuest({ ...guest, specialRequests: e.target.value })} placeholder="Arrival time, accessibility needs, or other requests" />
            <Button type="submit" size="lg" loading={submitting} className="w-full sm:w-auto">Send reservation request</Button>
            <p className="text-xs text-muted">Your details are shared with this hotel to handle the reservation. Payment is processed securely by the payment provider.</p>
          </form>}
        </>
      )}

      <dl className="mt-14 grid gap-6 border-t border-ink/10 pt-10 sm:grid-cols-2"><div><dt className="font-semibold">Check-in</dt><dd className="mt-1 text-muted">From {formatTime(hotel.policies.checkInTime)}</dd></div><div><dt className="font-semibold">Check-out</dt><dd className="mt-1 text-muted">By {formatTime(hotel.policies.checkOutTime)}</dd></div>{hotel.policies.cancellation && <div className="sm:col-span-2"><dt className="font-semibold">Cancellation</dt><dd className="mt-1 text-muted">{hotel.policies.cancellation}</dd></div>}</dl>
      <p className="mt-8 text-sm text-muted"><Link to="/rooms" className="underline underline-offset-4">Explore all rooms</Link></p>
    </Container>
  );
}

function ContactActions({ hotelName, contact, message }: { hotelName: string; contact: { whatsapp: string | null; phone: string | null; email: string | null }; message: string }) {
  const hasContact = contact.whatsapp || contact.phone || contact.email;
  if (!hasContact) return <p className="mt-5 text-muted">This hotel hasn't added contact details yet.</p>;
  return <div className="mt-6 flex flex-wrap gap-3">{contact.whatsapp && <a href={whatsappLink(contact.whatsapp, message)} target="_blank" rel="noopener noreferrer" className={btnPrimary}>Book on WhatsApp</a>}{contact.phone && <a href={telLink(contact.phone)} className={btnOutline}>Call {contact.phone}</a>}{contact.email && <a href={mailLink(contact.email, `Booking enquiry: ${hotelName}`)} className={btnOutline}>Email us</a>}</div>;
}
