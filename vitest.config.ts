import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          d1Databases: ["DB"],
          compatibilityDate: "2025-04-04",
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
});
