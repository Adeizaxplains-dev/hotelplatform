import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import type { RequestHandler } from "express";

/**
 * One structured line per request: request id, method, path (never the query string,
 * which can carry reset tokens), status and response time. Later phases attach
 * userId / tenantId through res.locals.logContext.
 */
export function requestLogger(logger: Logger): RequestHandler {
  return pinoHttp({
    logger,
    genReqId: (_req, res) => (res.getHeader("X-Request-Id") as string | undefined) ?? "unknown",
    customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
    autoLogging: { ignore: (req) => (req.url ?? "").startsWith("/api/v1/health") },
    serializers: {
      req: (req: { id: string; method: string; url?: string }) => ({
        id: req.id,
        method: req.method,
        path: (req.url ?? "").split("?")[0],
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
    customProps: (_req, res) => ({
      requestId: res.getHeader("X-Request-Id"),
      ...((res as unknown as { locals?: { logContext?: Record<string, unknown> } }).locals?.logContext ?? {}),
    }),
  }) as unknown as RequestHandler;
}
