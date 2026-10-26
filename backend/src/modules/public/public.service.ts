import type { Types } from "mongoose";
import type { TenantView } from "../../shared/context.js";
import { NotFoundError } from "../../shared/errors.js";
import type { EntitlementService } from "../entitlements/entitlement.service.js";
import { enabledFeatures } from "../entitlements/features.js";
import { HotelProfile } from "../hotel/hotelProfile.model.js";
import { toPublicImage, type PublicImage } from "../media/imageUrls.js";
import type { MediaService } from "../media/media.service.js";
import { AMENITIES } from "../rooms/amenities.js";
import { RoomType, type IRoomType } from "../rooms/roomType.model.js";
import { Facility } from "../website/facility.model.js";
import { GalleryImage } from "../website/gallery.model.js";
import { WebsiteContent } from "../website/websiteContent.model.js";

type Assets = Awaited<ReturnType<MediaService["byIds"]>>;
const img = (assets: Assets, id: unknown, alt = ""): PublicImage | null => {
  const a = id ? assets.get(String(id)) : undefined;
  return a ? toPublicImage(a, alt) : null;
};

/**
 * Builds the PUBLIC view of a hotel. Everything here is an explicit allow-list of fields: no ids, no tenant ids,
 * no room numbers, no inactive items, no internal flags. Parts the hotel's plan does not include are simply absent.
 */
export function createPublicService({ entitlements, media }: { entitlements: EntitlementService; media: MediaService }) {
  const roomTypeDto = (t: IRoomType & { _id: Types.ObjectId }, assets: Assets, currency: string) => ({
    slug: t.slug, name: t.name, shortDescription: t.shortDescription ?? null, description: t.description ?? null,
    maxAdults: t.maxAdults, maxChildren: t.maxChildren, bedConfig: t.bedConfig ?? null, sizeSqm: t.sizeSqm ?? null,
    price: { amount: t.basePrice, currency }, isFeatured: t.isFeatured,
    amenities: t.amenityKeys.flatMap((k) => {
      const a = AMENITIES.find((x) => x.key === k);
      return a ? [{ key: a.key, label: a.label, icon: a.icon }] : [];
    }),
    images: t.imageAssetIds.flatMap((id) => {
      const i = img(assets, id, t.name);
      return i ? [i] : [];
    }),
    seo: { title: t.seo?.title ?? null, description: t.seo?.description ?? null },
  });

  return {
    async site(tenant: TenantView) {
      const t = tenant.id;
      const ent = await entitlements.forTenant(tenant);
      const f = ent.features;
      const [profile, content, types, facilities, gallery] = await Promise.all([
        HotelProfile.findOne({ tenantId: t }).lean(),
        f.cms ? WebsiteContent.findOne({ tenantId: t }).lean() : null,
        f.rooms ? RoomType.find({ tenantId: t, isActive: true }).sort({ isFeatured: -1, sortOrder: 1, name: 1 }).limit(6).lean() : [],
        f.cms ? Facility.find({ tenantId: t, isActive: true }).sort({ sortOrder: 1, name: 1 }).limit(12).lean() : [],
        f.gallery ? GalleryImage.find({ tenantId: t, isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).limit(8).lean() : [],
      ]);

      const assets = await media.byIds(t, [
        profile?.branding?.logoAssetId, profile?.branding?.faviconAssetId, profile?.seo?.ogImageAssetId,
        ...(content?.hero?.imageAssetIds ?? []), content?.about?.imageAssetId,
        ...types.flatMap((x) => x.imageAssetIds), ...facilities.map((x) => x.imageAssetId), ...gallery.map((x) => x.assetId),
      ]);

      const roomTypes = types.map((x) => roomTypeDto(x as IRoomType & { _id: Types.ObjectId }, assets, tenant.currency));
      const explicitHero = (content?.hero?.imageAssetIds ?? []).flatMap((id) => {
        const i = img(assets, id, tenant.name);
        return i ? [i] : [];
      });
      const heroImages = explicitHero.length ? explicitHero : roomTypes[0]?.images.slice(0, 1) ?? [];

      return {
        hotel: {
          name: tenant.name, slug: tenant.slug, currency: tenant.currency, timezone: tenant.timezone,
          tagline: profile?.tagline ?? null, description: profile?.description ?? null,
          contact: {
            phone: profile?.contact?.phone ?? null, whatsapp: profile?.contact?.whatsapp ?? null, email: profile?.contact?.email ?? null,
            address: profile?.contact?.address ?? null, city: profile?.contact?.city ?? null, state: profile?.contact?.state ?? null, country: profile?.contact?.country ?? null,
            mapEmbedUrl: profile?.contact?.mapEmbedUrl ?? null, latitude: profile?.contact?.latitude ?? null, longitude: profile?.contact?.longitude ?? null,
          },
          social: { facebook: profile?.social?.facebook ?? null, instagram: profile?.social?.instagram ?? null, x: profile?.social?.x ?? null, tiktok: profile?.social?.tiktok ?? null, youtube: profile?.social?.youtube ?? null },
          policies: {
            checkInTime: profile?.policies?.checkInTime ?? "14:00", checkOutTime: profile?.policies?.checkOutTime ?? "12:00",
            cancellation: profile?.policies?.cancellation ?? null, houseRules: profile?.policies?.houseRules ?? null, children: profile?.policies?.children ?? null, pets: profile?.policies?.pets ?? null,
          },
          branding: {
            primaryColor: profile?.branding?.primaryColor ?? "#0B6E6E", accentColor: profile?.branding?.accentColor ?? "#B8863B", typography: profile?.branding?.typography ?? "modern",
            logo: img(assets, profile?.branding?.logoAssetId, `${tenant.name} logo`), favicon: img(assets, profile?.branding?.faviconAssetId),
          },
          seo: { titleTemplate: profile?.seo?.titleTemplate ?? null, defaultDescription: profile?.seo?.defaultDescription ?? null, ogImage: img(assets, profile?.seo?.ogImageAssetId, tenant.name) },
        },
        features: enabledFeatures(ent),
        content: content
          ? {
              hero: { headline: content.hero?.headline ?? null, subheadline: content.hero?.subheadline ?? null, images: heroImages },
              about: { heading: content.about?.heading ?? null, body: content.about?.body ?? null, image: img(assets, content.about?.imageAssetId, tenant.name), highlights: content.about?.highlights ?? [] },
              whyChooseUs: content.whyChooseUs ?? [], testimonials: content.testimonials ?? [], faqs: content.faqs ?? [],
              pageSeo: content.pageSeo ?? {},
            }
          : { hero: { headline: null, subheadline: null, images: heroImages }, about: { heading: null, body: null, image: null, highlights: [] }, whyChooseUs: [], testimonials: [], faqs: [], pageSeo: {} },
        featuredRooms: roomTypes,
        facilities: facilities.map((x) => ({ name: x.name, description: x.description ?? null, icon: x.icon, image: img(assets, x.imageAssetId, x.name) })),
        gallery: gallery.flatMap((x) => {
          const i = img(assets, x.assetId, x.caption ?? "");
          return i ? [{ caption: x.caption ?? null, category: x.category, image: i }] : [];
        }),
      };
    },

    async roomTypes(tenant: TenantView) {
      const rows = await RoomType.find({ tenantId: tenant.id, isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
      const assets = await media.byIds(tenant.id, rows.flatMap((r) => r.imageAssetIds));
      return rows.map((r) => roomTypeDto(r as IRoomType & { _id: Types.ObjectId }, assets, tenant.currency));
    },

    async roomType(tenant: TenantView, slug: string) {
      const r = await RoomType.findOne({ tenantId: tenant.id, slug, isActive: true }).lean();
      if (!r) throw new NotFoundError("We couldn't find that room.");
      const assets = await media.byIds(tenant.id, r.imageAssetIds);
      return roomTypeDto(r as IRoomType & { _id: Types.ObjectId }, assets, tenant.currency);
    },

    async facilities(tenant: TenantView) {
      const rows = await Facility.find({ tenantId: tenant.id, isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
      const assets = await media.byIds(tenant.id, rows.map((r) => r.imageAssetId));
      return rows.map((x) => ({ name: x.name, description: x.description ?? null, icon: x.icon, image: img(assets, x.imageAssetId, x.name) }));
    },

    async gallery(tenant: TenantView, category?: string) {
      const filter: Record<string, unknown> = { tenantId: tenant.id, isActive: true, ...(category ? { category } : {}) };
      const rows = await GalleryImage.find(filter).sort({ sortOrder: 1, createdAt: -1 }).limit(120).lean();
      const assets = await media.byIds(tenant.id, rows.map((r) => r.assetId));
      return rows.flatMap((x) => {
        const i = img(assets, x.assetId, x.caption ?? "");
        return i ? [{ caption: x.caption ?? null, category: x.category, image: i }] : [];
      });
    },
  };
}
export type PublicService = ReturnType<typeof createPublicService>;
