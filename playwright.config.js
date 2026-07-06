const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  fullyParallel: true,
  // Pages pull marked/prism/fonts from CDNs; runner network hiccups can fail
  // a test spuriously. Retries paper over that until the CDN deps are vendored.
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:8123",
  },
  webServer: {
    command: "node tests/serve.js 8123",
    url: "http://127.0.0.1:8123/",
    reuseExistingServer: !process.env.CI,
  },
});
