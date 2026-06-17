# Supabase — Go-live Check

**Data:** 2026-06-17
**Sprint:** 15

---

## Configuração do cliente

| Item | Status |
|------|--------|
| `VITE_SUPABASE_URL` presente em `.env.local` | ✅ |
| `VITE_SUPABASE_ANON_KEY` presente em `.env.local` | ✅ |
| `SUPABASE_URL` (serverless api/) em `.env.local` | ⚠️ Ausente localmente — OK se não usar `vercel dev` localmente |
| `SUPABASE_SERVICE_ROLE_KEY` em `.env.local` | ⚠️ Ausente localmente — **obrigatório no Vercel dashboard** |
| Cliente criado em `src/lib/supabase.js` | ✅ |
| Admin client separado em `api/_supabaseAdmin.js` | ✅ |

---

## Tabelas operacionais carregadas

O hook `useOperationalData` carrega 21 tabelas com `OWNER_SCOPED_TABLES` (todas isoladas por `owner_user_id`):

| # | Tabela | Propósito |
|---|--------|-----------|
| 1 | `fazendas` | Cadastro de fazendas |
| 2 | `lotes` | Lotes e rebanho |
| 3 | `pastagens` | Pastagens (opcional) |
| 4 | `animais` | Animais individuais |
| 5 | `custos` | Custos operacionais |
| 6 | `pesagens` | Registros de pesagem |
| 7 | `sanitario` | Manejos sanitários |
| 8 | `tarefas` | Tarefas e rotinas |
| 9 | `estoque` | Estoque de insumos |
| 10 | `movimentacoes_animais` | Entradas/saídas de animais |
| 11 | `movimentacoes_financeiras` | Movimentações financeiras |
| 12 | `movimentacoes_estoque` | Movimentações de estoque |
| 13 | `funcionarios` | Equipe da fazenda |
| 14 | `rotinas` | Rotinas recorrentes |
| 15 | `alertas_resolvidos` | Alertas marcados como resolvidos |
| 16 | `alertas_adiados` | Alertas adiados (snooze) |
| 17 | `usuarios` | Perfis de usuários |
| 18 | `auditoria` | Log de auditoria |
| 19 | `consumo_suplementacao` | Histórico de suplementação |
| 20 | `configuracoes` | Configurações por fazenda |
| 21 | `cenarios` | Simulações salvas (opcional) |

Tabelas opcionais que podem não existir: `pastagens`, `cenarios` (tratadas via `OPTIONAL_STRATEGIC_TABLES`).

---

## Migration financeira

`supabase/migrations/20260616000000_financial_status_fields.sql` — aplicada:

```sql
ALTER TABLE movimentacoes_financeiras
  ADD COLUMN IF NOT EXISTS status TEXT
    CHECK (status IS NULL OR status IN ('previsto', 'realizado', 'pago', 'cancelado')),
  ADD COLUMN IF NOT EXISTS data_competencia DATE,
  ADD COLUMN IF NOT EXISTS data_vencimento DATE,
  ADD COLUMN IF NOT EXISTS data_pagamento DATE;
```

Compatibilidade retroativa: `status = NULL` tratado como `'realizado'` no código.

---

## RLS (Row Level Security)

- Todas as tabelas operacionais são owner-scoped — dados de um usuário **nunca** aparecem para outro
- `OWNER_SCOPED_TABLES` cobre as 21 tabelas (ver `useOperationalData.js`)
- Admin client (`SUPABASE_SERVICE_ROLE_KEY`) é usado apenas em funções serverless (`api/`) para operações bilaterais (Asaas webhook, criação de assinatura)
- **⚠️ Verificar manualmente no Supabase dashboard:** RLS ativo em todas as tabelas, especialmente `movimentacoes_financeiras`, `customer_subscriptions`, `billing_events`

---

## Tabelas de billing (Asaas)

Gerenciadas via `api/_asaas.js`:

| Tabela | Propósito |
|--------|-----------|
| `profiles` | Perfil do usuário com dados de billing |
| `checkout_sessions` | Sessões de checkout Asaas |
| `customer_subscriptions` | Status da assinatura por usuário |
| `billing_events` | Log de eventos do webhook Asaas |

---

## Resiliência de dados

- Snapshot local em localStorage (`herdon-operational-snapshot-*`) para offline/failover
- Circuit breaker após 4 falhas consecutivas de hydration (45s cooldown)
- Concurrency limit: 3 tabelas simultâneas
- Retry: 2 tentativas com backoff 350ms

---

## Checklist de validação manual (Supabase Dashboard)

- [ ] Acessar projeto no Supabase dashboard
- [ ] Confirmar que RLS está ativo em `movimentacoes_financeiras`
- [ ] Confirmar que RLS está ativo em `customer_subscriptions`
- [ ] Confirmar que migration financeira foi aplicada (colunas `status`, `data_vencimento`, etc.)
- [ ] Verificar policies: um usuário não acessa dados de outro
- [ ] Confirmar que `SUPABASE_SERVICE_ROLE_KEY` está configurada no Vercel dashboard
- [ ] Testar login de 2 usuários diferentes e verificar isolamento de dados

---

## Status geral

| Item | Status |
|------|--------|
| Cliente configurado | ✅ |
| 21 tabelas mapeadas | ✅ |
| Migration financeira aplicada | ✅ |
| OWNER_SCOPED_TABLES implementado | ✅ |
| RLS — verificação via dashboard | ⚠️ Pendente manual |
| `SUPABASE_SERVICE_ROLE_KEY` no Vercel | ⚠️ Pendente confirmação |
