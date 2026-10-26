import { rateLimit } from "express-rate-limit";
import type { Request, RequestHandler } from "express";
import { sendError } from "../shared/response.js";

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string;
  skip?: (req: Request) => boolean;
  /** Custom bucket key (e.g. IP + email). Wrap IPs with ipKeyGenerator() so IPv6 users cannot dodge the limit. */
  keyGenerator?: (req: Request) => string;
}

/**
 * Factory so later phases can add stricter limiters (login, password reset, booking
 * submission) with the same error contract. The default store is in-memory: with more than one
 * API instance, switch to a shared store (see docs/SECURITY.md).
 */
export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    ...(options.skip ? { skip: options.skip } : {}),
    ...(options.keyGenerator ? { keyGenerator: options.keyGenerator } : {}),
    handler: (_req, res) => {
      sendError(res, 429, "RATE_LIMITED", options.message ?? "Too many requests. Please wait a moment and try again.");
    },
  });
}
