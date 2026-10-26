import { Router } from "express";
import multer from "multer";
import { authenticate, requireAnyPermission, requireFeature, requirePermission } from "../../middleware/authenticate.js";
import { createRateLimiter } from "../../middleware/rateLimit.js";
import { requireActiveTenant, requireTenant } from "../../middleware/tenantContext.js";
import { getValidated, validate } from "../../middleware/validate.js";
import { actorAndTenant, handler, metaOf } from "../../shared/http.js";
import { sendSuccess } from "../../shared/response.js";
import { objectIdSchema } from "../../shared/pagination.js";
import { z } from "zod";
import type { AuthService } from "../auth/auth.service.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import { toPublicImage } from "../media/imageUrls.js";
import type { MediaService } from "../media/media.service.js";
import { createFacilitySchema, createGallerySchema, mediaListQuery, updateFacilitySchema, updateGallerySchema, updateMediaSchema, uploadFieldsSchema } from "./website.schemas.js";
import type { CreateFacilityBody, CreateGalleryBody, UpdateFacilityBody, UpdateGalleryBody } from "./website.schemas.js";
import type { WebsiteService } from "./website.service.js";
import type { IMediaAsset } from "../media/media.model.js";
import type { Types } from "mongoose";

type Id = { id: string };
const idParams = z.object({ id: objectIdSchema }).strict();
const galleryList = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50) }).strict();

const mediaDto = (a: IMediaAsset & { _id: Types.ObjectId }) => ({ id: String(a._id), ...toPublicImage(a), bytes: a.bytes, format: a.format, createdAt: (a as unknown as { createdAt?: Date }).createdAt });

export function createWebsiteRouters(auth: AuthService, entitlements: EntitlementService, website: WebsiteService, media: MediaService, uploadMaxBytes: number): { facilities: Router; gallery: Router; media: Router } {
  const chain = (feature: Parameters<typeof requireFeature>[1]) => [requireTenant, requireActiveTenant, authenticate(auth), requireFeature(entitlements, feature)] as const;

  const facilities = Router();
  facilities.use(...chain("cms"));
  facilities.get("/", requirePermission("cms.read"), handler(async (_req, res) => sendSuccess(res, await website.listFacilities(actorAndTenant(res).tenant.id))));
  facilities.post("/", requirePermission("cms.update"), validate({ body: createFacilitySchema }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    sendSuccess(res, await website.createFacility(actor, tenant, getValidated<CreateFacilityBody>(res).body, metaOf(req, res)), 201);
  }));
  facilities.patch("/:id", requirePermission("cms.update"), validate({ params: idParams, body: updateFacilitySchema }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    const v = getValidated<UpdateFacilityBody, unknown, Id>(res);
    sendSuccess(res, await website.updateFacility(actor, tenant, v.params.id, v.body, metaOf(req, res)));
  }));
  facilities.delete("/:id", requirePermission("cms.update"), validate({ params: idParams }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    await website.deleteFacility(actor, tenant, getValidated<unknown, unknown, Id>(res).params.id, metaOf(req, res));
    sendSuccess(res, { deleted: true });
  }));

  const gallery = Router();
  gallery.use(...chain("gallery"));
  gallery.get("/", requirePermission("cms.read"), validate({ query: galleryList }), handler(async (_req, res) => {
    const q = getValidated<unknown, { page: number; limit: number }>(res).query;
    const { items, meta } = await website.listGallery(actorAndTenant(res).tenant.id, q.page, q.limit);
    sendSuccess(res, items, 200, meta);
  }));
  gallery.post("/", requirePermission("cms.update"), validate({ body: createGallerySchema }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    sendSuccess(res, await website.addGallery(actor, tenant, getValidated<CreateGalleryBody>(res).body, metaOf(req, res)), 201);
  }));
  gallery.patch("/:id", requirePermission("cms.update"), validate({ params: idParams, body: updateGallerySchema }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    const v = getValidated<UpdateGalleryBody, unknown, Id>(res);
    sendSuccess(res, await website.updateGallery(actor, tenant, v.params.id, v.body, metaOf(req, res)));
  }));
  gallery.delete("/:id", requirePermission("cms.update"), validate({ params: idParams }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    await website.removeGallery(actor, tenant, getValidated<unknown, unknown, Id>(res).params.id, metaOf(req, res));
    sendSuccess(res, { deleted: true });
  }));

  // Uploads: memory storage with hard limits; the file's CONTENT is verified in MediaService (never its name or claimed type).
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: uploadMaxBytes, files: 1, fields: 4, parts: 6 } }).single("file");
  const canEditSomething = requireAnyPermission("cms.update", "rooms.update", "settings.update");
  const canSeeSomething = requireAnyPermission("cms.read", "rooms.read", "settings.read");

  const mediaRouter = Router();
  mediaRouter.use(...chain("website"));
  mediaRouter.post("/", canEditSomething, createRateLimiter({ windowMs: 10 * 60 * 1000, max: 60, message: "You're uploading too quickly. Please wait a few minutes." }), upload, handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    const fields = uploadFieldsSchema.parse(req.body ?? {});
    const asset = await media.upload(tenant, actor, req.file ? { buffer: req.file.buffer, size: req.file.size } : undefined, fields.alt, metaOf(req, res));
    sendSuccess(res, mediaDto(asset.toObject() as IMediaAsset & { _id: Types.ObjectId }), 201);
  }));
  mediaRouter.get("/", canSeeSomething, validate({ query: mediaListQuery }), handler(async (_req, res) => {
    const q = getValidated<unknown, { page: number; limit: number }>(res).query;
    const { items, meta } = await media.list(actorAndTenant(res).tenant.id, q.page, q.limit);
    sendSuccess(res, items.map((a) => mediaDto(a as IMediaAsset & { _id: Types.ObjectId })), 200, meta);
  }));
  mediaRouter.patch("/:id", canEditSomething, validate({ params: idParams, body: updateMediaSchema }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    const v = getValidated<{ alt: string }, unknown, Id>(res);
    const a = await media.updateAlt(tenant, actor, v.params.id, v.body.alt, metaOf(req, res));
    sendSuccess(res, mediaDto(a.toObject() as IMediaAsset & { _id: Types.ObjectId }));
  }));
  mediaRouter.delete("/:id", canEditSomething, validate({ params: idParams }), handler(async (req, res) => {
    const { actor, tenant } = actorAndTenant(res);
    await media.remove(tenant, actor, getValidated<unknown, unknown, Id>(res).params.id, metaOf(req, res));
    sendSuccess(res, { deleted: true });
  }));

  return { facilities, gallery, media: mediaRouter };
}
