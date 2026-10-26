import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, RefreshCw } from "lucide-react";
import { Alert } from "@/components/feedback/Alert";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/feedback/Skeleton";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Fields";
import { useAuth } from "@/features/auth/AuthContext";
import { formatMoney } from "@/lib/format";
import { adminApi, type ReservationAdmin } from "@/services/adminApi";
import { ApiError } from "@/services/apiClient";

const statuses = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"] as const;
type Status = typeof statuses[number];
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^\w/, (x) => x.toUpperCase());
const badgeTone = (status: string): "success" | "warning" | "danger" | "neutral" => {
  if (["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"].includes(status)) return "success";
  if (status === "PENDING") return "warning";
  if (["CANCELLED", "NO_SHOW"].includes(status)) return "danger";
  return "neutral";
};

export default function ReservationsPage() {
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const q = useQuery({ queryKey: ["admin", "reservations", statusFilter], queryFn: () => adminApi.reservations(statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ""), staleTime: 15_000 });
  const mutation = useMutation({
    mutationFn: ({
  id,
  status,
}: {
  id: string;
  status: Exclude<Status, "PENDING">;
}) => adminApi.updateReservationStatus(id, status),
    onSuccess: async () => { setError(""); await queryClient.invalidateQueries({ queryKey: ["admin", "reservations"] }); await queryClient.invalidateQueries({ queryKey: ["admin", "rooms"] }); },
    onError: (e) => setError(e instanceof ApiError ? e.message : "The reservation could not be updated. Please try again."),
  });
  const canUpdate = me?.permissions.includes("reservations.update") ?? false;
  const canCancel = me?.permissions.includes("reservations.cancel") ?? false;

  function actions(r: ReservationAdmin) {
    const choices: Status[] = r.status === "PENDING" ? ["CONFIRMED", ...(canCancel ? ["CANCELLED" as const] : []), "NO_SHOW"]
      : r.status === "CONFIRMED" ? ["CHECKED_IN", ...(canCancel ? ["CANCELLED" as const] : []), "NO_SHOW"]
      : r.status === "CHECKED_IN" ? ["CHECKED_OUT"] : [];
    return choices;
  }

  return <div className="mx-auto grid max-w-7xl gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold text-lagoon-700">FRONT DESK</p><h1 className="mt-1 text-3xl font-extrabold">Reservations</h1><p className="mt-2 text-muted">Review guest requests, confirm stays, and manage check-in and check-out.</p></div><Button variant="secondary" icon={<RefreshCw className="size-4" aria-hidden="true" />} onClick={() => void q.refetch()} loading={q.isFetching}>Refresh</Button></div>
    {!me?.features.includes("payments") && <Alert tone="info" title="Online payment availability">Guests can pay online when Paystack is configured for the platform and enabled for this hotel. Always verify payment status in the reservation before check-in.</Alert>}
    {error && <Alert tone="danger" title="Could not update reservation">{error}</Alert>}
    <div className="max-w-xs"><Select label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All reservations</option>{statuses.map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></div>
    {q.isPending ? <div className="grid gap-3" aria-busy="true">{[0, 1, 2].map((n) => <Skeleton key={n} className="h-36 w-full rounded-xl" />)}</div>
      : q.isError ? <ErrorState description="We couldn't load reservations. Check the connection and try again." onRetry={() => void q.refetch()} retrying={q.isFetching} />
      : q.data.items.length === 0 ? <EmptyState icon={CalendarCheck} title="No reservations yet" description="Guest reservation requests will appear here after the booking engine receives them." />
      : <div className="grid gap-4">{q.data.items.map((r) => <ReservationCard key={r.id} reservation={r} choices={actions(r)} canUpdate={canUpdate} busy={mutation.isPending && mutation.variables?.id === r.id} onStatus={(status) =>
  mutation.mutate({
    id: r.id,
    status: status as Exclude<Status, "PENDING">,
  })
} />)}</div>}
  </div>;
}

function ReservationCard({ reservation: r, choices, canUpdate, busy, onStatus }: { reservation: ReservationAdmin; choices: Status[]; canUpdate: boolean; busy: boolean; onStatus: (status: Status) => void }) {
  return <article className="rounded-xl border border-line bg-surface p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold text-muted">{r.reference}</p><h2 className="mt-1 text-xl font-bold">{r.guest.fullName}</h2><p className="mt-1 text-sm text-muted">{r.guest.email} · {r.guest.phone}</p></div><div className="flex flex-wrap gap-2"><Badge tone={badgeTone(r.status)}>{label(r.status)}</Badge><Badge>{label(r.paymentStatus)}</Badge></div></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Stay dates</p><p className="mt-1 font-semibold">{r.checkIn} → {r.checkOut}</p><p className="text-sm text-muted">{r.nights} {r.nights === 1 ? "night" : "nights"}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Guests</p><p className="mt-1 font-semibold">{r.adults} adults{r.children ? `, ${r.children} children` : ""}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Booking total</p><p className="mt-1 font-semibold">{formatMoney(r.price.totalAmount, r.price.currency)}</p><p className="text-sm text-muted">{r.paymentStatus === "UNPAID" ? "No payment recorded" : "Payment status shown above"}</p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-muted">Source</p><p className="mt-1 font-semibold">{label(r.source)}</p></div></div>
    {r.specialRequests && <p className="mt-4 rounded-lg bg-canvas p-3 text-sm"><strong>Guest requests:</strong> {r.specialRequests}</p>}
    {canUpdate && choices.length > 0 && <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">{choices.map((status) => <Button key={status} size="sm" variant={status === "CANCELLED" || status === "NO_SHOW" ? "danger" : status === "CONFIRMED" ? "primary" : "secondary"} loading={busy} disabled={busy} onClick={() => onStatus(status)}>{label(status)}</Button>)}</div>}
  </article>;
}
