import type { Model, Types, UpdateQuery } from "mongoose";

/**
 * Thin helper for tenant-owned collections: every method pins tenantId, so service code cannot
 * forget it. Built per request/operation with the tenant from the verified context.
 *
 *   const rooms = tenantRepository(Room, ctx.tenant.id);
 *   await rooms.findById(id);            // → Room.findOne({ _id: id, tenantId })
 */
export function tenantRepository<T>(model: Model<T>, tenantId: Types.ObjectId | null) {
  return {
    findById: (id: Types.ObjectId | string) => model.findOne({ _id: id, tenantId } as never),
    findOne: (filter: Record<string, unknown> = {}) => model.findOne({ ...filter, tenantId } as never),
    find: (filter: Record<string, unknown> = {}) => model.find({ ...filter, tenantId } as never),
    count: (filter: Record<string, unknown> = {}) => model.countDocuments({ ...filter, tenantId } as never),
    create: (data: Record<string, unknown>) => model.create({ ...data, tenantId } as never),
    updateById: (id: Types.ObjectId | string, update: UpdateQuery<T>) =>
      model.findOneAndUpdate({ _id: id, tenantId } as never, update, { returnDocument: "after", runValidators: true }),
    deleteById: (id: Types.ObjectId | string) => model.deleteOne({ _id: id, tenantId } as never),
  };
}
