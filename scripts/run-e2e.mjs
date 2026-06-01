import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const requiredVars = [
  'E2E_BASE_URL',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
  'E2E_USER_A_EMAIL',
  'E2E_USER_A_PASSWORD',
  'E2E_USER_B_EMAIL',
  'E2E_USER_B_PASSWORD',
];

function loadDotEnvFile(filename) {
  const filePath = path.resolve(process.cwd(), filename);
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = String(line || '').trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!key) continue;
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnvFile('.env.e2e');
loadDotEnvFile('.env.e2e.local');

const missingVars = requiredVars.filter((name) => !String(process.env[name] || '').trim());
if (missingVars.length > 0) {
  console.error('[E2E_ENV_ERROR] Missing required E2E environment variables:');
  missingVars.forEach((name) => console.error(`- ${name}`));
  console.error('[E2E_ENV_ERROR] Create .env.e2e from .env.e2e.example and fill real credentials.');
  process.exit(1);
}

let playwrightPackage;
try {
  playwrightPackage = await import('@playwright/test');
} catch {
  console.error('[E2E_SETUP_ERROR] @playwright/test is not available. Install E2E dependencies first.');
  process.exit(1);
}

if (!playwrightPackage?.test) {
  console.error('[E2E_SETUP_ERROR] Invalid Playwright environment.');
  process.exit(1);
}

const args = ['playwright', 'test'];
if (process.argv.includes('--headed')) {
  args.push('--headed');
}

const child = spawn('npx', args, { stdio: 'inherit', shell: true, env: process.env });
child.on('exit', (code) => process.exit(code ?? 1));
