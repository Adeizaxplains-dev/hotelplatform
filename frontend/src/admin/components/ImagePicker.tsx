import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Images, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { describeError } from "@/lib/errors";
import { adminApi, type MediaItem } from "@/services/adminApi";
import { checkImageFile } from "../imageRules";

interface Props {
  label: string;
  value: string[];
  onChange: (ids: string[]) => void;
  max?: number;
  hint?: string;
}

/** Choose images for a room, page or logo: upload new ones or pick from the hotel's library. */
export function ImagePicker({ label, value, onChange, max = 1, hint }: Props) {
  const id = useId();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const library = useQuery({ queryKey: ["admin", "media"], queryFn: adminApi.media, staleTime: 15_000 });
  const items: MediaItem[] = library.data?.items ?? [];
  const byId = new Map(items.map((m) => [m.id, m]));

  const upload = useMutation({
    mutationFn: (file: File) => adminApi.upload(file),
    onSuccess: (asset) => {
      setProblem(null);
      void qc.invalidateQueries({ queryKey: ["admin", "media"] });
      onChange(max === 1 ? [asset.id] : [...value, asset.id].slice(0, max));
    },
    onError: (e) => setProblem(describeError(e)),
  });

  const add = (assetId: string) => {
    if (value.includes(assetId)) return;
    onChange(max === 1 ? [assetId] : [...value, assetId].slice(0, max));
  };
  const full = max > 1 && value.length >= max;

  return (
    <div className="grid gap-2">
      <p id={id} className="text-sm font-semibold">{label}</p>
      {hint && <p className="text-sm text-muted">{hint}</p>}

      {value.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-labelledby={id}>
          {value.map((assetId, i) => {
            const m = byId.get(assetId);
            return (
              <li key={assetId} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-neutral-100">
                {m ? <img src={m.url} alt={m.alt || `Selected image ${i + 1}`} className="size-full object-cover" /> : <div className="grid size-full place-items-center text-xs text-muted">Image</div>}
                {max > 1 && i === 0 && <span className="absolute left-1 top-1 rounded bg-ink px-1.5 py-0.5 text-xs font-bold text-white">Cover</span>}
                <button type="button" onClick={() => onChange(value.filter((v) => v !== assetId))} aria-label={`Remove image ${i + 1}`} className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-white/95 text-danger-700 shadow hover:bg-white"><Trash2 className="size-4" aria-hidden="true" /></button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`${label}: choose a file to upload`} onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          const msg = checkImageFile(file);
          if (msg) return setProblem(msg);
          setProblem(null);
          upload.mutate(file);
        }} />
        <Button variant="secondary" size="sm" icon={<ImagePlus className="size-4" aria-hidden="true" />} loading={upload.isPending} disabled={full} onClick={() => input.current?.click()}>Upload image</Button>
        <Button variant="secondary" size="sm" icon={<Images className="size-4" aria-hidden="true" />} aria-expanded={showLibrary} onClick={() => setShowLibrary((s) => !s)}>{showLibrary ? "Hide library" : "Choose from library"}</Button>
      </div>
      {problem && <p role="alert" className="text-sm font-medium text-danger-700">{problem}</p>}

      {showLibrary && (
        <div className="rounded-lg border border-line p-3">
          {library.isPending ? <p className="text-sm text-muted">Loading your images…</p> : items.length === 0 ? <p className="text-sm text-muted">No images uploaded yet.</p> : (
            <ul className="grid max-h-56 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
              {items.map((m, i) => (
                <li key={m.id}>
                  <button type="button" onClick={() => add(m.id)} disabled={value.includes(m.id) || full} aria-label={`Use image ${m.alt || i + 1}`} className="block aspect-square w-full overflow-hidden rounded-md border border-line disabled:opacity-40">
                    <img src={m.url} alt="" className="size-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
