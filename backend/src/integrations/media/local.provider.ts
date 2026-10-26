import { randomBytes } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MediaStorage, StoredImage, UploadInput } from "./media.storage.js";

/** Development storage: files on this server's disk, served at /api/v1/uploads. Not for production. */
export class LocalMediaStorage implements MediaStorage {
  readonly provider = "local" as const;
  constructor(readonly root: string) {}

  async upload({ folder, buffer, format, width, height }: UploadInput): Promise<StoredImage> {
    const name = `${randomBytes(12).toString("hex")}.${format}`; // the client's file name is never used
    const dir = path.join(this.root, folder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buffer, { flag: "wx" });
    return { publicId: `${folder}/${name}`, url: `/api/v1/uploads/${folder}/${name}`, width, height, bytes: buffer.length, format };
  }

  async remove(publicId: string): Promise<void> {
    const target = path.resolve(this.root, publicId);
    if (!target.startsWith(path.resolve(this.root) + path.sep)) return; // never delete outside the upload folder
    await rm(target, { force: true });
  }
}
