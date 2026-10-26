import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/components/ui/Badge";

const styles: Record<Exclude<Tone, "neutral">, string> = {
  info: "border-info-700/30 bg-info-50 text-info-700",
  success: "border-success-700/30 bg-success-50 text-success-700",
  warning: "border-warning-700/30 bg-warning-50 text-warning-700",
  danger: "border-danger-700/30 bg-danger-50 text-danger-700",
};
const icons = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle } as const;

export function Alert({ tone = "info", title, children, className }: { tone?: Exclude<Tone, "neutral">; title: string; children?: ReactNode; className?: string }) {
  const Icon = icons[tone];
  return (
    <div role={tone === "danger" || tone === "warning" ? "alert" : "status"} className={cn("flex gap-3 rounded-md border p-4", styles[tone], className)}>
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-bold">{title}</p>
        {children && <div className="mt-1 text-sm">{children}</div>}
      </div>
    </div>
  );
}
