import { spawn } from 'node:child_process';

const requiredVars = [
  'E2E_BASE_URL',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
  'E2E_USER_A_EMAIL',
  'E2E_USER_A_PASSWORD',
  'E2E_USER_B_EMAIL',
  'E2E_USER_B_PASSWORD',
];

const hasAnyCredential = requiredVars
  .filter((name) => name !== 'E2E_BASE_URL')
  .some((name) => Boolean(process.env[name]));

if (!hasAnyCredential) {
  console.log('[E2E_SKIP] Variáveis E2E ausentes. Defina as variáveis abaixo para executar:');
  requiredVars.forEach((name) => console.log(`- ${name}`));
  process.exit(0);
}

let playwrightPackage;
try {
  playwrightPackage = await import('@playwright/test');
} catch {
  console.log('[E2E_SKIP] @playwright/test não está disponível neste ambiente. Instale dependências de E2E para executar.');
  process.exit(0);
}

if (!playwrightPackage?.test) {
  console.log('[E2E_SKIP] Ambiente Playwright inválido.');
  process.exit(0);
}

const args = ['playwright', 'test'];
if (process.argv.includes('--headed')) {
  args.push('--headed');
}

const child = spawn('npx', args, { stdio: 'inherit', shell: true, env: process.env });
child.on('exit', (code) => process.exit(code ?? 1));
