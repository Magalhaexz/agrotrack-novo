# Asaas — Prontidão para Produção

**Atualizado:** 2026-06-17 (Sprint 15)
**Histórico:** criado Sprint 5, atualizado Sprint 15 com revisão completa do código

---

## Status atual

| Item | Valor |
|------|-------|
| Ambiente em `.env.local` | `ASAAS_ENV=sandbox` |
| Ambiente de go-live | ⚠️ Trocar para `production` APENAS após validação sandbox completa |

---

## Variáveis de ambiente necessárias

| Variável | Onde | Obrigatória | Status |
|----------|------|-------------|--------|
| `ASAAS_API_BASE_URL` | Vercel (server) | Sim | ⚠️ Verificar dashboard |
| `ASAAS_API_KEY` | Vercel (server) | Sim | ⚠️ Verificar dashboard |
| `ASAAS_WEBHOOK_TOKEN` | Vercel (server) | Sim | ⚠️ Verificar dashboard |
| `ASAAS_ENV` | Vercel (server) | Sim | ⚠️ Verificar (sandbox ou production) |

> **Nunca** expor `ASAAS_API_KEY` como variável `VITE_*` — sempre server-only.

---

## Endpoints serverless implementados

| Arquivo | Rota Vercel | Função |
|---------|-------------|--------|
| `api/asaas-create-customer.js` | `POST /api/asaas-create-customer` | Cria cliente no Asaas |
| `api/asaas-create-subscription.js` | `POST /api/asaas-create-subscription` | Cria assinatura (payment link) |
| `api/asaas-webhook.js` | `POST /api/asaas-webhook` | Recebe eventos do Asaas |

---

## Fluxo de assinatura implementado

```
Usuário clica "Assinar" no plano
  ↓
POST /api/asaas-create-customer
  → Cria ou reutiliza cliente no Asaas com nome, email, CPF, telefone
  ↓
POST /api/asaas-create-subscription
  → Verifica sessão de checkout recente (últimos 30 min)
  → Se não existe: cria payment link recorrente (RECURRENT / MONTHLY)
  → Salva checkout_session no Supabase
  → Salva customer_subscription no Supabase
  → Retorna checkoutUrl para o usuário
  ↓
Usuário completa pagamento no Asaas
  ↓
Asaas envia evento para /api/asaas-webhook
  → Valida token do webhook (ASAAS_WEBHOOK_TOKEN)
  → Mapeia evento para status: active | past_due | canceled | blocked | trialing
  → Atualiza customer_subscriptions no Supabase
  → Registra billing_event para auditoria
```

---

## Segurança do webhook

- Token validado via header `asaas-access-token` (ou aliases)
- Sem token válido → retorna 401
- Idempotente: `upsert` em `billing_events` com `onConflict: 'provider_event_id'`
- Eventos desconhecidos são armazenados mas não atualizam assinatura

---

## Mapeamento de status

| Evento Asaas | Status interno |
|-------------|---------------|
| received / confirmed / paid / settled | `active` |
| overdue / failed / refused / delinquent / pending | `past_due` |
| refund / cancel / deleted | `canceled` |
| chargeback / dispute / fraud | `blocked` |
| trial | `trialing` |
| desconhecido | `ignored` (não atualiza) |

---

## Riscos antes de ir para produção

| Risco | Severidade | Mitigação |
|-------|-----------|-----------|
| `ASAAS_ENV=sandbox` ativo em produção | **Bloqueador** | Trocar para `production` no Vercel dashboard antes do go-live |
| `ASAAS_API_KEY` de sandbox em produção | **Bloqueador** | Usar API Key do ambiente produção do Asaas |
| `ASAAS_WEBHOOK_TOKEN` não configurado no Vercel | **Bloqueador** | Webhook irá retornar 401 para todo evento |
| Dados de billing não persistindo (service_role ausente) | **Bloqueador** | Configurar `SUPABASE_SERVICE_ROLE_KEY` no Vercel |
| CPF/CNPJ do usuário ausente no perfil | Alto | Usuário vê mensagem pedindo dados antes do checkout |
| `billingType` não especificado → Asaas usa `UNDEFINED` | Médio | Asaas aceita e deixa usuário escolher método |

---

## Checklist antes de produção

- [ ] Confirmar que `ASAAS_ENV=production` está no Vercel dashboard
- [ ] Confirmar que `ASAAS_API_KEY` é a chave de produção (não sandbox)
- [ ] Confirmar que webhook URL está cadastrada no painel Asaas: `https://agrotrack-novo.vercel.app/api/asaas-webhook`
- [ ] Confirmar que `ASAAS_WEBHOOK_TOKEN` no Asaas painel bate com a variável no Vercel
- [ ] Testar criação de assinatura no sandbox antes de migrar para produção
- [ ] Testar webhook simulado no Asaas sandbox
- [ ] Confirmar que plano "enterprise" retorna mensagem de atendimento manual (não gera checkout)

---

## Status geral

| Item | Status |
|------|--------|
| Endpoints implementados | ✅ |
| Webhook com validação de token | ✅ |
| Billing events idempotentes | ✅ |
| Mapeamento de status completo | ✅ |
| Ambiente sandbox em `.env.local` | ✅ correto para dev |
| Ambiente produção no Vercel | ⚠️ Verificar e configurar antes do go-live |
| Não criar cobrança real sem confirmação | ✅ respeitado nesta sprint |
