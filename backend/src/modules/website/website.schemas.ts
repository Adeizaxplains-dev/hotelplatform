import { z } from "zod";
import { objectIdSchema, paginationSchema } from "../../shared/pagination.js";
import { plainText, title } from "../../shared/validation.js";
import { FEATURE_ICONS } from "../rooms/amenities.js";
import { GALLERY_CATEGORIES } from "./gallery.model.js";

export const createFacilitySchema = z.object({
  name: title(80), description: plainText(600).optional(), icon: z.enum(FEATURE_ICONS).optional(),
  imageAssetId: objectIdSchema.optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().min(0).max(10000).optional(),
}).strict();
export const updateFacilitySchema = z.object({
  name: title(80).optional(), description: plainText(600).nullable().optional(), icon: z.enum(FEATURE_ICONS).optional(),
  imageAssetId: objectIdSchema.nullable().optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().min(0).max(10000).optional(),
}).strict().refine((v) => Object.keys(v).length > 0, "Nothing to update.");

export const createGallerySchema = z.object({
  assetId: objectIdSchema, caption: plainText(160).optional(), category: z.enum(GALLERY_CATEGORIES).optional(),
  isActive: z.boolean().optional(), sortOrder: z.number().int().min(0).max(100000).optional(),
}).strict();
export const updateGallerySchema = z.object({
  caption: plainText(160).nullable().optional(), category: z.enum(GALLERY_CATEGORIES).optional(),
  isActive: z.boolean().optional(), sortOrder: z.number().int().min(0).max(100000).optional(),
}).strict().refine((v) => Object.keys(v).length > 0, "Nothing to update.");

export const mediaListQuery = paginationSchema.strict();
export const updateMediaSchema = z.object({ alt: plainText(200) }).strict();
export const uploadFieldsSchema = z.object({ alt: plainText(200).optional() });

export type CreateFacilityBody = z.infer<typeof createFacilitySchema>;
export type UpdateFacilityBody = z.infer<typeof updateFacilitySchema>;
export type CreateGalleryBody = z.infer<typeof createGallerySchema>;
export type UpdateGalleryBody = z.infer<typeof updateGallerySchema>;
