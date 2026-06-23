# Endpoints Serverless (Sprint 30)

## Inventário de `api/`

| Arquivo | Tipo | Método | Autenticação |
|---|---|---|---|
| `_supabaseAdmin.js` | Módulo compartilhado (não é endpoint) | — | — |
| `_asaas.js` | Módulo compartilhado (não é endpoint) | — | — |
| `asaas-create-customer.js` | Endpoint | POST | Bearer token (Supabase) |
| `asaas-create-subscription.js` | Endpoint | POST | Bearer token (Supabase) |
| `asaas-webhook.js` | Endpoint | POST | Token de webhook do Asaas (header) |
| `cloud-sync.js` | Endpoint | POST | Bearer token (Supabase) |
| `cloud-diagnostic.js` | Endpoint | POST | Bearer token (Supabase) |

## `_supabaseAdmin.js` — módulo base

- `getSupabaseAdminClient()` — cria/cacheia o client com `SUPABASE_SERVICE_ROLE_KEY` (lê de `process.env`, nunca de `import.meta.env`/`VITE_*` — confirmado, não pode ir para o bundle do navegador).
- `resolveAuthenticatedUser(req)` — extrai o Bearer token do header `Authorization` e valida via `client.auth.getUser(token)`. Retorna `null` se inválido/ausente — todos os endpoints checam isso antes de prosseguir.
- `safeErrorPayload(error, fallbackMessage)` — já existia e já é seguro: devolve só `code`/`httpStatus`/uma mensagem fixa, nunca `error.message` ou `error.details` crus (que poderiam conter SQL ou estrutura interna).

## `_asaas.js` — checagens por endpoint

### `handleCreateCustomerRequest` / `handleCreateSubscriptionRequest`
- Rejeitam método != POST (405).
- Verificam `getAsaasServerEnvStatus().configured` antes de chamar a API do Asaas (nunca tenta com env faltando).
- Exigem usuário autenticado (`resolveAuthenticatedUser`) — 401 se sessão ausente/inválida.
- Validam payload (`planCode` obrigatório, dados do cliente completos) antes de chamar o Asaas — nunca envia requisição incompleta.
- `logSubscriptionFailure()` (auditado nesta sprint): loga `apiKeyPresent`/`webhookTokenPresent` como booleano, nunca o valor da chave. Confirmado seguro.

### `handleWebhookRequest`
- Rejeita método != POST (405).
- Valida `validateWebhookToken()` contra `ASAAS_WEBHOOK_TOKEN` antes de processar qualquer coisa — evento sem token correto recebe 401 e não é processado.
- Se a assinatura vinculada ao evento não for encontrada, responde `200 OK` com `ignored: true` em vez de erro — evita que o Asaas re-tente indefinidamente um evento que não corresponde a nada no banco, e não revela se um `customer_id`/`subscription_id` existe ou não (evita enumeração).
- Idempotente: usa `provider_event_id` como chave de upsert em `billing_events` — reprocessar o mesmo evento não duplica.

## `cloud-sync.js`

- Rejeita header de autorização malformado antes mesmo de chamar o Supabase (`isMalformedAuthorizationHeader`).
- Todo payload de escrita carrega `owner_user_id: userId` (o usuário autenticado resolvido pelo próprio token) — nunca um valor vindo do corpo da requisição. Mesmo que o cliente tente mandar um `owner_user_id` diferente no payload, a função de mapeamento (`mapFazendaPayload`/`mapLotePayload`) sempre usa o `userId` resolvido pelo servidor.
- Updates filtram por `id` **e** `owner_user_id` juntos — mesmo com client admin (que ignora RLS), a query não atualiza uma linha de outra conta mesmo que o `id` seja adivinhado/forjado.

## `cloud-diagnostic.js` — achado corrigido nesta sprint

**Encontrado:** o endpoint fazia duas checagens de conectividade **sem filtro de conta** (`runTableCheck(client, 'lotes', null)` e `runTableCheck(client, 'fazendas', null)`), usando o client `service_role` (que ignora RLS). A resposta incluía `count` — o número total de linhas da tabela **em toda a plataforma**, não só da conta do usuário autenticado. Qualquer usuário logado, ao chamar esse endpoint de diagnóstico (que roda automaticamente antes de sincronizar), recebia esse número agregado entre contas. O frontend nunca lê esse campo (confirmado por busca em `src/services/supabaseDiagnostics.js`), então não tinha utilidade — só exposição.

**Correção:** `count` agora é sempre `null` quando a checagem não tem `userId` (checagem "a tabela existe e responde", não "quantas linhas tem"). Quando há `userId`, a contagem continua sendo devolvida normalmente (é a contagem da própria conta do usuário, informação legítima). Teste adicionado em `tests/cloudDiagnostic.test.js`.

## Validações já presentes em todos os endpoints (confirmado, sem necessidade de correção)

- Método HTTP restrito (rejeita com 405 fora do esperado).
- Nenhum endpoint aceita `service_role` vindo do cliente — a chave é sempre lida do ambiente do servidor.
- Mensagens de erro voltadas ao usuário são todas em português, amigáveis, e não vazam SQL/stack trace.
- CORS: não há configuração de CORS explícita nos arquivos `api/*.js` (Vercel serve as funções no mesmo domínio do frontend por padrão; não há necessidade de CORS cross-origin neste projeto).

## Pendências

- Adicionar testes unitários equivalentes para `cloud-sync.js` (hoje só `_asaas.js`/`cloud-diagnostic.js` têm cobertura de teste entre os arquivos `api/`).
- Considerar rate limiting nos endpoints de checkout/webhook se o volume de uso justificar (não necessário no estágio piloto).
