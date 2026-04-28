import { expect, test } from '@playwright/test';

// Reutiliza nomes fixos com prefixo E2E para evitar criação ilimitada de dados de teste
// enquanto a exclusão via UI de Fazendas não estiver disponível de forma confiável.
const E2E_PREFIX = 'E2E_HERDON_';
const FARM_PERSISTENCE = `${E2E_PREFIX}FAZENDA_PERSISTENCIA`;
const FARM_RLS = `${E2E_PREFIX}FAZENDA_RLS`;

const runtimeEnv = globalThis?.process?.env || {};

const env = {
  adminEmail: runtimeEnv.E2E_ADMIN_EMAIL,
  adminPassword: runtimeEnv.E2E_ADMIN_PASSWORD,
  userAEmail: runtimeEnv.E2E_USER_A_EMAIL,
  userAPassword: runtimeEnv.E2E_USER_A_PASSWORD,
  userBEmail: runtimeEnv.E2E_USER_B_EMAIL,
  userBPassword: runtimeEnv.E2E_USER_B_PASSWORD,
};

const hasAuthEnv = Boolean(env.adminEmail && env.adminPassword);
const hasPersistenceEnv = Boolean(env.userAEmail && env.userAPassword);
const hasRlsEnv = Boolean(env.userAEmail && env.userAPassword && env.userBEmail && env.userBPassword);

async function openLogin(page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'HERDON', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Entrar$/ })).toBeVisible();
}

async function login(page, email, password) {
  await openLogin(page);
  await page.getByLabel(/^E-mail$/).fill(email);
  await page.getByLabel(/^Senha$/).fill(password);
  await page.getByRole('button', { name: /^Entrar$/ }).click();
  await expect(page.getByRole('button', { name: /^Fazendas$/ })).toBeVisible();
  await expect(page.getByText('Sair da conta').first()).toBeVisible();
}

async function logout(page) {
  await page.getByText('Sair da conta').first().click();
  await expect(page.getByRole('button', { name: /^Entrar$/ })).toBeVisible();
}

async function openFazendas(page) {
  await page.getByRole('button', { name: /^Fazendas$/ }).click();
  await expect(page.getByRole('heading', { name: /^Fazendas$/ })).toBeVisible();
}

async function ensureFarmExists(page, farmName) {
  await openFazendas(page);
  const farmCard = page.getByText(farmName);
  if (await farmCard.count()) {
    return;
  }

  await page.getByRole('button', { name: /^\+ Nova Fazenda$/ }).click();
  await page.getByLabel('Nome da fazenda *').fill(farmName);
  await page.getByRole('button', { name: /^Salvar$/ }).click();
  await expect(page.getByText(farmName)).toBeVisible();
}

test.describe('Smoke E2E - Herdon', () => {
  test('login smoke', async ({ page }) => {
    test.skip(!hasAuthEnv, 'E2E_LOGIN_SKIP: defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD.');
    await login(page, env.adminEmail, env.adminPassword);
  });

  test('logout smoke', async ({ page }) => {
    test.skip(!hasAuthEnv, 'E2E_LOGOUT_SKIP: defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD.');
    await login(page, env.adminEmail, env.adminPassword);
    await logout(page);
    await page.reload();
    await expect(page.getByRole('button', { name: /^Entrar$/ })).toBeVisible();
  });

  test('cross-tab logout', async ({ browser }) => {
    test.skip(!hasAuthEnv, 'E2E_CROSSTAB_SKIP: defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD.');

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const tabA = await contextA.newPage();
    const tabB = await contextB.newPage();

    await login(tabA, env.adminEmail, env.adminPassword);
    await login(tabB, env.adminEmail, env.adminPassword);

    await logout(tabA);

    await tabB.bringToFront();
    await tabB.reload();
    await expect(tabB.getByRole('button', { name: /^Entrar$/ })).toBeVisible();

    await contextA.close();
    await contextB.close();
  });

  test('persistence smoke: mantém fazenda de teste após refresh', async ({ page }) => {
    test.skip(!hasPersistenceEnv, 'E2E_PERSISTENCE_SKIP: defina E2E_USER_A_EMAIL e E2E_USER_A_PASSWORD.');

    await login(page, env.userAEmail, env.userAPassword);
    await ensureFarmExists(page, FARM_PERSISTENCE);

    await page.reload();
    await openFazendas(page);
    await expect(page.getByText(FARM_PERSISTENCE)).toBeVisible();
  });

  test('RLS smoke: usuário B não vê fazenda de usuário A', async ({ browser }) => {
    test.skip(!hasRlsEnv, 'E2E_RLS_SKIP: defina credenciais de USER_A e USER_B.');

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await login(pageA, env.userAEmail, env.userAPassword);
    await ensureFarmExists(pageA, FARM_RLS);

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await login(pageB, env.userBEmail, env.userBPassword);
    await openFazendas(pageB);
    await expect(pageB.getByText(FARM_RLS)).toHaveCount(0);

    await contextA.close();
    await contextB.close();
  });

  test('permission smoke: usuário limitado não gerencia acessos', async ({ page }) => {
    test.skip(!hasRlsEnv, 'E2E_PERMISSION_SKIP: defina USER_B para perfil limitado (operador/visualizador).');

    await login(page, env.userBEmail, env.userBPassword);
    await page.getByRole('button', { name: /^Configurações$/ }).click();
    await expect(page.getByRole('heading', { name: /^Configurações$/ })).toBeVisible();

    await expect(page.getByText('Usuários e Acessos')).toHaveCount(0);
  });
});
