import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Accepts a well-formed upstream X-Request-Id (e.g. from a proxy) or generates one. */
export function requestId(): RequestHandler {
  return (req, res, next) => {
    const incoming = req.header("x-request-id");
    const id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
    res.locals["requestId"] = id;
    res.setHeader("X-Request-Id", id);
    next();
  };
}
