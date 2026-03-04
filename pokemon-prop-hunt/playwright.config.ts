import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'on',
    video: 'off',
    channel: 'chrome',
    launchOptions: {
      args: [
        '--enable-webgl',
        '--enable-webgl2',
        '--ignore-gpu-blocklist',
        '--no-sandbox',
        '--disable-gpu-sandbox',
        '--use-gl=angle',
        '--use-angle=gl-egl',
        '--ozone-platform=headless',
        '--enable-features=Vulkan',
      ],
    },
  },
  projects: [
    {
      name: 'chrome-gpu',
      use: { browserName: 'chromium' },
    },
  ],
  outputDir: './test-results',
});
