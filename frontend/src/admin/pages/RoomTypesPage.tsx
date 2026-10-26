import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BedDouble, Pencil, Plus, Trash2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useToast } from "@/components/feedback/Toast";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { FormSection, Textarea, Toggle } from "@/components/ui/Fields";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/features/auth/AuthContext";
import { fieldErrors } from "@/lib/errors";
import { formatMoney } from "@/lib/format";
import { koboToNaira, nairaToKobo } from "@/lib/money";
import { can } from "@/permissions";
import { adminApi, type RoomTypeAdmin } from "@/services/adminApi";
import { AdminPage, FormError, QueryBoundary } from "../components/AdminPage";
import { ImagePicker } from "../components/ImagePicker";

const whole = (min: number, max: number, what: string) => z.string().regex(/^\d+$/, `Enter a whole number for ${what}.`).refine((v) => Number(v) >= min && Number(v) <= max, `${what} must be between ${min} and ${max}.`);

const schema = z.object({
  name: z.string().trim().min(1, "Enter a name for this room type.").max(80),
  shortDescription: z.string().max(200),
  description: z.string().max(3000),
  maxAdults: whole(1, 20, "adults"),
  maxChildren: whole(0, 10, "children"),
  bedConfig: z.string().max(80),
  sizeSqm: z.string().refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 5 && Number(v) <= 2000), "Size must be between 5 and 2000 m²."),
  price: z.string().refine((v) => nairaToKobo(v) !== null, "Enter a price like 85000 or 85000.50."),
  amenityKeys: z.array(z.string()),
  imageAssetIds: z.array(z.string()).max(12),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

const blank: Values = { name: "", shortDescription: "", description: "", maxAdults: "2", maxChildren: "0", bedConfig: "", sizeSqm: "", price: "", amenityKeys: [], imageAssetIds: [], isFeatured: false, isActive: true };
const fromType = (t: RoomTypeAdmin): Values => ({
  name: t.name, shortDescription: t.shortDescription ?? "", description: t.description ?? "", maxAdults: String(t.maxAdults), maxChildren: String(t.maxChildren),
  bedConfig: t.bedConfig ?? "", sizeSqm: t.sizeSqm ? String(t.sizeSqm) : "", price: koboToNaira(t.basePrice), amenityKeys: t.amenityKeys, imageAssetIds: t.images.map((i) => i.assetId), isFeatured: t.isFeatured, isActive: t.isActive,
});

export default function RoomTypesPage() {
  const { me } = useAuth();
  const [editing, setEditing] = useState<RoomTypeAdmin | "new" | null>(null);
  const q = useQuery({ queryKey: ["admin", "room-types"], queryFn: () => adminApi.roomTypes() });
  const canCreate = can(me, "rooms.create");

  return (
    <AdminPage title="Room types" description="The kinds of room you offer: price, photos and what's included. Individual rooms are added under Rooms." action={canCreate && <Button icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setEditing("new")}>Add room type</Button>}>
      <QueryBoundary query={q} what="your room types">
        {({ items }) => items.length === 0 ? (
          <Card><EmptyState icon={BedDouble} title="No room types yet" description="Add your first room type, such as Standard or Deluxe. It appears on your website as soon as it's visible." action={canCreate ? <Button icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setEditing("new")}>Add room type</Button> : undefined} /></Card>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {items.map((t) => (
                <li key={t.id} className="grid items-center gap-3 p-4 md:grid-cols-[4rem_1fr_9rem_7rem_8rem_auto]">
                  <div className="size-16 overflow-hidden rounded-md bg-neutral-100">{t.images[0] ? <img src={t.images[0].url} alt="" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-muted"><BedDouble className="size-6" aria-hidden="true" /></div>}</div>
                  <div className="min-w-0"><p className="truncate font-bold">{t.name}</p><p className="truncate text-sm text-muted">/rooms/{t.slug}</p></div>
                  <p className="font-semibold">{formatMoney(t.basePrice, "NGN")}<span className="text-sm font-normal text-muted"> / night</span></p>
                  <p className="text-sm text-muted">{t.maxAdults + t.maxChildren} guests · {t.roomCount ?? 0} room{t.roomCount === 1 ? "" : "s"}</p>
                  <div className="flex flex-wrap gap-1.5"><StatusBadge tone={t.isActive ? "success" : "neutral"}>{t.isActive ? "Visible" : "Hidden"}</StatusBadge>{t.isFeatured && <StatusBadge tone="info">Featured</StatusBadge>}</div>
                  {can(me, "rooms.update") && <Button variant="secondary" size="sm" icon={<Pencil className="size-4" aria-hidden="true" />} onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`}>Edit</Button>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </QueryBoundary>
      {editing && <RoomTypeDialog key={editing === "new" ? "new" : editing.id} existing={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </AdminPage>
  );
}

function RoomTypeDialog({ existing, onClose }: { existing: RoomTypeAdmin | null; onClose: () => void }) {
  const { me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const amenities = useQuery({ queryKey: ["admin", "amenities"], queryFn: adminApi.amenities, staleTime: Infinity });
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: existing ? fromType(existing) : blank });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = {
        name: v.name.trim(), maxAdults: Number(v.maxAdults), maxChildren: Number(v.maxChildren), basePrice: nairaToKobo(v.price)!,
        amenityKeys: v.amenityKeys, imageAssetIds: v.imageAssetIds, isFeatured: v.isFeatured, isActive: v.isActive,
        ...(existing
          ? { shortDescription: v.shortDescription.trim() || null, description: v.description.trim() || null, bedConfig: v.bedConfig.trim() || null, sizeSqm: v.sizeSqm ? Number(v.sizeSqm) : null }
          : { ...(v.shortDescription.trim() ? { shortDescription: v.shortDescription.trim() } : {}), ...(v.description.trim() ? { description: v.description.trim() } : {}), ...(v.bedConfig.trim() ? { bedConfig: v.bedConfig.trim() } : {}), ...(v.sizeSqm ? { sizeSqm: Number(v.sizeSqm) } : {}) }),
      };
      return existing ? adminApi.updateRoomType(existing.id, body as never) : adminApi.createRoomType(body as never);
    },
    onSuccess: () => { toast(existing ? "Room type saved." : "Room type added."); void qc.invalidateQueries({ queryKey: ["admin", "room-types"] }); onClose(); },
    onError: (e) => { for (const [k, m] of Object.entries(fieldErrors(e))) form.setError(k as keyof Values, { message: m }); },
  });
  const remove = useMutation({
    mutationFn: () => adminApi.deleteRoomType(existing!.id),
    onSuccess: () => { toast("Room type deleted."); void qc.invalidateQueries({ queryKey: ["admin", "room-types"] }); onClose(); },
  });

  const errors = form.formState.errors;
  const grouped = new Map<string, NonNullable<typeof amenities.data>>();
  for (const a of amenities.data ?? []) grouped.set(a.group, [...(grouped.get(a.group) ?? []), a]);

  return (
    <Dialog open title={existing ? `Edit ${existing.name}` : "Add room type"} onClose={onClose} size="xl"
      footer={<>
        {existing && can(me, "rooms.delete") && <Button variant="danger" size="sm" className="mr-auto" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirmDelete(true)}>Delete</Button>}
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="room-type-form" loading={save.isPending}>{existing ? "Save changes" : "Add room type"}</Button>
      </>}>
      <form id="room-type-form" noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-6">
        <FormError error={save.error && Object.keys(fieldErrors(save.error)).length === 0 ? save.error : null} />
        {confirmDelete && (
          <div role="alertdialog" aria-label="Confirm delete" className="grid gap-3 rounded-lg border border-danger-700/30 bg-danger-50 p-4">
            <p className="font-bold text-danger-700">Delete "{existing?.name}"?</p>
            <p className="text-sm text-danger-700">This removes it from your website. Rooms using it must be moved or removed first. To keep it but hide it, turn off "Visible on website" instead.</p>
            <FormError error={remove.error} />
            <div className="flex gap-2"><Button type="button" variant="danger" size="sm" loading={remove.isPending} onClick={() => remove.mutate()}>Yes, delete</Button><Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Keep it</Button></div>
          </div>
        )}
        <FormSection title="Basics">
          <Input label="Name" required error={errors.name?.message} {...form.register("name")} />
          <Input label="Short description" hint="One line shown on room cards." error={errors.shortDescription?.message} {...form.register("shortDescription")} />
          <Textarea label="Description" hint="Plain text. Leave a blank line between paragraphs." error={errors.description?.message} {...form.register("description")} />
        </FormSection>
        <FormSection title="Capacity and price">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Adults" inputMode="numeric" required error={errors.maxAdults?.message} {...form.register("maxAdults")} />
            <Input label="Children" inputMode="numeric" error={errors.maxChildren?.message} {...form.register("maxChildren")} />
            <Input label="Size (m²)" inputMode="numeric" error={errors.sizeSqm?.message} {...form.register("sizeSqm")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Bed" hint="For example 1 King bed" error={errors.bedConfig?.message} {...form.register("bedConfig")} />
            <Input label="Price per night (₦)" inputMode="decimal" required hint="Naira. You can include kobo, e.g. 85000.50" error={errors.price?.message} {...form.register("price")} />
          </div>
        </FormSection>
        <FormSection title="Photos" description="The first photo is the cover.">
          <Controller control={form.control} name="imageAssetIds" render={({ field }) => <ImagePicker label="Room photos" value={field.value} onChange={field.onChange} max={12} />} />
        </FormSection>
        <FormSection title="What's included">
          <Controller control={form.control} name="amenityKeys" render={({ field }) => (
            <div className="grid gap-4">
              {amenities.isPending && <p className="text-sm text-muted">Loading amenities…</p>}
              {[...grouped.entries()].map(([group, list]) => (
                <fieldset key={group}><legend className="text-sm font-semibold">{group}</legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {list.map((a) => (
                      <label key={a.key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-line px-3 hover:bg-neutral-100">
                        <input type="checkbox" className="size-4 accent-[var(--color-lagoon-600)]" checked={field.value.includes(a.key)} onChange={(e) => field.onChange(e.target.checked ? [...field.value, a.key] : field.value.filter((k) => k !== a.key))} />{a.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          )} />
        </FormSection>
        <FormSection title="Website">
          <Toggle label="Visible on website" description="Turn off to hide this room type without deleting it." {...form.register("isActive")} />
          <Toggle label="Featured on the home page" description="Featured rooms appear first." {...form.register("isFeatured")} />
        </FormSection>
      </form>
    </Dialog>
  );
}
