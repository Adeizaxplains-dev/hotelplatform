/** Image storage abstraction: the CMS depends on this interface, not on Cloudinary. */
export type ImageFormat = "jpg" | "png" | "webp";

export interface StoredImage {
  publicId: string;
  url: string;
  width: number;
  height: number;
  bytes: number;
  format: ImageFormat;
}

export interface UploadInput {
  /** Opaque per-hotel folder key (derived, not the tenant id). Every file lives under its hotel's own folder, so hotels can never overwrite each other's files. */
  folder: string;
  buffer: Buffer;
  format: ImageFormat;
  width: number;
  height: number;
}

export interface MediaStorage {
  readonly provider: "cloudinary" | "local" | "memory" | "none";
  upload(input: UploadInput): Promise<StoredImage>;
  remove(publicId: string): Promise<void>;
}
