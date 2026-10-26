import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/format";
import { adminApi } from "@/services/adminApi";
import { AdminPage, QueryBoundary } from "../components/AdminPage";

export default function GuestsPage() {
  const [search, setSearch] = useState("");
  const query = useQuery({ queryKey: ["admin", "guests", search], queryFn: () => adminApi.guests(search ? `&q=${encodeURIComponent(search)}` : "") });
  return <AdminPage title="Guest directory" description="Search guests from reservation history and review their recent stays. Guest records are grouped by email address.">
    <Input label="Search guests" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, phone or booking reference" />
    <QueryBoundary query={query} what="the guest directory">{(result) => result.items.length ? <div className="grid gap-4">{result.items.map((g) => <Card key={g.email} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">{g.guest.fullName}</h2><p className="text-sm text-muted">{g.email} · {g.guest.phone}</p></div><div className="text-right"><p className="text-xs uppercase text-muted">Reservations</p><p className="text-xl font-extrabold">{g.reservations}</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="text-xs uppercase text-muted">Total booked (all history)</p><p className="mt-1 font-semibold">{formatMoney(g.totalBooked, g.currency)}</p></div><div><p className="text-xs uppercase text-muted">Most recent booking</p><p className="mt-1 font-semibold">{new Date(g.lastReservationAt).toLocaleDateString()}</p></div></div><div className="mt-4 border-t border-line pt-3"><h3 className="text-sm font-bold">Recent stays</h3><ul className="mt-2 grid gap-2">{g.recentReservations.map((r) => <li key={r.reference} className="flex flex-wrap justify-between gap-2 rounded-md bg-canvas p-3 text-sm"><span><strong>{r.reference}</strong> · {r.checkIn} → {r.checkOut}<span className="ml-2 text-muted">{r.status.replaceAll("_", " ")}</span></span><span>{formatMoney(r.totalAmount, r.currency)} · {r.paymentStatus.replaceAll("_", " ")}</span></li>)}</ul></div></Card>)}</div> : <EmptyState icon={Users} title="No guests found" description="Guests appear here when their email address has been used for a reservation." />}</QueryBoundary>
  </AdminPage>;
}
