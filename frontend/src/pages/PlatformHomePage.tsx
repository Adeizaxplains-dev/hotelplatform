import { useQuery } from "@tanstack/react-query";
import { Building2, LogOut } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/feedback/Skeleton";
import { StatusBadge } from "@/components/ui/Badge";
import { Badge } from "@/components/ui/Badge";
import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useAuth } from "@/features/auth/AuthContext";
import { platformApi } from "@/services/platformApi";

/** Minimal operator view: real data from /platform/tenants. Management screens arrive later. */
export default function PlatformHomePage() {
  const { me, logout } = useAuth();
  const q = useQuery({ queryKey: ["platform", "tenants"], queryFn: platformApi.listTenants });

  return (
    <div className="min-h-dvh">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <BrandMark />
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" icon={<LogOut className="size-4" aria-hidden="true" />} onClick={() => void logout()}>Sign out</Button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="text-3xl font-extrabold">Platform</h1>
        <p className="mt-1 text-muted">Signed in as {me?.user.email}</p>
        <Card className="mt-8">
          <CardHeader title="Hotels" description="Every hotel on the platform." />
          {q.isPending ? (
            <div className="grid gap-3 p-5" aria-busy="true"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-6 w-2/3" /></div>
          ) : q.isError ? (
            <ErrorState description="We couldn't load the hotels." onRetry={() => void q.refetch()} retrying={q.isFetching} />
          ) : q.data.length === 0 ? (
            <EmptyState icon={Building2} title="No hotels yet" description="Hotels you create will appear here with their plan and status." />
          ) : (
            <ul className="divide-y divide-line">
              {q.data.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div><p className="font-bold">{t.name}</p><p className="text-sm text-muted">{t.slug}</p></div>
                  <div className="flex items-center gap-2"><Badge>{t.plan}</Badge><StatusBadge tone={t.status === "ACTIVE" ? "success" : "warning"}>{t.status === "ACTIVE" ? "Active" : "Suspended"}</StatusBadge></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
