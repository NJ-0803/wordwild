import { defineConfig } from "@playwright/test";

/** Browser end-to-end tests. They use the installed Google Chrome (no separate browser download) and a production build served locally. */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 1,
  reporter: "list",
  use: { baseURL: "http://localhost:3210", channel: "chrome", trace: "retain-on-failure" },
  webServer: { command: "npm run build && npx next start -p 3210", url: "http://localhost:3210", reuseExistingServer: true, timeout: 240_000 },
});
