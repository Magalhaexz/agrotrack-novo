import { defineConfig } from '@playwright/test';

const runtimeEnv = globalThis?.process?.env || {};
const baseURL = runtimeEnv.E2E_BASE_URL || 'http://127.0.0.1:4173';
const isRemoteBaseUrl = Boolean(runtimeEnv.E2E_BASE_URL);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: isRemoteBaseUrl
    ? undefined
    : {
        command: 'npm run dev -- --host 127.0.0.1 --port 4173',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
