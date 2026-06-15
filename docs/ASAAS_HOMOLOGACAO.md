# Asaas — Homologação Sandbox

> Sprint 4 · Etapa 4 · Gerado em 2026-06-15  
> Status atual: integração em **sandbox**. Produção requer troca de chaves e URL.

---

## Resumo executivo

| Ponto | Status |
|-------|--------|
| Integração Asaas implementada | ✅ Sim — `api/_asaas.js` (1375 linhas) |
| Endpoints serverless existem | ✅ 3 rotas: create-customer, create-subscription, webhook |
| Sandbox configurado como padrão | ✅ Fallback: `https://sandbox.asaas.com/api/v3` |
| Fluxo completo implementado | ✅ customer → subscription (payment link) → webhook → DB |
| Teste real de sandbox | ⚠️ Não executável sem credenciais — documentado estruturalmente |
| Troca para produção | 🔴 Pendente — requer troca de vars e configuração de webhook |

---

## Arquitetura da integração

### Serverless functions (`api/`)

| Arquivo | Rota | Método | Função |
|---------|------|--------|--------|
| `api/asaas-create-customer.js` | `/api/asaas-create-customer` | POST | Cria cliente no Asaas |
| `api/asaas-create-subscription.js` | `/api/asaas-create-subscription` | POST | Cria assinatura (payment link) |
| `api/asaas-webhook.js` | `/api/asaas-webhook` | POST | Recebe eventos do Asaas |
| `api/_asaas.js` | — | — | Biblioteca compartilhada |
| `api/_supabaseAdmin.js` | — | — | Admin client (service_role) |

### Fluxo de assinatura

```
1. Frontend → POST /api/asaas-create-customer
   └─ Asaas API /customers → retorna customerId

2. Frontend → POST /api/asaas-create-subscription
   └─ Asaas API /paymentLinks (chargeType: RECURRENT)
   └─ Retorna checkoutUrl para o usuário pagar
   └─ Grava customer_subscriptions + checkout_sessions no Supabase

3. Asaas → POST /api/asaas-webhook
   └─ Valida ASAAS_WEBHOOK_TOKEN
   └─ Processa evento (PAYMENT_CONFIRMED, PAYMENT_OVERDUE, etc.)
   └─ Atualiza customer_subscriptions.status no Supabase
   └─ Grava billing_events para auditoria
```

### Método de cobrança escolhido

O código usa `/paymentLinks` com `chargeType: RECURRENT` (não `/subscriptions` direto).

Isso gera um link de pagamento recorrente onde o cliente paga pela primeira vez e as cobranças subsequentes são automáticas. **Vantagem:** compatível com sandbox sem pré-aprovação.

---

## Variáveis de ambiente

| Variável | Sandbox | Produção |
|----------|---------|----------|
| `ASAAS_API_BASE_URL` | `https://sandbox.asaas.com/api/v3` | `https://api.asaas.com/v3` |
| `ASAAS_API_KEY` | Chave sandbox (prefixo `$aact_`) | Chave produção |
| `ASAAS_WEBHOOK_TOKEN` | Token configurado no sandbox | Token de produção |
| `ASAAS_ENV` | `sandbox` | `production` |

**Fallback de URL:** se `ASAAS_API_BASE_URL` não estiver definida, o código usa `https://sandbox.asaas.com/api/v3` automaticamente — nunca cai em produção por acidente.

---

## Planos mapeados

Do `src/services/subscriptions.js`:

| planCode | planName | Preço | Status |
|----------|----------|-------|--------|
| `fundador` | Fundador | R$297/mês | Ativo |
| `essencial` | Essencial | R$197/mês | Ativo |
| `pro` | Pro | R$397/mês | Ativo |
| `premium` | Premium | R$697/mês | Ativo |
| `enterprise` | Enterprise | — | Ativo |

⚠️ Os IDs de plano no Asaas de **produção** ainda não foram criados. Criar os planos no painel Asaas e garantir que o mapeamento em `subscriptions.js` está correto é obrigatório antes do go-live.

---

## Checklist sandbox → produção

```
[ ] 1. Trocar ASAAS_API_BASE_URL → https://api.asaas.com/v3
[ ] 2. Gerar chave API de produção no painel Asaas
[ ] 3. Configurar ASAAS_API_KEY com chave de produção
[ ] 4. Criar webhook no painel Asaas apontando para:
         https://agrotrack-novo.vercel.app/api/asaas-webhook
[ ] 5. Definir ASAAS_WEBHOOK_TOKEN e registrar o mesmo no painel
[ ] 6. Trocar ASAAS_ENV → production
[ ] 7. Criar planos recorrentes no Asaas de produção (fundador, essencial, pro, premium)
[ ] 8. Testar fluxo completo: criação de cliente → link → webhook
```

---

## Teste estrutural (sandbox) — o que foi validado

| Componente | Verificação | Resultado |
|-----------|------------|---------|
| `getRuntimeEnv()` | Lê vars sem expor ao cliente | ✅ Usa `process.env` — server-side only |
| Fallback de URL | Se `ASAAS_API_BASE_URL` ausente | ✅ Cai para sandbox — não expõe produção |
| `validateWebhookToken()` | Compara header com `ASAAS_WEBHOOK_TOKEN` | ✅ Implementado — rejeita sem token |
| Auth em `/asaas-create-customer` | Verifica sessão Supabase antes da chamada | ✅ `resolveAuthenticatedUser` chamado |
| Auth em `/asaas-create-subscription` | Idem | ✅ Confirmado |
| Escrita em `customer_subscriptions` | Usa service_role (bypass RLS) | ✅ Via `_supabaseAdmin.js` |
| Escrita em `billing_events` | Auditoria de cada evento Asaas | ✅ `buildBillingEventRow` implementado |
| Erro sem env configurada | Retorna 500 (não 200 vazio) | ✅ `env.configured` verificado antes de cada chamada |

---

## Eventos de webhook mapeados

`mapAsaasEventToSubscriptionStatus()` em `api/_asaas.js`:

| Evento Asaas | Status mapeado | Ação |
|-------------|---------------|------|
| `PAYMENT_CONFIRMED` | `active` | Ativa assinatura |
| `PAYMENT_RECEIVED` | `active` | Ativa assinatura |
| `PAYMENT_OVERDUE` | `past_due` | Marca como vencida |
| `PAYMENT_DELETED` | `canceled` | Cancela |
| `SUBSCRIPTION_DELETED` | `canceled` | Cancela |
| `PAYMENT_REFUNDED` | `canceled` | Cancela por reembolso |

---

## Pendências antes de go-live

| Item | Prioridade |
|------|-----------|
| Criar conta Asaas de produção e chaves | 🔴 P1 |
| Configurar webhook de produção | 🔴 P1 |
| Testar fluxo completo em sandbox com cartão de teste | 🟡 P2 |
| Verificar `priceCents` nos planos (subscriptions.js) | 🟡 P2 |
| Configurar `VITE_CHECKOUT_URL` para URL de produção | 🟡 P2 |
