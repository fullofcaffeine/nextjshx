import { existsSync } from "node:fs";
import path from "node:path";

import { defineConfig } from "@playwright/test";

const configuredBrowser = process.env.NEXTJSHX_CHROME;
if (configuredBrowser !== undefined && !path.isAbsolute(configuredBrowser)) {
  throw new Error("NEXTJSHX_CHROME must be an absolute browser executable path");
}
const executablePath = [
  configuredBrowser,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].find((candidate) => candidate !== undefined && existsSync(candidate));
if (executablePath === undefined) {
  throw new Error("no system Chrome/Chromium executable found; configure NEXTJSHX_CHROME");
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "todoapp-next.spec.mjs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 90_000,
  expect: { timeout: 10_000 },
  outputDir: ".nextjshx/playwright-results",
  reporter: [
    ["line"],
    ["html", { outputFolder: ".nextjshx/playwright-report", open: "never" }],
  ],
  use: {
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath,
      args: ["--disable-dev-shm-usage", "--no-sandbox"],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
});
