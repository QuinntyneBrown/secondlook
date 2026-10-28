import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './storybook',
  fullyParallel: true,
  // GitHub's ubuntu runners have 4 vCPUs for public repos; 2 workers left half idle.
  workers: 4,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: 'list',
  expect: { timeout: 10_000 },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:6006',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx http-server ../frontend/dist/storybook -a 127.0.0.1 -p 6006 -c-1 --silent',
    url: 'http://127.0.0.1:6006/index.json',
    reuseExistingServer: false,
  },
});
