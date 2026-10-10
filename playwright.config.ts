import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  retries: 0,
  globalTimeout: 15 * 60 * 1000,
  reporter: "line",
  use: { baseURL: "http://127.0.0.1:18284", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm preview --host 127.0.0.1 --port 18284",
    url: "http://127.0.0.1:18284",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
