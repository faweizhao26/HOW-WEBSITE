import { defineConfig, devices } from "@playwright/test"

const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const projectRoot = __dirname
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL
const baseURL = externalBaseURL || "http://127.0.0.1:3019"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: "line",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath: chromePath },
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: "npm run dev -- --webpack --hostname 127.0.0.1 --port 3019",
        cwd: projectRoot,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
