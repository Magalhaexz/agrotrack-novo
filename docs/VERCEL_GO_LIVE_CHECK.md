# Vercel — Go-live Check

**Data:** 2026-06-17
**Sprint:** 15

---

## Projeto

| Campo | Valor |
|-------|-------|
| Nome | `agrotrack-novo` |
| ID | `prj_EvRR500wRpUFblz2tRRrXeqhhuto` |
| Framework | Vite |
| Node.js | 24.x |
| Team | `magalhaexzs-projects` |

---

## Último deploy (produção)

| Campo | Valor |
|-------|-------|
| ID | `dpl_4ca9vEGgfA8w2n4mdoKVnxWs1v9f` |
| Estado | ✅ `READY` |
| Target | `production` |
| Commit | `90490ad` — feat: add unified alerts and monitoring |
| Branch | `main` |
| Criado por | `magalhaexz` |

---

## Domínios disponíveis

| URL | Tipo |
|-----|------|
| `agrotrack-novo.vercel.app` | ✅ Domínio primário Vercel |
| `agrotrack-novo-magalhaexzs-projects.vercel.app` | Alias de equipe |
| `agrotrack-novo-git-main-magalhaexzs-projects.vercel.app` | Alias de branch |

**Domínio customizado:** não configurado. Para go-live profissional, recomenda-se configurar domínio próprio (ex: `app.herdon.com.br`).

---

## Rotas SPA

`vercel.json` configurado corretamente:

```json
{ "source": "/((?!api/).*)", "destination": "/index.html" }
```

Rotas públicas (`/termos-de-uso`, `/politica-de-privacidade`, etc.) são atendidas pelo mesmo `index.html` e roteadas pelo React. ✅

---

## Headers de segurança

| Header | Valor configurado |
|--------|-------------------|
| `X-Content-Type-Options` | `nosniff` ✅ |
| `X-Frame-Options` | `DENY` ✅ |
| `X-XSS-Protection` | `1; mode=block` ✅ |
| `Referrer-Policy` | `strict-origin-when-cross-origin` ✅ |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` ✅ |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` ✅ |

---

## Variáveis de ambiente (verificação pendente)

As seguintes variáveis devem estar configuradas no dashboard Vercel:

| Variável | Função | Status |
|----------|--------|--------|
| `VITE_SUPABASE_URL` | Supabase cliente | ⚠️ Verificar dashboard |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | ⚠️ Verificar dashboard |
| `VITE_APP_URL` | URL do app | ⚠️ Verificar dashboard |
| `VITE_CHECKOUT_URL` | URL de checkout | ⚠️ Verificar dashboard |
| `SUPABASE_URL` | Supabase servidor (api/) | ⚠️ Verificar dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (api/) — **crítico** | ⚠️ Verificar dashboard |
| `ASAAS_API_BASE_URL` | Endpoint Asaas | ⚠️ Verificar dashboard |
| `ASAAS_API_KEY` | API Key Asaas | ⚠️ Verificar dashboard |
| `ASAAS_WEBHOOK_TOKEN` | Token do webhook | ⚠️ Verificar dashboard |
| `ASAAS_ENV` | `sandbox` ou `production` | ⚠️ Verificar (não ir a prod sem confirmação) |

> **Ação necessária:** Entrar em Vercel → `agrotrack-novo` → Settings → Environment Variables e confirmar que todas estão presentes na environment `production`.

---

## Status geral

| Item | Status |
|------|--------|
| Projeto identificado | ✅ |
| Último deploy é Sprint 14 (correto) | ✅ |
| Deploy state: READY | ✅ |
| SPA rewrite configurado | ✅ |
| Headers de segurança | ✅ |
| Domínio customizado | ⚠️ Não configurado |
| Env vars verificadas no dashboard | ⚠️ Pendente (verificar manualmente) |

---

## Pendências antes do go-live

1. Confirmar env vars no Vercel dashboard (especialmente `SUPABASE_SERVICE_ROLE_KEY`)
2. Decidir se usa `agrotrack-novo.vercel.app` ou configurar domínio próprio
3. Confirmar `ASAAS_ENV=production` apenas quando tudo estiver validado
