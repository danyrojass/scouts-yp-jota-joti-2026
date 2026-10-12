import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://ypacarai:ypacarai@127.0.0.1:5433/ypacarai_test?schema=public";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    globalSetup: ["tests/global-setup.ts"],
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
    // Set before any module reads the environment so the app points at the
    // test database (dotenv does not override pre-set variables).
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      SESSION_SECRET: "test-secret-with-more-than-thirty-two-characters",
      PUBLIC_BASE_URL: "https://evento.test",
      CORS_ORIGINS: "https://evento.test",
      COOKIE_SECURE: "false",
      COOKIE_SAMESITE: "lax",
      SESSION_TTL_HOURS: "24",
      LOGIN_MAX_ATTEMPTS: "1000",
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
