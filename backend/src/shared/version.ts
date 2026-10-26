import { readFileSync } from "node:fs";

/** Reads backend/package.json; the relative path is identical from src/ and dist/. */
export const APP_VERSION: string = (() => {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();
