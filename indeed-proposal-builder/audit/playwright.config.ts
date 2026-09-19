import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './2026-09-19T1746Z',
  testMatch: /audit-browser\.spec\.ts/,
  timeout: 120_000,
  use: {
    baseURL: 'http://127.0.0.1:43123',
    trace: 'off',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:43123',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
