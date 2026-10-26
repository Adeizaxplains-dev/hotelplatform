import { hash, verify } from "@node-rs/argon2";
import { randomBytes } from "node:crypto";
import { z } from "zod";

// Argon2id with the library defaults (19 MiB memory, 2 passes, 1 lane), which meet the OWASP minimum.
export const hashPassword = (plain: string): Promise<string> => hash(plain);

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain);
  } catch {
    return false; // malformed hash: treat as a failed match, never throw to the caller
  }
}

/** A real hash of a random value, used to spend the same time when the account does not exist. */
let dummy: Promise<string> | undefined;
export const dummyHash = (): Promise<string> => (dummy ??= hashPassword(randomBytes(24).toString("hex")));

/** An unguessable hash for accounts that have not set a password yet (invited users). */
export const unusablePasswordHash = (): Promise<string> => hashPassword(randomBytes(32).toString("hex"));

const COMMON = new Set([
  "password", "password1", "password123", "1234567890", "12345678910", "qwertyuiop", "iloveyou123",
  "welcome123", "admin12345", "letmein1234", "hotel12345", "hotelpassword",
]);

/** Policy: length is what matters (NIST). Min 10, max 128, no obvious or account-derived passwords. */
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(128, "Use at most 128 characters.")
  .refine((p) => !COMMON.has(p.toLowerCase()), "That password is too common. Choose something less predictable.");

/** Extra check that needs the account's email. Returns an error message or null. */
export function passwordProblemFor(plain: string, email: string): string | null {
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (local.length >= 4 && plain.toLowerCase().includes(local)) return "Your password should not contain your email name.";
  return null;
}
