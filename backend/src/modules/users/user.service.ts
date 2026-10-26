import { trusted, type Types } from "mongoose";
import type { AuthContext, TenantView } from "../../shared/context.js";
import { AuthorizationError, BusinessRuleError, ConflictError, NotFoundError } from "../../shared/errors.js";
import type { EmailService } from "../../integrations/email/email.service.js";
import { containsText, inList } from "../../shared/mongoOps.js";
import { unusablePasswordHash } from "../../shared/password.js";
import { pageMeta } from "../../shared/pagination.js";
import type { AuditService, RequestMeta } from "../audit/audit.service.js";
import { inviteEmail } from "../auth/auth.emails.js";
import type { AuthService } from "../auth/auth.service.js";
import type { OneTimeTokenService } from "../auth/oneTimeToken.service.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import type { Entitlements } from "../entitlements/features.js";
import { canManageRole } from "../rbac/roles.js";
import { STAFF_ROLES, type Role, type StaffRole } from "../rbac/roles.js";
import { User, toPublicUser } from "./user.model.js";

interface Deps {
  audit: AuditService;
  entitlements: EntitlementService;
  oneTime: OneTimeTokenService;
  email: EmailService;
  auth: AuthService;
}

const ADMIN_ROLES: readonly Role[] = ["HOTEL_OWNER", "HOTEL_MANAGER"];

export function createUserService({ audit, entitlements, oneTime, email, auth }: Deps) {
  /** Staff accounts of THIS hotel only (customers are managed as guests, not here). Always tenant-pinned. */
  const staffFilter = (tenantId: Types.ObjectId, extra: Record<string, unknown> = {}) => ({ tenantId, role: inList(STAFF_ROLES), ...extra });

  async function assertRoomForRole(tenant: TenantView, ent: Entitlements, role: Role) {
    const staffCount = await User.countDocuments(staffFilter(tenant.id, { isActive: true }));
    entitlements.assertWithinLimit(ent, "maxStaff", staffCount);
    if (ADMIN_ROLES.includes(role)) {
      const adminCount = await User.countDocuments({ tenantId: tenant.id, isActive: true, role: inList(ADMIN_ROLES) });
      entitlements.assertWithinLimit(ent, "maxAdmins", adminCount);
    }
  }

  async function assertNotLastOwner(tenantId: Types.ObjectId, targetId: Types.ObjectId) {
    const others = await User.countDocuments({ tenantId, role: "HOTEL_OWNER", isActive: true, _id: trusted({ $ne: targetId }) });
    if (others === 0) throw new BusinessRuleError("A hotel must keep at least one active owner.", "LAST_OWNER");
  }

  async function loadStaff(tenantId: Types.ObjectId, id: string) {
    const user = await User.findOne(staffFilter(tenantId, { _id: id }));
    if (!user) throw new NotFoundError("Staff member not found.");
    return user;
  }

  return {
    async list(tenantId: Types.ObjectId, q: { page: number; limit: number; role?: Role | undefined; active?: boolean | undefined; search?: string | undefined }) {
      const filter = staffFilter(tenantId, {
        ...(q.role ? { role: q.role } : {}),
        ...(q.active !== undefined ? { isActive: q.active } : {}),
        ...(q.search ? { $or: [{ name: containsText(q.search) }, { email: containsText(q.search) }] } : {}),
      });
      const [rows, total] = await Promise.all([
        User.find(filter).sort({ name: 1 }).skip((q.page - 1) * q.limit).limit(q.limit),
        User.countDocuments(filter),
      ]);
      return { items: rows.map(toPublicUser), meta: pageMeta(total, q.page, q.limit) };
    },

    async get(tenantId: Types.ObjectId, id: string) {
      return toPublicUser(await loadStaff(tenantId, id));
    },

    /** Creates the account WITHOUT a password and emails an invite link; nobody ever shares a temporary password. */
    async create(actor: AuthContext, tenant: TenantView, input: { name: string; email: string; phone?: string | undefined; role: StaffRole }, baseUrl: string, meta: RequestMeta) {
      if (!canManageRole(actor.role, input.role)) throw new AuthorizationError("You cannot create users with that role.");
      const ent = await entitlements.forTenant(tenant);
      await assertRoomForRole(tenant, ent, input.role);

      const emailAddr = input.email.trim().toLowerCase();
      if (await User.exists({ tenantId: tenant.id, email: emailAddr })) throw new ConflictError("A user with this email already exists.");

      const user = await User.create({
        tenantId: tenant.id, name: input.name, email: emailAddr, phone: input.phone, role: input.role, isActive: true,
        passwordHash: await unusablePasswordHash(), createdBy: actor.userId,
      });
      const raw = await oneTime.issue(tenant.id, user._id, "INVITE");
      await email.send(inviteEmail(emailAddr, tenant.name, `${baseUrl}/reset-password?token=${raw}&invite=1`));
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "USER_CREATED", resourceType: "User", resourceId: String(user._id), after: toPublicUser(user), meta });
      return toPublicUser(user);
    },

    async update(actor: AuthContext, tenant: TenantView, id: string, input: { name?: string | undefined; phone?: string | undefined; role?: StaffRole | undefined }, meta: RequestMeta) {
      const target = await loadStaff(tenant.id, id);
      if (!canManageRole(actor.role, target.role)) throw new AuthorizationError("You cannot change a user with a role equal to or above yours.");
      const before = toPublicUser(target);

      if (input.role && input.role !== target.role) {
        if (String(target._id) === String(actor.userId)) throw new AuthorizationError("You cannot change your own role.");
        if (!canManageRole(actor.role, input.role)) throw new AuthorizationError("You cannot assign that role.");
        if (target.role === "HOTEL_OWNER") await assertNotLastOwner(tenant.id, target._id);
        if (ADMIN_ROLES.includes(input.role) && !ADMIN_ROLES.includes(target.role)) {
          const ent = await entitlements.forTenant(tenant);
          entitlements.assertWithinLimit(ent, "maxAdmins", await User.countDocuments({ tenantId: tenant.id, isActive: true, role: inList(ADMIN_ROLES) }));
        }
        target.role = input.role;
      }
      if (input.name !== undefined) target.name = input.name;
      if (input.phone !== undefined) target.phone = input.phone;
      await target.save();

      const after = toPublicUser(target);
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: before.role !== after.role ? "ROLE_CHANGED" : "USER_UPDATED", resourceType: "User", resourceId: id, before, after, meta });
      return after;
    },

    async setActive(actor: AuthContext, tenant: TenantView, id: string, active: boolean, meta: RequestMeta) {
      const target = await loadStaff(tenant.id, id);
      if (String(target._id) === String(actor.userId)) throw new AuthorizationError("You cannot disable or enable your own account.");
      if (!canManageRole(actor.role, target.role)) throw new AuthorizationError("You cannot change a user with a role equal to or above yours.");
      if (target.isActive === active) return toPublicUser(target);

      if (!active && target.role === "HOTEL_OWNER") await assertNotLastOwner(tenant.id, target._id);
      if (active) await assertRoomForRole(tenant, await entitlements.forTenant(tenant), target.role);

      const before = toPublicUser(target);
      target.isActive = active;
      await target.save();
      if (!active) await auth.revokeAllForUser(tenant.id, target._id, "USER_DISABLED");

      const after = toPublicUser(target);
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: active ? "USER_ENABLED" : "USER_DISABLED", resourceType: "User", resourceId: id, before, after, meta });
      return after;
    },
  };
}
export type UserService = ReturnType<typeof createUserService>;
