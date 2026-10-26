import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DoorOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useToast } from "@/components/feedback/Toast";
import { StatusBadge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Select, Toggle } from "@/components/ui/Fields";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/features/auth/AuthContext";
import { fieldErrors } from "@/lib/errors";
import { can } from "@/permissions";
import { adminApi, type RoomAdmin } from "@/services/adminApi";
import { AdminPage, FormError, QueryBoundary } from "../components/AdminPage";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  AVAILABLE: { label: "Available", tone: "success" }, RESERVED: { label: "Reserved", tone: "info" }, OCCUPIED: { label: "Occupied", tone: "warning" },
  MAINTENANCE: { label: "Maintenance", tone: "danger" }, OUT_OF_SERVICE: { label: "Out of service", tone: "neutral" },
};

const schema = z.object({
  roomNumber: z.string().trim().min(1, "Enter the room number.").max(20).regex(/^[A-Za-z0-9][A-Za-z0-9 ._/-]*$/, "Use letters, numbers and simple punctuation."),
  roomTypeId: z.string().min(1, "Choose a room type."),
  floor: z.string().refine((v) => v === "" || /^-?\d{1,3}$/.test(v), "Enter a floor number, e.g. 2."),
  status: z.string(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

export default function RoomsPage() {
  const { me } = useAuth();
  const [typeId, setTypeId] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<RoomAdmin | "new" | null>(null);
  const types = useQuery({ queryKey: ["admin", "room-types"], queryFn: () => adminApi.roomTypes() });
  const q = useQuery({ queryKey: ["admin", "rooms", typeId, status], queryFn: () => adminApi.rooms(`${typeId ? `&roomTypeId=${typeId}` : ""}${status ? `&status=${status}` : ""}`) });
  const canCreate = can(me, "rooms.create");
  const hasTypes = (types.data?.items.length ?? 0) > 0;

  return (
    <AdminPage title="Rooms" description="Every physical room, with its number and status." action={canCreate && hasTypes && <Button icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setEditing("new")}>Add room</Button>}>
      <div className="grid gap-3 sm:grid-cols-2 sm:max-w-xl">
        <Select label="Room type" value={typeId} onChange={(e) => setTypeId(e.target.value)}><option value="">All types</option>{types.data?.items.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
      </div>
      <QueryBoundary query={q} what="your rooms">
        {({ items, meta }) => items.length === 0 ? (
          <Card><EmptyState icon={DoorOpen} title={typeId || status ? "No rooms match" : "No rooms yet"} description={hasTypes ? "Add the rooms you have, for example 101, 102, 201. Each belongs to a room type." : "Create a room type first, then add the rooms that belong to it."} action={canCreate && hasTypes ? <Button icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setEditing("new")}>Add room</Button> : undefined} /></Card>
        ) : (
          <Card>
            <p className="border-b border-line px-4 py-3 text-sm text-muted">{meta.total} room{meta.total === 1 ? "" : "s"}</p>
            <ul className="divide-y divide-line">
              {items.map((r) => {
                const s = STATUS[r.status] ?? { label: r.status, tone: "neutral" as Tone };
                return (
                  <li key={r.id} className="grid items-center gap-2 p-4 sm:grid-cols-[6rem_1fr_9rem_8rem_auto]">
                    <p className="font-display text-xl font-extrabold">{r.roomNumber}</p>
                    <p className="text-muted">{r.roomTypeName}{r.floor !== undefined ? ` · Floor ${r.floor}` : ""}</p>
                    <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                    <p className="text-sm text-muted">{r.isActive ? "In service" : "Retired"}</p>
                    {can(me, "rooms.update") && <Button variant="secondary" size="sm" icon={<Pencil className="size-4" aria-hidden="true" />} onClick={() => setEditing(r)} aria-label={`Edit room ${r.roomNumber}`}>Edit</Button>}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </QueryBoundary>
      {editing && <RoomDialog key={editing === "new" ? "new" : editing.id} existing={editing === "new" ? null : editing} types={types.data?.items ?? []} onClose={() => setEditing(null)} />}
    </AdminPage>
  );
}

function RoomDialog({ existing, types, onClose }: { existing: RoomAdmin | null; types: Array<{ id: string; name: string }>; onClose: () => void }) {
  const { me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { roomNumber: existing?.roomNumber ?? "", roomTypeId: existing?.roomTypeId ?? types[0]?.id ?? "", floor: existing?.floor !== undefined ? String(existing.floor) : "", status: existing?.status ?? "AVAILABLE", isActive: existing?.isActive ?? true } });
  const done = (msg: string) => { toast(msg); void qc.invalidateQueries({ queryKey: ["admin", "rooms"] }); void qc.invalidateQueries({ queryKey: ["admin", "room-types"] }); onClose(); };

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = { roomNumber: v.roomNumber.trim(), roomTypeId: v.roomTypeId, status: v.status, isActive: v.isActive, ...(v.floor !== "" ? { floor: Number(v.floor) } : existing ? { floor: null } : {}) };
      return existing ? adminApi.updateRoom(existing.id, body) : adminApi.createRoom(body);
    },
    onSuccess: () => done(existing ? "Room saved." : "Room added."),
    onError: (e) => { for (const [k, m] of Object.entries(fieldErrors(e))) form.setError(k as keyof Values, { message: m }); },
  });
  const remove = useMutation({ mutationFn: () => adminApi.deleteRoom(existing!.id), onSuccess: () => done("Room deleted.") });
  const errors = form.formState.errors;

  return (
    <Dialog open title={existing ? `Edit room ${existing.roomNumber}` : "Add room"} size="md" onClose={onClose}
      footer={<>
        {existing && can(me, "rooms.delete") && <Button variant="danger" size="sm" className="mr-auto" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm(true)}>Delete</Button>}
        <Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="room-form" loading={save.isPending}>{existing ? "Save changes" : "Add room"}</Button>
      </>}>
      <form id="room-form" noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-5">
        <FormError error={save.error && Object.keys(fieldErrors(save.error)).length === 0 ? save.error : null} />
        {confirm && <div role="alertdialog" aria-label="Confirm delete" className="grid gap-3 rounded-lg border border-danger-700/30 bg-danger-50 p-4"><p className="font-bold text-danger-700">Delete room {existing?.roomNumber}?</p><FormError error={remove.error} /><div className="flex gap-2"><Button type="button" variant="danger" size="sm" loading={remove.isPending} onClick={() => remove.mutate()}>Yes, delete</Button><Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(false)}>Keep it</Button></div></div>}
        <Input label="Room number" required error={errors.roomNumber?.message} {...form.register("roomNumber")} />
        <Select label="Room type" required error={errors.roomTypeId?.message} {...form.register("roomTypeId")}><option value="">Choose…</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Floor" inputMode="numeric" error={errors.floor?.message} {...form.register("floor")} />
          <Select label="Status" {...form.register("status")}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select>
        </div>
        <Toggle label="In service" description="Turn off to retire a room without deleting its history." {...form.register("isActive")} />
      </form>
    </Dialog>
  );
}
