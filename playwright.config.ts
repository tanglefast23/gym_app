import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Keep e2e separate from unit tests (Vitest uses *.test.ts too).
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',

  reporter: [['list']],

  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
  },

  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
