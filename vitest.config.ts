import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/tests/**/*.test.ts"],
    // Transpile workspace packages (imported as @scip/*) rather than treating
    // them as external.
    server: {
      deps: {
        inline: [/@scip\//],
      },
    },
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
