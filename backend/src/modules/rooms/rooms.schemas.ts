import { z } from "zod";
import { objectIdSchema, paginationSchema } from "../../shared/pagination.js";
import { plainText, title } from "../../shared/validation.js";
import { AMENITY_KEYS } from "./amenities.js";
import { ROOM_STATUSES } from "./room.model.js";

const price = z.number().int("Price must be a whole number of kobo.").min(0).max(100_000_000_00);
const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/, "Use lowercase letters, numbers and hyphens.");
const seo = z.object({ title: plainText(90).optional(), description: plainText(300).optional() }).strict();

const typeFields = {
  name: title(80),
  slug: slug,
  shortDescription: plainText(200),
  description: plainText(3000),
  maxAdults: z.number().int().min(1).max(20),
  maxChildren: z.number().int().min(0).max(10),
  bedConfig: plainText(80),
  sizeSqm: z.number().min(5).max(2000),
  basePrice: price,
  amenityKeys: z.array(z.enum(AMENITY_KEYS)).max(30).refine((a) => new Set(a).size === a.length, "Each amenity can only be chosen once."),
  imageAssetIds: z.array(objectIdSchema).max(12),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0).max(10000),
  seo,
};

export const createRoomTypeSchema = z.object({
  name: typeFields.name, maxAdults: typeFields.maxAdults, basePrice: typeFields.basePrice,
  slug: typeFields.slug.optional(), shortDescription: typeFields.shortDescription.optional(), description: typeFields.description.optional(),
  maxChildren: typeFields.maxChildren.optional(), bedConfig: typeFields.bedConfig.optional(), sizeSqm: typeFields.sizeSqm.optional(),
  amenityKeys: typeFields.amenityKeys.optional(), imageAssetIds: typeFields.imageAssetIds.optional(), isFeatured: typeFields.isFeatured.optional(),
  isActive: typeFields.isActive.optional(), sortOrder: typeFields.sortOrder.optional(), seo: typeFields.seo.optional(),
}).strict();

export const updateRoomTypeSchema = z.object({
  name: typeFields.name.optional(), slug: typeFields.slug.optional(), shortDescription: typeFields.shortDescription.nullable().optional(),
  description: typeFields.description.nullable().optional(), maxAdults: typeFields.maxAdults.optional(), maxChildren: typeFields.maxChildren.optional(),
  bedConfig: typeFields.bedConfig.nullable().optional(), sizeSqm: typeFields.sizeSqm.nullable().optional(), basePrice: typeFields.basePrice.optional(),
  amenityKeys: typeFields.amenityKeys.optional(), imageAssetIds: typeFields.imageAssetIds.optional(), isFeatured: typeFields.isFeatured.optional(),
  isActive: typeFields.isActive.optional(), sortOrder: typeFields.sortOrder.optional(), seo: typeFields.seo.optional(),
}).strict().refine((v) => Object.keys(v).length > 0, "Nothing to update.");

export const listRoomTypesQuery = paginationSchema.extend({
  active: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  search: plainText(80, 1).optional(),
}).strict();

const roomNumber = z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9][A-Za-z0-9 ._/-]*$/, "Use letters, numbers and simple punctuation.");

export const createRoomSchema = z.object({
  roomNumber, roomTypeId: objectIdSchema, floor: z.number().int().min(-5).max(200).optional(),
  status: z.enum(ROOM_STATUSES).optional(), isActive: z.boolean().optional(),
}).strict();
export const updateRoomSchema = z.object({
  roomNumber: roomNumber.optional(), roomTypeId: objectIdSchema.optional(), floor: z.number().int().min(-5).max(200).nullable().optional(),
  status: z.enum(ROOM_STATUSES).optional(), isActive: z.boolean().optional(),
}).strict().refine((v) => Object.keys(v).length > 0, "Nothing to update.");
export const listRoomsQuery = paginationSchema.extend({
  roomTypeId: objectIdSchema.optional(), status: z.enum(ROOM_STATUSES).optional(),
  active: z.enum(["true", "false"]).transform((v) => v === "true").optional(), search: plainText(20, 1).optional(),
}).strict();

export const idParams = z.object({ id: objectIdSchema }).strict();
export type CreateRoomTypeBody = z.infer<typeof createRoomTypeSchema>;
export type UpdateRoomTypeBody = z.infer<typeof updateRoomTypeSchema>;
export type ListRoomTypesQuery = z.infer<typeof listRoomTypesQuery>;
export type CreateRoomBody = z.infer<typeof createRoomSchema>;
export type UpdateRoomBody = z.infer<typeof updateRoomSchema>;
export type ListRoomsQuery = z.infer<typeof listRoomsQuery>;
