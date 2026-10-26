import { Schema, model, type Types } from "mongoose";
import { tenantScope } from "../../database/plugins/tenantScope.js";

export interface IFacility {
  tenantId: Types.ObjectId;
  name: string;
  description?: string | undefined;
  icon: string;
  imageAssetId?: Types.ObjectId | undefined;
  isActive: boolean;
  sortOrder: number;
}
const schema = new Schema<IFacility>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 600 },
    icon: { type: String, default: "Sparkles", maxlength: 30 },
    imageAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset" },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);
tenantScope(schema);
schema.index({ tenantId: 1, isActive: 1, sortOrder: 1 });
export const Facility = model<IFacility>("Facility", schema);
