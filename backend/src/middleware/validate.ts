import type { RequestHandler, Response } from "express";
import type { ZodType } from "zod";
import { ValidationError, type ErrorDetail } from "../shared/errors.js";

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export interface Validated<B = unknown, Q = unknown, P = unknown> {
  body: B;
  query: Q;
  params: P;
}

/**
 * Validates params, query and body with Zod. The parsed (typed, stripped) values are placed
 * on res.locals.validated: controllers must read from there, never from the raw request.
 * Use strict() schemas for privileged resources so unexpected fields are rejected.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, res, next) => {
    const out: Record<string, unknown> = {};
    const problems: ErrorDetail[] = [];
    for (const key of ["params", "query", "body"] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (result.success) out[key] = result.data;
      else problems.push(...result.error.issues.map((i) => ({ path: [key, ...i.path].join("."), message: i.message })));
    }
    if (problems.length) return next(new ValidationError(undefined, problems));
    res.locals["validated"] = out;
    next();
  };
}

export function getValidated<B = unknown, Q = unknown, P = unknown>(res: Response): Validated<B, Q, P> {
  return (res.locals["validated"] ?? {}) as Validated<B, Q, P>;
}
