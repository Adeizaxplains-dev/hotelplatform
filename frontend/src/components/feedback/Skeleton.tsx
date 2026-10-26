import { cn } from "@/lib/cn";

/** Placeholder block while data loads. Decorative: hidden from assistive tech. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("rounded-md bg-neutral-100 motion-safe:animate-pulse", className)} />;
}
