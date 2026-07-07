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
  erro interno, para não gerar reenvio do mesmo update.
