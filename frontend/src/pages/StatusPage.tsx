import { RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert } from "@/components/feedback/Alert";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/feedback/Skeleton";
import { BrandMark } from "@/components/ui/BrandMark";
import { StatusBadge, type Tone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useHealth, type SystemState } from "@/hooks/useHealth";
import { API_BASE_URL } from "@/services/apiClient";

function rows(state: SystemState): Array<{ label: string; tone: Tone; text: string }> {
  switch (state.kind) {
    case "operational":
      return [
        { label: "API", tone: "success", text: "Operational" },
        { label: "Database", tone: "success", text: "Connected" },
      ];
    case "database-down":
      return [
        { label: "API", tone: "success", text: "Operational" },
        { label: "Database", tone: "danger", text: "Unreachable" },
      ];
    case "unreachable":
      return [
        { label: "API", tone: "danger", text: "Unreachable" },
        { label: "Database", tone: "neutral", text: "Unknown" },
      ];
  }
}

export default function StatusPage() {
  const { data, error, isPending, isFetching, refetch, dataUpdatedAt } = useHealth();

  return (
    <div className="min-h-dvh">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <BrandMark />
          <span className="text-sm text-white/80">Foundation build</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="text-3xl font-extrabold">System status</h1>
        <p className="mt-2 max-w-xl text-muted">Live check of the API and its database. This page is for operators; hotel websites and dashboards arrive in later phases.</p>

        <Card className="mt-8">
          <CardHeader
            title="Platform health"
            description={dataUpdatedAt ? `Last checked ${new Date(dataUpdatedAt).toLocaleTimeString()}` : "Checking…"}
            action={
              <Button variant="secondary" size="sm" icon={<RefreshCw className="size-4" aria-hidden="true" />} loading={isFetching && !isPending} onClick={() => void refetch()}>
                Check again
              </Button>
            }
          />

          {isPending ? (
            <div className="grid gap-4 p-5" aria-busy="true" aria-label="Checking system status">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-6 w-1/4" />
            </div>
          ) : error ? (
            <ErrorState description="We couldn't read the system status. Please try again." onRetry={() => void refetch()} retrying={isFetching} />
          ) : data ? (
            <div className="p-5">
              {data.kind === "unreachable" && (
                <Alert tone="danger" title="The API is not reachable" className="mb-5">
                  Start the backend (<code className="font-mono">npm run dev</code> in <code className="font-mono">backend</code>) or check <code className="font-mono">VITE_API_URL</code>.
                </Alert>
              )}
              {data.kind === "database-down" && (
                <Alert tone="warning" title="The API is running but cannot reach MongoDB" className="mb-5">
                  Check <code className="font-mono">DATABASE_URL</code> and your Atlas network access list.
                </Alert>
              )}
              <dl className="divide-y divide-line">
                {rows(data).map((r) => (
                  <div key={r.label} className="flex items-center justify-between py-3">
                    <dt className="font-semibold">{r.label}</dt>
                    <dd><StatusBadge tone={r.tone}>{r.text}</StatusBadge></dd>
                  </div>
                ))}
                {data.kind === "operational" && (
                  <div className="flex items-center justify-between py-3">
                    <dt className="font-semibold">API version</dt>
                    <dd className="text-muted">{data.report.version}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between py-3">
                  <dt className="font-semibold">API address</dt>
                  <dd className="font-mono text-sm text-muted">{API_BASE_URL}</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </Card>

        {import.meta.env.DEV && (
          <p className="mt-6 text-sm text-muted">
            Developer tools: <Link className="font-semibold text-lagoon-600 underline underline-offset-2" to="/design-system">design system</Link>
          </p>
        )}
      </main>
    </div>
  );
}
