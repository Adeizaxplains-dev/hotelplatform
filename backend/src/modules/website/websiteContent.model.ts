import { Schema, model, type Types } from "mongoose";
import { tenantScope } from "../../database/plugins/tenantScope.js";

export interface PageSeo { title?: string | undefined; description?: string | undefined }

export interface IWebsiteContent {
  tenantId: Types.ObjectId;
  hero: { headline?: string | undefined; subheadline?: string | undefined; imageAssetIds: Types.ObjectId[] };
  about: { heading?: string | undefined; body?: string | undefined; imageAssetId?: Types.ObjectId | undefined; highlights: Array<{ label: string; value: string }> };
  whyChooseUs: Array<{ title: string; text: string; icon: string }>;
  testimonials: Array<{ quote: string; guestName: string; source?: string | undefined; rating?: number | undefined }>;
  faqs: Array<{ question: string; answer: string }>;
  pageSeo: Partial<Record<"home" | "about" | "rooms" | "facilities" | "gallery" | "contact", PageSeo>>;
}

const seo = { title: { type: String, trim: true, maxlength: 90 }, description: { type: String, trim: true, maxlength: 300 }, _id: false };

/**
 * Structured website copy, NOT free-form pages or HTML. Every field is plain text, so a hotel editor can never
 * inject markup or script into the public site.
 */
const schema = new Schema<IWebsiteContent>(
  {
    hero: { headline: { type: String, trim: true, maxlength: 120 }, subheadline: { type: String, trim: true, maxlength: 300 }, imageAssetIds: [{ type: Schema.Types.ObjectId, ref: "MediaAsset" }] },
    about: {
      heading: { type: String, trim: true, maxlength: 120 }, body: { type: String, trim: true, maxlength: 4000 },
      imageAssetId: { type: Schema.Types.ObjectId, ref: "MediaAsset" },
      highlights: [{ label: { type: String, maxlength: 40 }, value: { type: String, maxlength: 40 }, _id: false }],
    },
    whyChooseUs: [{ title: { type: String, maxlength: 80 }, text: { type: String, maxlength: 300 }, icon: { type: String, maxlength: 30 }, _id: false }],
    testimonials: [{ quote: { type: String, maxlength: 600 }, guestName: { type: String, maxlength: 80 }, source: { type: String, maxlength: 60 }, rating: { type: Number, min: 1, max: 5 }, _id: false }],
    faqs: [{ question: { type: String, maxlength: 200 }, answer: { type: String, maxlength: 1000 }, _id: false }],
    pageSeo: { home: seo, about: seo, rooms: seo, facilities: seo, gallery: seo, contact: seo },
  },
  { timestamps: true, minimize: false }
);
tenantScope(schema, { indexed: false }); // one document per hotel: the UNIQUE index below is the only tenantId index
schema.index({ tenantId: 1 }, { unique: true });
export const WebsiteContent = model<IWebsiteContent>("WebsiteContent", schema);
