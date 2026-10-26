import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { EnvError, loadEnv, type Env } from "./env.js";

/**
 * Loads <repo>/.env for local development (real environment variables always win),
 * validates everything and returns the typed config. Exits with a readable message on
 * failure. Never prints values.
 */
export function bootstrapEnv(): Env {
  loadDotenv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });
  try {
    return loadEnv(process.env);
  } catch (err) {
    if (err instanceof EnvError) {
      process.stderr.write(`${err.message}\n\nSee .env.example for the full list of variables.\n`);
      process.exit(1);
    }
    throw err;
  }
}
