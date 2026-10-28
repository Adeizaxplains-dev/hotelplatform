
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, LogOut, Plus, X } from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Skeleton } from "@/components/feedback/Skeleton";
import { StatusBadge } from "@/components/ui/Badge";
import { Badge } from "@/components/ui/Badge";
import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/features/auth/AuthContext";
import { platformApi, type PlatformPlan } from "@/services/platformApi";
import { Link } from "react-router-dom";

const initialForm = {
  name: "",
  slug: "",
  plan: "WEBSITE" as PlatformPlan,
  ownerName: "",
  ownerEmail: "",
  timezone: "Africa/Lagos",
  currency: "NGN",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function PlatformHomePage() {
  const { me, logout } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [slugEdited, setSlugEdited] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const q = useQuery({
    queryKey: ["platform", "tenants"],
    queryFn: platformApi.listTenants,
  });

  const createMutation = useMutation({
    mutationFn: platformApi.createTenant,
    onSuccess: async (tenant) => {
      setSuccessMessage(
        `Hotel "${tenant.name}" was created. An invitation was sent to ${form.ownerEmail}.`
      );
      setForm(initialForm);
      setSlugEdited(false);
      setShowForm(false);
      await queryClient.invalidateQueries({
        queryKey: ["platform", "tenants"],
      });
    },
  });

  function updateName(value: string) {
    setForm((current) => ({
      ...current,
      name: value,
      ...(!slugEdited ? { slug: slugify(value) } : {}),
    }));
  }

  function updateField(
    field: "slug" | "plan" | "ownerName" | "ownerEmail" | "timezone" | "currency",
    value: string
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccessMessage("");

    createMutation.mutate({
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      plan: form.plan,
      ownerName: form.ownerName.trim(),
      ownerEmail: form.ownerEmail.trim().toLowerCase(),
      timezone: form.timezone.trim(),
      currency: form.currency.trim().toUpperCase(),
    });
  }

  return (
    <div className="min-h-dvh">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <BrandMark />
          <Button
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
            icon={<LogOut className="size-4" aria-hidden="true" />}
            onClick={() => void logout()}
          >
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold">Platform</h1>
            <p className="mt-1 text-muted">
              Signed in as {me?.user.email}
            </p>
          </div>
          <Button
            icon={<Plus className="size-4" aria-hidden="true" />}
            onClick={() => {
              setSuccessMessage("");
              setShowForm((open) => !open);
            }}
          >
            {showForm ? "Close form" : "Create hotel"}
          </Button>
        </div>

        {successMessage && (
          <div
            role="status"
            className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900"
          >
            {successMessage}
          </div>
        )}

        {showForm && (
          <Card className="mt-6">
            <CardHeader
              title="Create a hotel"
              description="Create the hotel workspace and invite its owner to set a password."
            />
            <form onSubmit={handleSubmit} className="grid gap-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Hotel name"
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="organization"
                  placeholder="e.g. Palm Court Hotel"
                  value={form.name}
                  onChange={(event) => updateName(event.target.value)}
                />
                <Input
                  label="Hotel URL slug"
                  required
                  minLength={3}
                  maxLength={40}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  hint="Lowercase letters, numbers and hyphens only."
                  placeholder="palm-court"
                  value={form.slug}
                  onChange={(event) => {
                    setSlugEdited(true);
                    updateField("slug", slugify(event.target.value));
                  }}
                />
                <div className="grid gap-1.5">
                  <label
                    htmlFor="hotel-plan"
                    className="text-sm font-semibold text-ink"
                  >
                    Plan
                  </label>
                  <select
                    id="hotel-plan"
                    required
                    value={form.plan}
                    onChange={(event) =>
                      updateField("plan", event.target.value)
                    }
                    className="min-h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-base text-ink"
                  >
                    <option value="WEBSITE">Website</option>
                    <option value="BOOKING">Booking</option>
                    <option value="MANAGEMENT">Management</option>
                  </select>
                </div>
                <Input
                  label="Owner's full name"
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                  placeholder="Hotel owner's name"
                  value={form.ownerName}
                  onChange={(event) =>
                    updateField("ownerName", event.target.value)
                  }
                />
                <Input
                  label="Owner's email"
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="owner@example.com"
                  value={form.ownerEmail}
                  onChange={(event) =>
                    updateField("ownerEmail", event.target.value)
                  }
                />
                <Input
                  label="Time zone"
                  required
                  value={form.timezone}
                  onChange={(event) =>
                    updateField("timezone", event.target.value)
                  }
                />
                <Input
                  label="Currency"
                  required
                  minLength={3}
                  maxLength={3}
                  pattern="[A-Za-z]{3}"
                  hint="Three-letter currency code, e.g. NGN."
                  value={form.currency}
                  onChange={(event) =>
                    updateField("currency", event.target.value)
                  }
                />
              </div>

              {createMutation.isError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  {createMutation.error instanceof Error
                    ? createMutation.error.message
                    : "The hotel could not be created. Please try again."}
                </div>
              )}

              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  icon={<X className="size-4" aria-hidden="true" />}
                  onClick={() => {
                    setShowForm(false);
                    createMutation.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={createMutation.isPending}
                  disabled={createMutation.isPending}
                  icon={<Plus className="size-4" aria-hidden="true" />}
                >
                  Create hotel
                </Button>
              </div>
            </form>
          </Card>
        )}

        <Card className="mt-8">
          <CardHeader
            title="Hotels"
            description="Every hotel on the platform."
          />
          {q.isPending ? (
            <div className="grid gap-3 p-5" aria-busy="true">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ) : q.isError ? (
            <ErrorState
              description="We couldn't load the hotels."
              onRetry={() => void q.refetch()}
              retrying={q.isFetching}
            />
          ) : q.data.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No hotels yet"
              description="Hotels you create will appear here with their plan and status."
            />
          ) : (
            <ul className="divide-y divide-line">
              {q.data.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div>
                    <Link
                      to={`/platform/tenants/${encodeURIComponent(t.id)}`}
                      className="font-bold text-ink underline-offset-4 hover:underline"
                    >
                      {t.name}
                    </Link>
                    <p className="text-sm text-muted">{t.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{t.plan}</Badge>
                    <StatusBadge
                      tone={t.status === "ACTIVE" ? "success" : "warning"}
                    >
                      {t.status === "ACTIVE" ? "Active" : "Suspended"}
                    </StatusBadge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
