import { defineConfig, devices } from '@playwright/test';
import { TEST_PORT, TEST_DB_PATH } from './frontend/tests/e2e/real-server/test-config.js';

// Normalize to forward slashes so the shell command works on Windows
const DB_PATH_SHELL = TEST_DB_PATH.replace(/\\/g, '/');

/**
 * Real-server E2E suite — tests against an actual running backend with an
 * isolated SQLite DB. No page.route() mocking is used anywhere in this suite.
 *
 * Run with:
 *   npx playwright test --config playwright.real.config.ts
 *
 * Prerequisites: frontend must be built (`npm run build --workspace=frontend`).
 */
export default defineConfig({
  testDir: './frontend/tests/e2e/real-server',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'html',
  globalSetup: './frontend/tests/e2e/real-server/global-setup.ts',
  globalTeardown: './frontend/tests/e2e/real-server/global-teardown.ts',
  use: {
    baseURL: `http://127.0.0.1:${TEST_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'real-server',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npx tsx backend/start-test-server.mjs ${TEST_PORT} "${DB_PATH_SHELL}"`,
    url: `http://127.0.0.1:${TEST_PORT}`,
    reuseExistingServer: false,
    timeout: 60 * 1000,
  },
});
