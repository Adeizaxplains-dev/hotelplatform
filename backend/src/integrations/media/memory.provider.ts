import { randomBytes } from "node:crypto";
import type { MediaStorage, StoredImage, UploadInput } from "./media.storage.js";

/** In-memory storage for tests: records what was uploaded and where. */
export class MemoryMediaStorage implements MediaStorage {
  readonly provider = "memory" as const;
  readonly files = new Map<string, { buffer: Buffer; folder: string }>();

  async upload({ folder, buffer, format, width, height }: UploadInput): Promise<StoredImage> {
    const publicId = `hotels/${folder}/${randomBytes(8).toString("hex")}`;
    this.files.set(publicId, { buffer, folder });
    return { publicId, url: `https://media.test/${publicId}.${format}`, width, height, bytes: buffer.length, format };
  }
  async remove(publicId: string): Promise<void> {
    this.files.delete(publicId);
  }
}
