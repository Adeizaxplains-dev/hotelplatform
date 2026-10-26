import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveMediaProvider, type Env } from "../../config/env.js";
import { ServiceUnavailableError } from "../../shared/errors.js";
import { CloudinaryMediaStorage } from "./cloudinary.provider.js";
import { LocalMediaStorage } from "./local.provider.js";
import type { MediaStorage } from "./media.storage.js";

export const LOCAL_UPLOAD_ROOT = fileURLToPath(new URL("../../../uploads", import.meta.url));

/** Used when no storage is configured: uploads fail with a clear, safe message instead of crashing. */
class UnconfiguredStorage implements MediaStorage {
  readonly provider = "none" as const;
  async upload(): Promise<never> {
    throw new ServiceUnavailableError("Image uploads are not set up yet. Ask your platform administrator to configure image storage.");
  }
  async remove(): Promise<void> {}
}

export function createMediaStorage(env: Env): MediaStorage {
  switch (resolveMediaProvider(env)) {
    case "cloudinary":
      return new CloudinaryMediaStorage({ cloudName: env.CLOUDINARY_CLOUD_NAME!, apiKey: env.CLOUDINARY_API_KEY!, apiSecret: env.CLOUDINARY_API_SECRET! });
    case "local":
      return new LocalMediaStorage(path.resolve(LOCAL_UPLOAD_ROOT));
    default:
      return new UnconfiguredStorage();
  }
}
