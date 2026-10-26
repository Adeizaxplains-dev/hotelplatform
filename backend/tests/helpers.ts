import type { Express } from "express";
import pino from "pino";
import { createApp } from "../src/app.js";
import { allowListPolicy } from "../src/middleware/security.js";
import { loadEnv, type Env } from "../src/config/env.js";
import { createHealthService, type HealthDeps } from "../src/modules/health/health.service.js";

export const VALID_RAW_ENV: Record<string, string> = {
  NODE_ENV: "test",
  PORT: "5000",
  DATABASE_URL: "mongodb://127.0.0.1:27017/hotel_test",
  ACCESS_TOKEN_SECRET: "a".repeat(40),
  REFRESH_TOKEN_SECRET: "b".repeat(40),
  CLIENT_URL: "http://localhost:5173",
  PLATFORM_DOMAIN: "platform.test",
};

export function makeEnv(overrides: Record<string, string | undefined> = {}): Env {
  return loadEnv({ ...VALID_RAW_ENV, ...overrides });
}

export const silentLogger = pino({ level: "silent" });

export function makeApp(opts: { env?: Env; mountRoutes?: (app: Express) => void; health?: Partial<HealthDeps> } = {}): Express {
  const env = opts.env ?? makeEnv();
  const health = createHealthService({
    getDatabaseStatus: () => "connected",
    pingDatabase: async () => true,
    ...opts.health,
  });
  // Unit tests never touch a database, so origins are checked against the static allow-list only.
  return createApp({ env, logger: silentLogger, health, originPolicy: allowListPolicy(env.CLIENT_URL), ...(opts.mountRoutes ? { mountRoutes: opts.mountRoutes } : {}) });
}
