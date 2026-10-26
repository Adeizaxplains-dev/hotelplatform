import type { RequestHandler } from "express";
import { ValidationError } from "../shared/errors.js";

const MAX_DEPTH = 10;
// Keys that Mongo interprets as operators ($ne, $gt...) or field paths (a.b).
const FORBIDDEN_KEY = /^\$|\.|\[\$/;

function scan(value: unknown, depth: number): boolean {
  if (depth > MAX_DEPTH) return true;
  if (Array.isArray(value)) return value.some((v) => scan(v, depth + 1));
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEY.test(key) || scan(child, depth + 1)) return true;
    }
  }
  return false;
}

/**
 * NoSQL-injection guard. Rejects (rather than silently rewrites) any request whose body,
 * query string or params contain Mongo operator keys. Zod validation and Mongoose's
 * sanitizeFilter are the next two layers.
 */
export function rejectMongoOperators(): RequestHandler {
  return (req, _res, next) => {
    if (scan(req.body, 0) || scan(req.query, 0) || scan(req.params, 0)) {
      return next(new ValidationError("The request contains characters that are not allowed."));
    }
    next();
  };
}
