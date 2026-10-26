
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  UserPlus,
  Pencil,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { adminApi, type StaffAdmin, type StaffRole } from "@/services/adminApi";
import { AdminPage, FormError, QueryBoundary } from "../components/AdminPage";

const roleLabels: Record<StaffRole, string> = {
  HOTEL_OWNER: "Hotel owner",
  HOTEL_MANAGER: "Hotel manager",
  RECEPTIONIST: "Receptionist",
  ACCOUNTANT: "Accountant",
  HOUSEKEEPER: "Housekeeper",
  RESTAURANT_MANAGER: "Restaurant manager",
  STAFF: "General staff",
};

type StaffForm = {
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
};

const emptyForm: StaffForm = {
  name: "",
  email: "",
  phone: "",
  role: "STAFF",
};

export default function StaffPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [editing, setEditing] = useState<StaffAdmin | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [formError, setFormError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter !== "ALL") params.set("role", roleFilter);
    if (activeFilter !== "ALL") params.set("active", activeFilter);
    const encoded = params.toString();
    return encoded ? `&${encoded}` : "";
  }, [search, roleFilter, activeFilter]);

  const staffQuery = useQuery({
    queryKey: ["admin", "staff", queryString],
    queryFn: () => adminApi.staff(queryString),
  });

  const rolesQuery = useQuery({
    queryKey: ["admin", "staff-roles"],
    queryFn: () => adminApi.staffRoles(),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name.trim(),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        role: form.role,
      };

      if (editing) {
        return adminApi.updateStaff(editing.id, body);
      }

      return adminApi.createStaff({
        ...body,
        email: form.email.trim().toLowerCase(),
      });
    },
    onSuccess: async () => {
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setFormError(null);
      setNotice(
        editing
          ? "Staff details updated successfully."
          : "Staff account created. Check the invitation workflow for the next step."
      );
      await queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
    },
    onError: (error) => setFormError(error),
  });

  const activeMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? adminApi.enableStaff(id) : adminApi.disableStaff(id),
    onSuccess: async (_result, variables) => {
      setNotice(
        variables.active
          ? "Staff account enabled."
          : "Staff account disabled."
      );
      await queryClient.invalidateQueries({ queryKey: ["admin", "staff"] });
    },
  });

  const assignableRoles = (rolesQuery.data ?? []).filter(
    (item) => item.assignable
  );

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm,
      role: assignableRoles.some((item) => item.role === "STAFF")
        ? "STAFF"
        : assignableRoles[0]?.role ?? "STAFF",
    });
    setFormError(null);
    setNotice("");
    setDialogOpen(true);
  }

  function openEdit(person: StaffAdmin) {
    setEditing(person);
    setForm({
      name: person.name,
      email: person.email,
      phone: person.phone ?? "",
      role: person.role,
    });
    setFormError(null);
    setNotice("");
    setDialogOpen(true);
  }

  return (
    <AdminPage
      title="Staff management"
      description="Manage hotel team accounts, assign permitted roles, and control staff access."
      action={
        <Button
          icon={<UserPlus className="size-4" />}
          onClick={openCreate}
          disabled={rolesQuery.isPending || !assignableRoles.length}
        >
          Add staff
        </Button>
      }
    >
      {notice && (
        <div
          role="status"
          className="rounded-lg border border-line bg-surface p-3 text-sm text-ink"
        >
          {notice}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted">Team members shown</p>
          <p className="mt-2 text-2xl font-bold">
            {staffQuery.data?.items.length ?? "—"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">Active members shown</p>
          <p className="mt-2 text-2xl font-bold">
            {staffQuery.data?.items.filter((person) => person.isActive).length ?? "—"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted">Roles you can assign</p>
          <p className="mt-2 text-2xl font-bold">
            {rolesQuery.data?.filter((item) => item.assignable).length ?? "—"}
          </p>
        </Card>
      </div>

      <Card className="p-4 sm:p-5">
        <CardHeader
          title="Team directory"
          description="Search staff, review account status, and update access."
        />

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-3 size-4 text-muted"
            />
            <Input
              label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name, email or phone"
              className="pl-9"
            />
          </div>

          <label className="grid gap-1.5 text-sm font-medium">
            Role
            <select
              className="min-h-11 rounded-md border border-line-strong bg-surface px-3 text-base"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
            >
              <option value="ALL">All roles</option>
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Account status
            <select
              className="min-h-11 rounded-md border border-line-strong bg-surface px-3 text-base"
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
            >
              <option value="ALL">All accounts</option>
              <option value="true">Active</option>
              <option value="false">Disabled</option>
            </select>
          </label>
        </div>

        <div className="mt-5">
          <QueryBoundary query={staffQuery} what="the staff directory">
            {(result) =>
              result.items.length === 0 ? (
                <EmptyState
  icon={Users}
  title="No staff found"
  description="Try another search or add a staff member to your hotel."
/>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-muted">
                        <th className="px-3 py-3 font-medium">Team member</th>
                        <th className="px-3 py-3 font-medium">Role</th>
                        <th className="px-3 py-3 font-medium">Status</th>
                        <th className="px-3 py-3 font-medium">Last login</th>
                        <th className="px-3 py-3 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.items.map((person) => (
                        <tr key={person.id} className="border-b border-line last:border-0">
                          <td className="px-3 py-4">
                            <div className="font-semibold">{person.name}</div>
                            <div className="mt-1 text-muted">{person.email}</div>
                            {person.phone && (
                              <div className="mt-1 text-xs text-muted">{person.phone}</div>
                            )}
                          </td>
                          <td className="px-3 py-4">
                            {roleLabels[person.role as StaffRole] ?? person.role}
                          </td>
                          <td className="px-3 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                person.isActive
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-neutral-100 text-neutral-600"
                              }`}
                            >
                              {person.isActive ? "Active" : "Disabled"}
                            </span>
                            {!person.emailVerified && (
                              <div className="mt-1 text-xs text-muted">Email not verified</div>
                            )}
                          </td>
                          <td className="px-3 py-4 text-muted">
                            {person.lastLoginAt
                              ? new Date(person.lastLoginAt).toLocaleDateString()
                              : "Never"}
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                icon={<Pencil className="size-3.5" />}
                                onClick={() => openEdit(person)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={activeMutation.isPending}
                                icon={
                                  person.isActive
                                    ? <UserX className="size-3.5" />
                                    : <UserCheck className="size-3.5" />
                                }
                                onClick={() => {
                                  const action = person.isActive ? "disable" : "enable";
                                  if (
                                    window.confirm(
                                      `Are you sure you want to ${action} ${person.name}'s account?`
                                    )
                                  ) {
                                    activeMutation.mutate({
                                      id: person.id,
                                      active: !person.isActive,
                                    });
                                  }
                                }}
                              >
                                {person.isActive ? "Disable" : "Enable"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </QueryBoundary>
        </div>

        {activeMutation.isError && (
          <div className="mt-4">
            <FormError error={activeMutation.error} />
          </div>
        )}
      </Card>

      <Dialog
        open={dialogOpen}
        onClose={() => {
          if (!saveMutation.isPending) setDialogOpen(false);
        }}
        title={editing ? "Edit staff member" : "Create staff account"}
        description={
          editing
            ? "Update staff details and the role they are permitted to hold."
            : "Create an account for a team member at this hotel."
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDialogOpen(false)}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              loading={saveMutation.isPending}
              onClick={() => {
                setFormError(null);
                saveMutation.mutate();
              }}
            >
              {editing ? "Save changes" : "Create account"}
            </Button>
          </>
        }
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setFormError(null);
            saveMutation.mutate();
          }}
        >
          <Input
            label="Full name"
            required
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Enter full name"
          />

          <Input
  label="Email address"
  required
  type="email"
  disabled={Boolean(editing)}
  value={form.email}
  onChange={(event) =>
    setForm((current) => ({ ...current, email: event.target.value }))
  }
  placeholder="staff@example.com"
  hint={
    editing
      ? "Email address cannot be changed here."
      : "An invitation will be initiated by the backend."
  }
/>

          <Input
            label="Phone number"
            value={form.phone}
            onChange={(event) =>
              setForm((current) => ({ ...current, phone: event.target.value }))
            }
            placeholder="Optional"
          />

          <label className="grid gap-1.5 text-sm font-medium">
            Assign role
            <select
              required
              className="min-h-11 rounded-md border border-line-strong bg-surface px-3 text-base"
              value={form.role}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  role: event.target.value as StaffRole,
                }))
              }
            >
              {assignableRoles.map((item) => (
                <option key={item.role} value={item.role}>
                  {roleLabels[item.role]}
                </option>
              ))}
              {editing &&
                !assignableRoles.some((item) => item.role === editing.role) && (
                  <option value={editing.role}>
                    {roleLabels[editing.role]}
                  </option>
                )}
            </select>
            <span className="text-xs font-normal text-muted">
              Available roles are determined by your permissions.
            </span>
          </label>

          <FormError error={formError} />
        </form>
      </Dialog>

      <div className="rounded-lg border border-line bg-surface p-4 text-sm text-muted">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" />
          <p>
            Staff access is restricted by hotel, assigned role, permissions,
            and subscription limits. Platform super-admin accounts are managed
            separately.
          </p>
        </div>
      </div>
    </AdminPage>
  );
}
