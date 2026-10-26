import mongoose from "mongoose";
import type { Logger } from "pino";
import type { Env } from "../config/env.js";

// Treat any `$operator` inside a user-supplied filter as a literal value (NoSQL-injection defence in depth).
mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

export type DatabaseStatus = "connected" | "connecting" | "disconnecting" | "disconnected";

const STATES: Record<number, DatabaseStatus> = { 0: "disconnected", 1: "connected", 2: "connecting", 3: "disconnecting" };

export function getDatabaseStatus(): DatabaseStatus {
  return STATES[mongoose.connection.readyState] ?? "disconnected";
}

/** Round-trips to the server. Resolves true only if MongoDB answers within the timeout. */
export async function pingDatabase(timeoutMs = 2000): Promise<boolean> {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return false;
  try {
    await Promise.race([
      mongoose.connection.db.admin().ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("ping timeout")), timeoutMs).unref()),
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function connectDatabase(env: Pick<Env, "DATABASE_URL">, logger: Logger): Promise<void> {
  const conn = mongoose.connection;
  conn.on("disconnected", () => logger.warn("MongoDB disconnected"));
  conn.on("reconnected", () => logger.info("MongoDB reconnected"));
  conn.on("error", (err) => logger.error({ err }, "MongoDB connection error"));

  await mongoose.connect(env.DATABASE_URL, { serverSelectionTimeoutMS: 10_000, maxPoolSize: 20 });
  logger.info({ database: conn.name }, "MongoDB connected"); // never log the connection string
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
