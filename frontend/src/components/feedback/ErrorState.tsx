import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

/** Plain-language failure with a way forward. Technical detail belongs in server logs, not here. */
export function ErrorState({ title = "Something went wrong", description, onRetry, retrying, children }: { title?: string; description: string; onRetry?: () => void; retrying?: boolean; children?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-danger-50 text-danger-700">
        <TriangleAlert className="size-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      <p className="mt-1 max-w-md text-muted">{description}</p>
      {children}
      {onRetry && (
        <Button className="mt-5" variant="secondary" onClick={onRetry} loading={retrying ?? false}>
          Try again
        </Button>
      )}
    </div>
  );
}
