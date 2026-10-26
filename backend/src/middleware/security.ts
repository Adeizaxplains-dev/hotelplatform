import cors from "cors";
import helmet from "helmet";
import type { RequestHandler } from "express";
import { sendError } from "../shared/response.js";

/**
 * Decides whether a browser Origin may call the API. Today: the CLIENT_URL allow-list.
 * Phase 1 plugs in verified tenant domains/subdomains here.
 */
export type OriginPolicy = (origin: string) => boolean | Promise<boolean>;

export function allowListPolicy(allowed: string[]): OriginPolicy {
  const set = new Set(allowed);
  return (origin) => set.has(origin);
}

export function securityMiddleware(isOriginAllowed: OriginPolicy): RequestHandler[] {
  const guard: RequestHandler = async (req, res, next) => {
    const origin = req.header("origin");
    // Requests without an Origin (server-to-server, webhooks, curl) are not browser cross-site calls.
    if (!origin) return next();
    try {
      if (await isOriginAllowed(origin)) return next();
    } catch {
      /* fall through to deny */
    }
    sendError(res, 403, "CORS_ORIGIN_NOT_ALLOWED", "This origin is not allowed to use the API.");
  };

  return [
    helmet({ crossOriginResourcePolicy: { policy: "same-site" } }),
    guard,
    cors({
      origin: (origin, cb) => cb(null, Boolean(origin)), // the guard above already rejected disallowed origins
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
      exposedHeaders: ["X-Request-Id", "Retry-After", "RateLimit"],
      maxAge: 600,
    }),
  ];
}

/**
 * Caches origin decisions (including "no") for a short time so a flood of random Origin headers cannot
 * turn into a flood of database lookups. Bounded size; oldest entries are dropped first.
 */
export function cachedPolicy(policy: OriginPolicy, ttlMs = 60_000, maxEntries = 500): OriginPolicy {
  const cache = new Map<string, { ok: boolean; at: number }>();
  return async (origin) => {
    const hit = cache.get(origin);
    if (hit && Date.now() - hit.at < ttlMs) return hit.ok;
    const ok = await policy(origin);
    if (cache.size >= maxEntries) cache.delete(cache.keys().next().value as string);
    cache.set(origin, { ok, at: Date.now() });
    return ok;
  };
}

/** Allowed: the configured CLIENT_URL list, the platform's own pages, and the sites of active hotels. */
export function combinePolicies(...policies: OriginPolicy[]): OriginPolicy {
  return async (origin) => {
    for (const p of policies) if (await p(origin)) return true;
    return false;
  };
}
