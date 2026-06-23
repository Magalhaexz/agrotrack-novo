# Auditoria Asaas (Sprint 28)

## Resumo

A integração com o Asaas **já existe, é real (commitada em `main` há várias sprints) e está bem mais madura do que o diagnóstico inicial da sprint sugeria**. Esta sprint foi de auditoria — confirmar que está segura e documentar — sem alterar o fluxo de cobrança.

## Arquivos envolvidos

| Arquivo | Papel |
|---|---|
| `api/_asaas.js` | Lógica compartilhada: chamadas à API Asaas, mapeamento de eventos de webhook para status de assinatura, persistência em `customer_subscriptions`/`checkout_sessions`/`billing_events` |
| `api/asaas-create-customer.js` | Endpoint serverless: cria/confirma o cliente no Asaas |
| `api/asaas-create-subscription.js` | Endpoint serverless: cria o link de pagamento recorrente (checkout) |
| `api/asaas-webhook.js` | Endpoint serverless: recebe eventos do Asaas e atualiza a assinatura |
| `src/services/asaasBilling.js` | Código client-side: chama os endpoints acima a partir do navegador, com mensagens de erro amigáveis |

## Ambiente: sandbox por padrão, produção exige variável explícita

Em `api/_asaas.js`, função `getRuntimeEnv()`:

```js
const baseUrl = process.env.ASAAS_API_BASE_URL || process.env.ASAAS_BASE_URL || 'https://sandbox.asaas.com/api/v3';
const environment = process.env.ASAAS_ENV || 'sandbox';
```

**Confirmado:** não há URL de produção do Asaas hardcoded em nenhum lugar do código. O ambiente é sempre lido de variável de ambiente, com **sandbox como padrão** caso a variável não esteja definida. Para apontar para produção, seria necessário definir manualmente `ASAAS_ENV=production` e `ASAAS_API_BASE_URL=https://api.asaas.com/v3` no ambiente do servidor (Vercel) — **nada disso foi alterado nesta sprint**, e `.env.example` continua documentando `ASAAS_ENV=sandbox` como o valor de referência.

## Variáveis de ambiente (servidor, nunca expostas ao frontend)

| Variável | Uso |
|---|---|
| `ASAAS_ENV` | `sandbox` (padrão) ou `production` |
| `ASAAS_API_BASE_URL` (ou alias `ASAAS_BASE_URL`) | Host da API Asaas |
| `ASAAS_API_KEY` | Chave de acesso à API Asaas — **só lida em `api/`, nunca em código com prefixo `VITE_`** |
| `ASAAS_WEBHOOK_TOKEN` | Token para validar que o webhook recebido é legítimo (`validateWebhookToken()`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role do Supabase — **só usada em `api/_supabaseAdmin.js`, server-side, nunca em `VITE_*`** |

Confirmado em `.env.example`: a separação entre variáveis `VITE_*` (vão para o bundle do navegador, devem ser só dados públicos) e variáveis de servidor (nunca prefixadas com `VITE_`) já está documentada e respeitada no código atual.

## Checkout: como funciona hoje

1. Usuário escolhe um plano em "Planos e Assinatura" → `requestAsaasSandboxCheckout()` (`src/services/asaasBilling.js`) chama `POST /api/asaas-create-subscription` com o token de sessão do Supabase.
2. O endpoint valida a sessão, confirma os dados do cliente (nome, e-mail, CPF/CNPJ, telefone — pede o que faltar antes de continuar), cria o cliente no Asaas se necessário, e cria um **link de pagamento recorrente** (`billingType: 'UNDEFINED'`, ou seja, o Asaas mostra todos os meios de pagamento ativos na conta — Pix, Boleto, Cartão — conforme configurado no painel Asaas).
3. A resposta inclui a URL de checkout hospedada pelo Asaas; o frontend abre essa URL para o usuário pagar.
4. Sessões de checkout recentes (últimos 30 min) são reaproveitadas em vez de criar um novo link a cada clique — evita duplicar cobranças por clique duplo.

## Webhook: como funciona hoje

1. Asaas envia o evento para `POST /api/asaas-webhook`.
2. `validateWebhookToken()` confirma o token (`ASAAS_WEBHOOK_TOKEN`) antes de processar qualquer coisa — eventos sem token válido são rejeitados com 401.
3. `mapAsaasEventToSubscriptionStatus()` traduz o nome do evento/status de pagamento para um status interno (`active`, `past_due`, `canceled`, `blocked`, `trialing`) — texto-livre do Asaas, sem depender de um formato exato de payload.
4. O evento é sempre registrado em `billing_events` (auditoria), mesmo quando não há assinatura vinculada (nesse caso, é "ignorado com segurança" — `200 OK`, sem erro, sem efeito).
5. Se a assinatura for encontrada, `customer_subscriptions.status` é atualizado.

## Billing types suportados

`billingType: 'UNDEFINED'` no link de pagamento — delega ao Asaas mostrar os meios habilitados na conta (Pix, Boleto, Cartão de Crédito). Não há billing type fixo/hardcoded que limitasse a um único meio de pagamento.

## Risco de cobrança real acidental: não encontrado

Não existe nenhum caminho de código que force produção. A única forma de uma chamada real à API de produção do Asaas ocorrer é se alguém **manualmente** definir `ASAAS_ENV=production` (ou `ASAAS_API_BASE_URL` apontando para produção) e `ASAAS_API_KEY` com uma chave de produção real no ambiente do servidor (Vercel) — uma ação de infraestrutura fora do código, não uma mudança feita por esta sprint nem por nenhuma anterior.

**Confirmação explícita: cobrança real continua desativada. Nenhuma variável de ambiente foi alterada nesta sprint.**

## Testes existentes

`src/services/asaasBilling.test.js` e `tests/asaas.test.js` já cobrem mapeamento de eventos, validação de token de webhook, extração de URL de pagamento e mensagens de erro amigáveis — não foram alterados nesta sprint (nenhuma lógica de Asaas foi modificada).

## Pendências futuras (ativação de cobrança real)

Quando a equipe decidir ativar cobrança real em produção:

1. Confirmar humanamente os preços finais de cada plano (ver `docs/PLANOS_HERDON.md`).
2. Criar conta de produção no Asaas (separada da sandbox) e gerar uma `ASAAS_API_KEY` de produção.
3. Configurar `ASAAS_ENV=production` e `ASAAS_API_BASE_URL=https://api.asaas.com/v3` **apenas no ambiente de produção** (Vercel), nunca no `.env` local de desenvolvimento.
4. Registrar a URL de webhook de produção no painel Asaas com um `ASAAS_WEBHOOK_TOKEN` novo e exclusivo de produção.
5. Testar o fluxo completo (checkout → pagamento real de baixo valor → webhook → status atualizado) antes de divulgar para clientes reais.
6. Decidir o que fazer com assinaturas `internal_test`/piloto já existentes — manter como cortesia ou migrar para um plano pago.
