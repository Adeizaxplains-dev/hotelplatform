import { z } from "zod";

/**
 * Environment validation. The process refuses to start with a bad configuration,
 * and error messages never echo the values (they may be secrets).
 *
 * Variables for later phases (Paystack, Cloudinary, email) are optional for now and
 * become required by the phase that uses them.
 */

const PLACEHOLDER = /change[-_ ]?me|replace[-_ ]?me|example|your[-_ ]?secret/i;

const optionalString = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const originList = z
  .string()
  .min(1, "CLIENT_URL is required")
  .transform((v) => v.split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean))
  .pipe(
    z
      .array(
        z.string().refine((s) => {
          try {
            const u = new URL(s);
            return (u.protocol === "http:" || u.protocol === "https:") && u.origin === s;
          } catch {
            return false;
          }
        }, "must be an origin such as https://hotel.example.com (no path, no wildcard)")
      )
      .min(1)
  );

const trustProxy = z
  .string()
  .default("false")
  .transform((v, ctx) => {
    if (v === "false") return false as const;
    if (v === "true") return true as const;
    const n = Number(v);
    if (Number.isInteger(n) && n >= 0) return n;
    ctx.addIssue({ code: "custom", message: "TRUST_PROXY must be true, false or a hop count" });
    return z.NEVER;
  });

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),

    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required")
      .refine((v) => /^mongodb(\+srv)?:\/\//.test(v), "DATABASE_URL must start with mongodb:// or mongodb+srv://"),

    ACCESS_TOKEN_SECRET: z.string().min(32, "ACCESS_TOKEN_SECRET must be at least 32 characters"),
    REFRESH_TOKEN_SECRET: z.string().min(32, "REFRESH_TOKEN_SECRET must be at least 32 characters"),

    CLIENT_URL: originList,
    // Base domain of the platform, e.g. hotelplatform.com. Hotel subdomains are <slug>.<PLATFORM_DOMAIN>.
    // In development it defaults to "localhost" (so hotel-a.localhost works).
    PLATFORM_DOMAIN: optionalString.refine(
      (v) => v === undefined || /^(?=.{3,253}$)([a-z0-9-]+\.)*[a-z0-9-]+$/.test(v),
      "PLATFORM_DOMAIN must be a bare lowercase domain such as hotelplatform.com (no scheme, no port)"
    ),
    TRUST_PROXY: trustProxy,

    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(15 * 60 * 1000),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
    BODY_LIMIT: z.string().default("100kb"),
    // Multiplies the limits on login, registration, password reset and refresh. Only for tests/load tools: production must keep 1.
    AUTH_RATE_LIMIT_SCALE: z.coerce.number().min(0.1).max(1000).default(1),

    // Image storage. cloudinary | local (development only: files on this server's disk) | none.
    // Unset: cloudinary when its three credentials are present, otherwise local outside production, otherwise none.
    MEDIA_PROVIDER: z.enum(["cloudinary", "local", "none"]).optional(),
    UPLOAD_MAX_BYTES: z.coerce.number().int().min(100_000).max(15_000_000).default(5_000_000),

    // Later phases (optional now)
    PAYSTACK_SECRET_KEY: optionalString,
    PAYSTACK_PUBLIC_KEY: optionalString,
    // Monthly SaaS subscription prices in kobo. Leave unset to disable checkout until pricing is approved.
    SAAS_WEBSITE_MONTHLY_KOBO: optionalString,
    SAAS_BOOKING_MONTHLY_KOBO: optionalString,
    SAAS_MANAGEMENT_MONTHLY_KOBO: optionalString,
    CLOUDINARY_CLOUD_NAME: optionalString,
    CLOUDINARY_API_KEY: optionalString,
    CLOUDINARY_API_SECRET: optionalString,
    EMAIL_PROVIDER: z.enum(["console", "smtp"]).default("console"),
    EMAIL_FROM: optionalString,
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().optional(),
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
  })
  .superRefine((env, ctx) => {
    if (env.ACCESS_TOKEN_SECRET === env.REFRESH_TOKEN_SECRET) {
      ctx.addIssue({ code: "custom", path: ["REFRESH_TOKEN_SECRET"], message: "must differ from ACCESS_TOKEN_SECRET" });
    }
    if (env.NODE_ENV === "production") {
      for (const key of ["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"] as const) {
        if (PLACEHOLDER.test(env[key])) {
          ctx.addIssue({ code: "custom", path: [key], message: "looks like a placeholder; generate a real secret" });
        }
      }
      if (env.AUTH_RATE_LIMIT_SCALE !== 1) {
        ctx.addIssue({ code: "custom", path: ["AUTH_RATE_LIMIT_SCALE"], message: "must be 1 in production" });
      }
      if (env.MEDIA_PROVIDER === "local") {
        ctx.addIssue({ code: "custom", path: ["MEDIA_PROVIDER"], message: "local storage is for development only; use cloudinary in production" });
      }
      if (!env.PLATFORM_DOMAIN) {
        ctx.addIssue({ code: "custom", path: ["PLATFORM_DOMAIN"], message: "is required in production" });
      }
      if (env.CLIENT_URL.some((o) => o.startsWith("http://"))) {
        ctx.addIssue({ code: "custom", path: ["CLIENT_URL"], message: "must use https in production" });
      }
    }
  });

export type Env = z.infer<typeof schema>;

export type MediaProviderName = "cloudinary" | "local" | "none";

/** Decides which image storage to use, and fails clearly if Cloudinary is chosen without credentials. */
export function resolveMediaProvider(env: Pick<Env, "MEDIA_PROVIDER" | "NODE_ENV" | "CLOUDINARY_CLOUD_NAME" | "CLOUDINARY_API_KEY" | "CLOUDINARY_API_SECRET">): MediaProviderName {
  const hasCloudinary = Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
  if (env.MEDIA_PROVIDER === "cloudinary" && !hasCloudinary) throw new EnvError(["CLOUDINARY_*: MEDIA_PROVIDER=cloudinary needs CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET"]);
  if (env.MEDIA_PROVIDER) return env.MEDIA_PROVIDER;
  if (hasCloudinary) return "cloudinary";
  return env.NODE_ENV === "production" ? "none" : "local";
}

/** The domain hotels hang off. "localhost" in development, so hotel-a.localhost resolves to a tenant. */
export const platformDomainOf = (env: Pick<Env, "PLATFORM_DOMAIN">): string => env.PLATFORM_DOMAIN ?? "localhost";

export class EnvError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid environment configuration:\n - ${problems.join("\n - ")}`);
    this.name = "EnvError";
  }
}

/** Pure function: validates a raw env object. Never prints or returns the offending values. */
export function loadEnv(raw: Record<string, string | undefined>): Env {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new EnvError(result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`));
  }
  return result.data;
}
