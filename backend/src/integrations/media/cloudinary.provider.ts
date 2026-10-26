import { v2 as cloudinary } from "cloudinary";
import type { MediaStorage, StoredImage, UploadInput, ImageFormat } from "./media.storage.js";

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * Cloudinary adapter. The secret stays on the server; the browser never talks to Cloudinary directly.
 * Files go to hotels/<folder>/ with unique names and are never overwritten.
 * NOTE: written against Cloudinary's documented Node SDK; it has NOT been exercised against a live account yet.
 */
export class CloudinaryMediaStorage implements MediaStorage {
  readonly provider = "cloudinary" as const;

  constructor(creds: CloudinaryCredentials) {
    cloudinary.config({ cloud_name: creds.cloudName, api_key: creds.apiKey, api_secret: creds.apiSecret, secure: true });
  }

  upload({ folder, buffer }: UploadInput): Promise<StoredImage> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: `hotels/${folder}`, resource_type: "image", unique_filename: true, use_filename: false, overwrite: false, allowed_formats: ["jpg", "png", "webp"] },
          (err, result) => {
            if (err || !result) return reject(err ?? new Error("Cloudinary returned no result"));
            resolve({
              publicId: result.public_id,
              url: result.secure_url,
              width: result.width,
              height: result.height,
              bytes: result.bytes,
              format: (result.format === "jpeg" ? "jpg" : result.format) as ImageFormat,
            });
          }
        )
        .end(buffer);
    });
  }

  async remove(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
  }
}
