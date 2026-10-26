import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, RefreshCw } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useToast } from "@/components/feedback/Toast";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Fields";
import { adminApi, type HousekeepingRoom } from "@/services/adminApi";
import { AdminPage, QueryBoundary } from "../components/AdminPage";

const LABEL: Record<string, string> = { DIRTY: "Needs cleaning", CLEANING: "Cleaning in progress", CLEAN: "Clean", INSPECTED: "Inspected" };
const NEXT: Record<HousekeepingRoom["housekeepingStatus"], HousekeepingRoom["housekeepingStatus"][]> = { DIRTY: ["CLEANING"], CLEANING: ["CLEAN", "DIRTY"], CLEAN: ["INSPECTED", "DIRTY", "CLEANING"], INSPECTED: ["DIRTY", "CLEANING"] };

export default function HousekeepingPage() {
  const [filter, setFilter] = useState("");
  const qc = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: ["admin", "housekeeping", filter], queryFn: () => adminApi.housekeeping(filter) });
  const update = useMutation({ mutationFn: ({ id, status }: { id: string; status: HousekeepingRoom["housekeepingStatus"] }) => adminApi.updateHousekeeping(id, status), onSuccess: () => { toast("Housekeeping status updated."); void qc.invalidateQueries({ queryKey: ["admin", "housekeeping"] }); void qc.invalidateQueries({ queryKey: ["admin", "operations-report"] }); }, onError: () => toast("Could not update this room. Refresh and try again.") });
  return <AdminPage title="Housekeeping" description="Track room cleaning and inspection. Status changes are recorded in the hotel audit trail." action={<Button variant="secondary" icon={<RefreshCw className="size-4" aria-hidden="true" />} onClick={() => void query.refetch()}>Refresh</Button>}>
    <div className="max-w-xs"><Select label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All rooms</option>{Object.entries(LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div>
    <QueryBoundary query={query} what="housekeeping rooms">{(rooms) => rooms.length === 0 ? <Card><EmptyState icon={ClipboardCheck} title="No rooms to show" description="Active rooms will appear here when they are added to the hotel." /></Card> : <Card><ul className="divide-y divide-line">{rooms.map((room) => <li key={room.id} className="grid gap-3 p-4 sm:grid-cols-[5rem_1fr_10rem_12rem] sm:items-center"><div><p className="font-display text-xl font-extrabold">{room.roomNumber}</p>{room.floor !== undefined && <p className="text-xs text-muted">Floor {room.floor}</p>}</div><div><p className="font-semibold">{room.roomTypeName}</p><p className="text-sm text-muted">Room status: {room.roomStatus.replaceAll("_", " ")}</p></div><span className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${room.needsAttention ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{LABEL[room.housekeepingStatus]}</span><div className="flex flex-wrap gap-2">{NEXT[room.housekeepingStatus].map((status) => <Button key={status} size="sm" variant="secondary" loading={update.isPending && update.variables?.id === room.id} disabled={update.isPending} onClick={() => update.mutate({ id: room.id, status })}>{LABEL[status]}</Button>)}</div></li>)}</ul></Card>}</QueryBoundary>
  </AdminPage>;
}
