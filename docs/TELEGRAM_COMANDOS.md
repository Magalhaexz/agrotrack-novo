# Comandos do Bot Telegram HERDON

## Problema corrigido

O bot respondia normalmente a mensagens comuns (orientando a enviar o código
`HERDON-000000`), mas os comandos de barra (`/start`, `/alertas`, `/contas`,
`/status`) não tinham handler algum e caíam sem tratamento específico.
`src/domain/telegramComandos.js` adiciona esses comandos sem alterar o fluxo
de vínculo por código (Sprint 7) nem os comandos do Sprint 8.

## Comandos disponíveis

| Comando | Resposta |
|---|---|
| `/start` | Boas-vindas + instrução de vínculo (`HERDON-000000`) |
| `/ajuda` | Lista todos os comandos (novos + Sprint 8: `/relatorio`, `/prioridades`, `/pagamentos`, `/estoque`, `/tarefas`, `/lotes`) |
| `/status` | Confirma que o bot está ativo (não depende de vínculo) |
| `/contas` | Diz se o chat está vinculado a uma conta HERDON |
| `/alertas` | Resumo dos alertas (total + contagem por prioridade + até 5 alertas), só se vinculado |
| Comando não mapeado (ex.: `/teste`) | "Comando não reconhecido. Envie /ajuda..." |

Comandos com sufixo de bot (`/start@HerdonAlertasBot`) funcionam igual.

## Fluxo de vínculo (inalterado)

Qualquer mensagem contendo `HERDON-XXXXXX` (com ou sem `/start` na frente,
inclusive vindo do deep link `t.me/<bot>?start=HERDON-XXXXXX`) é tratada
**antes** dos comandos novos — continua exatamente como no Sprint 7
(`api/_telegramConnections.js`, `extractHerdonCodeFromText`).

Mensagem sem comando e sem código: orienta a enviar o código
(comportamento antigo, inalterado).

## Segurança

`/contas` e `/alertas` só respondem dados reais quando o `chat_id` já está em
`telegram_connections` (`is_active = true`). Sem vínculo, ambos devolvem a
mesma orientação de vínculo — nunca dados de outra conta. `/alertas` usa
`montarDbDaConta(client, conexao.owner_user_id)`, isolando por conta.

## Como testar

- Unitário (lógica pura, sem rede): `src/domain/telegramComandos.test.js`
  (`npm test`).
- Real: enviar no Telegram, nesta ordem, `/start`, `/ajuda`, `/status`,
  `/contas`, `/alertas`, `/teste` — e confirmar que o código
  `HERDON-000000` ainda vincula normalmente.

## Cuidados

- Nunca commitar `.env` nem logar `TELEGRAM_BOT_TOKEN`.
- `api/telegram-webhook.js` sempre responde HTTP 200 ao Telegram, mesmo em
  erro interno, para não gerar reenvio do mesmo update — **exceto** quando o
  request não passa na checagem de `secret_token` (401, ver diagnóstico
  abaixo) ou não é `POST` (405).

## Diagnóstico de produção

Incidente registrado: o bot parou de responder a **qualquer** mensagem
(inclusive `/start`, que não depende de banco) mesmo com o hotfix de
comandos publicado e os testes locais passando. Causa raiz encontrada via
logs de runtime da Vercel (MCP): **100% das requisições a
`/api/telegram-webhook` retornavam 401**, rejeitadas por
`isWebhookAuthorized()` — `TELEGRAM_WEBHOOK_SECRET` está configurado no
ambiente de produção, mas o webhook registrado no Telegram não estava
enviando (ou enviava um valor diferente) o `secret_token` esperado no
header `X-Telegram-Bot-Api-Secret-Token`. A lógica de comandos em si nunca
chegou a rodar — o pedido é rejeitado antes de qualquer leitura do texto da
mensagem. Confirmado que não é problema de rota/deploy: os logs mostram a
function sendo executada normalmente (sem erro de import, sem 404/500), só
retornando 401 de propósito.

### Como verificar `getWebhookInfo` (sem expor o token)

Rodar num shell onde `TELEGRAM_BOT_TOKEN` já está definido como variável de
ambiente — nunca colar o token direto no comando nem em log:

```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
```

Checar no JSON de resposta (nenhum desses campos contém o token):
`url`, `pending_update_count`, `last_error_date`, `last_error_message`,
`max_connections`, `allowed_updates`. Se `pending_update_count` estiver alto
e `last_error_message` mencionar `401`/`Unauthorized`, é o mesmo sintoma
deste incidente.

### Como identificar URL errada

`url` deve ser exatamente `https://herdonapp.com.br/api/telegram-webhook`
(domínio de produção real, confirmado via `vercel.com` → projeto
`agrotrack-novo` → Domains). Se `url` estiver vazia, apontar para um
deployment de preview (`*-git-*.vercel.app` de uma branch que não é `main`,
ou um hash de deployment específico em vez do alias estável), ou for um
domínio antigo — é preciso re-registrar com `setWebhook` (abaixo).

### Como configurar o webhook corretamente (`setWebhook`)

Só quem tem acesso a `TELEGRAM_BOT_TOKEN` e ao valor de
`TELEGRAM_WEBHOOK_SECRET` configurado na Vercel pode rodar isto — nenhum
agente/sessão sem esses dois valores consegue executar a correção sozinho.

```bash
curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://herdonapp.com.br/api/telegram-webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

O `secret_token` enviado aqui precisa ser **idêntico** ao valor da env var
`TELEGRAM_WEBHOOK_SECRET` no projeto Vercel (Settings → Environment
Variables, ambiente Production). Depois, confirmar com `getWebhookInfo`
novamente: `url` correta, `last_error_message` ausente ou antigo (anterior
ao horário do `setWebhook`), `pending_update_count` caindo a zero conforme o
Telegram reenvia os updates pendentes.

**Alternativa mais simples (menos segura):** remover `TELEGRAM_WEBHOOK_SECRET`
do projeto Vercel e reimplantar — `isWebhookAuthorized()` já trata "sem
secret configurado" como aceitar qualquer requisição (comportamento
documentado no próprio código, `api/telegram-webhook.js`). Não exige rodar
nenhum comando com o token, mas remove a validação de origem do webhook (o
endpoint passa a confiar em qualquer POST enviado a ele — o isolamento por
conta continua garantido, já que o handler nunca aceita `owner_user_id` vindo
do texto da mensagem, só do `chat_id` já vinculado em `telegram_connections`).

### Como ver logs da Vercel (via MCP, sem precisar do dashboard)

```
get_runtime_logs(projectId, teamId, query="telegram-webhook", group_by="statusCode", since="7d")
get_runtime_errors(projectId, teamId, routes="/api/telegram-webhook", since="7d")
```

`projectId`/`teamId` deste projeto estão em `.vercel/project.json`
(`prj_EvRR500wRpUFblz2tRRrXeqhhuto` / `team_vVaTXEv1SAtdX8i4zqAzfVVC`).
`get_runtime_errors` só pega exceções não tratadas — um 401 deliberado (como
este incidente) só aparece em `get_runtime_logs`, não em
`get_runtime_errors`.

### Teste POST simulado (sem enviar mensagem real)

Para confirmar que a rota responde sem depender do Telegram, usar um
`chat_id` que não existe em `telegram_connections` (não aciona nenhum envio
real, já que a função tenta enviar e falha silenciosamente se o chat não
existir — mas isso já teria passado pela checagem de `secret_token`):

```bash
curl -i -X POST https://herdonapp.com.br/api/telegram-webhook \
  -H "Content-Type: application/json" \
  -H "X-Telegram-Bot-Api-Secret-Token: $TELEGRAM_WEBHOOK_SECRET" \
  -d '{"message":{"chat":{"id":123456789000},"text":"/status"}}'
```

Sem o header `X-Telegram-Bot-Api-Secret-Token` (quando `TELEGRAM_WEBHOOK_SECRET`
está configurado), a resposta será `401` — reproduz o incidente localmente
sem precisar de acesso à Vercel.

### Variáveis obrigatórias (produção)

| Variável | Onde é lida | Sintoma se ausente/errada |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `api/_telegram.js` | Nenhuma mensagem é enviada (erro `MISSING_TELEGRAM_ENV`, engolido por `.catch()` nos pontos de chamada — silencioso pro usuário, visível só no log `sendMessage falhou`) |
| `TELEGRAM_WEBHOOK_SECRET` | `api/telegram-webhook.js` (`isWebhookAuthorized`) | Se configurada errado/divergente do `setWebhook`, **todo** update é rejeitado com 401 antes de qualquer lógica rodar — este incidente |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | `api/_supabaseAdmin.js` | Lança exceção não tratada ao montar o client (fora de qualquer `try/catch` na primeira chamada do handler) — apareceria em `get_runtime_errors`, diferente do sintoma deste incidente |

### Observabilidade adicionada neste hotfix

`api/telegram-webhook.js` ganhou 4 logs seguros (sem token, sem texto livre
do usuário) para que este diagnóstico não precise ser refeito do zero da
próxima vez:

- `[telegram-webhook] rejeitado: secret_token ausente ou divergente` — no
  401 de `isWebhookAuthorized` (só indica se o header chegou ou não, nunca o
  valor).
- `[telegram-webhook] update recebido` — a cada POST autorizado.
- `[telegram-webhook] comando recebido` — nome do comando reconhecido
  (`/start`, `/status` etc.), nunca texto livre.
- `[telegram-webhook] resposta enviada com sucesso` / `sendMessage falhou`
  (com `error.code`, nunca o corpo da resposta do Telegram nem o token).
