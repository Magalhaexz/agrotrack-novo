# ASAAS_PRODUCAO_READINESS

Sprint 5 — Etapa 4  
Data: 2026-06-15  
Status: SANDBOX — NÃO pronto para produção real sem ação do operador

---

## Aviso crítico

> Nenhuma cobrança real foi criada nesta análise. Este documento é puramente documental.
> A integração está operacional em sandbox. Para produção, é necessário configurar as variáveis
> de ambiente listadas na seção "Ações necessárias antes de ir a produção".

---

## Arquitetura da integração

### Serverless functions (Vercel)

| Arquivo | Rota | Handler | Método |
|---------|------|---------|--------|
| `api/asaas-create-subscription.js` | `POST /api/asaas-create-subscription` | `handleCreateSubscriptionRequest` | POST |
| `api/asaas-create-customer.js` | `POST /api/asaas-create-customer` | `handleCreateCustomerRequest` | POST |
| `api/asaas-webhook.js` | `POST /api/asaas-webhook` | `handleWebhookRequest` | POST |
| `api/_asaas.js` | Helper interno | — | — |
| `api/_supabaseAdmin.js` | Helper interno | — | — |

### Tabelas Supabase consumidas

| Tabela | Operação | Propósito |
|--------|----------|-----------|
| `customer_subscriptions` | SELECT, UPSERT, UPDATE | Estado da assinatura do usuário |
| `checkout_sessions` | SELECT, UPSERT | Sessão de checkout (evita duplicatas em 30min) |
| `billing_events` | UPSERT | Histórico de eventos de pagamento Asaas |
| `profiles` | SELECT | Dados do usuário para cadastro no Asaas |

---

## Fluxo completo de assinatura

```
Frontend → POST /api/asaas-create-subscription
  ↓ Valida sessão JWT (auth.uid via SUPABASE_SERVICE_ROLE_KEY)
  ↓ Valida planCode (fundador, essencial, pro, premium)
  ↓ Verifica checkout_session recente (< 30 min) → retorna URL existente se sim
  ↓ POST /customers no Asaas → cria cliente com nome+email+CPF+telefone
  ↓ POST /paymentLinks no Asaas → chargeType=RECURRENT, subscriptionCycle=MONTHLY
  ↓ Salva customer_subscriptions + checkout_sessions + billing_events no Supabase
  ↓ Retorna { checkoutUrl, paymentUrl, ... }
```

```
Asaas → POST /api/asaas-webhook
  ↓ Valida ASAAS_WEBHOOK_TOKEN no header
  ↓ Mapeia evento → status interno (active, past_due, canceled, blocked, trialing)
  ↓ Upsert billing_events (idempotente via provider_event_id)
  ↓ Atualiza customer_subscriptions.status
```

---

## Estado atual das variáveis de ambiente

| Variável | Sandbox | Produção | Observação |
|----------|---------|----------|------------|
| `ASAAS_API_BASE_URL` | `https://sandbox.asaas.com/api/v3` (default se ausente) | `https://api.asaas.com/v3` | **Deve ser configurada explicitamente em prod** |
| `ASAAS_API_KEY` | Chave sandbox (`$aas_test_...`) | Chave produção (`$aas_prod_...`) | **Nunca usar chave de teste em prod** |
| `ASAAS_WEBHOOK_TOKEN` | Qualquer valor ou ausente | Token configurado no painel Asaas | **Obrigatório em prod — ausente = webhook rejeitado** |
| `ASAAS_ENV` | `sandbox` (default se ausente) | `production` | Informativo — não muda comportamento do código diretamente |

**Risco crítico:** Se `ASAAS_API_BASE_URL` não for configurada em produção, o código usa o fallback `https://sandbox.asaas.com/api/v3`. Isso significa que cobranças em "produção" iriam para sandbox silenciosamente — o usuário pagaria mas o HERDON não receberia.

---

## Verificações de segurança (resultado)

| Check | Status | Detalhes |
|-------|--------|----------|
| API Key server-only | PASS | Sem prefixo `VITE_` — não exposta no bundle frontend |
| Webhook token validado | PASS | `validateWebhookToken()` verifica múltiplos headers candidatos |
| Webhook sem token configurado = rejeição | PASS | `if (!token) return false` — rejeita todos se variável ausente |
| Autenticação obrigatória em create-subscription | PASS | Verifica `auth.uid()` via `resolveAuthenticatedUser` |
| Autenticação obrigatória em create-customer | PASS | Mesma verificação |
| Webhook não requer autenticação JWT (correto) | PASS | Usa token próprio do Asaas |
| Dados de cartão não armazenados | PASS | Integração via payment link — dados de cartão vão direto para Asaas |
| Idempotência em billing_events | PASS | UPSERT com `onConflict: 'provider_event_id'` |
| Idempotência em checkout (30 min) | PASS | `findRecentCheckoutSession` evita criar checkout duplicado |
| CPF/CNPJ não armazenado no HERDON | PASS | Enviado ao Asaas na criação do cliente, não persiste localmente |

---

## Mapeamento de eventos Asaas → status interno

| Palavras-chave no evento | Status resultante | Ação |
|--------------------------|-------------------|------|
| `received`, `confirmed`, `paid`, `settled` | `active` | Atualiza subscription |
| `overdue`, `failed`, `refused`, `unpaid`, `pending` | `past_due` | Atualiza subscription |
| `cancel`, `refund`, `deleted` | `canceled` | Atualiza subscription |
| `chargeback`, `dispute`, `fraud` | `blocked` | Bloqueia acesso |
| `trial` | `trialing` | Atualiza subscription |
| Outros | `null` (ignorado) | Armazena evento, não atualiza |

---

## Planos configurados no código

Fonte: `src/services/subscriptions.js` via `getPlanLimits(planCode)`

| planCode | planName | Valor (inferido do CobrancaPage) |
|----------|----------|----------------------------------|
| `fundador` | Fundador | R$ 297/mês |
| `essencial` | Essencial | R$ 197/mês |
| `pro` | Pro | R$ 397/mês |
| `premium` | Premium | R$ 697/mês |
| `enterprise` | Enterprise | Manual (sem checkout automático) |

---

## Ações necessárias antes de ir a produção

### No painel Asaas

- [ ] Criar conta de produção (se ainda em sandbox)
- [ ] Gerar API Key de produção (prefixo `$aas_prod_`)
- [ ] Criar webhook em produção apontando para `https://<app-url>/api/asaas-webhook`
- [ ] Anotar o token do webhook configurado (será usado em `ASAAS_WEBHOOK_TOKEN`)
- [ ] Verificar que os planos com os valores corretos estão configurados
- [ ] Testar um pagamento real de baixo valor antes de liberar para todos os usuários

### No Vercel (variáveis de ambiente — Production)

- [ ] `ASAAS_API_BASE_URL` = `https://api.asaas.com/v3`
- [ ] `ASAAS_API_KEY` = chave de produção (obtida no painel Asaas)
- [ ] `ASAAS_WEBHOOK_TOKEN` = token configurado no webhook do painel Asaas
- [ ] `ASAAS_ENV` = `production`
- [ ] Verificar que as 4 variáveis estão no scope "Production" (não apenas "Preview")

### Validação pós-configuração

1. Chamar `GET /api/asaas-create-subscription` (deve retornar 405 — valida que a função está viva)
2. Verificar logs do Vercel: a função não deve logar `[asaas-create-subscription]` com `ASAAS_ENV_MISSING`
3. Criar uma assinatura de teste com um usuário real e verificar que o checkout URL é gerado
4. Confirmar que o webhook Asaas chega e é processado (verificar `billing_events` no Supabase)

---

## Riscos documentados

| Risco | Severidade | Mitigação |
|-------|------------|-----------|
| `ASAAS_API_BASE_URL` ausente em prod → sandbox silencioso | CRÍTICO | Configurar explicitamente + verificar logs após deploy |
| `ASAAS_WEBHOOK_TOKEN` ausente → todos webhooks rejeitados | ALTO | Configurar token idêntico no painel Asaas e no Vercel |
| Customer criado sem CPF → Asaas pode rejeitar em prod | MÉDIO | Garantir que o campo CPF/CNPJ está no perfil do usuário antes do checkout |
| Nenhum plano em USD/outro moeda — apenas BRL | BAIXO | Escopo BR-only, OK por ora |
| `billing_events` cresce sem TTL | BAIXO | Adicionar política de retenção futuramente |

---

## Status atual: SANDBOX

A integração está funcional em ambiente sandbox. Cobranças reais exigem as ações listadas acima.
Nenhuma cobrança real foi criada nesta sprint.
