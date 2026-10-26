import type { Model, Types } from "mongoose";

/**
 * Returns the hotel's single document of this kind, creating it with schema defaults on first use.
 * Two simultaneous first requests can race on the unique tenantId index: the loser simply reads the winner's row.
 */
export async function ensureTenantDoc<T>(model: Model<T>, tenantId: Types.ObjectId) {
  try {
    return await model.findOneAndUpdate({ tenantId } as never, { $setOnInsert: { tenantId } } as never, { upsert: true, returnDocument: "after" });
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    return model.findOne({ tenantId } as never);
  }
}

/** Turns a nested PATCH body into Mongo $set / $unset paths. `null` clears a value; arrays replace wholesale. */
export function toUpdateOps(body: Record<string, unknown>, prefix = ""): { $set: Record<string, unknown>; $unset: Record<string, 1> } {
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (value === null) $unset[path] = 1;
    else if (typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      const nested = toUpdateOps(value as Record<string, unknown>, path);
      Object.assign($set, nested.$set);
      Object.assign($unset, nested.$unset);
    } else $set[path] = value;
  }
  return { $set, $unset };
}
