import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/format";
import { adminApi } from "@/services/adminApi";
import { AdminPage, QueryBoundary } from "../components/AdminPage";
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 8)}01`;
type ReportRow = { currency: string; amount: number; count: number };
export default function FinancialReportPage() {
  const [from, setFrom] = useState(monthStart()); const [to, setTo] = useState(today());
  const query = useQuery({ queryKey: ["admin", "financial-report", from, to], queryFn: () => adminApi.financialReport(from, to), enabled: /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to });
  return <AdminPage title="Financial report" description="Operational financial summaries by hotel-local dates. Values remain grouped by currency; amounts are not converted.">
    <div className="grid max-w-xl gap-3 sm:grid-cols-2"><Input label="From date" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /><Input label="To date" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
    {from > to && <p className="text-sm text-danger-700">The start date must be on or before the end date.</p>}
    <QueryBoundary query={query} what="the financial report">{(r) => {
      const groups: Array<{ title: string; countLabel: string; rows: ReportRow[] }> = [
        { title: "Payments collected", countLabel: "transactions", rows: r.paymentsCollected.map((x) => ({ currency: x.currency, amount: x.amount, count: x.transactions })) },
        { title: "Processed refunds", countLabel: "refunds", rows: r.refundsProcessed.map((x) => ({ currency: x.currency, amount: x.amount, count: x.refunds })) },
        { title: "Invoices issued", countLabel: "invoices", rows: r.invoicesIssued.map((x) => ({ currency: x.currency, amount: x.amount, count: x.invoices })) },
        { title: "Outstanding balances", countLabel: "invoices", rows: r.outstandingBalances.map((x) => ({ currency: x.currency, amount: x.amount, count: x.invoices })) },
        { title: "Reservations booked", countLabel: "reservations", rows: r.reservationsBooked.map((x) => ({ currency: x.currency, amount: x.amount, count: x.reservations })) },
      ];
      return <div className="grid gap-5"><p className="text-sm text-muted">Report timezone: {r.timezone} · {r.from} to {r.to}</p><div className="grid gap-4 xl:grid-cols-2">{groups.map((group) => <Card key={group.title} className="p-5"><h2 className="font-bold">{group.title}</h2>{group.rows.length ? <ul className="mt-3 divide-y divide-line">{group.rows.map((row) => <li key={row.currency} className="flex flex-wrap justify-between gap-3 py-3"><div><p className="font-semibold">{row.currency}</p><p className="text-xs text-muted">{row.count} {group.countLabel}</p></div><p className="text-lg font-extrabold">{formatMoney(row.amount, row.currency)}</p></li>)}</ul> : <p className="mt-3 text-sm text-muted">No records for this section.</p>}</Card>)}</div><Card className="p-5"><h2 className="font-bold">Important accounting note</h2><p className="mt-2 text-sm text-muted">{r.note}</p></Card></div>;
    }}</QueryBoundary>
  </AdminPage>;
}
