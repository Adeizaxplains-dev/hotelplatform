import type { Types } from "mongoose";
import type { Env } from "../../config/env.js";
import type { EmailService } from "../../integrations/email/email.service.js";
import type { AuthContext, TenantView } from "../../shared/context.js";
import {
  AccountDisabledError, AuthenticationError, ConflictError, InvalidCredentialsError, TenantAccessError, ValidationError,
} from "../../shared/errors.js";
import { gt } from "../../shared/mongoOps.js";
import { dummyHash, hashPassword, passwordProblemFor, verifyPassword } from "../../shared/password.js";
import type { AuditService, RequestMeta } from "../audit/audit.service.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import { User, toPublicUser, type PublicUser } from "../users/user.model.js";
import { passwordResetEmail, verifyEmailMessage } from "./auth.emails.js";
import type { OneTimeTokenService } from "./oneTimeToken.service.js";
import { Session, type RevokeReason } from "./session.model.js";
import type { TokenService } from "./token.service.js";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export interface AuthDeps {
  env: Pick<Env, "REFRESH_TOKEN_TTL_DAYS">;
  tokens: TokenService;
  oneTime: OneTimeTokenService;
  audit: AuditService;
  email: EmailService;
  entitlements: EntitlementService;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: PublicUser;
}

const normalizeEmail = (e: string) => e.trim().toLowerCase();
const tid = (t: TenantView | null) => t?.id ?? null;

export function createAuthService(deps: AuthDeps) {
  const { tokens, oneTime, audit, email, entitlements } = deps;
  const refreshTtlMs = deps.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

  async function revokeSession(tenantId: Types.ObjectId | null, sessionId: Types.ObjectId, reason: RevokeReason) {
    await Session.updateOne({ _id: sessionId, tenantId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });
  }
  async function revokeAllForUser(tenantId: Types.ObjectId | null, userId: Types.ObjectId, reason: RevokeReason) {
    await Session.updateMany({ tenantId, userId, revokedAt: null }, { $set: { revokedAt: new Date(), revokedReason: reason } });
  }

  async function startSession(user: { _id: Types.ObjectId; tenantId: Types.ObjectId | null }, meta: RequestMeta): Promise<{ sessionId: Types.ObjectId; refreshToken: string; accessToken: string }> {
    const refresh = tokens.newRefreshToken();
    const session = await Session.create({
      tenantId: user.tenantId,
      userId: user._id,
      tokenHash: refresh.hash,
      expiresAt: new Date(Date.now() + refreshTtlMs),
      lastUsedAt: new Date(),
      ipAddress: meta.ip,
      userAgent: meta.userAgent?.slice(0, 200),
    });
    const accessToken = await tokens.signAccessToken({ userId: user._id, sessionId: session._id, tenantId: user.tenantId });
    return { sessionId: session._id, refreshToken: refresh.raw, accessToken };
  }

  return {
    revokeAllForUser,

    async login(tenant: TenantView | null, input: { email: string; password: string }, meta: RequestMeta): Promise<IssuedSession> {
      const tenantId = tid(tenant);
      const emailAddr = normalizeEmail(input.email);
      const user = await User.findOne({ tenantId, email: emailAddr }).select("+passwordHash");

      if (!user) {
        await verifyPassword(await dummyHash(), input.password); // same cost as a real check: no timing tell
        await audit.recordSafe({ tenantId, action: "LOGIN_FAILED", resourceType: "User", after: { reason: "unknown_account" }, meta });
        throw new InvalidCredentialsError();
      }

      if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
        await audit.recordSafe({ tenantId, actorUserId: user._id, action: "LOGIN_BLOCKED", resourceType: "User", resourceId: String(user._id), meta });
        throw new InvalidCredentialsError(); // indistinguishable from a wrong password
      }

      if (!(await verifyPassword(user.passwordHash, input.password))) {
        await User.updateOne({ _id: user._id, tenantId }, { $inc: { failedLoginCount: 1 } }); // atomic increment
        const updated = await User.findOne({ _id: user._id, tenantId });
        if (updated && updated.failedLoginCount >= LOCKOUT_THRESHOLD) {
          await User.updateOne({ _id: user._id, tenantId }, { $set: { lockedUntil: new Date(Date.now() + LOCKOUT_MS), failedLoginCount: 0 } });
          await audit.recordSafe({ tenantId, actorUserId: user._id, action: "ACCOUNT_LOCKED", resourceType: "User", resourceId: String(user._id), meta });
        }
        await audit.recordSafe({ tenantId, actorUserId: user._id, action: "LOGIN_FAILED", resourceType: "User", resourceId: String(user._id), after: { reason: "bad_password" }, meta });
        throw new InvalidCredentialsError();
      }

      if (!user.isActive) throw new AccountDisabledError(); // only revealed to someone who knows the password

      await User.updateOne({ _id: user._id, tenantId }, { $set: { failedLoginCount: 0, lastLoginAt: new Date() }, $unset: { lockedUntil: 1 } });
      const s = await startSession(user, meta);
      await audit.recordSafe({ tenantId, actorUserId: user._id, action: "LOGIN_SUCCEEDED", resourceType: "Session", resourceId: String(s.sessionId), meta });
      return { accessToken: s.accessToken, refreshToken: s.refreshToken, expiresIn: tokens.accessTtlSeconds, user: toPublicUser(user) };
    },

    /**
     * Rotates the refresh token. The swap is a single atomic update keyed on the current token hash, so two
     * requests can never both succeed with the same token. Presenting a token that was already rotated away
     * means it leaked: the whole session is revoked.
     */
    async refresh(tenant: TenantView | null, rawToken: string, meta: RequestMeta): Promise<IssuedSession> {
      const tenantId = tid(tenant);
      const oldHash = tokens.hashRefreshToken(rawToken);
      const next = tokens.newRefreshToken();
      const now = new Date();

      const session = await Session.findOneAndUpdate(
        { tenantId, tokenHash: oldHash, revokedAt: null, expiresAt: gt(now) },
        { $set: { tokenHash: next.hash, previousTokenHash: oldHash, rotatedAt: now, lastUsedAt: now, ipAddress: meta.ip, userAgent: meta.userAgent?.slice(0, 200) } },
        { returnDocument: "after" }
      );

      if (!session) {
        const replayed = await Session.findOne({ tenantId, previousTokenHash: oldHash, revokedAt: null });
        if (replayed) {
          await revokeSession(tenantId, replayed._id, "REUSE_DETECTED");
          await audit.recordSafe({ tenantId, actorUserId: replayed.userId, action: "REFRESH_TOKEN_REUSE_DETECTED", resourceType: "Session", resourceId: String(replayed._id), meta });
        }
        throw new AuthenticationError("Your session has expired. Please sign in again.");
      }

      const user = await User.findOne({ _id: session.userId, tenantId });
      if (!user || !user.isActive) {
        await revokeSession(tenantId, session._id, "USER_INACTIVE");
        throw new AuthenticationError("Your session has expired. Please sign in again.");
      }
      const accessToken = await tokens.signAccessToken({ userId: user._id, sessionId: session._id, tenantId });
      return { accessToken, refreshToken: next.raw, expiresIn: tokens.accessTtlSeconds, user: toPublicUser(user) };
    },

    async logout(tenant: TenantView | null, rawToken: string | undefined, meta: RequestMeta): Promise<void> {
      if (!rawToken) return;
      const tenantId = tid(tenant);
      const session = await Session.findOneAndUpdate(
        { tenantId, tokenHash: tokens.hashRefreshToken(rawToken), revokedAt: null },
        { $set: { revokedAt: new Date(), revokedReason: "LOGOUT" } }
      );
      if (session) await audit.recordSafe({ tenantId, actorUserId: session.userId, action: "LOGOUT", resourceType: "Session", resourceId: String(session._id), meta });
    },

    async logoutAll(auth: AuthContext, meta: RequestMeta): Promise<void> {
      await revokeAllForUser(auth.tenantId, auth.userId, "LOGOUT_ALL");
      await audit.recordSafe({ tenantId: auth.tenantId, actorUserId: auth.userId, action: "LOGOUT_ALL", resourceType: "User", resourceId: String(auth.userId), meta });
    },

    /** Validates an access token and loads the CURRENT user. Role, status and session are never taken from the token. */
    async authenticate(accessToken: string, hostTenant: TenantView | null): Promise<AuthContext & { user: PublicUser }> {
      const claims = await tokens.verifyAccessToken(accessToken);
      if (String(claims.tenantId ?? "") !== String(hostTenant?.id ?? "")) throw new TenantAccessError();

      const session = await Session.findOne({ _id: claims.sessionId, tenantId: claims.tenantId, userId: claims.userId, revokedAt: null, expiresAt: gt(new Date()) });
      if (!session) throw new AuthenticationError("Your session has expired. Please sign in again.");

      const user = await User.findOne({ _id: claims.userId, tenantId: claims.tenantId });
      if (!user) throw new AuthenticationError("Your session has expired. Please sign in again.");
      if (!user.isActive) throw new AccountDisabledError();

      return { userId: user._id, sessionId: session._id, role: user.role, tenantId: user.tenantId, name: user.name, email: user.email, user: toPublicUser(user) };
    },

    /** Guest self-registration on a hotel's site. Role is fixed to CUSTOMER: the caller cannot choose it. */
    async register(tenant: TenantView, input: { name: string; email: string; password: string; phone?: string | undefined }, baseUrl: string, meta: RequestMeta): Promise<PublicUser> {
      const ent = await entitlements.forTenant(tenant);
      entitlements.assertFeature(ent, "booking");
      const count = await User.countDocuments({ tenantId: tenant.id, isActive: true });
      entitlements.assertWithinLimit(ent, "maxUsers", count);

      const emailAddr = normalizeEmail(input.email);
      const problem = passwordProblemFor(input.password, emailAddr);
      if (problem) throw new ValidationError(problem);
      if (await User.exists({ tenantId: tenant.id, email: emailAddr })) throw new ConflictError("An account with this email already exists.");

      const user = await User.create({
        tenantId: tenant.id, name: input.name, email: emailAddr, phone: input.phone, role: "CUSTOMER", isActive: true,
        passwordHash: await hashPassword(input.password), passwordChangedAt: new Date(),
      });
      const raw = await oneTime.issue(tenant.id, user._id, "EMAIL_VERIFY");
      await email.send(verifyEmailMessage(emailAddr, tenant.name, `${baseUrl}/verify-email?token=${raw}`));
      await audit.record({ tenantId: tenant.id, actorUserId: user._id, action: "USER_REGISTERED", resourceType: "User", resourceId: String(user._id), after: toPublicUser(user), meta });
      return toPublicUser(user);
    },

    /** Always succeeds from the caller's point of view: the response never reveals whether the email has an account. */
    async forgotPassword(tenant: TenantView | null, rawEmail: string, baseUrl: string, meta: RequestMeta): Promise<void> {
      const tenantId = tid(tenant);
      const user = await User.findOne({ tenantId, email: normalizeEmail(rawEmail), isActive: true });
      if (!user) return;
      const raw = await oneTime.issue(tenantId, user._id, "PASSWORD_RESET");
      await email.send(passwordResetEmail(user.email, tenant?.name ?? "Hotel Platform", `${baseUrl}/reset-password?token=${raw}`));
      await audit.recordSafe({ tenantId, actorUserId: user._id, action: "PASSWORD_RESET_REQUESTED", resourceType: "User", resourceId: String(user._id), meta });
    },

    /** Used for both "forgot password" and first-time invite links. Revokes every existing session. */
    async resetPassword(tenant: TenantView | null, rawToken: string, newPassword: string, meta: RequestMeta): Promise<void> {
      const tenantId = tid(tenant);
      const purposes = ["PASSWORD_RESET", "INVITE"] as const;
      const peeked = await oneTime.peek(tenantId, rawToken, purposes);
      if (!peeked) throw new ValidationError("This link is invalid or has expired. Please request a new one.");

      const user = await User.findOne({ _id: peeked.userId, tenantId });
      if (!user) throw new ValidationError("This link is invalid or has expired. Please request a new one.");
      const problem = passwordProblemFor(newPassword, user.email);
      if (problem) throw new ValidationError(problem);
      if (!user.isActive) throw new AccountDisabledError();

      const spent = await oneTime.consume(tenantId, rawToken, purposes);
      if (!spent) throw new ValidationError("This link is invalid or has expired. Please request a new one.");

      await User.updateOne(
        { _id: user._id, tenantId },
        { $set: { passwordHash: await hashPassword(newPassword), passwordChangedAt: new Date(), failedLoginCount: 0, emailVerifiedAt: user.emailVerifiedAt ?? new Date() }, $unset: { lockedUntil: 1 } }
      );
      await revokeAllForUser(tenantId, user._id, "PASSWORD_RESET");
      await audit.record({ tenantId, actorUserId: user._id, action: "PASSWORD_CHANGED", resourceType: "User", resourceId: String(user._id), after: { via: spent.purpose }, meta });
    },

    async verifyEmail(tenant: TenantView | null, rawToken: string, meta: RequestMeta): Promise<void> {
      const tenantId = tid(tenant);
      const spent = await oneTime.consume(tenantId, rawToken, ["EMAIL_VERIFY"]);
      if (!spent) throw new ValidationError("This link is invalid or has expired.");
      await User.updateOne({ _id: spent.userId, tenantId }, { $set: { emailVerifiedAt: new Date() } });
      await audit.recordSafe({ tenantId, actorUserId: spent.userId, action: "EMAIL_VERIFIED", resourceType: "User", resourceId: String(spent.userId), meta });
    },
  };
}
export type AuthService = ReturnType<typeof createAuthService>;
