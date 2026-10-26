import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Printer, ReceiptText } from "lucide-react";
import { Alert } from "@/components/feedback/Alert";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatMoney } from "@/lib/format";
import { ApiError } from "@/services/apiClient";
import { adminApi } from "@/services/adminApi";
import { AdminPage, QueryBoundary } from "../components/AdminPage";

export default function InvoicesPage() {
  const [search, setSearch] = useState(""); const [reservationId, setReservationId] = useState(""); const [error, setError] = useState(""); const [printId, setPrintId] = useState(""); const qc = useQueryClient();
  const invoices = useQuery({ queryKey: ["admin", "invoices", search], queryFn: () => adminApi.invoices(search ? `&q=${encodeURIComponent(search)}` : "") });
  const reservations = useQuery({ queryKey: ["admin", "reservations", "invoice-picker"], queryFn: () => adminApi.reservations(), staleTime: 30_000 });
  const issue = useMutation({ mutationFn: () => adminApi.issueInvoice(reservationId), onSuccess: async () => { setError(""); await qc.invalidateQueries({ queryKey: ["admin", "invoices"] }); }, onError: (e) => setError(e instanceof ApiError ? e.message : "Could not issue the invoice.") });
  const existingIds = new Set((invoices.data?.items ?? []).map((i) => i.reservationId));
  const choices = (reservations.data?.items ?? []).filter((r) => !existingIds.has(r.id) && !["CANCELLED", "NO_SHOW"].includes(r.status));
  return <AdminPage title="Invoices" description="Issue reservation invoices, track recorded payments, and review outstanding balances.">
    <Card className="grid gap-4 p-5"><h2 className="font-bold">Issue an invoice</h2><p className="text-sm text-muted">One invoice per reservation. The invoice snapshots the reservation total and guest details; payment totals are calculated from successful payment records.</p>
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end"><label className="grid gap-1.5 text-sm font-semibold">Reservation<select className="min-h-11 rounded-md border border-line-strong bg-surface px-3 text-base font-normal" value={reservationId} onChange={(e) => setReservationId(e.target.value)}><option value="">Choose a reservation…</option>{choices.map((r) => <option key={r.id} value={r.id}>{r.reference} — {r.guest.fullName} ({r.checkIn})</option>)}</select></label><Button loading={issue.isPending} disabled={!reservationId} onClick={() => issue.mutate()} icon={<ReceiptText className="size-4" />}>Issue invoice</Button></div>
      {error && <Alert tone="danger" title="Invoice action failed">{error}</Alert>}
    </Card>
    <Input label="Search invoices" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Invoice number, booking reference, guest or email" />
    <QueryBoundary query={invoices} what="invoices">{(result) => result.items.length ? <div className="grid gap-3">{result.items.map((i) => <Card key={i.id} className={`invoice-print-card p-5 ${printId === i.id ? "invoice-print-target" : ""}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-muted">{i.invoiceNumber}</p><h2 className="mt-1 text-lg font-bold">{i.guest.fullName}</h2><p className="text-sm text-muted">{i.guest.email} · Booking {i.reservationReference}</p></div><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold">{i.paymentStatus.replaceAll("_", " ")}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs uppercase text-muted">Invoice total</p><p className="mt-1 font-bold">{formatMoney(i.total, i.currency)}</p></div><div><p className="text-xs uppercase text-muted">Paid</p><p className="mt-1 font-semibold">{formatMoney(i.amountPaid, i.currency)}</p></div><div><p className="text-xs uppercase text-muted">Refunded</p><p className="mt-1 font-semibold">{formatMoney(i.amountRefunded, i.currency)}</p></div><div><p className="text-xs uppercase text-muted">Balance</p><p className="mt-1 font-bold">{formatMoney(i.balance, i.currency)}</p></div></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3 text-sm text-muted"><span>Issued {new Date(i.issuedAt).toLocaleDateString()}</span><Button variant="secondary" size="sm" icon={<Printer className="size-4" />} onClick={() => { setPrintId(i.id); document.body.classList.add("printing-invoice"); window.setTimeout(() => window.print(), 80); window.onafterprint = () => { document.body.classList.remove("printing-invoice"); setPrintId(""); window.onafterprint = null; }; }}>Print / Save PDF</Button></div></Card>)}</div> : <EmptyState icon={FileText} title="No invoices found" description="Choose a reservation above to issue its first invoice, or change your search." />}</QueryBoundary>
  </AdminPage>;
}
