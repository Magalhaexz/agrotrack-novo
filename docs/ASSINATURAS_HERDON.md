# Estados da Assinatura (Sprint 28)

## Status real no banco (constraint, não pode ser outro valor)

`customer_subscriptions_status_check` em `docs/supabase-production-schema.sql`:

```sql
status in ('trialing', 'active', 'past_due', 'canceled', 'blocked', 'internal_test')
```

Esses 6 valores são os únicos aceitos pelo banco. A Sprint 28 pedia também `expired` e `founder` como estados — **não foram adicionados ao banco** porque:

- `founder` não é um status de assinatura, é um **`plan_code`** (`fundador`) — dimensão diferente. Uma assinatura pode estar `active` com `plan_code = 'fundador'`.
- `expired` não tem uso real hoje: o app já distingue "vencida mas ainda tentando cobrar" (`past_due`) de "cancelada" (`canceled`). Adicionar um sétimo status exigiria migração de banco e ajuste de todo o código que já lista os 6 valores — risco desnecessário para esta sprint, que pede para não tocar em banco sem necessidade.

## Mapeamento completo

| Status pedido na Sprint 28 | Status real usado pelo HERDON | Observação |
|---|---|---|
| `active` | `active` | Igual |
| `trial` | `trialing` | Nome já existente, só com "ing" no final |
| `past_due` | `past_due` | Igual |
| `cancelled` | `canceled` | Grafia americana (1 "L"), já era assim no banco — mantido |
| `expired` | *(não existe separado)* | Tratado como `past_due` prolongado ou `canceled`, conforme o caso |
| `internal_test` | `internal_test` | Igual |
| `founder` | *(é um `plan_code`, não um status)* | `plan_code: 'fundador'`, qualquer status |
| `none` | *(ausência de registro em `customer_subscriptions`)* | `subscription === null` — não é um valor de status, é a ausência de assinatura |

## O que o app sabe responder (já implementado, confirmado nesta sprint)

`src/services/subscriptions.js`, função `buildSubscriptionAccessState(subscription)`:

| Pergunta | Função/campo |
|---|---|
| Pode acessar o app? | `canEnterApp` — true para `active`, `trialing`, `past_due`, `internal_test`, ou quando não há assinatura (permissivo por padrão) |
| Pode criar novos dados? | `evaluateLimit()`/`canCreateFarm()`/`canCreateAnimal()`/`canInviteUser()` — depende do plano e do uso atual, não do status (exceto `canceled`/`blocked`, que bloqueiam tudo) |
| Precisa escolher plano? | Quando não há assinatura (`subscription === null`) — mensagem "Escolha um plano para continuar usando o HERDON." (atualizada nesta sprint) |
| Está em beta/piloto? | `status === 'internal_test'` — mensagem "Você está usando o HERDON em acesso piloto. A cobrança ainda não está ativa." (atualizada nesta sprint) |
| Está vencido? | `status === 'past_due'` — `warning: true`, mas `canEnterApp: true` (não bloqueia, só avisa) |
| Está cancelado? | `status === 'canceled'` ou `'blocked'` — `blocked: true`, app mostra `AssinaturaBloqueadaPage` (já existente) |
| Está em teste interno? | `status === 'internal_test'` — nunca bloqueado (está no mesmo conjunto de status "pode acessar" que `active`) |

## Proteção do beta/internal_test (Etapa 1 e Etapa 7 da sprint)

Confirmado por leitura de código que **nenhuma conta `internal_test` pode ser bloqueada** pelo fluxo normal:

```js
const ACTIVE_STATUSES = new Set(['active', 'trialing', 'internal_test']);
const ENTERABLE_STATUSES = new Set(['active', 'trialing', 'past_due', 'internal_test']);
const BLOCKED_STATUSES = new Set(['canceled', 'blocked']);
```

`internal_test` está nos dois conjuntos "permitido" e em nenhum "bloqueado". A função `buildSubscriptionAccessState` só marca `blocked: true` quando o status está em `BLOCKED_STATUSES` — `internal_test` nunca cai nesse caminho. Também existe um campo de escape adicional (`override`/`internal_override`/`is_internal_override`) que, se `true`, ignora qualquer limite ou bloqueio de módulo independente do status.

Testado em `tests/subscriptions.test.js` (existente) e reforçado em `tests/planos.test.js` (novo, Sprint 28): contas sem plano reconhecido ou com `internal_test` nunca são bloqueadas.

## Separação beta / sandbox / produção

| Conceito | O que significa no HERDON | Onde fica |
|---|---|---|
| **Beta/piloto** | Conta com `status: 'internal_test'` no banco — acesso completo, sem cobrança, dado manualmente pelo admin via SQL | `customer_subscriptions.status` |
| **Sandbox** | Ambiente do Asaas usado para testar checkout/webhook sem mover dinheiro real | `ASAAS_ENV=sandbox` (padrão) |
| **Produção** | Ambiente real do Asaas, cobrança de verdade | `ASAAS_ENV=production` — **não configurado em nenhum lugar hoje** |

Esses três conceitos são independentes: uma conta beta (`internal_test`) nunca passa pelo Asaas (não há checkout para quem já tem acesso liberado manualmente); o ambiente sandbox/produção do Asaas só importa para contas que de fato tentam pagar (`active`, `trialing`, `past_due` vindas de um checkout real).

## Upgrade e downgrade (Etapa 8)

- **Upgrade**: o usuário escolhe um plano superior em "Planos e Assinatura" → abre checkout Asaas normalmente (mesmo fluxo de qualquer assinatura nova). Não há lógica especial de "proporcionalidade"/crédito — fica documentado como pendência futura.
- **Downgrade**: **não automatizado nesta sprint**, por decisão explícita do escopo ("downgrade pode ser apenas solicitação ou documentação"). Hoje, um downgrade precisa ser solicitado por e-mail (`herdonapp@gmail.com`, ver `docs/SUPORTE_FEEDBACK_HERDON.md`) e ajustado manualmente pelo admin no banco (`UPDATE customer_subscriptions SET plan_code = ...`). Se o uso atual da conta exceder o limite do plano novo, os limites passam a valer a partir daí (sem apagar dados existentes, mas bloqueando criação de novos registros até a conta se ajustar ou voltar a um plano maior).
- **Cancelamento**: documentado em `docs/SUPORTE_FEEDBACK_HERDON.md` (Sprint 26) — também não automatizado.

## Pendências futuras

- Upgrade/downgrade automático com cálculo de proporcionalidade.
- Status `expired` dedicado, se o negócio precisar distinguir de `past_due`/`canceled`.
- Portal do cliente Asaas (autoatendimento para forma de pagamento, histórico de faturas).
- Cobrança anual.
