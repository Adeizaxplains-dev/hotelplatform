import type { ReactNode } from "react";
import { BrandMark } from "@/components/ui/BrandMark";
import { Skeleton } from "@/components/feedback/Skeleton";
import { useTenantInfo } from "@/hooks/useTenantInfo";

/** Two-panel sign-in frame: the hotel's identity on the left (desktop), the form on the right. */
export default function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const tenant = useTenantInfo();
  const name = tenant.kind === "hotel" ? tenant.info.name : tenant.kind === "platform" ? "Hotel Platform" : null;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-ink p-10 text-white lg:flex">
        <BrandMark />
        <div>
          {tenant.kind === "loading" ? <Skeleton className="h-10 w-2/3 bg-white/10" /> : <p className="text-4xl font-extrabold leading-tight">{name ?? "Welcome"}</p>}
          <p className="mt-3 max-w-sm text-white/75">{tenant.kind === "hotel" ? "Sign in to manage your stay or your hotel." : "Platform administration."}</p>
        </div>
        <p className="text-sm text-white/60">Secure sign-in. Your session is protected.</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><BrandMark className="text-ink" /></div>
          {tenant.kind === "hotel" && tenant.info.status === "SUSPENDED" ? (
            <div role="alert" className="rounded-lg border border-warning-700/30 bg-warning-50 p-5 text-warning-700">
              <p className="font-bold">This hotel's account is suspended</p>
              <p className="mt-1 text-sm">Sign-in is unavailable. Please contact the hotel directly.</p>
            </div>
          ) : tenant.kind === "unknown" ? (
            <div role="alert" className="rounded-lg border border-danger-700/30 bg-danger-50 p-5 text-danger-700">
              <p className="font-bold">We couldn't find this hotel</p>
              <p className="mt-1 text-sm">Check the address you were given and try again.</p>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-extrabold">{title}</h1>
              {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
              <div className="mt-8">{children}</div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
