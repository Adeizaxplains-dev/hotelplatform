import { Schema, model, type Types } from "mongoose";
import { tenantScope } from "../../database/plugins/tenantScope.js";

export interface IRoomType {
  tenantId: Types.ObjectId;
  name: string;
  slug: string;
  shortDescription?: string | undefined;
  description?: string | undefined;
  maxAdults: number;
  maxChildren: number;
  bedConfig?: string | undefined;
  sizeSqm?: number | undefined;
  /** Nightly base price in the smallest currency unit (kobo for NGN). Integers only, never floats. */
  basePrice: number;
  amenityKeys: string[];
  imageAssetIds: Types.ObjectId[];
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  seo: { title?: string | undefined; description?: string | undefined };
}

const schema = new Schema<IRoomType>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, lowercase: true, trim: true, maxlength: 80 },
    shortDescription: { type: String, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 3000 },
    maxAdults: { type: Number, required: true, min: 1, max: 20 },
    maxChildren: { type: Number, default: 0, min: 0, max: 10 },
    bedConfig: { type: String, trim: true, maxlength: 80 },
    sizeSqm: { type: Number, min: 5, max: 2000 },
    basePrice: { type: Number, required: true, min: 0, max: 100_000_000_00, validate: { validator: Number.isInteger, message: "basePrice must be an integer number of kobo" } },
    amenityKeys: [{ type: String }],
    imageAssetIds: [{ type: Schema.Types.ObjectId, ref: "MediaAsset" }],
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    seo: { title: { type: String, maxlength: 90 }, description: { type: String, maxlength: 300 } },
  },
  { timestamps: true, minimize: false }
);
tenantScope(schema);
schema.index({ tenantId: 1, slug: 1 }, { unique: true });
schema.index({ tenantId: 1, isActive: 1, sortOrder: 1 });
export const RoomType = model<IRoomType>("RoomType", schema);
