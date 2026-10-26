import { cn } from "@/lib/cn";
import type { PublicImage } from "@/types/site";
import { HOTEL_PHOTOS, isLegacyDemoArtwork, photoForLabel } from "../photoDefaults";

interface Props {
  image: PublicImage;
  /** Tells the browser how wide the image will be so it downloads the right size. */
  sizes?: string;
  /** Use for the first image on screen (hero): loads at once with high priority. Everything else lazy-loads. */
  priority?: boolean;
  className?: string;
  alt?: string;
}

/** Responsive image with intrinsic dimensions, lazy loading, and a safe photographic fallback. */
export function Img({ image, sizes = "100vw", priority = false, className, alt }: Props) {
  const legacyArtwork = isLegacyDemoArtwork(image);
  const effectiveImage = legacyArtwork ? photoForLabel(alt ?? image.alt) : image;
  const fallback = HOTEL_PHOTOS.find((photo) => photo.url !== effectiveImage.url) ?? photoForLabel(alt ?? image.alt);
  return (
    <img
      src={effectiveImage.url}
      onError={(event) => {
        const target = event.currentTarget;
        if (target.dataset.fallbackApplied === "true") return;
        target.dataset.fallbackApplied = "true";
        target.src = fallback.url;
        target.removeAttribute("srcset");
      }}
      {...(effectiveImage.srcSet ? { srcSet: effectiveImage.srcSet } : {})}
      sizes={sizes}
      width={effectiveImage.width}
      height={effectiveImage.height}
      alt={legacyArtwork ? effectiveImage.alt : (alt ?? image.alt)}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      {...(priority ? { fetchPriority: "high" as const } : {})}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}

/** Real-photo fallback for hotels that have not uploaded their own property photography yet. */
export function HotelPhoto({ image, label, index = 0, sizes = "100vw", priority = false, className }: {
  image?: PublicImage | null;
  label?: string;
  index?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  const selected = image ?? photoForLabel(label, index);
  return <Img image={selected} alt={image?.alt ?? label ?? selected.alt} sizes={sizes} priority={priority} className={className} />;
}

/** Kept as a compatibility wrapper; missing room photos now use real representative photography. */
export function Placeholder({ label, className }: { label?: string; className?: string }) {
  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-brand-soft", className)} role="img" aria-label={label ? `${label} representative photo` : "Representative hotel photo"}>
      <HotelPhoto label={label} className="absolute inset-0" />
      <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">Representative image</span>
    </div>
  );
}
