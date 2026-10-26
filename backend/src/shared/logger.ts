import pino, { type DestinationStream, type Logger } from "pino";
import type { Env } from "../config/env.js";

/** Paths whose values must never reach the logs. */
export const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["x-paystack-signature"]',
  'res.headers["set-cookie"]',
  "*.password",
  "*.newPassword",
  "*.currentPassword",
  "*.token",
  "*.accessToken",
  "*.refreshToken",
  "*.secret",
  "*.apiKey",
  "*.DATABASE_URL",
  "*.PAYSTACK_SECRET_KEY",
  "*.ACCESS_TOKEN_SECRET",
  "*.REFRESH_TOKEN_SECRET",
  "password",
  "token",
  "accessToken",
  "refreshToken",
];

export function createLogger(env: Pick<Env, "NODE_ENV" | "LOG_LEVEL">, destination?: DestinationStream): Logger {
  const level = env.LOG_LEVEL ?? (env.NODE_ENV === "test" ? "silent" : env.NODE_ENV === "production" ? "info" : "debug");
  const options = {
    level,
    base: { service: "hotel-platform-api" },
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  if (destination) return pino(options, destination);
  if (env.NODE_ENV === "development") {
    return pino({
      ...options,
      transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname,service" } },
    });
  }
  return pino(options);
}
