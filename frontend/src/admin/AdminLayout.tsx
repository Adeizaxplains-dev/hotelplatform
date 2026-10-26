import { ExternalLink, LogOut, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { BrandMark } from "@/components/ui/BrandMark";
import { ToastProvider } from "@/components/feedback/Toast";
import { cn } from "@/lib/cn";
import { useAuth } from "@/features/auth/AuthContext";
import { hasFeature } from "@/permissions";
import { visibleNav } from "./nav";

export default function AdminLayout() {
  const { me, logout } = useAuth();
  const { pathname } = useLocation();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const drawer = openOn === pathname;
  const first = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!drawer) return undefined;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  if (!me) return null;
  const items = visibleNav(me);
  const nav = (
    <nav aria-label="Admin" className="grid gap-1">
      {items.map((n, i) => (
        <NavLink key={n.to} to={n.to} end={n.end ?? false} ref={i === 0 ? first : undefined} className={({ isActive }) => cn("flex min-h-11 items-center gap-3 rounded-md px-3 font-semibold", isActive ? "bg-lagoon-50 text-lagoon-700" : "text-ink hover:bg-neutral-100")}>
          <n.icon className="size-5" aria-hidden="true" />{n.label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <ToastProvider>
      <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
        <aside className="hidden border-r border-line bg-surface p-4 lg:block">
          <div className="mb-6 px-1"><BrandMark className="text-ink" /></div>
          {nav}
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button type="button" className="grid size-11 place-items-center rounded-md hover:bg-neutral-100 lg:hidden" aria-label={drawer ? "Close menu" : "Open menu"} aria-expanded={drawer} onClick={() => setOpenOn(drawer ? null : pathname)}>{drawer ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}</button>
              <p className="font-bold">{me.tenant?.name}</p>
            </div>
            <div className="flex items-center gap-1">
              {hasFeature(me, "website") && <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-semibold text-lagoon-700 hover:bg-lagoon-50"><ExternalLink className="size-4" aria-hidden="true" /><span className="hidden sm:inline">View website</span><span className="sr-only sm:hidden">View website</span></a>}
              <button type="button" onClick={() => void logout()} className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 font-semibold hover:bg-neutral-100"><LogOut className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Sign out</span><span className="sr-only sm:hidden">Sign out</span></button>
            </div>
          </header>
          {drawer && <div role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-x-0 bottom-0 top-16 z-20 overflow-y-auto bg-surface p-4 lg:hidden">{nav}</div>}
          <main className="flex-1 bg-canvas p-4 sm:p-6 lg:p-8"><Outlet /></main>
        </div>
      </div>
    </ToastProvider>
  );
}
