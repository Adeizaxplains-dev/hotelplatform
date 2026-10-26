import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Images, Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Alert } from "@/components/feedback/Alert";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useToast } from "@/components/feedback/Toast";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Select, Toggle } from "@/components/ui/Fields";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/features/auth/AuthContext";
import { describeError } from "@/lib/errors";
import { can } from "@/permissions";
import { adminApi, type GalleryAdmin } from "@/services/adminApi";
import { AdminPage, FormError, QueryBoundary } from "../components/AdminPage";
import { checkImageFile } from "../imageRules";

const CATEGORIES: Array<[string, string]> = [["rooms", "Rooms"], ["dining", "Dining"], ["exterior", "Exterior"], ["facilities", "Facilities"], ["events", "Events"], ["other", "Other"]];

export default function GalleryPage() {
  const { me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState<GalleryAdmin | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const q = useQuery({ queryKey: ["admin", "gallery"], queryFn: adminApi.gallery });
  const canEdit = can(me, "cms.update");

  const addMany = useMutation({
    mutationFn: async (files: File[]) => {
      const failures: string[] = [];
      let added = 0;
      for (const file of files) {
        const bad = checkImageFile(file);
        if (bad) { failures.push(`${file.name}: ${bad}`); continue; }
        try {
          const asset = await adminApi.upload(file);
          await adminApi.addGallery({ assetId: asset.id });
          added += 1;
        } catch (e) { failures.push(`${file.name}: ${describeError(e)}`); }
      }
      return { added, failures };
    },
    onSuccess: ({ added, failures }) => { setProblems(failures); if (added) toast(`${added} photo${added === 1 ? "" : "s"} added.`); void qc.invalidateQueries({ queryKey: ["admin", "gallery"] }); void qc.invalidateQueries({ queryKey: ["admin", "media"] }); },
  });

  return (
    <AdminPage title="Gallery" description="Photos shown on your website's gallery and home page." action={canEdit && (
      <>
        <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Choose photos to upload" onChange={(e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; if (files.length) addMany.mutate(files); }} />
        <Button icon={<ImagePlus className="size-4" aria-hidden="true" />} loading={addMany.isPending} onClick={() => input.current?.click()}>Add photos</Button>
      </>
    )}>
      {problems.length > 0 && <Alert tone="warning" title="Some photos weren't added"><ul className="list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul></Alert>}
      <QueryBoundary query={q} what="your gallery">
        {({ items, meta }) => items.length === 0 ? (
          <Card><EmptyState icon={Images} title="No photos yet" description="Add photos of your rooms, dining area and grounds. JPG, PNG or WebP, up to 5 MB each." action={canEdit ? <Button icon={<ImagePlus className="size-4" aria-hidden="true" />} onClick={() => input.current?.click()}>Add photos</Button> : undefined} /></Card>
        ) : (
          <>
            <p className="text-sm text-muted">{meta.total} photo{meta.total === 1 ? "" : "s"}</p>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((g) => (
                <li key={g.id} className="overflow-hidden rounded-lg border border-line bg-surface">
                  <div className="aspect-[4/3] bg-neutral-100">{g.image && <img src={g.image.url} alt={g.caption ?? g.image.alt ?? ""} className="size-full object-cover" />}</div>
                  <div className="grid gap-2 p-3">
                    <p className="truncate text-sm font-semibold">{g.caption || "No caption"}</p>
                    <div className="flex items-center justify-between gap-2"><StatusBadge tone={g.isActive ? "success" : "neutral"}>{g.isActive ? "Visible" : "Hidden"}</StatusBadge>{canEdit && <Button variant="secondary" size="sm" icon={<Pencil className="size-4" aria-hidden="true" />} onClick={() => setEditing(g)} aria-label={`Edit photo ${g.caption ?? ""}`}>Edit</Button>}</div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </QueryBoundary>
      {editing && <GalleryDialog key={editing.id} item={editing} onClose={() => setEditing(null)} />}
    </AdminPage>
  );
}

function GalleryDialog({ item, onClose }: { item: GalleryAdmin; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [caption, setCaption] = useState(item.caption ?? "");
  const [category, setCategory] = useState(item.category);
  const [visible, setVisible] = useState(item.isActive);
  const [confirm, setConfirm] = useState(false);
  const done = (m: string) => { toast(m); void qc.invalidateQueries({ queryKey: ["admin", "gallery"] }); onClose(); };
  const save = useMutation({ mutationFn: () => adminApi.updateGallery(item.id, { caption: caption.trim() || null, category, isActive: visible }), onSuccess: () => done("Photo saved.") });
  const remove = useMutation({ mutationFn: () => adminApi.removeGallery(item.id), onSuccess: () => done("Photo removed.") });

  return (
    <Dialog open title="Edit photo" size="md" onClose={onClose}
      footer={<><Button variant="danger" size="sm" className="mr-auto" icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirm(true)}>Remove</Button><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button></>}>
      <div className="grid gap-5">
        {item.image && <img src={item.image.url} alt="" className="max-h-56 w-full rounded-lg object-cover" />}
        <FormError error={save.error} />
        {confirm && <div role="alertdialog" aria-label="Confirm remove" className="grid gap-3 rounded-lg border border-danger-700/30 bg-danger-50 p-4"><p className="font-bold text-danger-700">Remove this photo from the gallery?</p><p className="text-sm text-danger-700">The image stays in your library.</p><FormError error={remove.error} /><div className="flex gap-2"><Button variant="danger" size="sm" loading={remove.isPending} onClick={() => remove.mutate()}>Yes, remove</Button><Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>Keep it</Button></div></div>}
        <Input label="Caption" hint="Describes the photo for visitors and screen readers." value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={160} />
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
        <Toggle label="Visible on website" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
      </div>
    </Dialog>
  );
}
