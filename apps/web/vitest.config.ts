import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: [
      "src/**/*.{test,spec}.?(c|m)[jt]s?(x)",
      "../../tests/integration/**/*.{test,spec}.?(c|m)[jt]s?(x)",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "../../tests/integration/exam-week-suppression.test.ts",
      "../../tests/integration/placement-prediction.test.ts",
      "../../tests/integration/credential-threshold.test.ts",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
      "bcryptjs": path.resolve(__dirname, "./node_modules/bcryptjs/index.js"),
    },
  },
});
