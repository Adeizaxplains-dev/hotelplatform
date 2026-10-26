import type { Server } from "node:http";
import { createApp } from "./app.js";
import { bootstrapEnv } from "./config/bootstrap.js";
import { connectDatabase, disconnectDatabase } from "./database/connection.js";
import { createLogger } from "./shared/logger.js";

const env = bootstrapEnv();
const logger = createLogger(env);

async function main(): Promise<void> {
  await connectDatabase(env, logger);
  const app = createApp({ env, logger });
  const server: Server = app.listen(env.PORT, () => logger.info({ port: env.PORT, env: env.NODE_ENV }, "API listening"));

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down");
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    server.close(() => {
      disconnectDatabase()
        .catch((err: unknown) => logger.error({ err }, "Error closing MongoDB"))
        .finally(() => process.exit(0));
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "Unhandled promise rejection");
    shutdown("unhandledRejection");
  });
}

main().catch((err: unknown) => {
  logger.fatal({ err }, "Failed to start the API");
  process.exit(1);
});
