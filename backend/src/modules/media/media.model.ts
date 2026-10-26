import { Schema, model, type Types } from "mongoose";
import { tenantScope } from "../../database/plugins/tenantScope.js";

export interface IMediaAsset {
  tenantId: Types.ObjectId;
  provider: "cloudinary" | "local" | "memory";
  publicId: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  format: "jpg" | "png" | "webp";
  alt?: string | undefined;
  uploadedBy?: Types.ObjectId | undefined;
}

const schema = new Schema<IMediaAsset>(
  {
    provider: { type: String, enum: ["cloudinary", "local", "memory"], required: true },
    publicId: { type: String, required: true },
    url: { type: String, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    bytes: { type: Number, required: true },
    format: { type: String, enum: ["jpg", "png", "webp"], required: true },
    alt: { type: String, maxlength: 200 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
tenantScope(schema);
schema.index({ tenantId: 1, createdAt: -1 });
schema.index({ tenantId: 1, publicId: 1 }, { unique: true });
export const MediaAsset = model<IMediaAsset>("MediaAsset", schema);
