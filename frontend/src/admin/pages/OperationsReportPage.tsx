import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { adminApi } from "@/services/adminApi";
import { formatMoney } from "@/lib/format";
import { AdminPage, QueryBoundary } from "../components/AdminPage";

const today = () => new Date().toISOString().slice(0, 10);
const number = (n: number) => new Intl.NumberFormat().format(n);

export default function OperationsReportPage() {
  const [date, setDate] = useState(today());
  const query = useQuery({ queryKey: ["admin", "operations-report", date], queryFn: () => adminApi.operationsReport(date), enabled: /^\d{4}-\d{2}-\d{2}$/.test(date) });
  return <AdminPage title="Operations report" description="Daily room status, occupancy, arrivals, departures and successful payments.">
    <div className="max-w-xs"><Input label="Report date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
    <QueryBoundary query={query} what="the operations report">{(r) => <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Occupancy", `${r.rooms.occupancyPercent}%`], ["Occupied rooms", `${number(r.rooms.occupied)} / ${number(r.rooms.total)}`], ["Arrivals", number(r.arrivals.length)], ["Departures", number(r.departures.length)], ["Guests in-house", number(r.inHouseGuests)], ["New reservations", number(r.reservationsCreatedToday)], ["Available rooms", number(r.rooms.available)], ["Maintenance / out of service", number(r.rooms.maintenance)]].map(([label, value]) => <Card key={label} className="p-5"><p className="text-sm text-muted">{label}</p><p className="mt-2 font-display text-3xl font-extrabold">{value}</p></Card>)}</div>
      <Card className="p-5"><h2 className="font-bold">Housekeeping summary</h2><div className="mt-3 flex flex-wrap gap-2">{Object.entries(r.housekeeping).map(([status, count]) => <span key={status} className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm">{status.replaceAll("_", " ")}: <strong>{number(count)}</strong></span>)}</div></Card>
      <div className="grid gap-6 xl:grid-cols-2">{([["Arrivals", r.arrivals], ["Departures", r.departures]] as const).map(([title, items]) => <Card key={title} className="overflow-hidden"><div className="border-b border-line px-5 py-4"><h2 className="font-bold">{title}</h2><p className="text-sm text-muted">{items.length} reservation(s)</p></div>{items.length ? <ul className="divide-y divide-line">{items.map((item) => <li key={item.reference} className="p-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-semibold">{item.guestName}</p><span className="text-sm text-muted">{item.reference}</span></div><p className="mt-1 text-sm text-muted">{item.checkIn} → {item.checkOut} · {item.status.replaceAll("_", " ")}</p></li>)}</ul> : <p className="p-5 text-sm text-muted">No {title.toLowerCase()} for this date.</p>}</Card>)}</div>
      <Card className="p-5"><h2 className="font-bold">Successful payments</h2>{r.paymentsCollected.length ? <ul className="mt-3 divide-y divide-line">{r.paymentsCollected.map((p) => <li key={p.currency} className="flex flex-wrap justify-between gap-2 py-3"><span>{number(p.transactions)} transaction(s) · {p.currency}</span><strong>{formatMoney(p.total, p.currency)}</strong></li>)}</ul> : <p className="mt-2 text-sm text-muted">No successful payments recorded on this date.</p>}<p className="mt-3 text-xs text-muted">Payment totals include successful Paystack payment records only; they are not a full accounting ledger.</p></Card>
    </div>}</QueryBoundary>
  </AdminPage>;
}
