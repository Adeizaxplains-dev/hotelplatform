import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useToast } from "@/components/feedback/Toast";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea, Toggle } from "@/components/ui/Fields";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/features/auth/AuthContext";
import { fieldErrors } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { can } from "@/permissions";
import { NamedIcon } from "@/public-site/icons";
import { adminApi, type FacilityAdmin } from "@/services/adminApi";
import { AdminPage, FormError, QueryBoundary } from "../components/AdminPage";
import { ImagePicker } from "../components/ImagePicker";

const schema = z.object({ name: z.string().trim().min(1, "Enter a name.").max(80), description: z.string().max(600), icon: z.string().min(1), imageAssetIds: z.array(z.string()).max(1), isActive: z.boolean() });
type Values = z.infer<typeof schema>;

export default function FacilitiesPage() {
  const { me } = useAuth();
  const [editing, setEditing] = useState<FacilityAdmin | "new" | null>(null);
  const q = useQuery({ queryKey: ["admin", "facilities"], queryFn: adminApi.facilities });
  const canEdit = can(me, "cms.update");
  return (
    <AdminPage title="Facilities" description="Pool, restaurant, gym, parking: what guests can enjoy on site." action={canEdit && <Button icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setEditing("new")}>Add facility</Button>}>
      <QueryBoundary query={q} what="your facilities">
        {(items) => items.length === 0 ? (
          <Card><EmptyState icon={Sparkles} title="No facilities yet" description="List what your hotel offers. Each facility appears on your website with its icon and description." action={canEdit ? <Button icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => setEditing("new")}>Add facility</Button> : undefined} /></Card>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {items.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-4 p-4">
                  <span className="grid size-11 place-items-center rounded-full bg-lagoon-50 text-lagoon-700"><NamedIcon name={f.icon} className="size-5" /></span>
                  <div className="min-w-0 flex-1"><p className="font-bold">{f.name}</p>{f.description && <p className="truncate text-sm text-muted">{f.description}</p>}</div>
                  <StatusBadge tone={f.isActive ? "success" : "neutral"}>{f.isActive ? "Visible" : "Hidden"}</StatusBadge>
                  {canEdit && <Button variant="secondary" size="sm" icon={<Pencil className="size-4" aria-hidden="true" />} onClick={() => setEditing(f)} aria-label={`Edit ${f.name}`}>Edit</Button>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </QueryBoundary>
      {editing && <FacilityDialog key={editing === "new" ? "new" : editing.id} existing={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </AdminPage>
  );
}

function FacilityDialog({ existing, onClose }: { existing: FacilityAdmin | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const icons = useQuery({ queryKey: ["admin", "icons"], queryFn: adminApi.icons, staleTime: Infinity });
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: existing?.name ?? "", description: existing?.description ?? "", icon: existing?.icon ?? "Sparkles", imageAssetIds: existing?.imageAssetId ? [existing.imageAssetId] : [], isActive: existing?.isActive ?? true } });
  const done = (m: string) => { toast(m); void qc.invalidateQueries({ queryKey: ["admin", "facilities"] }); onClose(); };
  const save = useMutation({
    mutationFn: (v: Values) => {
      const body = { name: v.name.trim(), icon: v.icon, isActive: v.isActive, ...(existing ? { description: v.description.trim() || null, imageAssetId: v.imageAssetIds[0] ?? null } : { ...(v.description.trim() ? { description: v.description.trim() } : {}), ...(v.imageAssetIds[0] ? { imageAssetId: v.imageAssetIds[0] } : {}) }) };
      return existing ? adminApi.updateFacility(existing.id, body) : adminApi.createFacility(body);
    },
    onSuccess: () => done(existing ? "Facility saved." : "Facility added."),
    onError: (e) => { for (const [k, m] of Object.entries(fieldErrors(e))) form.setError(k as keyof Values, { message: m }); },
  });
  const remove = useMutation({ mutationFn: () => adminApi.deleteFacility(existing!.id), onSuccess: () => done("Facility deleted.") });
  const errors = form.formState.errors;

  return (
    <Dialog open title={existing ? `Edit ${existing.name}` : "Add facility"} size="lg" onClose={onClose}
      footer={<>
        {existing && <Button variant="danger" size="sm" className="mr-auto" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm(true)}>Delete</Button>}
        <Button variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" form="facility-form" loading={save.isPending}>{existing ? "Save changes" : "Add facility"}</Button>
      </>}>
      <form id="facility-form" noValidate onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-5">
        <FormError error={save.error && Object.keys(fieldErrors(save.error)).length === 0 ? save.error : null} />
        {confirm && <div role="alertdialog" aria-label="Confirm delete" className="grid gap-3 rounded-lg border border-danger-700/30 bg-danger-50 p-4"><p className="font-bold text-danger-700">Delete "{existing?.name}"?</p><FormError error={remove.error} /><div className="flex gap-2"><Button type="button" variant="danger" size="sm" loading={remove.isPending} onClick={() => remove.mutate()}>Yes, delete</Button><Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(false)}>Keep it</Button></div></div>}
        <Input label="Name" required error={errors.name?.message} {...form.register("name")} />
        <Textarea label="Description" error={errors.description?.message} {...form.register("description")} />
        <Controller control={form.control} name="icon" render={({ field }) => (
          <fieldset><legend className="text-sm font-semibold">Icon</legend>
            <div className="mt-2 grid grid-cols-6 gap-2 sm:grid-cols-8" role="radiogroup" aria-label="Icon">
              {(icons.data ?? []).map((name) => (
                <button key={name} type="button" role="radio" aria-checked={field.value === name} aria-label={name} onClick={() => field.onChange(name)} className={cn("grid size-11 place-items-center rounded-md border", field.value === name ? "border-lagoon-600 bg-lagoon-50 text-lagoon-700" : "border-line hover:bg-neutral-100")}><NamedIcon name={name} className="size-5" /></button>
              ))}
            </div>
          </fieldset>
        )} />
        <Controller control={form.control} name="imageAssetIds" render={({ field }) => <ImagePicker label="Photo (optional)" value={field.value} onChange={field.onChange} max={1} />} />
        <Toggle label="Visible on website" {...form.register("isActive")} />
      </form>
    </Dialog>
  );
}
