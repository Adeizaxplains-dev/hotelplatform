import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      // Pure logic and HTTP behaviour with injected fakes: no database needed.
      { test: { name: "unit", environment: "node", include: ["tests/unit/**/*.test.ts"], setupFiles: ["tests/setup.ts"], testTimeout: 10_000 } },
      // Real MongoDB (TEST_DATABASE_URL). Files run one at a time because they share the database.
      {
        test: {
          name: "integration", environment: "node", include: ["tests/integration/**/*.test.ts"], setupFiles: ["tests/setup.ts"],
          globalSetup: ["tests/integration/globalSetup.ts"], fileParallelism: false, testTimeout: 30_000, hookTimeout: 30_000,
        },
      },
    ],
  },
});
