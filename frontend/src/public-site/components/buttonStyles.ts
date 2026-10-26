import { cn } from "@/lib/cn";

const base = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 font-semibold transition-colors";
export const btnPrimary = cn(base, "bg-brand text-on-brand hover:bg-brand-hover");
export const btnLight = cn(base, "bg-white text-ink hover:bg-white/90");
export const btnGhostLight = cn(base, "border border-white/70 text-white hover:bg-white/15");
export const btnOutline = cn(base, "border border-ink/25 text-ink hover:bg-ink/5");
