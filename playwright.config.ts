import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for BrainTap.
 *
 * Tests run against a real production build (next build && next start) so the
 * static-params / 404 behaviour matches what ships. In local dev an already
 * running server is reused; in CI a fresh server is booted.
 */

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "e2e",
  // Production builds can be slow to render the full hub on cold start.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],

  webServer: {
    command: "npm run build && npm run start",
    url: baseURL,
    // In dev, reuse a server you already have running; in CI always boot fresh.
    reuseExistingServer: !isCI,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
