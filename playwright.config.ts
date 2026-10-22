import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:3001',
    headless: true,
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox'] },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:3001/api/health',
    reuseExistingServer: !process.env.CI,
    env: { APP_URL: 'http://127.0.0.1:3001', PORT: '3001', DATABASE_PATH: '.data/e2e.sqlite' },
    timeout: 30000,
  },
});
