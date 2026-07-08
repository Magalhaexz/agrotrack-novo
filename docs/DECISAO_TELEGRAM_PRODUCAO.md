# Decisão — Telegram Production-Ready (Sprint 20)

## 1. Segurança

- Webhook (`api/telegram-webhook.js`) continua exigindo `X-Telegram-Bot-Api-Secret-Token`
  igual a `TELEGRAM_WEBHOOK_SECRET` quando essa env var está configurada
  (`isWebhookAuthorized`). Sem a env var, aceita qualquer request — limitação
  documentada desde o Sprint 7/hotfix, mantida.
- `TELEGRAM_BOT_TOKEN` e `TELEGRAM_WEBHOOK_SECRET` nunca aparecem no
  frontend (`src/`) — só em `api/*.js`, lidos via `process.env`.
- Logs (console) nunca imprimem token, secret_token ou texto livre do
  usuário — só nome de comando, presença/ausência de campos, e códigos de
  erro (`error.code`), já era assim desde o hotfix de 401 e continua.

## 2. Vínculo

- `/start` e `/status` respondem sem vínculo.
- `/contas` informa se há vínculo, sem expor dados de outra conta.
- `/alertas` exige vínculo ativo (`telegram_connections.is_active = true`).
- `HERDON-XXXXXX` continua sendo o único fluxo de conexão
  (`api/_telegramConnections.js`, inalterado).

## 3. Rate limit

- `src/domain/telegramRateLimit.js` (puro, testável) — `avaliarRateLimitTelegram`.
- Limite padrão: 10 eventos/60s por `chat_id`. `/start` e o código
  `HERDON-XXXXXX` usam limite mais generoso (20/60s) para não travar o
  pareamento legítimo em caso de reenvio/retry do usuário.
- Persistência: **em memória**, num `Map` no escopo do módulo
  `api/telegram-webhook.js` (`eventosPorChat`). Decisão consciente de **não
  criar migration/tabela nova** para isto:
  - `telegram_notification_logs` já existe, mas seu formato é o de trilha de
    envio do relatório diário (`notification_type`, `status: sent|failed`),
    não o de contador de eventos por janela deslizante — reaproveitar essa
    tabela exigiria uma consulta por linha a cada mensagem recebida, o que é
    mais caro (I/O de banco por comando) do que o problema justifica.
  - O caso que o rate limit precisa cobrir é rajada/spam/loop no mesmo chat
    em segundos — isso acontece dentro de uma mesma instância "quente" da
    function Vercel, que é exatamente quando o `Map` em memória funciona.
  - Limitação conhecida: um cold start zera o contador daquele chat. Aceito
    porque o pior caso é permitir uma rajada extra após cold start, nunca
    quebrar o bot.
  - Se isso se provar insuficiente em produção (function estourando memória
    com muitos chats distintos, ou rajadas cross-cold-start), o upgrade é
    criar `telegram_eventos` (schema já rascunhado na Sprint 20, não criado)
    e trocar só a implementação de `registrarEventoEAvaliarRateLimit` — a
    função pura de domínio não muda.
- O rate limit nunca lança exceção: `avaliarRateLimitTelegram` é pura e
  sempre retorna um objeto; se rejeitado, o webhook responde 200
  (`{ ok: true, rateLimited: true }`) para não gerar reenvio do Telegram.

## 4. Observabilidade

Logs seguros já existiam desde o hotfix de 401 (ver
`docs/TELEGRAM_COMANDOS.md#Observabilidade-adicionada-neste-hotfix`) e
ganharam um ponto novo:

- `[telegram-webhook] rate limit excedido` — quando um chat estoura o
  limite (`quantidadeNaJanela`, nunca o texto da mensagem).

Diagnóstico de produção: `scripts/telegram-diagnostico.mjs` (novo, Sprint
20) chama `getWebhookInfo` e imprime só campos não sensíveis (`url`,
`pending_update_count`, `last_error_date`, `last_error_message`,
`max_connections`, `allowed_updates`) — nunca o token. Uso documentado em
`docs/TELEGRAM_COMANDOS.md`.

## 5. Operação

- Conexões Telegram: cada usuário só vê/gerencia a própria conexão em
  Configurações → Integrações (`src/pages/ConfiguracoesPage.jsx`,
  `src/services/telegramConnection.js`), protegido por RLS
  (`telegram_connections_select_own`, `user_id = auth.uid()`). Sprint 20
  adicionou ao painel existente o chat_id mascarado e a data de conexão —
  não foi criada tela nova nem policy de conta (RLS por `user_id`, não por
  `same_account`), porque a tabela é uma linha por usuário, não por conta.
  Uma visão "todas as conexões da equipe" exigiria uma policy nova baseada
  em `same_account`/roles — não criada nesta sprint (seria migration +
  painel novo para um caso de uso ainda não pedido; fica de backlog se
  algum gestor de conta precisar auditar conexões de outros membros).
- Reconfigurar webhook: `docs/TELEGRAM_COMANDOS.md` já tinha o passo a
  passo completo (`getWebhookInfo`/`setWebhook` via curl, checklist de
  variáveis obrigatórias); Sprint 20 adicionou o script de diagnóstico como
  atalho para a primeira parte.
