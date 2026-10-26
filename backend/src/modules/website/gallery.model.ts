import { Schema, model, type Types } from "mongoose";
import { tenantScope } from "../../database/plugins/tenantScope.js";

export const GALLERY_CATEGORIES = ["rooms", "dining", "exterior", "facilities", "events", "other"] as const;

export interface IGalleryImage {
  tenantId: Types.ObjectId;
  assetId: Types.ObjectId;
  caption?: string | undefined;
  category: (typeof GALLERY_CATEGORIES)[number];
  isActive: boolean;
  sortOrder: number;
}
const schema = new Schema<IGalleryImage>(
  {
    assetId: { type: Schema.Types.ObjectId, ref: "MediaAsset", required: true },
    caption: { type: String, trim: true, maxlength: 160 },
    category: { type: String, enum: GALLERY_CATEGORIES, default: "other" },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);
tenantScope(schema);
schema.index({ tenantId: 1, isActive: 1, sortOrder: 1 });
export const GalleryImage = model<IGalleryImage>("GalleryImage", schema);
