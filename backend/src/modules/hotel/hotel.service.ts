import type { Types } from "mongoose";
import type { AuthContext, TenantView } from "../../shared/context.js";
import { ensureTenantDoc, toUpdateOps } from "../../shared/upsert.js";
import type { AuditService, RequestMeta } from "../audit/audit.service.js";
import { toPublicImage, type PublicImage } from "../media/imageUrls.js";
import type { MediaService } from "../media/media.service.js";
import { WebsiteContent } from "../website/websiteContent.model.js";
import type { UpdateContentBody, UpdateProfileBody } from "./hotel.schemas.js";
import { HotelProfile } from "./hotelProfile.model.js";

const strip = <T extends object>(doc: T): Record<string, unknown> => {
  const { _id, tenantId: _t, __v, createdAt: _c, updatedAt: _u, ...rest } = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
  void _id; void _t; void __v; void _c; void _u;
  return rest;
};

export function createHotelService({ audit, media }: { audit: AuditService; media: MediaService }) {
  async function imagesFor(tenantId: Types.ObjectId, ids: Array<unknown>): Promise<Record<string, PublicImage>> {
    const map = await media.byIds(tenantId, ids as Array<string | undefined>);
    return Object.fromEntries([...map.entries()].map(([id, a]) => [id, toPublicImage(a)]));
  }

  return {
    async getProfile(tenantId: Types.ObjectId) {
      const doc = (await ensureTenantDoc(HotelProfile, tenantId))!;
      const view = strip(doc.toObject()) as { branding?: { logoAssetId?: unknown; faviconAssetId?: unknown }; seo?: { ogImageAssetId?: unknown } };
      const ids = [view.branding?.logoAssetId, view.branding?.faviconAssetId, view.seo?.ogImageAssetId];
      return { ...view, assets: await imagesFor(tenantId, ids) };
    },

    async updateProfile(actor: AuthContext, tenant: TenantView, body: UpdateProfileBody, meta: RequestMeta) {
      await media.assertOwned(tenant.id, [body.branding?.logoAssetId, body.branding?.faviconAssetId, body.seo?.ogImageAssetId]);
      const before = (await ensureTenantDoc(HotelProfile, tenant.id))!.toObject();
      const { $set, $unset } = toUpdateOps(body as Record<string, unknown>);
      await HotelProfile.updateOne({ tenantId: tenant.id }, { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) });
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "SETTINGS_UPDATED", resourceType: "HotelProfile", before: strip(before), after: body, meta });
      return this.getProfile(tenant.id);
    },

    async getContent(tenantId: Types.ObjectId) {
      const doc = (await ensureTenantDoc(WebsiteContent, tenantId))!;
      const view = strip(doc.toObject()) as { hero?: { imageAssetIds?: unknown[] }; about?: { imageAssetId?: unknown } };
      const ids = [...(view.hero?.imageAssetIds ?? []), view.about?.imageAssetId];
      return { ...view, assets: await imagesFor(tenantId, ids) };
    },

    async updateContent(actor: AuthContext, tenant: TenantView, body: UpdateContentBody, meta: RequestMeta) {
      await media.assertOwned(tenant.id, [...(body.hero?.imageAssetIds ?? []), body.about?.imageAssetId]);
      const before = (await ensureTenantDoc(WebsiteContent, tenant.id))!.toObject();
      const { $set, $unset } = toUpdateOps(body as Record<string, unknown>);
      await WebsiteContent.updateOne({ tenantId: tenant.id }, { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) });
      await audit.record({ tenantId: tenant.id, actorUserId: actor.userId, action: "CONTENT_UPDATED", resourceType: "WebsiteContent", before: strip(before), after: Object.keys(body), meta });
      return this.getContent(tenant.id);
    },
  };
}
export type HotelService = ReturnType<typeof createHotelService>;
