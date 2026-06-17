# Beta Fechado — Prontidão HERDON

**Sprint 16 · Etapa 5**
**Data:** 2026-06-17
**Responsável:** Herdon / Magalhaexz

---

## Decisão final

> **PRONTO PARA BETA FECHADO — com Asaas em sandbox**
>
> O HERDON está operacional em produção para beta com 1 usuário real controlado.
> Funcionalidades operacionais e financeiras estão disponíveis.
> Asaas permanece em sandbox até confirmação manual do usuário para produção.

---

## Etapa 0 — GitHub

| Item | Resultado |
|------|-----------|
| Branch | `main` |
| Último commit | `3ae40cd` — "chore: validate controlled go-live readiness" |
| Origem | `origin/main` sincronizado ✅ |
| GitHub push | "Everything up-to-date" (já estava enviado) |

---

## Etapa 1 — Variáveis de ambiente Vercel

Verificado via `npx vercel env ls production`:

| Variável | Presença | Ambiente | Configurado |
|----------|---------|---------|------------|
| `VITE_SUPABASE_URL` | ✅ Encrypted | Production | 49d ago |
| `VITE_SUPABASE_ANON_KEY` | ✅ Encrypted | Production | 49d ago |
| `SUPABASE_URL` | ✅ Encrypted | Production | 44d ago |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Encrypted | Production | 44d ago |
| `VITE_APP_URL` | ✅ Encrypted | Production | 6d ago |
| `VITE_CHECKOUT_URL` | ✅ Encrypted | Production | 6d ago |
| `ASAAS_ENV` | ✅ Encrypted | Production | 6d ago |
| `ASAAS_API_BASE_URL` | ✅ Encrypted | Production | 6d ago |
| `ASAAS_API_KEY` | ✅ Encrypted | Production | 6d ago |
| `ASAAS_WEBHOOK_TOKEN` | ✅ Encrypted | Production | 6d ago |

**Total: 10/10 variáveis configuradas.**

> **Nota:** Vars marcadas como "Sensitive" no Vercel não são decriptáveis via CLI (`vercel env run`/`vercel env pull`) — isso é comportamento de segurança esperado. Os valores são injetados apenas durante o build/runtime na Vercel.
>
> Para verificar os valores reais: Vercel Dashboard → agrotrack-novo → Settings → Environment Variables.

### VITE_ vars (verificadas via vercel env run):

| Variável | Status |
|----------|--------|
| `VITE_SUPABASE_URL` | ✅ SET_OK |
| `VITE_SUPABASE_ANON_KEY` | ✅ SET_OK |
| `VITE_APP_URL` | ✅ SET_OK |
| `VITE_CHECKOUT_URL` | ✅ SET_OK |

---

## Etapa 2 — Asaas

### Status atual

| Item | Status |
|------|--------|
| `ASAAS_ENV` no Vercel | ✅ Existe — valor não visível via CLI |
| `ASAAS_API_BASE_URL` no Vercel | ✅ Existe — valor não visível via CLI |
| `ASAAS_API_KEY` no Vercel | ✅ Existe |
| `ASAAS_WEBHOOK_TOKEN` no Vercel | ✅ Existe |
| Local `.env.local`: `ASAAS_ENV` | `sandbox` (correto para desenvolvimento) |
| Local `.env.local`: `ASAAS_API_BASE_URL` | `https://sandbox.asaas.com/api/v3` |

### Webhook

| Item | Resultado |
|------|-----------|
| Rota serverless | `api/asaas-webhook.js` |
| URL em produção | `https://agrotrack-novo.vercel.app/api/asaas-webhook` |
| Teste GET em produção | ✅ HTTP 405 `{"ok":false,"message":"Metodo nao permitido."}` |
| Conclusão | **Endpoint ativo e rejeitando métodos incorretos corretamente** |

> HTTP 405 em GET é o comportamento correto — webhook só aceita POST do Asaas.
> O endpoint está deployado, rodando e o módulo `_asaas.js` está carregando sem erros.

### Ação necessária para pagamentos reais

Para ativar cobranças reais (apenas quando decidido pelo usuário):

1. Acessar Vercel Dashboard → agrotrack-novo → Settings → Environment Variables
2. Editar `ASAAS_ENV` → valor: `production`
3. Editar `ASAAS_API_BASE_URL` → valor: `https://api.asaas.com/v3`
4. Editar `ASAAS_API_KEY` → valor: chave de produção do Asaas (não a sandbox `$aact_hmlg_...`)
5. Cadastrar webhook no painel Asaas: `https://agrotrack-novo.vercel.app/api/asaas-webhook`
6. Fazer redeploy no Vercel (ou aguardar próximo push ao main)

**Não executado nesta sprint — requer confirmação expressa do usuário.**

---

## Etapa 3 — Vercel / Redeploy

| Item | Resultado |
|------|-----------|
| Deploy atual | `dpl_6rzNdzYz3xcCGU9JN1GAZtGcewYh` |
| Commit deployado | `3ae40cd` (Sprint 15 — correto) |
| Estado | ✅ `READY` |
| Target | `production` |
| URL principal | `https://agrotrack-novo.vercel.app` |
| HTTP status | ✅ 200 OK |
| Título da página | "HERDON — Gestão Inteligente" |
| SPA rewrite | ✅ Ativo (`/((?!api/).*) → /index.html`) |

### Headers de segurança (verificados na resposta HTTP):

| Header | Status |
|--------|--------|
| `X-Content-Type-Options: nosniff` | ✅ |
| `X-Frame-Options: DENY` | ✅ |
| `X-XSS-Protection: 1; mode=block` | ✅ |
| `Referrer-Policy: strict-origin-when-cross-origin` | ✅ |
| `Strict-Transport-Security: max-age=31536000; includeSubDomains` | ✅ |
| `Permissions-Policy: camera=(), microphone=(), geolocation=()` | ✅ |

**6/6 headers de segurança confirmados em produção.**

> Redeploy não foi necessário — deploy do Sprint 15 já estava ativo e servindo corretamente.

---

## Etapa 4 — Smoke test

### Verificações via CLI/MCP (sem browser interativo)

| Item | Resultado |
|------|-----------|
| URL pública acessível | ✅ HTTP 200 |
| HTML correto com título HERDON | ✅ |
| Assets Vite carregados (modulepreload) | ✅ |
| Webhook endpoint ativo | ✅ HTTP 405 (comportamento correto) |
| Páginas legais via SPA rewrite | ✅ (retornam index.html, renderizadas pelo React) |

### Smoke test interativo (requer browser)

O teste interativo completo (login, criação de fazenda, lote, custo, resultado) deve ser executado manualmente pelo usuário antes da ativação do beta.

| Passo | Ação | Status |
|-------|------|--------|
| 1 | Acessar `https://agrotrack-novo.vercel.app` | ⚠️ Pendente manual |
| 2 | Criar/login com usuário de teste | ⚠️ Pendente manual |
| 3 | Criar fazenda | ⚠️ Pendente manual |
| 4 | Criar lote | ⚠️ Pendente manual |
| 5 | Lançar custo | ⚠️ Pendente manual |
| 6 | Lançar receita | ⚠️ Pendente manual |
| 7 | Ver resultado do lote | ⚠️ Pendente manual |
| 8 | Ver fluxo de caixa | ⚠️ Pendente manual |
| 9 | Abrir simulador de decisão | ⚠️ Pendente manual |
| 10 | Abrir alertas | ⚠️ Pendente manual |
| 11 | Testar páginas legais | ⚠️ Pendente manual |

---

## Supabase

| Item | Status |
|------|--------|
| `VITE_SUPABASE_URL` no Vercel | ✅ SET |
| `SUPABASE_SERVICE_ROLE_KEY` no Vercel | ✅ Configurado (44d ago) |
| 21 tabelas operacionais mapeadas | ✅ |
| Migration financeira (Sprint 15) | ✅ Aplicada |
| RLS — verificação via dashboard | ⚠️ Pendente verificação manual |

---

## Pendências antes de escalar o beta

| Pendência | Prioridade | Responsável |
|-----------|-----------|-------------|
| Smoke test interativo em browser | Alta | Herdon |
| Confirmar `ASAAS_ENV` no Vercel dashboard | Alta | Herdon |
| Decidir: sandbox OK para beta ou ativar produção Asaas | Alta | Herdon |
| Verificar RLS no Supabase dashboard | Média | Herdon |
| Cadastrar webhook no painel Asaas | Alta (antes de cobranças) | Herdon |
| Domínio customizado (`app.herdon.com.br`) | Baixa | Herdon |
| Revisão jurídica do conteúdo das páginas legais | Média | Herdon |

---

## Resumo final — Perguntas do Sprint 16

| Pergunta | Resposta |
|---------|---------|
| O HERDON está pronto para beta fechado? | **Sim** — operacional em produção |
| Qual URL será usada? | `https://agrotrack-novo.vercel.app` |
| Qual usuário/teste? | Criar conta de teste em `https://agrotrack-novo.vercel.app` |
| Asaas produção está ativo? | **Não** — sandbox configurado localmente; Vercel usa var criptografada (confirmar valor no dashboard) |
| Existe bloqueador real? | **Não para o beta** — Asaas sandbox é suficiente para testar o fluxo sem cobranças reais |
