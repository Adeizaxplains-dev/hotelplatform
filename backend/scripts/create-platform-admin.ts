/*
 * Creates the first platform operator (PLATFORM_SUPER_ADMIN). Reads PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_NAME and
 * PLATFORM_ADMIN_PASSWORD from the environment so the password never appears in shell history or logs.
 *   PLATFORM_ADMIN_EMAIL=you@example.com PLATFORM_ADMIN_NAME="Your Name" PLATFORM_ADMIN_PASSWORD='...' npm run admin:create
 */
import { bootstrapEnv } from "../src/config/bootstrap.js";
import { connectDatabase, disconnectDatabase } from "../src/database/connection.js";
import { createPlatformAdmin } from "../src/modules/tenants/platform.service.js";
import { createLogger } from "../src/shared/logger.js";

const env = bootstrapEnv();
const { PLATFORM_ADMIN_EMAIL: email, PLATFORM_ADMIN_NAME: name, PLATFORM_ADMIN_PASSWORD: password } = process.env;
if (!email || !name || !password) {
  console.error("Set PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_NAME and PLATFORM_ADMIN_PASSWORD.");
  process.exit(1);
}
try {
  await connectDatabase(env, createLogger({ NODE_ENV: "production", LOG_LEVEL: "warn" }));
  const user = await createPlatformAdmin({ name, email, password });
  console.log(`Platform administrator created: ${user.email}`);
  await disconnectDatabase();
} catch (err) {
  console.error("Could not create the administrator:", (err as Error).message);
  process.exit(1);
}
