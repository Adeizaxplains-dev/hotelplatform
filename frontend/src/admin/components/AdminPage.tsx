import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Alert } from "@/components/feedback/Alert";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/feedback/Skeleton";
import { describeError } from "@/lib/errors";

export function AdminPage({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>{description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Loading skeleton, friendly error with retry, or the content: the three states every list needs. */
export function QueryBoundary<T>({ query, what, children }: { query: UseQueryResult<T>; what: string; children: (data: T) => ReactNode }) {
  if (query.isPending) return <div className="grid gap-3" aria-busy="true" aria-label={`Loading ${what}`}><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-2/3" /></div>;
  if (query.isError) return <div className="rounded-lg border border-line bg-surface"><ErrorState description={`We couldn't load ${what}. Please try again.`} onRetry={() => void query.refetch()} retrying={query.isFetching} /></div>;
  return <>{children(query.data)}</>;
}

export const FormError = ({ error }: { error: unknown }) => (error ? <Alert tone="danger" title="That didn't work">{describeError(error)}</Alert> : null);
