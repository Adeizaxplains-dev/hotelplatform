import { AlertTriangle, CheckCircle2, CircleDashed, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-neutral-100 text-neutral-700",
  info: "bg-info-50 text-info-700",
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
};
const icons = { neutral: CircleDashed, info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle } as const;

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold", tones[tone], className)}>{children}</span>;
}

/**
 * Status chip: always an icon plus a text label, so meaning never depends on colour alone.
 * Domain statuses (reservation, room, payment) map onto these tones in later phases.
 */
export function StatusBadge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  const Icon = icons[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", tones[tone], className)}>
      <Icon className="size-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}
