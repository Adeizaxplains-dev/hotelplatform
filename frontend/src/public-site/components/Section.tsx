import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const Container = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>{children}</div>
);

export function SectionHeading({ title, intro, action, className }: { title: string; intro?: string | null; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-2xl">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h2>
        {intro && <p className="mt-3 text-lg text-muted">{intro}</p>}
      </div>
      {action}
    </div>
  );
}
