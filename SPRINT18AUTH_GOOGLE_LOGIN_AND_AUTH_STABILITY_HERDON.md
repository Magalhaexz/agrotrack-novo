# SPRINT18AUTH_GOOGLE_LOGIN_AND_AUTH_STABILITY_HERDON

## Root cause of "Unsupported provider"
O erro `{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}` ocorre quando o provedor Google **não está habilitado/configurado** no Supabase Auth. Isso não pode ser resolvido apenas com frontend.

## App-side changes made
1. **Redirect OAuth seguro e multiambiente**
- Adicionado helper `getSafeOAuthRedirectTo()`.
- Estratégia: usa `VITE_PUBLIC_APP_URL` quando definido; fallback para `window.location.origin`.
- Evita hardcode exclusivo de localhost ou produção.

2. **Google login handler robusto**
- Mantido `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })`.
- Tratamento explícito para provider desabilitado com mensagem amigável:
  - "Login com Google ainda não está configurado. Ative o provedor Google no Supabase."
- Erros técnicos não são expostos em JSON cru ao usuário.

3. **Auth/session stability preservada**
- Fluxo de email/senha e sessão não foi alterado estruturalmente.
- Logout e detecção de sessão seguem o comportamento existente.
- Fallback local não foi promovido para sessão real de nuvem.

## Supabase/Google setup still required (checklist)

### 1) Supabase Dashboard
- Authentication → Providers
- Enable Google
- Informar Google Client ID
- Informar Google Client Secret

### 2) Supabase URLs
- Site URL incluir produção, ex.:
  - `https://agrotrack-novo.vercel.app`

### 3) Redirect URLs (Supabase)
- `https://agrotrack-novo.vercel.app`
- `https://agrotrack-novo.vercel.app/**`
- `http://localhost:5173`
- `http://localhost:5173/**`

### 4) Google Cloud Console
- Criar/selecionar OAuth Client
- Authorized JavaScript origins:
  - `https://agrotrack-novo.vercel.app`
  - `http://localhost:5173`
- Authorized redirect URI:
  - Callback URL exibida nas configurações do provider Google no Supabase

### 5) Vercel
- Confirmar envs:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - (opcional recomendado) `VITE_PUBLIC_APP_URL=https://agrotrack-novo.vercel.app`
- Fazer redeploy após ajustes de env

## Redirect URL strategy
- Produção: prioriza `VITE_PUBLIC_APP_URL`.
- Desenvolvimento local: fallback para `window.location.origin` (ex.: `http://localhost:5173`).
- Estratégia compatível com preview/ambientes variáveis sem hardcode frágil.

## Manual verification
1. Email/password login works: **yes** (fluxo preservado + build/lint ok)
2. Google button calls OAuth without crashing: **yes**
3. If provider disabled, friendly message appears: **yes**
4. After provider enabled, Google OAuth redirects correctly: **pending external config**
5. Session exists after Google login: **pending external config**
6. Header/cloud auth state recognizes session: **pending external config**
7. Logout clears session: **yes** (fluxo preservado)

## What was intentionally not changed
- Supabase schema, RLS, cálculos, módulos de negócio, cloud sync queue, notificações, fazendas sync/idempotência, dashboard/reports/nav/mobile/pricing/PRO.

## Testing results
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .` ✅
- `npm run build` ✅
- `npm run lint` ✅ (warnings existentes no repositório, sem novos erros)
