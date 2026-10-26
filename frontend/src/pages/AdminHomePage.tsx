
import {
  ArrowRight,
  BedDouble,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Globe,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useAuth } from "@/features/auth/AuthContext";
import { authApi } from "@/services/authApi";
import { visibleNav } from "@/admin/nav";

const label = (s: string) =>
  s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

const shortcuts = [
  {
    to: "/admin/reservations",
    title: "Reservations",
    description: "Review and manage guest bookings.",
    icon: CalendarCheck,
    color: "bg-blue-50 text-blue-700",
  },
  {
    to: "/admin/rooms",
    title: "Rooms",
    description: "Manage your room inventory.",
    icon: BedDouble,
    color: "bg-violet-50 text-violet-700",
  },
  {
    to: "/admin/guests",
    title: "Guests",
    description: "Access your guest records.",
    icon: Users,
    color: "bg-emerald-50 text-emerald-700",
  },
  {
    to: "/admin/website",
    title: "Website",
    description: "Update your hotel's online presence.",
    icon: Globe,
    color: "bg-amber-50 text-amber-700",
  },
  {
    to: "/admin/invoices",
    title: "Invoices",
    description: "Review guest invoices.",
    icon: ReceiptText,
    color: "bg-rose-50 text-rose-700",
  },
  {
    to: "/admin/financial-report",
    title: "Financial reports",
    description: "Review available financial reporting.",
    icon: WalletCards,
    color: "bg-cyan-50 text-cyan-700",
  },
];

export default function AdminHomePage() {
  const { me, logout } = useAuth();
  const [showPermissions, setShowPermissions] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);

  if (!me) return null;

  const items = visibleNav(me);
  const allowedRoutes = new Set(items.map((item) => item.to));
  const availableShortcuts = shortcuts.filter((item) =>
    allowedRoutes.has(item.to),
  );

  const grouped = new Map<string, string[]>();
  for (const permission of me.permissions) {
    const area = permission.split(".")[0] ?? "other";
    grouped.set(area, [...(grouped.get(area) ?? []), permission]);
  }

  const firstName = me.user.name.trim().split(/\s+/)[0] || "there";
  const role = label(me.user.role);

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-7">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-6 text-white shadow-sm sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-12 -top-20 size-64 rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-2 -top-10 size-44 rounded-full border border-white/10"
        />

        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-teal-100">
              <Sparkles className="size-3.5" aria-hidden="true" />
              HOTEL MANAGEMENT
            </div>
            <p className="text-sm font-medium text-teal-100">
              {me.tenant?.name || "Your hotel"}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Welcome back, {firstName}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Manage your hotel's online presence and access your available
              operations from one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {allowedRoutes.has("/admin/website") && (
              <Link
                to="/admin/website"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                <Globe className="size-4" aria-hidden="true" />
                Manage website
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            )}
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              View website
            </a>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted">
                Management access
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight">
                {items.length}
              </p>
              <p className="mt-1 text-sm text-muted">
                Available sections
              </p>
            </div>
            <div className="grid size-11 place-items-center rounded-xl bg-teal-50 text-teal-700">
              <LayoutDashboard className="size-5" aria-hidden="true" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted">
                Permissions
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight">
                {me.permissions.length}
              </p>
              <p className="mt-1 text-sm text-muted">
                Granted to your role
              </p>
            </div>
            <div className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted">
                Plan features
              </p>
              <p className="mt-2 text-3xl font-bold tracking-tight">
                {me.features.length}
              </p>
              <p className="mt-1 text-sm text-muted">
                Available capabilities
              </p>
            </div>
            <div className="grid size-11 place-items-center rounded-xl bg-violet-50 text-violet-700">
              <CheckCircle2 className="size-5" aria-hidden="true" />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted">
                Account role
              </p>
              <p className="mt-2 text-xl font-bold tracking-tight">
                {role}
              </p>
              <p className="mt-1 text-sm text-muted">
                Your current access level
              </p>
            </div>
            <div className="grid size-11 place-items-center rounded-xl bg-amber-50 text-amber-700">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                Quick access
              </h2>
              <p className="mt-1 text-sm text-muted">
                Jump straight to the areas you manage most.
              </p>
            </div>
          </div>

          {availableShortcuts.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {availableShortcuts.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="group flex min-h-32 items-start gap-4 rounded-xl border border-line bg-surface p-5 transition duration-200 hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2"
                  >
                    <div
                      className={`grid size-11 shrink-0 place-items-center rounded-xl ${item.color}`}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-ink">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-sm leading-5 text-muted">
                        {item.description}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
                        Open section
                        <ArrowRight
                          className="size-4 transition-transform group-hover:translate-x-1"
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Card className="p-6">
              <p className="text-sm text-muted">
                No management shortcuts are available for this account.
              </p>
            </Card>
          )}
        </div>

        <aside className="grid content-start gap-4">
          <Card>
            <CardHeader
              title="Your workspace"
              description="Account and hotel access overview."
              action={
                <ShieldCheck
                  className="size-5 text-teal-700"
                  aria-hidden="true"
                />
              }
            />
            <div className="grid gap-4 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Hotel
                </p>
                <p className="mt-1 font-semibold">
                  {me.tenant?.name || "Hotel workspace"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Signed in as
                </p>
                <p className="mt-1 break-words font-semibold">
                  {me.user.name}
                </p>
                <p className="mt-0.5 break-all text-sm text-muted">
                  {me.user.email}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Role
                </p>
                <div className="mt-2">
                  <Badge>{role}</Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700">
                <Sparkles className="size-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-semibold">Make your hotel stand out</h3>
                <p className="mt-1 text-sm leading-5 text-muted">
                  Keep your hotel information, rooms and gallery up to date
                  for website visitors.
                </p>
                {allowedRoutes.has("/admin/website") && (
                  <Link
                    to="/admin/website"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-900"
                  >
                    Update your website
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </div>
          </Card>
        </aside>
      </section>

      <section className="grid gap-3">
        <Card>
          <button
            type="button"
            onClick={() => setShowPermissions((value) => !value)}
            aria-expanded={showPermissions}
            className="flex w-full items-center justify-between gap-4 rounded-xl p-5 text-left focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-inset"
          >
            <div>
              <h2 className="font-semibold">Permissions and access</h2>
              <p className="mt-1 text-sm text-muted">
                View the detailed permissions assigned to your role.
              </p>
            </div>
            <ChevronDown
              className={`size-5 shrink-0 text-muted transition-transform ${showPermissions ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {showPermissions && (
            <div className="grid gap-5 border-t border-line p-5 sm:grid-cols-2">
              {[...grouped.entries()].map(([area, permissions]) => (
                <div key={area}>
                  <p className="text-sm font-semibold">{label(area)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {permissions.map((permission) => (
                      <Badge key={permission}>
                        {permission.split(".").slice(1).join(".")}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
              {grouped.size === 0 && (
                <p className="text-sm text-muted">
                  This role has no management permissions.
                </p>
              )}
            </div>
          )}
        </Card>

        <Card>
          <button
            type="button"
            onClick={() => setShowFeatures((value) => !value)}
            aria-expanded={showFeatures}
            className="flex w-full items-center justify-between gap-4 rounded-xl p-5 text-left focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-inset"
          >
            <div>
              <h2 className="font-semibold">Plan features</h2>
              <p className="mt-1 text-sm text-muted">
                Review the capabilities enabled for your hotel's plan.
              </p>
            </div>
            <ChevronDown
              className={`size-5 shrink-0 text-muted transition-transform ${showFeatures ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {showFeatures && (
            <div className="flex flex-wrap gap-2 border-t border-line p-5">
              {me.features.map((feature) => (
                <Badge
                  key={feature}
                  className="bg-teal-50 text-teal-800"
                >
                  {label(feature)}
                </Badge>
              ))}
              {me.features.length === 0 && (
                <p className="text-sm text-muted">
                  No plan features are enabled.
                </p>
              )}
            </div>
          )}
        </Card>
      </section>

      <div className="flex flex-col justify-between gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
        <p className="text-sm text-muted">
          Signed in as {me.user.email}
        </p>
        <Button
          variant="secondary"
          className="justify-center gap-2 sm:justify-self-start"
          onClick={() =>
            void authApi.logoutAll().then(() => logout())
          }
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out on all devices
        </Button>
      </div>
    </div>
  );
}
