import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import type { PublicImage } from "@/types/site";
import { Img } from "./Img";

interface Props {
  images: Array<{ image: PublicImage; caption?: string | null }>;
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}

/** Full-screen image viewer: Esc closes, arrow keys move, focus stays inside, background scroll is locked. */
export function Lightbox({ images, index, onIndex, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const prevFocus = useRef<Element | null>(null);
  const count = images.length;
  const go = useCallback((d: number) => onIndex((index + d + count) % count), [index, count, onIndex]);

  useEffect(() => {
    prevFocus.current = document.activeElement;
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      (prevFocus.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowLeft") go(-1);
    else if (e.key === "ArrowRight") go(1);
    else if (e.key === "Tab") {
      const focusable = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  };

  const current = images[index];
  if (!current) return null;
  const btn = "grid size-12 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/30";

  return (
    <div role="dialog" aria-modal="true" aria-label="Photo viewer" className="fixed inset-0 z-[70] flex flex-col bg-black/95 text-white" onKeyDown={onKeyDown} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex items-center justify-between p-4">
        <p className="text-sm text-white/80" aria-live="polite">Photo {index + 1} of {count}</p>
        <button ref={closeRef} type="button" onClick={onClose} className={btn} aria-label="Close photo viewer"><X className="size-5" aria-hidden="true" /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        {count > 1 && <button type="button" onClick={() => go(-1)} className={`${btn} absolute left-2 sm:left-4`} aria-label="Previous photo"><ChevronLeft className="size-6" aria-hidden="true" /></button>}
        <Img image={current.image} sizes="100vw" alt={current.image.alt || current.caption || ""} className="!h-auto !w-auto max-h-full max-w-full object-contain" />
        {count > 1 && <button type="button" onClick={() => go(1)} className={`${btn} absolute right-2 sm:right-4`} aria-label="Next photo"><ChevronRight className="size-6" aria-hidden="true" /></button>}
      </div>
      <p className="min-h-14 p-4 text-center text-white/90">{current.caption ?? ""}</p>
    </div>
  );
}
