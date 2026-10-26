import { useQuery } from "@tanstack/react-query";
import { Images } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/feedback/Skeleton";
import { cn } from "@/lib/cn";
import { publicApi } from "@/services/publicApi";
import { Img } from "../components/Img";
import { Lightbox } from "../components/Lightbox";
import { Seo } from "../components/Seo";
import { Container } from "../components/Section";
import { useSite } from "../SiteContext";
import { SAMPLE_GALLERY } from "../photoDefaults";

const LABELS: Record<string, string> = { rooms: "Rooms", dining: "Dining", exterior: "Exterior", facilities: "Facilities", events: "Events", other: "More" };

export default function GalleryPage() {
  const { hotel, content } = useSite();
  const [category, setCategory] = useState<string | undefined>();
  const [viewer, setViewer] = useState<number | null>(null);
  const all = useQuery({ queryKey: ["public", "gallery", "all"], queryFn: () => publicApi.gallery(), staleTime: 30_000 });
  const galleryItems = (all.data?.length ?? 0) > 0 ? all.data! : SAMPLE_GALLERY;
  const shown = category ? galleryItems.filter((g) => g.category === category) : galleryItems;
  const categories = [...new Set(galleryItems.map((g) => g.category))];
  const seo = content.pageSeo.gallery;

  return (
    <Container className="py-14 sm:py-20">
      <Seo page="Gallery" titleOverride={seo?.title} description={seo?.description ?? `Photos of ${hotel.name}.`} path="/gallery" />
      <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">Gallery</h1>
      {categories.length > 1 && (
        <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter photos">
          {[undefined, ...categories].map((c) => (
            <button key={c ?? "all"} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={cn("min-h-11 rounded-full border px-5 font-semibold", category === c ? "border-brand bg-brand text-on-brand" : "border-ink/20 hover:bg-ink/5")}>{c ? (LABELS[c] ?? c) : "All"}</button>
          ))}
        </div>
      )}
      <div className="mt-10">
        {all.isPending ? <Skeleton className="h-72 w-full" /> : all.isError ? <ErrorState description="We couldn't load the gallery. Please try again." onRetry={() => void all.refetch()} retrying={all.isFetching} /> : shown.length === 0 ? (
          <EmptyState icon={Images} title="No photos in this category" description="Try another gallery category." />
        ) : (
          <>
            {(!all.data || all.data.length === 0) && <p className="mb-6 text-sm text-muted">Representative hotel photography. Upload your own property's photos in Website settings to replace these samples.</p>}
            <ul className="columns-2 gap-3 sm:gap-4 lg:columns-3">
              {shown.map((g, i) => (
                <li key={`${g.image.url}-${i}`} className="mb-3 break-inside-avoid sm:mb-4">
                  <button type="button" onClick={() => setViewer(i)} className="group block w-full overflow-hidden rounded-2xl" aria-label={`Open photo: ${g.caption ?? g.image.alt ?? `photo ${i + 1}`}`}>
                    <div style={{ aspectRatio: `${g.image.width} / ${g.image.height}` }}><Img image={g.image} sizes="(min-width: 1024px) 360px, 50vw" alt={g.caption ?? g.image.alt} className="transition-transform duration-700 motion-safe:group-hover:scale-105" /></div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {viewer !== null && <Lightbox images={shown.map((g) => ({ image: g.image, caption: g.caption }))} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />}
    </Container>
  );
}
