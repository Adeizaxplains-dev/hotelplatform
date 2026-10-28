
/* Verifies DATABASE_URL without printing credentials. */
import mongoose from "mongoose";
import { bootstrapEnv } from "../src/config/bootstrap.js";
import {
  connectDatabase,
  disconnectDatabase,
  pingDatabase,
} from "../src/database/connection.js";
import { createLogger } from "../src/shared/logger.js";

const env = bootstrapEnv();
const logger = createLogger({
  NODE_ENV: "production",
  LOG_LEVEL: "warn",
});

try {
  await connectDatabase(env, logger);

  const ok = await pingDatabase(5000);

  console.log(
    ok
      ? "Database check passed: connected and answering ping."
      : "Database check FAILED: connected but ping failed.",
  );

  if (ok) {
    console.log("Connected database name:", mongoose.connection.name);
  }

  await disconnectDatabase();
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error(
    "Database check FAILED:",
    (err as Error).name,
  );

  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
}
