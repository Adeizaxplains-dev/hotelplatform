import type { Logger } from "pino";
import type { Types } from "mongoose";
import { AuditLog } from "./audit.model.js";

export interface RequestMeta {
  ip?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
}

export interface AuditEvent {
  tenantId: Types.ObjectId | null;
  actorUserId?: Types.ObjectId | undefined;
  action: string;
  resourceType: string;
  resourceId?: string | undefined;
  before?: unknown;
  after?: unknown;
  meta?: RequestMeta | undefined;
}

const SECRET_KEY = /pass(word)?|token|secret|hash|authorization|cookie/i;

/** Removes anything secret-looking from before/after snapshots. Audit rows must never hold credentials. */
export function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  const src = typeof (value as { toObject?: unknown }).toObject === "function" ? (value as { toObject: () => object }).toObject() : value;
  return Object.fromEntries(
    Object.entries(src as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEY.test(k) ? "[REDACTED]" : scrub(v, depth + 1)])
  );
}

const present = (a: { _id: unknown; action: string; resourceType: string; resourceId?: string | undefined; actorUserId?: Types.ObjectId | undefined; before?: unknown; after?: unknown; ipAddress?: string | undefined; createdAt: Date }) => ({
  id: String(a._id), action: a.action, resourceType: a.resourceType, resourceId: a.resourceId,
  actorUserId: a.actorUserId ? String(a.actorUserId) : undefined, before: a.before, after: a.after, ipAddress: a.ipAddress, createdAt: a.createdAt,
});

export function createAuditService(logger: Logger) {
  const toDoc = (e: AuditEvent) => ({
    tenantId: e.tenantId,
    actorUserId: e.actorUserId,
    action: e.action,
    resourceType: e.resourceType,
    resourceId: e.resourceId,
    before: scrub(e.before),
    after: scrub(e.after),
    ipAddress: e.meta?.ip,
    userAgent: e.meta?.userAgent,
    requestId: e.meta?.requestId,
  });

  return {
    /** For changes that matter: if the audit row cannot be written, the operation fails. */
    async record(event: AuditEvent): Promise<void> {
      await AuditLog.create(toDoc(event));
    },
    /** For high-volume security events (logins): best effort, a failure is logged but does not block the user. */
    async recordSafe(event: AuditEvent): Promise<void> {
      try {
        await AuditLog.create(toDoc(event));
      } catch (err) {
        logger.error({ err, action: event.action }, "Failed to write audit event");
      }
    },
    /** One hotel's own trail (or the platform's, with tenantId null). Always tenant-pinned. */
    async list(tenantId: Types.ObjectId | null, page: number, limit: number, action?: string) {
      const filter: Record<string, unknown> = { tenantId, ...(action ? { action } : {}) };
      const [items, total] = await Promise.all([
        AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        AuditLog.countDocuments(filter),
      ]);
      return { items: items.map(present), total };
    },
    /** Platform operator only: every hotel's trail at once (explicitly opts out of tenant scoping). */
    async listAll(page: number, limit: number, opts: { tenantId?: Types.ObjectId | undefined; action?: string | undefined } = {}) {
      const filter: Record<string, unknown> = { ...(opts.tenantId ? { tenantId: opts.tenantId } : {}), ...(opts.action ? { action: opts.action } : {}) };
      const [items, total] = await Promise.all([
        AuditLog.find(filter).setOptions({ skipTenantScope: true }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        AuditLog.countDocuments(filter).setOptions({ skipTenantScope: true }),
      ]);
      return { items: items.map((a) => ({ ...present(a), tenantId: a.tenantId ? String(a.tenantId) : null })), total };
    },
  };
}
export type AuditService = ReturnType<typeof createAuditService>;
