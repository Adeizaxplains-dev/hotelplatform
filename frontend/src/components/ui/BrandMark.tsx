import { cn } from "@/lib/cn";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-extrabold tracking-tight", className)}>
      <svg viewBox="0 0 64 64" className="size-8" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#0F2230" />
        <circle cx="24" cy="32" r="9" fill="none" stroke="#D9A441" strokeWidth="5" />
        <path d="M33 32h20M46 32v9M53 32v6" stroke="#D9A441" strokeWidth="5" strokeLinecap="round" />
      </svg>
      Hotel Platform
    </span>
  );
}
