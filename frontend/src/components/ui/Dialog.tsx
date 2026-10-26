import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface Props { open: boolean; title: string; description?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: "md" | "lg" | "xl" }

/**
 * Accessible modal: focus moves in and is trapped, Esc closes, focus returns to the opener, background scroll locks.
 * On phones it is a bottom sheet, on larger screens a centred panel.
 */
export function Dialog({ open, title, description, onClose, children, footer, size = "lg" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    opener.current = document.activeElement;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input, select, textarea, button:not([data-close])")?.focus();
    return () => {
      document.body.style.overflow = "";
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab") return;
    const f = Array.from(ref.current!.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null || el === document.activeElement);
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown} className={cn("flex max-h-[94dvh] w-full flex-col rounded-t-2xl bg-surface shadow-2xl sm:rounded-2xl", size === "md" && "sm:max-w-lg", size === "lg" && "sm:max-w-2xl", size === "xl" && "sm:max-w-4xl")}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div><h2 id={titleId} className="text-lg font-bold">{title}</h2>{description && <p className="mt-0.5 text-sm text-muted">{description}</p>}</div>
          <button type="button" data-close onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-md text-muted hover:bg-neutral-100"><X className="size-5" aria-hidden="true" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
