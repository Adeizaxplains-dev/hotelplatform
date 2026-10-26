import { z } from "zod";

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const HTML_TAG = /<\/?[a-z!][^>]*>/i;

/**
 * Plain text only. HTML-looking input is rejected (not silently altered) so editors learn that markup is not
 * supported, and nothing the public site renders can ever carry markup. React still escapes everything on output.
 */
export const plainText = (max: number, min = 0) =>
  z.string().trim().min(min).max(max)
    .refine((v) => !CONTROL.test(v), "Contains characters that are not allowed.")
    .refine((v) => !HTML_TAG.test(v), "HTML is not allowed. Write plain text.");

export const title = (max: number) => plainText(max, 1);

const HEX = /^#[0-9a-fA-F]{6}$/;
export const hexColor = z.string().regex(HEX, "Use a colour like #0B6E6E.").transform((v) => v.toUpperCase());

export const phone = z.string().trim().regex(/^\+?[0-9\s()-]{6,20}$/, "Enter a valid phone number.");
/** WhatsApp numbers are stored as digits with the country code and no plus sign, ready for wa.me links. */
export const whatsapp = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s()+-]/g, ""))
  .pipe(z.string().regex(/^[1-9]\d{7,14}$/, "Enter the number with its country code, e.g. 2348012345678."));

export const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time like 14:00.");

export function httpsUrl(hostSuffixes?: readonly string[]) {
  return z.string().trim().max(300).refine((v) => {
    try {
      const u = new URL(v);
      if (u.protocol !== "https:" || u.username || u.password) return false;
      return !hostSuffixes || hostSuffixes.some((s) => u.hostname === s || u.hostname.endsWith(`.${s}`));
    } catch {
      return false;
    }
  }, hostSuffixes ? `Enter a secure (https) link on ${hostSuffixes[0]}.` : "Enter a secure (https) link.");
}

export const mapEmbedUrl = z.string().trim().max(600).refine((v) => {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && u.hostname === "www.google.com" && u.pathname.startsWith("/maps/embed");
  } catch {
    return false;
  }
}, "Paste the Google Maps embed link (it starts with https://www.google.com/maps/embed).");

/** Accepts `null` to clear an optional field in a PATCH. */
export const clearable = <T extends z.ZodType>(schema: T) => schema.nullable().optional();
