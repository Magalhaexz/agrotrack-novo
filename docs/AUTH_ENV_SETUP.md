# HERDON Authentication Environment Setup

This guide restores the Supabase authentication flow after auth env drift.

## Local `.env.local`

Your local file must include:

```env
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=PUBLIC_ANON_KEY
ASAAS_ENV=sandbox
# Use ASAAS_API_BASE_URL or ASAAS_BASE_URL (alias) for the provider API host.
ASAAS_API_BASE_URL=https://sandbox.asaas.com/api/v3
ASAAS_API_KEY=SERVER_ONLY_KEY
ASAAS_WEBHOOK_TOKEN=SERVER_ONLY_TOKEN
VITE_APP_URL=http://localhost:5173
VITE_CHECKOUT_URL=http://localhost:5173/minha-assinatura
```

Important:

- `VITE_SUPABASE_URL` must be the project base URL only.
- Do not include `/rest/v1/` in `VITE_SUPABASE_URL`.
- Never use the Supabase `service_role` key in the frontend.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are required for login, signup, Google OAuth, and session restoration.

## Vercel environment variables

Set these variables in Vercel:

```env
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=PUBLIC_ANON_KEY
ASAAS_ENV=sandbox
# Use ASAAS_API_BASE_URL or ASAAS_BASE_URL (alias) for the provider API host.
ASAAS_API_BASE_URL=https://sandbox.asaas.com/api/v3
ASAAS_API_KEY=SERVER_ONLY_KEY
ASAAS_WEBHOOK_TOKEN=SERVER_ONLY_TOKEN
VITE_APP_URL=https://agrotrack-novo.vercel.app
VITE_CHECKOUT_URL=https://agrotrack-novo.vercel.app/minha-assinatura
```

Important:

- After changing Vercel env vars, a redeploy is required.
- `VITE_APP_URL` should point to the deployed app origin.
- `VITE_CHECKOUT_URL` should point to the customer subscription page.

## Supabase Auth redirect URLs

Add these URLs in the Supabase dashboard under Authentication redirect settings:

- `https://agrotrack-novo.vercel.app`
- `https://agrotrack-novo.vercel.app/`
- `http://localhost:5173`
- `http://localhost:5173/`

If you test any custom local path, add it explicitly as well.

## What to verify

1. Email/password signup works.
2. Email/password login works.
3. Google login redirects back to the same app origin.
4. Refreshing the page keeps the session restored.
5. Logout clears the visible auth state immediately.
6. Dev builds show a friendly setup hint if the Supabase env is missing.
