import { Schema, Types, type Query } from "mongoose";

/**
 * TENANT-SCOPE TRIPWIRE: the database-layer defence for tenant isolation.
 *
 * Every tenant-owned collection gets a `tenantId` field and this plugin. Any query or aggregation
 * that does not pin `tenantId` to a single concrete value THROWS before it reaches MongoDB, so a
 * forgotten filter (e.g. Room.findById(id)) fails loudly in tests instead of leaking another hotel's data.
 *
 * - A value must be an ObjectId, a string, or null (platform-level rows). Operators such as
 *   { $ne: ... } or { $in: [...] } are rejected.
 * - Platform code that deliberately works across tenants must say so: .setOptions({ skipTenantScope: true }).
 * - Avoid .populate() into tenant-owned models: populate queries are not tenant-pinned. Load by tenant instead.
 */
export class TenantScopeError extends Error {
  constructor(operation: string, model: string) {
    super(`Unscoped ${operation} on tenant-owned model "${model}": the filter must include tenantId.`);
    this.name = "TenantScopeError";
  }
}

const isConcrete = (v: unknown): boolean => v === null || typeof v === "string" || v instanceof Types.ObjectId;

function pinsTenant(filter: Record<string, unknown> | undefined | null): boolean {
  if (!filter) return false;
  if (Object.prototype.hasOwnProperty.call(filter, "tenantId")) return isConcrete(filter["tenantId"]);
  const and = filter["$and"];
  return Array.isArray(and) && and.some((f) => pinsTenant(f as Record<string, unknown>));
}

const QUERY_OPS = [
  "find", "findOne", "findOneAndUpdate", "findOneAndDelete", "findOneAndReplace",
  "updateOne", "updateMany", "replaceOne", "deleteOne", "deleteMany", "countDocuments", "distinct",
] as const;

export interface TenantScopeOptions {
  /** true for collections that also hold platform-level rows (tenantId = null), e.g. users, sessions, audit logs. */
  nullable?: boolean;
  /**
   * Add the plain `tenantId` index (default). Set false when the model declares its own index that starts with
   * tenantId (for example a UNIQUE one). Declaring both makes Mongoose silently drop the second, losing `unique`.
   */
  indexed?: boolean;
}

export function tenantScope(schema: Schema, { nullable = false, indexed = true }: TenantScopeOptions = {}): void {
  schema.add({
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: !nullable, default: nullable ? null : undefined, ...(indexed ? { index: true } : {}) },
  });

  for (const op of QUERY_OPS) {
    schema.pre(op, function (this: Query<unknown, unknown>) {
      if (this.getOptions()["skipTenantScope"]) return;
      if (!pinsTenant(this.getFilter() as Record<string, unknown>)) throw new TenantScopeError(op, this.model.modelName);
    });
  }

  schema.pre("aggregate", function () {
    if (this.options["skipTenantScope"]) return;
    const first = this.pipeline()[0] as { $match?: Record<string, unknown> } | undefined;
    if (!first?.$match || !pinsTenant(first.$match)) throw new TenantScopeError("aggregate", this.model().modelName);
  });
}
