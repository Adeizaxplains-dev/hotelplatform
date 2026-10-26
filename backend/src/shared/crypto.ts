import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Opaque, URL-safe random token (refresh tokens, reset links). 48 bytes = 384 bits of entropy. */
export const randomToken = (bytes = 48): string => randomBytes(bytes).toString("base64url");

/**
 * Tokens are stored as HMAC-SHA256(secret, token): a database leak alone is not enough to
 * recognise or forge a valid token, and lookups stay a plain indexed equality query.
 */
export const hashToken = (secret: string, token: string): string => createHmac("sha256", secret).update(token).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
