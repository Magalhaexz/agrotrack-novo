# Sprint 7 — Telegram Multiusuário (Resultado)

Evolui a integração Telegram do Sprint 6 (MVP de conta única, variáveis
`TELEGRAM_CHAT_ID`/`TELEGRAM_OWNER_USER_ID`) para conexão por
usuário/produtor, sem cadastro manual na Vercel.

## Tabelas criadas

Migration: `supabase/migrations/20260706120000_telegram_multiuser_connections.sql`

- **`telegram_connections`** — uma conexão ativa por usuário HERDON
  (`UNIQUE(user_id)`). Guarda `telegram_chat_id`, dados do perfil Telegram e
  preferências (`daily_report_enabled`, `alert_payments_enabled`,
  `alert_stock_enabled`, `alert_tasks_enabled`, `alert_health_enabled`,
  `report_time`).
- **`telegram_connection_codes`** — código temporário (`HERDON-XXXXXX`),
  expira em 15 minutos, marcado `used_at` depois de consumido.
- **`telegram_notification_logs`** — trilha de envio do relatório diário
  (`sent`/`failed` por conexão), só para diagnóstico server-side.

### RLS

- `telegram_connections`: `SELECT`/`UPDATE` só para `user_id = auth.uid()`
  (o próprio usuário vê e ajusta a própria conexão — não é
  `app_is_same_account`, de propósito: conectar um Telegram é pessoal, não
  compartilhado com a conta toda). Sem policy de `INSERT`/`DELETE` para
  `authenticated`: só a service role (webhook) cria linhas.
- `telegram_connection_codes` e `telegram_notification_logs`: RLS habilitado
  sem nenhuma policy para `anon`/`authenticated` — acesso só via service role
  (endpoints em `api/`). Isso evita qualquer usuário ler código ou log de
  outro.

## Endpoints criados

- `POST /api/telegram-gerar-codigo` — autenticado (`Authorization: Bearer
  <access_token do Supabase>`). Resolve `owner_user_id` a partir de
  `profiles.owner_user_id` do usuário autenticado (nunca aceita
  `owner_user_id` do corpo da requisição). Gera código, invalida códigos
  anteriores não usados, aplica cooldown de 15s contra clique repetido.
  Resposta: `{ ok, code, telegramUrl, expiresAt, ttlMinutes }` —
  `telegramUrl` vem `null` se `TELEGRAM_BOT_USERNAME` não estiver
  configurado no servidor; `TELEGRAM_BOT_TOKEN` nunca aparece na resposta.
- `POST /api/telegram-webhook` — recebe updates do Telegram. Extrai
  `HERDON-XXXXXX` da mensagem, valida o código em
  `telegram_connection_codes`, faz upsert em `telegram_connections` e
  responde ao usuário no próprio chat. Valida
  `X-Telegram-Bot-Api-Secret-Token` contra `TELEGRAM_WEBHOOK_SECRET` quando
  configurado (ver limitação abaixo).
- `POST/GET /api/telegram-relatorio-diario` (reescrito) — protegido por
  `Authorization: Bearer <TELEGRAM_REPORT_SECRET>`. Busca todas as conexões
  ativas com `daily_report_enabled=true`, monta o `db` por `owner_user_id`,
  gera alertas com `gerarAlertasUnificados` (Sprint 5) e formata com
  `gerarRelatorioDiarioTelegram` (Sprint 6) — nenhum cálculo novo. Envia
  sequencialmente (evita rate limit do Bot API); uma falha não interrompe as
  demais. `GET` é aceito porque a Vercel Cron só invoca rotas via GET.
  `dryRun: true` no corpo retorna só contagem de alertas por conta, sem texto
  da mensagem (evita vazar dado de uma conta para quem chamou o dry-run).

## Como o produtor conecta

1. Em **Configurações → Integrações → Telegram**, clica em "Conectar Telegram".
2. HERDON mostra um código (`HERDON-482913`), válido por 15 minutos, e — se
   `TELEGRAM_BOT_USERNAME` estiver configurado no servidor — também um botão
   "Abrir no Telegram" e um QR Code, ambos apontando para
   `https://t.me/<bot>?start=HERDON-482913` (deep link oficial do Telegram:
   abrir o link já envia `/start HERDON-482913` ao bot).
3. O usuário abre o bot do HERDON no Telegram (pelo botão, QR Code, ou
   manualmente) e envia `/start HERDON-482913` (ou só `HERDON-482913`).
4. O webhook valida o código e vincula o `chat_id` à conta do usuário — a
   mesma lógica de sempre, o deep link/QR só evitam digitar o código.
5. A tela em Configurações consulta a conexão a cada 4s enquanto o código
   está pendente e atualiza sozinha para "Conectado" — sem precisar de F5.
6. Desconectar marca `is_active = false` (não apaga o histórico).

### Deep link + QR Code (UX)

`POST /api/telegram-gerar-codigo` monta o `telegramUrl` no servidor com
`process.env.TELEGRAM_BOT_USERNAME` (`api/_telegramConnections.js#buildTelegramUrl`)
e devolve pronto na resposta — o frontend nunca monta o link sozinho nem lê
username de bot de variável de cliente. Sem `TELEGRAM_BOT_USERNAME`
configurado no servidor, `telegramUrl` vem `null` e a tela cai de volta para
só o código textual (nenhum erro, só menos UX).

`src/services/telegramConnection.js` ainda exporta `buildTelegramDeepLink`
como utilitário puro (mesma lógica), mas a tela usa o `telegramUrl` que já
vem da API.

QR Code renderizado com [`qrcode.react`](https://www.npmjs.com/package/qrcode.react)
(sem dependências além do `react` já usado no projeto, ~6kB gzip no chunk da
página) — gerado 100% no navegador, sem chamada a serviço externo (evita
vazar o código de pareamento para terceiros).

## Configurar o bot

1. Criar o bot com [@BotFather](https://t.me/BotFather) → obter
   `TELEGRAM_BOT_TOKEN`.
2. Definir o webhook (rodar uma vez, com o token do bot e a URL do deploy):

   ```bash
   curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://SEU_DOMINIO/api/telegram-webhook", "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"}'
   ```

## Variáveis de ambiente

Multiusuário (novas):

- `TELEGRAM_BOT_TOKEN` — token do bot (server-only).
- `TELEGRAM_BOT_USERNAME` — username público do bot (sem `@`), server-only.
  Usado só para montar `telegramUrl` (deep link + QR Code) em
  `api/telegram-gerar-codigo.js`; nunca lido pelo frontend. **Não existe
  variável `VITE_TELEGRAM_BOT_USERNAME`** — uma versão anterior deste sprint
  tentou montar o link no frontend com uma env `VITE_`, mas isso deixava o
  botão/QR Code quebrados sempre que a env de cliente não estava configurada
  no deploy; a fonte da verdade agora é o servidor.
- `TELEGRAM_WEBHOOK_SECRET` — secret do webhook (server-only).
- `TELEGRAM_REPORT_SECRET` — secret do endpoint de relatório (já existia).
- `CRON_SECRET` — opcional; se definido, a Vercel injeta automaticamente
  `Authorization: Bearer <valor>` nas chamadas do Cron Job. Use o mesmo valor
  de `TELEGRAM_REPORT_SECRET`.

Legadas (Sprint 6, MVP de conta única — **não recomendadas para produção
multiusuário**, mantidas só para referência):

- `TELEGRAM_CHAT_ID`
- `TELEGRAM_OWNER_USER_ID`

`api/telegram-relatorio-diario.js` não lê mais nenhuma das duas.
`enviarMensagemTelegram()` (helper legado, usa `TELEGRAM_CHAT_ID`) continua
existindo em `api/_telegram.js` só por compatibilidade, mas nenhum endpoint
novo chama ele — todos usam `enviarMensagemTelegramParaChat(chatId, texto)`.

## Como testar

**Gerar código:**
```bash
curl -X POST https://SEU_DOMINIO/api/telegram-gerar-codigo \
  -H "Authorization: Bearer <access_token do usuário logado>"
```

**Conexão:** enviar o código retornado para o bot no Telegram e conferir que
a linha aparece em `telegram_connections` com `is_active = true`.

**Envio manual (dry run, não envia mensagem de verdade):**
```bash
curl -X POST https://SEU_DOMINIO/api/telegram-relatorio-diario \
  -H "Authorization: Bearer <TELEGRAM_REPORT_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```

**Envio real:** mesma chamada sem `dryRun`, ou aguardar o Cron Job.

## Cron

Adicionado em `vercel.json` (`0 10 * * *` — 10h UTC, ~7h no horário de
Brasília). Depende de `CRON_SECRET` estar configurado na Vercel com o mesmo
valor de `TELEGRAM_REPORT_SECRET` para a chamada automática ser autorizada.
Planos Hobby da Vercel limitam a frequência de Cron Jobs — confirme o limite
do plano em uso antes de contar com o agendamento automático.

## Limitações

- Sem `TELEGRAM_WEBHOOK_SECRET` configurado, o webhook aceita qualquer
  requisição (documentado, não há outro mecanismo de assinatura do Telegram
  disponível sem essa configuração). Configure em produção.
- `telegram_connections` é 1 conexão por usuário HERDON (não por
  fazenda/lote); todos os alertas de todas as fazendas do `owner_user_id` do
  usuário entram no mesmo relatório, igual ao Sprint 6.
- Sem retry automático em falha de envio — a próxima execução diária tenta
  de novo; `telegram_notification_logs` registra o que falhou.

## Fora de escopo (fica para depois)

- WhatsApp — não implementado neste sprint, por instrução explícita.
