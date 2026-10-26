import { z } from "zod";
import { objectIdSchema } from "../../shared/pagination.js";
import { clearable, hexColor, httpsUrl, mapEmbedUrl, phone, plainText, timeOfDay, title, whatsapp } from "../../shared/validation.js";
import { FEATURE_ICONS } from "../rooms/amenities.js";
import { TYPOGRAPHY } from "./hotelProfile.model.js";

// Every schema is strict(): unknown fields (tenantId, ids, status...) are rejected. null clears an optional value.
const contact = z.object({
  phone: clearable(phone), whatsapp: clearable(whatsapp), email: clearable(z.email().max(254).transform((v) => v.toLowerCase())),
  address: clearable(plainText(200)), city: clearable(plainText(80)), state: clearable(plainText(80)), country: clearable(plainText(80)),
  mapEmbedUrl: clearable(mapEmbedUrl), latitude: clearable(z.number().min(-90).max(90)), longitude: clearable(z.number().min(-180).max(180)),
}).strict();

const social = z.object({
  facebook: clearable(httpsUrl(["facebook.com", "fb.com"])), instagram: clearable(httpsUrl(["instagram.com"])),
  x: clearable(httpsUrl(["x.com", "twitter.com"])), tiktok: clearable(httpsUrl(["tiktok.com"])), youtube: clearable(httpsUrl(["youtube.com", "youtu.be"])),
}).strict();

const policies = z.object({
  checkInTime: timeOfDay.optional(), checkOutTime: timeOfDay.optional(),
  cancellation: clearable(plainText(1000)), houseRules: clearable(plainText(1000)), children: clearable(plainText(500)), pets: clearable(plainText(500)),
}).strict();

const branding = z.object({
  primaryColor: hexColor.optional(), accentColor: hexColor.optional(), typography: z.enum(TYPOGRAPHY).optional(),
  logoAssetId: clearable(objectIdSchema), faviconAssetId: clearable(objectIdSchema),
}).strict();

const seo = z.object({
  titleTemplate: clearable(plainText(100).refine((v) => v.includes("%s"), "Include %s where the page title should go, e.g. %s | Palm Hotel.")),
  defaultDescription: clearable(plainText(300)), ogImageAssetId: clearable(objectIdSchema),
}).strict();

export const updateProfileSchema = z.object({
  tagline: clearable(plainText(140)), description: clearable(plainText(600)),
  contact: contact.optional(), social: social.optional(), policies: policies.optional(), branding: branding.optional(), seo: seo.optional(),
}).strict().refine((v) => Object.keys(v).length > 0, "Nothing to update.");

const pageSeo = z.object({ title: clearable(plainText(90)), description: clearable(plainText(300)) }).strict();

export const updateContentSchema = z.object({
  hero: z.object({ headline: clearable(plainText(120)), subheadline: clearable(plainText(300)), imageAssetIds: z.array(objectIdSchema).max(5).optional() }).strict().optional(),
  about: z.object({
    heading: clearable(plainText(120)), body: clearable(plainText(4000)), imageAssetId: clearable(objectIdSchema),
    highlights: z.array(z.object({ label: title(40), value: title(40) }).strict()).max(6).optional(),
  }).strict().optional(),
  whyChooseUs: z.array(z.object({ title: title(80), text: plainText(300, 1), icon: z.enum(FEATURE_ICONS) }).strict()).max(6).optional(),
  testimonials: z.array(z.object({ quote: plainText(600, 1), guestName: title(80), source: plainText(60).optional(), rating: z.number().int().min(1).max(5).optional() }).strict()).max(12).optional(),
  faqs: z.array(z.object({ question: title(200), answer: plainText(1000, 1) }).strict()).max(12).optional(),
  pageSeo: z.object({ home: pageSeo.optional(), about: pageSeo.optional(), rooms: pageSeo.optional(), facilities: pageSeo.optional(), gallery: pageSeo.optional(), contact: pageSeo.optional() }).strict().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, "Nothing to update.");

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
export type UpdateContentBody = z.infer<typeof updateContentSchema>;
