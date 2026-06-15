# HERDON E2E Setup (Sprint 14A)

## Purpose
Enable real authenticated E2E testing for HERDON using Playwright and real Supabase test users.

## Required Environment Variables
Create `.env.e2e` from `.env.e2e.example` and fill real test credentials:

```env
E2E_BASE_URL=http://127.0.0.1:5173
E2E_ADMIN_EMAIL=
E2E_ADMIN_PASSWORD=
E2E_USER_A_EMAIL=
E2E_USER_A_PASSWORD=
E2E_USER_B_EMAIL=
E2E_USER_B_PASSWORD=
```

Do not commit real credentials.

## Expected Test Users / Roles
- `E2E_ADMIN_EMAIL`: admin/proprietário profile (full access)
- `E2E_USER_A_EMAIL`: regular operational user (used for persistence/RLS baseline)
- `E2E_USER_B_EMAIL`: limited profile (`operador` or `visualizador`) for permission checks

If your project uses invite/profile sync, ensure users are mapped to the expected `perfil` in Supabase (`profiles` / `invites` workflow).

## How to Create Users in Supabase
1. Open Supabase project dashboard.
2. Create users in Auth (email/password).
3. Ensure each user has a profile role in `public.profiles` (or invite flow) matching expected test role.
4. Confirm each user can log in via HERDON UI before running E2E.

## Local Run
1. Install dependencies:
```bash
npm install
```
2. Copy and fill env file:
```bash
cp .env.e2e.example .env.e2e
```
3. Run E2E headless:
```bash
npm run e2e
```
4. Run E2E headed:
```bash
npm run e2e:headed
```

The runner loads `.env.e2e` and `.env.e2e.local` automatically.

## Dev Server Behavior
- If `E2E_BASE_URL` is not set to a remote URL, Playwright config starts local dev server automatically at `127.0.0.1:4173`.
- If `E2E_BASE_URL` points to a remote environment, web server auto-start is skipped.

## Smoke Coverage in Sprint 14A
- Login works
- Dashboard/app shell opens
- Logged user does not show known mock farm names
- Logout works
- Existing smoke checks for persistence, RLS, and limited permission remain available

## Troubleshooting
### Missing variable error
If runner prints `[E2E_ENV_ERROR]`, fill all required `E2E_*` variables in `.env.e2e`.

### Login failure
- Validate email/password manually in HERDON login page.
- Check Supabase Auth user exists and is confirmed.
- Check profile role mapping (`profiles`/`invites`) if access appears wrong.

### Playwright missing
If runner prints `[E2E_SETUP_ERROR] @playwright/test is not available`, install E2E dependency tooling for your environment.

### Base URL mismatch
If tests cannot open app:
- Confirm `E2E_BASE_URL` points to a reachable HERDON instance.
- For local runs, prefer `http://127.0.0.1:4173` or adjust to your running host/port.
