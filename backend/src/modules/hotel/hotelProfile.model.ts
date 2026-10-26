import { Schema, model, type Types } from "mongoose";
import { tenantScope } from "../../database/plugins/tenantScope.js";

export const TYPOGRAPHY = ["modern", "classic"] as const;
export type Typography = (typeof TYPOGRAPHY)[number];

export interface IHotelProfile {
  tenantId: Types.ObjectId;
  tagline?: string | undefined;
  description?: string | undefined;
  contact: { phone?: string | undefined; whatsapp?: string | undefined; email?: string | undefined; address?: string | undefined; city?: string | undefined; state?: string | undefined; country?: string | undefined; mapEmbedUrl?: string | undefined; latitude?: number | undefined; longitude?: number | undefined };
  social: { facebook?: string | undefined; instagram?: string | undefined; x?: string | undefined; tiktok?: string | undefined; youtube?: string | undefined };
  policies: { checkInTime: string; checkOutTime: string; cancellation?: string | undefined; houseRules?: string | undefined; children?: string | undefined; pets?: string | undefined };
  branding: { primaryColor: string; accentColor: string; typography: Typography; logoAssetId?: Types.ObjectId | undefined; faviconAssetId?: Types.ObjectId | undefined };
  seo: { titleTemplate?: string | undefined; defaultDescription?: string | undefined; ogImageAssetId?: Types.ObjectId | undefined };
}

const str = (max: number) => ({ type: String, trim: true, maxlength: max });

const schema = new Schema<IHotelProfile>(
  {
    tagline: str(140),
    description: str(600),
    contact: {
      phone: str(30), whatsapp: str(20), email: { type: String, trim: true, lowercase: true, maxlength: 254 },
      address: str(200), city: str(80), state: str(80), country: str(80), mapEmbedUrl: str(600),
      latitude: { type: Number, min: -90, max: 90 }, longitude: { type: Number, min: -180, max: 180 },
    },
    social: { facebook: str(200), instagram: str(200), x: str(200), tiktok: str(200), youtube: str(200) },
    policies: {
      checkInTime: { type: String, default: "14:00" }, checkOutTime: { type: String, default: "12:00" },
      cancellation: str(1000), houseRules: str(1000), children: str(500), pets: str(500),
    },
    branding: {
      primaryColor: { type: String, default: "#0B6E6E" }, accentColor: { type: String, default: "#B8863B" },
      typography: { type: String, enum: TYPOGRAPHY, default: "modern" },
      logoAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset" }, faviconAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset" },
    },
    seo: { titleTemplate: str(100), defaultDescription: str(300), ogImageAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset" } },
  },
  { timestamps: true, minimize: false }
);
tenantScope(schema, { indexed: false }); // one document per hotel: the UNIQUE index below is the only tenantId index
schema.index({ tenantId: 1 }, { unique: true });
export const HotelProfile = model<IHotelProfile>("HotelProfile", schema);
