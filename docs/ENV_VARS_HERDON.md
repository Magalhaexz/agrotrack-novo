# Variáveis de Ambiente — HERDON

> Sprint 4 · Etapa 2 · Gerado em 2026-06-15  
> Verificação feita via grep em `src/`, `api/` e `.env.example`

---

## Resumo rápido

| Contexto | Prefixo | Exposição | Quem usa |
|----------|---------|-----------|---------|
| Frontend (bundle Vite) | `VITE_` | Pública — vai no JS | Browser / React |
| Servidor (serverless) | *(sem prefixo)* | Privada — só no Node | `api/*.js` na Vercel |

> **Regra de ouro:** nunca colocar `SUPABASE_SERVICE_ROLE_KEY` ou `ASAAS_API_KEY`  
> em variável com prefixo `VITE_`. Verificado: nenhuma dessas está em `VITE_*`. ✅

---

## Variáveis de Frontend (`VITE_*`)

| Variável | Obrigatória | Onde usada | Local | Preview | Produção |
|----------|------------|------------|-------|---------|----------|
| `VITE_SUPABASE_URL` | ✅ Sim | `src/lib/supabase.js` | `https://ljpiszxicmmuefbiixui.supabase.co` | mesmo | mesmo |
| `VITE_SUPABASE_ANON_KEY` | ✅ Sim | `src/lib/supabase.js` | chave anon do projeto | mesmo | mesmo |
| `VITE_APP_URL` | ✅ Sim | redirects OAuth/e-mail | `http://localhost:5173` | URL do preview Vercel | `https://herdon.com.br` |
| `VITE_CHECKOUT_URL` | ✅ Sim | link checkout assinatura | `http://localhost:5173/minha-assinatura` | URL preview + `/minha-assinatura` | `https://herdon.com.br/minha-assinatura` |
| `VITE_HERDON_BOOTSTRAP_ADMIN_EMAILS` | ⚠️ Não documentado | `src/services/userAccess.js:14` | *(ver nota abaixo)* | — | — |
| `VITE_PUBLIC_APP_URL` | 🔵 Alias opcional | alias de `VITE_APP_URL` | mesmo | mesmo | mesmo |

### Nota: `VITE_HERDON_BOOTSTRAP_ADMIN_EMAILS`

**Não está no `.env.example`** e tem fallback hardcoded em `userAccess.js:7`:

```js
const DEFAULT_BOOTSTRAP_ADMIN_EMAILS = ['magalhaesh617@gmail.com'];
```

- Valor esperado: lista separada por vírgula, ex.: `herdonapp@gmail.com,magalhaesh617@gmail.com`
- Risco: o fallback hardcoded fica visível no JS bundle de produção
- Ação recomendada: adicionar ao `.env.example` e definir na Vercel antes do go-live

---

## Variáveis de Servidor (`api/*.js`)

| Variável | Obrigatória | Onde usada | Sandbox | Preview | Produção |
|----------|------------|------------|---------|---------|----------|
| `SUPABASE_URL` | ✅ Sim | `api/_supabaseAdmin.js` | mesma URL do projeto | mesmo | mesmo |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Sim | `api/_supabaseAdmin.js` | chave service_role | mesmo | mesmo |
| `ASAAS_API_BASE_URL` | ✅ Sim | `api/_asaas.js` | `https://sandbox.asaas.com/api/v3` | sandbox | `https://api.asaas.com/v3` |
| `ASAAS_API_KEY` | ✅ Sim | `api/_asaas.js` | chave sandbox Asaas | sandbox | chave produção |
| `ASAAS_WEBHOOK_TOKEN` | ✅ Sim | `api/asaas-webhook.js` | token cadastrado no painel Asaas | — | token produção |
| `ASAAS_ENV` | 🔵 Opcional | `api/_asaas.js` | `sandbox` | `sandbox` | `production` |

### Notas servidor

- `SUPABASE_URL` e `VITE_SUPABASE_URL` têm o mesmo valor mas nomes diferentes — obrigatório ter os dois
- `SUPABASE_SERVICE_ROLE_KEY` bypass total de RLS — nunca em variável com `VITE_`
- `ASAAS_ENV` não altera a URL base (que é controlada por `ASAAS_API_BASE_URL`), mas pode ser usado por logging interno

---

## `.env.example` — Estado atual vs necessário

| Variável | No `.env.example`? | Ação |
|----------|-------------------|------|
| `VITE_SUPABASE_URL` | ✅ Sim | OK |
| `VITE_SUPABASE_ANON_KEY` | ✅ Sim | OK |
| `VITE_APP_URL` | ✅ Sim | OK |
| `VITE_CHECKOUT_URL` | ✅ Sim | OK |
| `ASAAS_ENV` | ✅ Sim | OK |
| `ASAAS_API_BASE_URL` | ✅ Sim | OK |
| `ASAAS_API_KEY` | ✅ Sim | OK |
| `ASAAS_WEBHOOK_TOKEN` | ✅ Sim | OK |
| `SUPABASE_URL` | ❌ Ausente | Adicionar com comentário "servidor" |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ Ausente | Adicionar com aviso de segurança |
| `VITE_HERDON_BOOTSTRAP_ADMIN_EMAILS` | ❌ Ausente | Adicionar como opcional com nota |

---

## Checklist de configuração Vercel (pré-produção)

```
[ ] VITE_SUPABASE_URL        → produção
[ ] VITE_SUPABASE_ANON_KEY   → produção
[ ] VITE_APP_URL             → https://herdon.com.br (domínio final)
[ ] VITE_CHECKOUT_URL        → https://herdon.com.br/minha-assinatura
[ ] SUPABASE_URL             → mesmo que VITE_SUPABASE_URL
[ ] SUPABASE_SERVICE_ROLE_KEY → painel Supabase → Settings → API → service_role
[ ] ASAAS_API_BASE_URL       → https://api.asaas.com/v3 (produção)
[ ] ASAAS_API_KEY            → chave de produção do painel Asaas
[ ] ASAAS_WEBHOOK_TOKEN      → token cadastrado no webhook do painel Asaas
[ ] ASAAS_ENV                → production
[ ] VITE_HERDON_BOOTSTRAP_ADMIN_EMAILS → email(s) admin separados por vírgula
```

---

## Verificação de segurança — service_role

Grep confirmou: `SUPABASE_SERVICE_ROLE_KEY` não aparece em nenhum arquivo com prefixo `VITE_`. ✅

Única ocorrência é `api/_supabaseAdmin.js`:

```js
process.env.SUPABASE_SERVICE_ROLE_KEY
```

`api/` roda no Node.js na Vercel (serverless) — não vai para o bundle do cliente.
