import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import type { Logger } from "pino";
import type { Env } from "./config/env.js";
import { buildContainer } from "./container.js";
import type { EmailService } from "./integrations/email/email.service.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { createRateLimiter } from "./middleware/rateLimit.js";
import { requestId } from "./middleware/requestId.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { rejectMongoOperators } from "./middleware/sanitize.js";
import { allowListPolicy, cachedPolicy, combinePolicies, securityMiddleware, type OriginPolicy } from "./middleware/security.js";
import { tenantContext } from "./middleware/tenantContext.js";
import { createAuditRouter } from "./modules/audit/audit.routes.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createPlatformRouter } from "./modules/tenants/platform.routes.js";
import { createTenantRouter } from "./modules/tenants/tenant.routes.js";
import { createUserRouter } from "./modules/users/user.routes.js";
import { createHotelRouter } from "./modules/hotel/hotel.routes.js";
import { createPublicRouter } from "./modules/public/public.routes.js";
import { createRoomsRouter } from "./modules/rooms/rooms.routes.js";
import { createWebsiteRouters } from "./modules/website/website.routes.js";
import { LOCAL_UPLOAD_ROOT } from "./integrations/media/index.js";
import type { MediaStorage } from "./integrations/media/media.storage.js";
import { createHealthRouter } from "./modules/health/health.routes.js";
import { createHealthService, type HealthService } from "./modules/health/health.service.js";
import { createReservationsRouter } from "./modules/reservations/reservation.routes.js";
import { createPaymentRouter, createPaymentWebhookRouter } from "./modules/payments/payment.routes.js";
import { createOperationsRouter } from "./modules/operations/operations.routes.js";
import { createFinanceRouter } from "./modules/finance/finance.routes.js";
import { createNotificationRouter } from "./modules/notifications/notification.routes.js";
import { createBillingRouter, createBillingWebhookRouter } from "./modules/billing/billing.routes.js";

export interface AppDeps {
  env: Env;
  logger: Logger;
  health?: HealthService;
  originPolicy?: OriginPolicy;
  /** Email provider override (tests capture messages here). */
  email?: EmailService;
  /** Image storage override (tests use an in-memory one). */
  storage?: MediaStorage;
  /** Mounts API v1 module routers. Phase 0 has none; tests use it to add probe routes. */
  mountRoutes?: (app: Express) => void;
}

/**
 * Builds the Express app. Everything is injected, so tests can build isolated apps.
 *
 * Pipeline: request id → logging → helmet → origin guard + CORS → health (exempt from rate limiting)
 * → rate limit → JSON body (size-limited) → cookies → operator rejection → tenant context (from hostname)
 * → per-route: active tenant → authenticate → permission → feature entitlement → validation →
 * controller → service → tenant-pinned queries → audit → 404 → central error handler.
 */
export function createApp({ env, logger, health = createHealthService(), originPolicy, email, storage, mountRoutes }: AppDeps): Express {
  const c = buildContainer(env, logger, email, storage);
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);

  app.use(requestId());
  app.use(requestLogger(logger));
  app.use(securityMiddleware(originPolicy ?? combinePolicies(allowListPolicy(env.CLIENT_URL), cachedPolicy((o) => c.tenants.isKnownOrigin(o)))));

  // Health is mounted before the rate limiter so uptime monitors are never throttled.
  app.use("/api/v1/health", createHealthRouter(health));

  app.use(createRateLimiter({ windowMs: env.RATE_LIMIT_WINDOW_MS, max: env.RATE_LIMIT_MAX }));

  // Paystack signs the exact raw request bytes; mount before express.json() and tenant hostname resolution.
  app.use("/api/v1/payments/webhook", createPaymentWebhookRouter(c.payments));
  app.use("/api/v1/billing/webhook", createBillingWebhookRouter(c.billing));
  app.use(express.json({ limit: env.BODY_LIMIT, strict: true }));
  app.use(cookieParser());
  app.use(rejectMongoOperators());

  // Development-only image files (MEDIA_PROVIDER=local). Served before tenant lookup: no database access, no directory listing.
  if (c.storage.provider === "local") {
    app.use("/api/v1/uploads", express.static(LOCAL_UPLOAD_ROOT, { index: false, dotfiles: "deny", maxAge: "1d", setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff") }));
  }

  // From here every request knows which hotel (or the platform) it is for, from the hostname alone.
  app.use("/api/v1", tenantContext(c.tenants));

  // API v1 modules: one router per module.
  app.use("/api/v1/auth", createAuthRouter(c.auth, c.authController, env.AUTH_RATE_LIMIT_SCALE));
  app.use("/api/v1/tenants", createTenantRouter(c.entitlements));
  app.use("/api/v1/users", createUserRouter(c.auth, c.entitlements, c.userController));
  app.use("/api/v1/audit", createAuditRouter(c.auth, c.entitlements, c.audit));
  const rooms = createRoomsRouter(c.auth, c.entitlements, c.rooms);
  const site = createWebsiteRouters(c.auth, c.entitlements, c.website, c.media, env.UPLOAD_MAX_BYTES);
  app.use("/api/v1/hotel", createHotelRouter(c.auth, c.entitlements, c.hotel));
  app.use("/api/v1/room-types", rooms.types);
  app.use("/api/v1/rooms", rooms.rooms);
  app.use("/api/v1/catalog", rooms.catalog);
  app.use("/api/v1/facilities", site.facilities);
  app.use("/api/v1/gallery", site.gallery);
  app.use("/api/v1/media", site.media);
  app.use("/api/v1/public", createPublicRouter(c.entitlements, c.publicSite));
  app.use("/api/v1/reservations", createReservationsRouter(c.auth, c.entitlements, c.reservations));
  app.use("/api/v1/payments", createPaymentRouter(c.auth, c.payments, c.entitlements));
  app.use("/api/v1/notifications", createNotificationRouter(c.auth, c.notifications));
  app.use("/api/v1/billing", createBillingRouter(c.auth, c.billing));
  const operations = createOperationsRouter(c.auth, c.entitlements, c.operations);
  const finance = createFinanceRouter(c.auth, c.entitlements, c.finance);
  app.use("/api/v1/housekeeping", operations.housekeeping);
  app.use("/api/v1/reports", operations.reports);
  app.use("/api/v1/invoices", finance.invoices);
  app.use("/api/v1/guests", finance.guests);
  app.use("/api/v1/reports", finance.reports);
  app.use("/api/v1/platform", createPlatformRouter(c.auth, c.platform, c.tenants, c.audit));
  mountRoutes?.(app);

  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
