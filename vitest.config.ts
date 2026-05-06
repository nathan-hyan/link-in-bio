import path from "node:path";
import {
  defineWorkersConfig,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(
    path.join(import.meta.dirname, "drizzle")
  );

  return {
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          isolatedStorage: true,
          wrangler: { configPath: "./wrangler.jsonc" },
          miniflare: {
            d1Databases: ["DB"],
            compatibilityDate: "2025-04-04",
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
      coverage: {
        provider: "istanbul",
        reporter: ["text", "html"],
        include: ["app/**/*.{ts,tsx}"],
        exclude: [
          "app/**/*.test.{ts,tsx}",
          "app/**/+types/**",
          "app/entry.server.tsx",
          "app/root.tsx",
          "app/routes.ts",
        ],
        thresholds: {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80,
        },
      },
    },
  };
});
