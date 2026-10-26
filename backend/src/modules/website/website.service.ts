import { Types } from "mongoose";
import type { AuthContext, TenantView } from "../../shared/context.js";
import { NotFoundError } from "../../shared/errors.js";
import { pageMeta } from "../../shared/pagination.js";
import type { AuditService, RequestMeta } from "../audit/audit.service.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import { toPublicImage } from "../media/imageUrls.js";
import type { MediaService } from "../media/media.service.js";
import { Facility } from "./facility.model.js";
import { GalleryImage } from "./gallery.model.js";
import type { CreateFacilityBody, CreateGalleryBody, UpdateFacilityBody, UpdateGalleryBody } from "./website.schemas.js";

export function createWebsiteService({ audit, entitlements, media }: { audit: AuditService; entitlements: EntitlementService; media: MediaService }) {
  const facilityDto = (f: { _id: Types.ObjectId; name: string; description?: string | undefined; icon: string; imageAssetId?: Types.ObjectId | undefined; isActive: boolean; sortOrder: number }, assets: Awaited<ReturnType<MediaService["byIds"]>>) => {
    const a = f.imageAssetId ? assets.get(String(f.imageAssetId)) : undefined;
    return { id: String(f._id), name: f.name, description: f.description, icon: f.icon, imageAssetId: f.imageAssetId ? String(f.imageAssetId) : undefined, image: a ? toPublicImage(a, f.name) : undefined, isActive: f.isActive, sortOrder: f.sortOrder };
  };
  const galleryDto = (g: { _id: Types.ObjectId; assetId: Types.ObjectId; caption?: string | undefined; category: string; isActive: boolean; sortOrder: number }, assets: Awaited<ReturnType<MediaService["byIds"]>>) => {
    const a = assets.get(String(g.assetId));
    return { id: String(g._id), assetId: String(g.assetId), caption: g.caption, category: g.category, isActive: g.isActive, sortOrder: g.sortOrder, image: a ? toPublicImage(a, g.caption ?? "") : undefined };
  };

  return {
    facilityDto, galleryDto,

    // ------------------------------------------------------------- facilities
    async listFacilities(tenantId: Types.ObjectId) {
      const rows = await Facility.find({ tenantId }).sort({ sortOrder: 1, name: 1 }).lean();
      const assets = await media.byIds(tenantId, rows.map((r) => r.imageAssetId));
      return rows.map((r) => facilityDto(r, assets));
    },
    async createFacility(actor: AuthContext, tenant: TenantView, body: CreateFacilityBody, meta: RequestMeta) {
      await media.assertOwned(tenant.id, [body.imageAssetId]);
      const f = await Facility.create({ ...body, tenantId: tenant.id });
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "FACILITY_CREATED", resourceType: "Facility", resourceId: String(f._id), after: { name: f.name }, meta });
      return facilityDto(f.toObject(), await media.byIds(tenant.id, [f.imageAssetId]));
    },
    async updateFacility(actor: AuthContext, tenant: TenantView, id: string, body: UpdateFacilityBody, meta: RequestMeta) {
      const f = await Facility.findOne({ _id: id, tenantId: tenant.id });
      if (!f) throw new NotFoundError("Facility not found.");
      if (body.imageAssetId) await media.assertOwned(tenant.id, [body.imageAssetId]);
      for (const [k, v] of Object.entries(body)) f.set(k, v === null ? undefined : v);
      await f.save();
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "FACILITY_UPDATED", resourceType: "Facility", resourceId: id, after: body, meta });
      return facilityDto(f.toObject(), await media.byIds(tenant.id, [f.imageAssetId]));
    },
    async deleteFacility(actor: AuthContext, tenant: TenantView, id: string, meta: RequestMeta) {
      const f = await Facility.findOne({ _id: id, tenantId: tenant.id });
      if (!f) throw new NotFoundError("Facility not found.");
      await Facility.deleteOne({ _id: f._id, tenantId: tenant.id });
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "FACILITY_DELETED", resourceType: "Facility", resourceId: id, before: { name: f.name }, meta });
    },

    // ---------------------------------------------------------------- gallery
    async listGallery(tenantId: Types.ObjectId, page: number, limit: number) {
      const [rows, total] = await Promise.all([
        GalleryImage.find({ tenantId }).sort({ sortOrder: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        GalleryImage.countDocuments({ tenantId }),
      ]);
      const assets = await media.byIds(tenantId, rows.map((r) => r.assetId));
      return { items: rows.map((r) => galleryDto(r, assets)), meta: pageMeta(total, page, limit) };
    },
    async addGallery(actor: AuthContext, tenant: TenantView, body: CreateGalleryBody, meta: RequestMeta) {
      await media.assertOwned(tenant.id, [body.assetId]);
      const ent = await entitlements.forTenant(tenant);
      entitlements.assertWithinLimit(ent, "maxGalleryImages", await GalleryImage.countDocuments({ tenantId: tenant.id }));
      const g = await GalleryImage.create({ ...body, assetId: new Types.ObjectId(body.assetId), tenantId: tenant.id });
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "GALLERY_IMAGE_ADDED", resourceType: "GalleryImage", resourceId: String(g._id), meta });
      return galleryDto(g.toObject(), await media.byIds(tenant.id, [g.assetId]));
    },
    async updateGallery(actor: AuthContext, tenant: TenantView, id: string, body: UpdateGalleryBody, meta: RequestMeta) {
      const g = await GalleryImage.findOne({ _id: id, tenantId: tenant.id });
      if (!g) throw new NotFoundError("Gallery image not found.");
      for (const [k, v] of Object.entries(body)) g.set(k, v === null ? undefined : v);
      await g.save();
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "GALLERY_IMAGE_UPDATED", resourceType: "GalleryImage", resourceId: id, after: body, meta });
      return galleryDto(g.toObject(), await media.byIds(tenant.id, [g.assetId]));
    },
    async removeGallery(actor: AuthContext, tenant: TenantView, id: string, meta: RequestMeta) {
      const g = await GalleryImage.findOne({ _id: id, tenantId: tenant.id });
      if (!g) throw new NotFoundError("Gallery image not found.");
      await GalleryImage.deleteOne({ _id: g._id, tenantId: tenant.id });
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "GALLERY_IMAGE_REMOVED", resourceType: "GalleryImage", resourceId: id, meta });
    },
  };
}
export type WebsiteService = ReturnType<typeof createWebsiteService>;
