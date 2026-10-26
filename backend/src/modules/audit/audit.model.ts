import { Schema, model, type Types } from "mongoose";
import { tenantScope } from "../../database/plugins/tenantScope.js";

export interface IAuditLog {
  tenantId: Types.ObjectId | null;
  actorUserId?: Types.ObjectId | undefined;
  action: string;
  resourceType: string;
  resourceId?: string | undefined;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  requestId?: string | undefined;
  createdAt: Date;
}

const auditSchema = new Schema<IAuditLog>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, required: true },
    resourceId: String,
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    ipAddress: { type: String, maxlength: 64 },
    userAgent: { type: String, maxlength: 200 },
    requestId: { type: String, maxlength: 64 },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { versionKey: false }
);
tenantScope(auditSchema, { nullable: true });
auditSchema.index({ tenantId: 1, createdAt: -1 });

// IMMUTABLE: audit rows can be inserted and read, never changed or removed through the model.
const refuse = () => {
  throw new Error("Audit logs are immutable.");
};
for (const op of ["updateOne", "updateMany", "findOneAndUpdate", "findOneAndReplace", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"] as const) {
  auditSchema.pre(op, refuse);
}
auditSchema.pre("save", function () {
  if (!this.isNew) refuse();
});
auditSchema.pre("deleteOne", { document: true, query: false }, refuse);

export const AuditLog = model<IAuditLog>("AuditLog", auditSchema);
