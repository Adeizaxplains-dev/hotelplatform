export const MAX_UPLOAD_BYTES = 5_000_000;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Client-side pre-check for a friendly message. The server re-checks the file's actual content. */
export function checkImageFile(file: Pick<File, "type" | "size">): string | null {
  if (!TYPES.includes(file.type)) return "Only JPG, PNG or WebP images can be uploaded.";
  if (file.size > MAX_UPLOAD_BYTES) return `That image is too large. The limit is ${MAX_UPLOAD_BYTES / 1_000_000} MB.`;
  return null;
}
