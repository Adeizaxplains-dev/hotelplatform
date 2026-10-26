import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** An empty screen is an invitation to act: say what will appear here and offer the next step. */
export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-lagoon-50 text-lagoon-600">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      <p className="mt-1 max-w-md text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
