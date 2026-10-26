import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { requireFeature } from "../../middleware/authenticate.js";
import { requireActiveTenant, requireTenant } from "../../middleware/tenantContext.js";
import { getValidated, validate } from "../../middleware/validate.js";
import { handler } from "../../shared/http.js";
import { getCtx } from "../../shared/context.js";
import { sendSuccess } from "../../shared/response.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import { GALLERY_CATEGORIES } from "../website/gallery.model.js";
import type { PublicService } from "./public.service.js";

/** Short shared-cache lifetime: edits show up within seconds, and a CDN in front can absorb traffic spikes. */
const cacheable: RequestHandler = (_req, res, next) => {
  res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
  res.vary("Host");
  next();
};

const slugParams = z.object({ slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/) }).strict();
const galleryQuery = z.object({ category: z.enum(GALLERY_CATEGORIES).optional() }).strict();

/** Public, unauthenticated read API for a hotel's website. The hotel comes from the address, as everywhere else. */
export function createPublicRouter(entitlements: EntitlementService, pub: PublicService): Router {
  const router = Router();
  const tenantOf = (res: Parameters<typeof getCtx>[0]) => getCtx(res).tenant!;
  router.use(requireTenant, requireActiveTenant, requireFeature(entitlements, "website"), cacheable);

  router.get("/site", handler(async (_req, res) => sendSuccess(res, await pub.site(tenantOf(res)))));
  router.get("/room-types", requireFeature(entitlements, "rooms"), handler(async (_req, res) => sendSuccess(res, await pub.roomTypes(tenantOf(res)))));
  router.get("/room-types/:slug", requireFeature(entitlements, "rooms"), validate({ params: slugParams }), handler(async (_req, res) => {
    sendSuccess(res, await pub.roomType(tenantOf(res), getValidated<unknown, unknown, { slug: string }>(res).params.slug));
  }));
  router.get("/facilities", requireFeature(entitlements, "cms"), handler(async (_req, res) => sendSuccess(res, await pub.facilities(tenantOf(res)))));
  router.get("/gallery", requireFeature(entitlements, "gallery"), validate({ query: galleryQuery }), handler(async (_req, res) => {
    sendSuccess(res, await pub.gallery(tenantOf(res), getValidated<unknown, { category?: string }>(res).query.category));
  }));
  return router;
}
