
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  CreditCard,
  Globe2,
  Layers3,
  Pencil,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Wallet,
} from "lucide-react";

import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/feedback/Skeleton";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { platformApi } from "@/services/platformApi";

function formatDate(value?: string) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function humanize(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayLimit(value: number | null | undefined) {
  if (value == null) return "Not configured";
  if (value < 0) return "Unlimited";
  return value.toLocaleString();
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-bold tracking-tight text-ink">
        {title}
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Building2;
}) {
  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="mt-2 break-words text-2xl font-bold tracking-tight text-ink">
            {value}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">{detail}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3">
          <Icon className="size-5 text-ink" aria-hidden="true" />
        </div>
      </div>
    </Card>
  );
}

export default function PlatformTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCurrency, setEditCurrency] = useState("");
  const [editTimezone, setEditTimezone] = useState("");
  const [editError, setEditError] = useState("");

  const q = useQuery({
    queryKey: ["platform", "tenant", id],
    queryFn: () => platformApi.getTenant(id!),
    enabled: Boolean(id),
  });

  const tenant = q.data;

  const updateTenantMutation = useMutation({
    mutationFn: () => {
      if (!id) {
        throw new Error("The hotel ID is missing.");
      }

      return platformApi.updateTenant(id, {
        name: editName.trim(),
        currency: editCurrency.trim().toUpperCase(),
        timezone: editTimezone.trim(),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["platform", "tenant", id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["platform", "tenants"],
        }),
      ]);

      setIsEditing(false);
      setEditError("");
    },
    onError: (error: Error) => {
      setEditError(error.message || "Unable to update hotel details.");
    },
  });

  function startEditing() {
    if (!tenant) return;

    setEditName(tenant.name);
    setEditCurrency(tenant.currency);
    setEditTimezone(tenant.timezone);
    setEditError("");
    setIsEditing(true);
  }

  const verifiedDomain = tenant?.domains.find(
    (domain) => domain.verified,
  )?.hostname;

  // Local development uses the tenant's slug-based subdomain.
  // Production links are shown only when a verified domain exists.
  const websiteUrl = tenant
    ? import.meta.env.DEV
      ? `http://${tenant.slug}.localhost:5173`
      : verifiedDomain
        ? `https://${verifiedDomain.replace(/^https?:\/\//i, "")}`
        : null
    : null;

  return (
    <div className="min-h-dvh bg-surface">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <BrandMark />

          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
            onClick={() => navigate("/platform")}
          >
            <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Back to platform</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {q.isPending ? (
          <div className="space-y-6" aria-busy="true">
            <div className="space-y-3">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-4 w-52" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : q.isError || !tenant ? (
          <div className="mx-auto max-w-2xl py-12">
            <ErrorState
              description="We couldn't load this hotel's details. Check your connection and try again."
              onRetry={() => void q.refetch()}
              retrying={q.isFetching}
            />
            <div className="mt-4 text-center">
              <Button
                variant="secondary"
                onClick={() => navigate("/platform")}
              >
                <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
                Return to all hotels
              </Button>
            </div>
          </div>
        ) : (
          <>
            <nav
              aria-label="Breadcrumb"
              className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted"
            >
              <button
                type="button"
                onClick={() => navigate("/platform")}
                className="hover:text-ink"
              >
                Platform
              </button>
              <span aria-hidden="true">/</span>
              <span className="font-medium text-ink">Hotel details</span>
            </nav>

            {/* Hotel identity and actions */}
            <section className="mb-8">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-line bg-panel shadow-sm sm:size-16">
                    <Building2
                      className="size-7 text-ink sm:size-8"
                      aria-hidden="true"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                        Hotel account
                      </span>
                      <StatusBadge
                        tone={
                          tenant.status === "ACTIVE" ? "success" : "warning"
                        }
                      >
                        {tenant.status === "ACTIVE" ? "Active" : "Suspended"}
                      </StatusBadge>
                    </div>

                    <h1 className="break-words text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                      {tenant.name}
                    </h1>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <Globe2 className="size-4" aria-hidden="true" />
                        {tenant.slug}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays
                          className="size-4"
                          aria-hidden="true"
                        />
                        Created {formatDate(tenant.createdAt)}
                      </span>
                    </div>

                    {tenant.suspendedReason && (
                      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-panel p-3 text-sm">
                        <CircleAlert
                          className="mt-0.5 size-4 shrink-0"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-semibold text-ink">
                            Suspension reason
                          </p>
                          <p className="mt-1 text-muted">
                            {tenant.suspendedReason}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {websiteUrl && (
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    >
                      Open hotel website
                      <ArrowUpRight
                        className="ml-2 size-4"
                        aria-hidden="true"
                      />
                    </a>
                  )}

                  <Button
                    variant="secondary"
                    onClick={() => void q.refetch()}
                    disabled={q.isFetching || updateTenantMutation.isPending}
                  >
                    <RefreshCw
                      className={`mr-2 size-4 ${q.isFetching ? "animate-spin" : ""}`}
                      aria-hidden="true"
                    />
                    Refresh
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={startEditing}
                    disabled={updateTenantMutation.isPending}
                  >
                    <Pencil className="mr-2 size-4" aria-hidden="true" />
                    Edit hotel
                  </Button>
                </div>
              </div>
            </section>

            {/* Edit hotel form */}
            {isEditing && (
              <section className="mb-10" aria-label="Edit hotel details">
                <Card>
                  <CardHeader
                    title="Edit hotel details"
                    description="Change the hotel's basic information. Its tenant URL, plan, and status will remain unchanged."
                  />

                  <form
                    className="space-y-5 p-5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setEditError("");

                      if (
                        editName.trim().length < 2 ||
                        editName.trim().length > 120
                      ) {
                        setEditError(
                          "Hotel name must contain between 2 and 120 characters.",
                        );
                        return;
                      }

                      if (!/^[A-Za-z]{3}$/.test(editCurrency.trim())) {
                        setEditError(
                          "Currency must be a three-letter code, such as NGN, USD, or GBP.",
                        );
                        return;
                      }

                      if (!editTimezone.trim()) {
                        setEditError("Please enter a timezone.");
                        return;
                      }

                      updateTenantMutation.mutate();
                    }}
                  >
                    <div>
                      <label
                        htmlFor="edit-hotel-name"
                        className="mb-2 block text-sm font-semibold text-ink"
                      >
                        Hotel name
                      </label>
                      <input
                        id="edit-hotel-name"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        required
                        minLength={2}
                        maxLength={120}
                        autoComplete="organization"
                        className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                      />
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="edit-hotel-currency"
                          className="mb-2 block text-sm font-semibold text-ink"
                        >
                          Currency
                        </label>
                        <input
                          id="edit-hotel-currency"
                          value={editCurrency}
                          onChange={(event) =>
                            setEditCurrency(event.target.value.toUpperCase())
                          }
                          required
                          minLength={3}
                          maxLength={3}
                          pattern="[A-Za-z]{3}"
                          placeholder="NGN"
                          className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                        />
                        <p className="mt-1 text-xs text-muted">
                          Three-letter code, such as NGN, USD, or GBP.
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="edit-hotel-timezone"
                          className="mb-2 block text-sm font-semibold text-ink"
                        >
                          Timezone
                        </label>
                        <input
                          id="edit-hotel-timezone"
                          value={editTimezone}
                          onChange={(event) =>
                            setEditTimezone(event.target.value)
                          }
                          required
                          maxLength={60}
                          placeholder="Africa/Lagos"
                          className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                        />
                        <p className="mt-1 text-xs text-muted">
                          Use an IANA timezone, for example Africa/Lagos.
                        </p>
                      </div>
                    </div>

                    {editError && (
                      <div
                        role="alert"
                        className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800"
                      >
                        {editError}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="submit"
                        disabled={updateTenantMutation.isPending}
                      >
                        {updateTenantMutation.isPending
                          ? "Saving changes..."
                          : "Save changes"}
                      </Button>

                      <Button
                        type="button"
                        variant="secondary"
                        disabled={updateTenantMutation.isPending}
                        onClick={() => {
                          setIsEditing(false);
                          setEditError("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Card>
              </section>
            )}

            {/* At-a-glance metrics */}
            <section
              aria-label="Hotel account summary"
              className="mb-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
              <MetricCard
                label="Current plan"
                value={humanize(tenant.plan)}
                detail="Assigned subscription tier"
                icon={Layers3}
              />
              <MetricCard
                label="Account status"
                value={tenant.status === "ACTIVE" ? "Active" : "Suspended"}
                detail={
                  tenant.status === "ACTIVE"
                    ? "Account is marked active"
                    : "Account is currently suspended"
                }
                icon={ShieldCheck}
              />
              <MetricCard
                label="Hotel owners"
                value={tenant.ownerCount}
                detail="Owner accounts associated with this hotel"
                icon={Users}
              />
              <MetricCard
                label="Connected domains"
                value={tenant.domains.length}
                detail={`${tenant.domains.filter((domain) => domain.verified).length} verified`}
                icon={Globe2}
              />
            </section>

            {/* Account configuration */}
            <section className="mb-10">
              <SectionHeading
                eyebrow="Configuration"
                title="Account overview"
                description="Core settings and identifiers for this hotel tenant."
              />

              <Card>
                <CardHeader
                  title="Hotel settings"
                  description="Current configuration returned by the platform."
                />
                <div className="grid gap-0 divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
                  <div className="border-line p-5 sm:border-r">
                    <p className="text-sm text-muted">Hotel name</p>
                    <p className="mt-1 break-words font-semibold text-ink">
                      {tenant.name}
                    </p>
                  </div>
                  <div className="p-5">
                    <p className="text-sm text-muted">Tenant slug</p>
                    <p className="mt-1 break-all font-mono text-sm font-semibold text-ink">
                      {tenant.slug}
                    </p>
                  </div>
                  <div className="border-t border-line p-5 sm:border-r">
                    <p className="text-sm text-muted">Currency</p>
                    <p className="mt-1 font-semibold text-ink">
                      {tenant.currency}
                    </p>
                  </div>
                  <div className="border-t border-line p-5">
                    <p className="text-sm text-muted">Timezone</p>
                    <p className="mt-1 break-words font-semibold text-ink">
                      {tenant.timezone}
                    </p>
                  </div>
                  <div className="border-t border-line p-5 sm:col-span-2">
                    <p className="text-sm text-muted">Tenant ID</p>
                    <p className="mt-1 break-all font-mono text-xs text-muted">
                      {tenant.id}
                    </p>
                  </div>
                </div>
              </Card>
            </section>

            {/* Feature entitlements and overrides */}
            <section className="mb-10">
              <SectionHeading
                eyebrow="Product access"
                title="Features and permissions"
                description="Review the features included in this tenant's current entitlements and any hotel-specific overrides."
              />

              <div className="grid items-start gap-5 xl:grid-cols-2">
                <Card className="h-full">
                  <CardHeader
                    title="Enabled features"
                    description={`${tenant.entitlements.features.length} feature(s) included in current entitlements.`}
                  />
                  <div className="p-5">
                    {tenant.entitlements.features.length ? (
                      <div className="flex flex-wrap gap-2">
                        {tenant.entitlements.features.map((feature) => (
                          <span
                            key={feature}
                            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 text-sm font-medium text-ink"
                          >
                            <Check className="size-3.5" aria-hidden="true" />
                            {humanize(feature)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-line p-5 text-sm text-muted">
                        No enabled features were returned for this account.
                      </p>
                    )}
                  </div>
                </Card>

                <Card className="h-full">
                  <CardHeader
                    title="Feature overrides"
                    description="Tenant-specific feature settings."
                  />
                  <div className="p-5">
                    {tenant.featureOverrides.length ? (
                      <ul className="divide-y divide-line">
                        {tenant.featureOverrides.map((item, index) => (
                          <li
                            key={`${item.feature}-${index}`}
                            className="py-4 first:pt-0 last:pb-0"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-ink">
                                  {humanize(item.feature)}
                                </p>
                                {item.reason && (
                                  <p className="mt-1 text-sm leading-5 text-muted">
                                    {item.reason}
                                  </p>
                                )}
                              </div>
                              <Badge>
                                {item.enabled ? "Enabled" : "Disabled"}
                              </Badge>
                            </div>

                            {item.expiresAt && (
                              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
                                <Clock3
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                                Expires {formatDate(item.expiresAt)}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rounded-lg border border-dashed border-line p-5 text-sm text-muted">
                        No custom feature overrides configured.
                      </p>
                    )}
                  </div>
                </Card>
              </div>
            </section>

            {/* Usage limits */}
            <section className="mb-10">
              <SectionHeading
                eyebrow="Capacity"
                title="Usage limits"
                description="Effective plan limits and any configured administrator overrides. This page displays configured limits, not live usage totals."
              />

              <Card>
                <CardHeader
                  title="Effective limits"
                  description="Values currently returned by the entitlement service."
                />
                <div className="p-5">
                  {Object.entries(tenant.entitlements.limits).length ? (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {Object.entries(tenant.entitlements.limits).map(
                        ([key, value]) => {
                          const override = tenant.limitOverrides?.[key];
                          const hasOverride = override != null;

                          return (
                            <div
                              key={key}
                              className="rounded-xl border border-line bg-panel p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-medium text-muted">
                                  {humanize(key)}
                                </p>
                                <SlidersHorizontal
                                  className="size-4 shrink-0 text-muted"
                                  aria-hidden="true"
                                />
                              </div>
                              <p className="mt-3 text-xl font-bold text-ink">
                                {displayLimit(value)}
                              </p>
                              {hasOverride && (
                                <p className="mt-2 text-xs text-muted">
                                  Admin override: {displayLimit(override)}
                                </p>
                              )}
                            </div>
                          );
                        },
                      )}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-line p-5 text-sm text-muted">
                      No usage limits were returned.
                    </p>
                  )}
                </div>
              </Card>
            </section>

            {/* Domains */}
            <section className="mb-10">
              <SectionHeading
                eyebrow="Website"
                title="Connected domains"
                description="Domains associated with the hotel and their verification status."
              />

              <Card>
                <CardHeader
                  title="Domain management overview"
                  description="Verification details provided by the platform."
                />
                <div className="p-5">
                  {tenant.domains.length ? (
                    <ul className="divide-y divide-line">
                      {tenant.domains.map((domain) => (
                        <li
                          key={domain.hostname}
                          className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="rounded-lg border border-line bg-panel p-2">
                              <Globe2
                                className="size-4 text-ink"
                                aria-hidden="true"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="break-all font-semibold text-ink">
                                {domain.hostname}
                              </p>
                              <p className="mt-1 text-xs text-muted">
                                {domain.verified
                                  ? "Domain is marked as verified"
                                  : "Domain verification is pending"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 sm:shrink-0">
                            <Badge>
                              {domain.verified ? "Verified" : "Unverified"}
                            </Badge>
                            {domain.verified && (
                              <a
                                href={`https://${domain.hostname.replace(/^https?:\/\//i, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm font-semibold text-ink underline-offset-4 hover:underline"
                              >
                                Visit
                                <ArrowUpRight
                                  className="size-4"
                                  aria-hidden="true"
                                />
                              </a>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-xl border border-dashed border-line p-6 text-center">
                      <Globe2
                        className="mx-auto size-7 text-muted"
                        aria-hidden="true"
                      />
                      <p className="mt-3 font-semibold text-ink">
                        No custom domains connected
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        This hotel has no custom domains recorded in its
                        current platform configuration.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </section>

            {/* Subscription history */}
            <section className="mb-10">
              <SectionHeading
                eyebrow="Billing"
                title="Plan history"
                description="Subscription records associated with this hotel tenant."
              />

              <Card>
                <CardHeader
                  title="Subscription records"
                  description={`${tenant.subscriptions.length} record(s) returned.`}
                />
                <div className="p-5">
                  {tenant.subscriptions.length ? (
                    <ul className="divide-y divide-line">
                      {tenant.subscriptions.map((subscription, index) => (
                        <li
                          key={`${subscription.plan}-${subscription.startedAt ?? index}-${index}`}
                          className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="rounded-lg border border-line bg-panel p-2">
                              <CreditCard
                                className="size-4 text-ink"
                                aria-hidden="true"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-ink">
                                {humanize(subscription.plan)}
                              </p>
                              {subscription.note && (
                                <p className="mt-1 text-sm leading-5 text-muted">
                                  {subscription.note}
                                </p>
                              )}
                            </div>
                          </div>

                          <span className="inline-flex items-center gap-1.5 text-sm text-muted sm:shrink-0">
                            <CalendarDays
                              className="size-4"
                              aria-hidden="true"
                            />
                            {formatDate(subscription.startedAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-xl border border-dashed border-line p-6 text-center">
                      <Wallet
                        className="mx-auto size-7 text-muted"
                        aria-hidden="true"
                      />
                      <p className="mt-3 font-semibold text-ink">
                        No subscription history
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        No plan history records were returned for this hotel.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </section>

            {/* Footer */}
            <footer className="flex flex-col gap-3 border-t border-line py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
              <p>
                Platform administration
                <span className="mx-2" aria-hidden="true">
                  ·
                </span>
                Hotel account details
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate("/platform")}
              >
                <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
                Back to all hotels
              </Button>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
