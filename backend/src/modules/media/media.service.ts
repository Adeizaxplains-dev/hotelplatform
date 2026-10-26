import { fileTypeFromBuffer } from "file-type";
import { imageSize } from "image-size";
import { Types } from "mongoose";
import { hashToken } from "../../shared/crypto.js";
import type { MediaStorage, ImageFormat } from "../../integrations/media/media.storage.js";
import { BusinessRuleError, ConflictError, NotFoundError, ValidationError } from "../../shared/errors.js";
import { inList } from "../../shared/mongoOps.js";
import { pageMeta } from "../../shared/pagination.js";
import type { AuthContext, TenantView } from "../../shared/context.js";
import type { AuditService, RequestMeta } from "../audit/audit.service.js";
import { HotelProfile } from "../hotel/hotelProfile.model.js";
import { RoomType } from "../rooms/roomType.model.js";
import { Facility } from "../website/facility.model.js";
import { GalleryImage } from "../website/gallery.model.js";
import { WebsiteContent } from "../website/websiteContent.model.js";
import { MediaAsset, type IMediaAsset } from "./media.model.js";

const ALLOWED: Record<string, ImageFormat> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MIN_SIDE = 100;
const MAX_SIDE = 8000;
export const MAX_MEDIA_PER_HOTEL = 1000;

/** Opaque, stable folder name for a hotel's files. Derived with a secret so the internal tenant id never appears in public image URLs. */
export const mediaFolderFor = (secret: string, tenantId: Types.ObjectId | string): string => hashToken(secret, `media-folder:${tenantId}`).slice(0, 24);

export interface UploadedFile {
  buffer: Buffer;
  size: number;
}

export function createMediaService(deps: { storage: MediaStorage; audit: AuditService; maxBytes: number; secret: string }) {
  const { storage, audit, maxBytes, secret } = deps;

  /** Every image id the caller wants to attach must belong to THIS hotel. Another hotel's id is rejected like an unknown one. */
  async function assertOwned(tenantId: Types.ObjectId, ids: Array<string | Types.ObjectId | undefined | null>): Promise<void> {
    const wanted = [...new Set(ids.filter(Boolean).map(String))];
    if (!wanted.length) return;
    const found = await MediaAsset.countDocuments({ tenantId, _id: inList(wanted.map((i) => new Types.ObjectId(i))) });
    if (found !== wanted.length) throw new ValidationError("One or more of the chosen images could not be found. Upload them again.");
  }

  async function usage(tenantId: Types.ObjectId, assetId: Types.ObjectId): Promise<number> {
    const counts = await Promise.all([
      RoomType.countDocuments({ tenantId, imageAssetIds: assetId }),
      GalleryImage.countDocuments({ tenantId, assetId }),
      Facility.countDocuments({ tenantId, imageAssetId: assetId }),
      WebsiteContent.countDocuments({ tenantId, $or: [{ "hero.imageAssetIds": assetId }, { "about.imageAssetId": assetId }] }),
      HotelProfile.countDocuments({ tenantId, $or: [{ "branding.logoAssetId": assetId }, { "branding.faviconAssetId": assetId }, { "seo.ogImageAssetId": assetId }] }),
    ]);
    return counts.reduce((a, b) => a + b, 0);
  }

  return {
    assertOwned,

    /** Loads assets for rendering, keyed by id. One query for any number of ids. */
    async byIds(tenantId: Types.ObjectId, ids: Array<string | Types.ObjectId | undefined | null>): Promise<Map<string, IMediaAsset & { _id: Types.ObjectId }>> {
      const wanted = [...new Set(ids.filter(Boolean).map(String))];
      if (!wanted.length) return new Map();
      const rows = await MediaAsset.find({ tenantId, _id: inList(wanted.map((i) => new Types.ObjectId(i))) }).lean();
      return new Map(rows.map((r) => [String(r._id), r as IMediaAsset & { _id: Types.ObjectId }]));
    },

    /**
     * Validates by CONTENT, not by what the client claims: the file's magic bytes must say JPEG, PNG or WebP
     * (SVG and everything else is refused), the size and pixel dimensions must be sane, and the client's file
     * name and content-type are never trusted or stored.
     */
    async upload(tenant: TenantView, actor: AuthContext, file: UploadedFile | undefined, alt: string | undefined, meta: RequestMeta) {
      if (!file || file.size === 0) throw new ValidationError("Choose an image to upload.");
      if (file.size > maxBytes) throw new ValidationError(`That image is too large. The limit is ${Math.round(maxBytes / 1_000_000)} MB.`);

      const detected = await fileTypeFromBuffer(file.buffer);
      const format = detected ? ALLOWED[detected.mime] : undefined;
      if (!format) throw new ValidationError("Only JPG, PNG or WebP images can be uploaded.");

      let dims: { width: number; height: number };
      try {
        const s = imageSize(file.buffer);
        if (!s.width || !s.height) throw new Error("no size");
        dims = { width: s.width, height: s.height };
      } catch {
        throw new ValidationError("That file could not be read as an image.");
      }
      if (dims.width < MIN_SIDE || dims.height < MIN_SIDE) throw new ValidationError(`The image is too small (minimum ${MIN_SIDE}px on each side).`);
      if (dims.width > MAX_SIDE || dims.height > MAX_SIDE) throw new ValidationError(`The image is too large (maximum ${MAX_SIDE}px on each side).`);

      if ((await MediaAsset.countDocuments({ tenantId: tenant.id })) >= MAX_MEDIA_PER_HOTEL) {
        throw new BusinessRuleError("This hotel has reached its image library limit. Delete unused images first.", "LIMIT_REACHED");
      }

      const stored = await storage.upload({ folder: mediaFolderFor(secret, tenant.id), buffer: file.buffer, format, ...dims });
      let asset;
      try {
        asset = await MediaAsset.create({
          tenantId: tenant.id, provider: storage.provider === "none" ? "memory" : storage.provider, publicId: stored.publicId, url: stored.url,
          width: stored.width, height: stored.height, bytes: stored.bytes, format: stored.format, alt: alt || undefined, uploadedBy: actor.userId,
        });
      } catch (err) {
        await storage.remove(stored.publicId).catch(() => undefined); // do not leave an orphan file behind
        throw err;
      }
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "MEDIA_UPLOADED", resourceType: "MediaAsset", resourceId: String(asset._id), after: { format, bytes: stored.bytes, width: dims.width, height: dims.height }, meta });
      return asset;
    },

    async list(tenantId: Types.ObjectId, page: number, limit: number) {
      const [rows, total] = await Promise.all([
        MediaAsset.find({ tenantId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        MediaAsset.countDocuments({ tenantId }),
      ]);
      return { items: rows, meta: pageMeta(total, page, limit) };
    },

    async updateAlt(tenant: TenantView, actor: AuthContext, id: string, alt: string, meta: RequestMeta) {
      const asset = await MediaAsset.findOneAndUpdate({ _id: id, tenantId: tenant.id }, { $set: { alt } }, { returnDocument: "after" });
      if (!asset) throw new NotFoundError("Image not found.");
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "MEDIA_UPDATED", resourceType: "MediaAsset", resourceId: id, meta });
      return asset;
    },

    /** Refuses to delete an image that a room, gallery, facility, page or branding still uses. */
    async remove(tenant: TenantView, actor: AuthContext, id: string, meta: RequestMeta) {
      const asset = await MediaAsset.findOne({ _id: id, tenantId: tenant.id });
      if (!asset) throw new NotFoundError("Image not found.");
      const inUse = await usage(tenant.id, asset._id);
      if (inUse > 0) throw new ConflictError("This image is still in use. Remove it from the page, room or gallery first.");
      await MediaAsset.deleteOne({ _id: asset._id, tenantId: tenant.id });
      await storage.remove(asset.publicId).catch(() => undefined);
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "MEDIA_DELETED", resourceType: "MediaAsset", resourceId: id, meta });
    },
  };
}
export type MediaService = ReturnType<typeof createMediaService>;
