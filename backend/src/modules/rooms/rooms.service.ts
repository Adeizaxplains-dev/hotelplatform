import { Types } from "mongoose";
import type { AuthContext, TenantView } from "../../shared/context.js";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors.js";
import { containsText } from "../../shared/mongoOps.js";
import { pageMeta } from "../../shared/pagination.js";
import { slugify, uniqueSlug } from "../../shared/slug.js";
import type { AuditService, RequestMeta } from "../audit/audit.service.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import { toPublicImage, type PublicImage } from "../media/imageUrls.js";
import type { MediaService } from "../media/media.service.js";
import { AMENITIES } from "./amenities.js";
import { Room } from "./room.model.js";
import { RoomType, type IRoomType } from "./roomType.model.js";
import { Reservation } from "../reservations/reservation.model.js";
import type { CreateRoomBody, CreateRoomTypeBody, ListRoomTypesQuery, ListRoomsQuery, UpdateRoomBody, UpdateRoomTypeBody } from "./rooms.schemas.js";

type TypeDoc = IRoomType & { _id: Types.ObjectId; createdAt?: Date };

export const amenityView = (keys: string[]) =>
  keys.flatMap((k) => {
    const a = AMENITIES.find((x) => x.key === k);
    return a ? [{ key: a.key, label: a.label, icon: a.icon }] : [];
  });

interface Deps {
  audit: AuditService;
  entitlements: EntitlementService;
  media: MediaService;
}

export function createRoomService({ audit, entitlements, media }: Deps) {
  const typeDto = (t: TypeDoc, assets: Map<string, Parameters<typeof toPublicImage>[0]>, roomCount?: number) => ({
    id: String(t._id), name: t.name, slug: t.slug, shortDescription: t.shortDescription, description: t.description,
    maxAdults: t.maxAdults, maxChildren: t.maxChildren, bedConfig: t.bedConfig, sizeSqm: t.sizeSqm, basePrice: t.basePrice,
    amenityKeys: t.amenityKeys, isFeatured: t.isFeatured, isActive: t.isActive, sortOrder: t.sortOrder, seo: t.seo, createdAt: t.createdAt,
    images: t.imageAssetIds.flatMap((id) => {
      const a = assets.get(String(id));
      return a ? [{ assetId: String(id), ...(toPublicImage(a, t.name) as PublicImage) }] : [];
    }),
    ...(roomCount === undefined ? {} : { roomCount }),
  });

  async function loadType(tenantId: Types.ObjectId, id: string) {
    const t = await RoomType.findOne({ _id: id, tenantId });
    if (!t) throw new NotFoundError("Room type not found.");
    return t;
  }

  async function assertSlugFree(tenantId: Types.ObjectId, slug: string, exceptId?: string) {
    const clash = await RoomType.findOne({ tenantId, slug });
    if (clash && String(clash._id) !== exceptId) throw new ConflictError("Another room type already uses that address.");
  }

  /** A room's type must be one of THIS hotel's types. Another hotel's id is reported as not found. */
  async function assertType(tenantId: Types.ObjectId, id: string) {
    if (!(await RoomType.exists({ tenantId, _id: id }))) throw new ValidationError("Choose one of your room types.");
  }

  return {
    typeDto,

    // ---------------------------------------------------------------- room types
    async listTypes(tenantId: Types.ObjectId, q: ListRoomTypesQuery) {
      const filter: Record<string, unknown> = { tenantId, ...(q.active !== undefined ? { isActive: q.active } : {}), ...(q.search ? { name: containsText(q.search) } : {}) };
      const [rows, total, counts] = await Promise.all([
        RoomType.find(filter).sort({ sortOrder: 1, name: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
        RoomType.countDocuments(filter),
        Room.aggregate([{ $match: { tenantId } }, { $group: { _id: "$roomTypeId", n: { $sum: 1 } } }]),
      ]);
      const countBy = new Map<string, number>(counts.map((c: { _id: Types.ObjectId; n: number }) => [String(c._id), c.n]));
      const assets = await media.byIds(tenantId, rows.flatMap((r) => r.imageAssetIds));
      return { items: rows.map((r) => typeDto(r as TypeDoc, assets, countBy.get(String(r._id)) ?? 0)), meta: pageMeta(total, q.page, q.limit) };
    },

    async getType(tenantId: Types.ObjectId, id: string) {
      const t = await loadType(tenantId, id);
      const assets = await media.byIds(tenantId, t.imageAssetIds);
      return typeDto(t.toObject() as TypeDoc, assets, await Room.countDocuments({ tenantId, roomTypeId: t._id }));
    },

    async createType(actor: AuthContext, tenant: TenantView, body: CreateRoomTypeBody, meta: RequestMeta) {
      await media.assertOwned(tenant.id, body.imageAssetIds ?? []);
      const slug = body.slug ?? (await uniqueSlug(slugify(body.name), async (s) => Boolean(await RoomType.exists({ tenantId: tenant.id, slug: s }))));
      if (body.slug) await assertSlugFree(tenant.id, slug);
      const t = await RoomType.create({ ...body, slug, tenantId: tenant.id });
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "ROOM_TYPE_CREATED", resourceType: "RoomType", resourceId: String(t._id), after: { name: t.name, basePrice: t.basePrice }, meta });
      return this.getType(tenant.id, String(t._id));
    },

    async updateType(actor: AuthContext, tenant: TenantView, id: string, body: UpdateRoomTypeBody, meta: RequestMeta) {
      const t = await loadType(tenant.id, id);
      if (body.imageAssetIds) await media.assertOwned(tenant.id, body.imageAssetIds);
      if (body.slug && body.slug !== t.slug) await assertSlugFree(tenant.id, body.slug, id);
      const before = { name: t.name, basePrice: t.basePrice, isActive: t.isActive };

      for (const [key, value] of Object.entries(body)) t.set(key, value === null ? undefined : value);
      await t.save();

      if (body.basePrice !== undefined && body.basePrice !== before.basePrice) {
        await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "ROOM_PRICE_CHANGED", resourceType: "RoomType", resourceId: id, before: { basePrice: before.basePrice }, after: { basePrice: t.basePrice }, meta });
      }
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "ROOM_TYPE_UPDATED", resourceType: "RoomType", resourceId: id, before, after: { name: t.name, basePrice: t.basePrice, isActive: t.isActive }, meta });
      return this.getType(tenant.id, id);
    },

    async deleteType(actor: AuthContext, tenant: TenantView, id: string, meta: RequestMeta) {
      const t = await loadType(tenant.id, id);
      const n = await Room.countDocuments({ tenantId: tenant.id, roomTypeId: t._id });
      if (n > 0) throw new ConflictError(`${n} room${n === 1 ? " uses" : "s use"} this type. Move or remove ${n === 1 ? "it" : "them"} first, or hide the type instead.`);
      await RoomType.deleteOne({ _id: t._id, tenantId: tenant.id });
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "ROOM_TYPE_DELETED", resourceType: "RoomType", resourceId: id, before: { name: t.name }, meta });
    },

    // -------------------------------------------------------------------- rooms
    roomDto: (r: { _id: Types.ObjectId; roomNumber: string; roomTypeId: Types.ObjectId; floor?: number | undefined; status: string; housekeepingStatus: string; isActive: boolean }, typeName?: string) => ({
      id: String(r._id), roomNumber: r.roomNumber, roomTypeId: String(r.roomTypeId), roomTypeName: typeName, floor: r.floor,
      status: r.status, housekeepingStatus: r.housekeepingStatus, isActive: r.isActive,
    }),

    async listRooms(tenantId: Types.ObjectId, q: ListRoomsQuery) {
      const filter: Record<string, unknown> = {
        tenantId,
        ...(q.roomTypeId ? { roomTypeId: new Types.ObjectId(q.roomTypeId) } : {}), ...(q.status ? { status: q.status } : {}),
        ...(q.active !== undefined ? { isActive: q.active } : {}), ...(q.search ? { roomNumber: containsText(q.search) } : {}),
      };
      const [rows, total, types] = await Promise.all([
        Room.find(filter).sort({ roomNumber: 1 }).skip((q.page - 1) * q.limit).limit(q.limit).lean(),
        Room.countDocuments(filter),
        RoomType.find({ tenantId }).select("name").lean(),
      ]);
      const names = new Map(types.map((t) => [String(t._id), t.name]));
      return { items: rows.map((r) => this.roomDto(r, names.get(String(r.roomTypeId)))), meta: pageMeta(total, q.page, q.limit) };
    },

    async getRoom(tenantId: Types.ObjectId, id: string) {
      const r = await Room.findOne({ _id: id, tenantId });
      if (!r) throw new NotFoundError("Room not found.");
      const t = await RoomType.findOne({ _id: r.roomTypeId, tenantId });
      return this.roomDto(r, t?.name);
    },

    async createRoom(actor: AuthContext, tenant: TenantView, body: CreateRoomBody, meta: RequestMeta) {
      await assertType(tenant.id, body.roomTypeId);
      const ent = await entitlements.forTenant(tenant);
      entitlements.assertWithinLimit(ent, "maxRooms", await Room.countDocuments({ tenantId: tenant.id }));
      if (await Room.exists({ tenantId: tenant.id, roomNumber: body.roomNumber })) throw new ConflictError(`Room ${body.roomNumber} already exists.`);
      const r = await Room.create({ ...body, roomTypeId: new Types.ObjectId(body.roomTypeId), tenantId: tenant.id });
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "ROOM_CREATED", resourceType: "Room", resourceId: String(r._id), after: { roomNumber: r.roomNumber, roomTypeId: body.roomTypeId }, meta });
      return this.getRoom(tenant.id, String(r._id));
    },

    async updateRoom(actor: AuthContext, tenant: TenantView, id: string, body: UpdateRoomBody, meta: RequestMeta) {
      const r = await Room.findOne({ _id: id, tenantId: tenant.id });
      if (!r) throw new NotFoundError("Room not found.");
      if (body.roomTypeId) await assertType(tenant.id, body.roomTypeId);
      if (body.roomNumber && body.roomNumber !== r.roomNumber && (await Room.exists({ tenantId: tenant.id, roomNumber: body.roomNumber }))) throw new ConflictError(`Room ${body.roomNumber} already exists.`);
      const before = { roomNumber: r.roomNumber, roomTypeId: String(r.roomTypeId), status: r.status, isActive: r.isActive };
      for (const [key, value] of Object.entries(body)) r.set(key, key === "roomTypeId" ? new Types.ObjectId(value as string) : value === null ? undefined : value);
      await r.save();
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "ROOM_UPDATED", resourceType: "Room", resourceId: id, before, after: body, meta });
      return this.getRoom(tenant.id, id);
    },

    /** Preserve reservation history: rooms that have ever been booked cannot be hard-deleted. */
    async deleteRoom(actor: AuthContext, tenant: TenantView, id: string, meta: RequestMeta) {
      const r = await Room.findOne({ _id: id, tenantId: tenant.id });
      if (!r) throw new NotFoundError("Room not found.");
      const reservations = await Reservation.countDocuments({ tenantId: tenant.id, roomId: r._id });
      if (reservations > 0) throw new ConflictError("This room has reservation history and cannot be deleted. Deactivate it instead.");
      await Room.deleteOne({ _id: r._id, tenantId: tenant.id });
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "ROOM_DELETED", resourceType: "Room", resourceId: id, before: { roomNumber: r.roomNumber }, meta });
    },
  };
}
export type RoomService = ReturnType<typeof createRoomService>;
