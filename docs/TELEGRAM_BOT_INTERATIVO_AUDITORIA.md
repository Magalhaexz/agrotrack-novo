# Auditoria — Bot Telegram Interativo (Sprint)

Estado do repositório na auditoria: `main`, lint ✓, 987 testes ✓.
Objetivo: mapear a integração atual antes de adicionar comandos interativos e
ações seguras. **Nada foi reescrito nesta fase.**

## 1. Onde o webhook recebe mensagens

`api/telegram-webhook.js` (Vercel Serverless Function, **não** Supabase Edge
Function — não existe `supabase/functions/`). Recebe `POST` com o `update` do
Bot API. Sempre responde `200` (senão o Telegram reenvia o mesmo update).

Fluxo atual, em ordem:
1. `isWebhookAuthorized(req)` — valida `x-telegram-bot-api-secret-token` contra
   `TELEGRAM_WEBHOOK_SECRET` (se o env não existir, aceita — limitação
   documentada; foi a causa do 401 em produção, hotfix `30faf4a`).
2. Extrai `chatId`/`texto` de `message | edited_message`.
3. Rate limit em memória por `chat_id` (`telegramRateLimit.js`), reseta em cold start.
4. Código `HERDON-XXXXXX` → fluxo de pareamento (Sprint 7).
5. Comando de barra novo (`/start /ajuda /status /contas /alertas`) → `telegramComandos.js`.
6. Senão, classificador de intenção por palavra-chave (`telegramIntent.js`) → resposta.

## 2. Como o usuário do Telegram é identificado

**Sempre pela conexão já salva**, nunca pelo texto da mensagem.
`buscarConexaoAtiva(client, chatId)` lê `telegram_connections` por
`telegram_chat_id = String(chatId)` e `is_active = true`, retornando
`{ id, owner_user_id, telegram_chat_id, fazenda_id }`. Este é o pilar de
segurança a preservar: o `owner_user_id` vem do banco, não do usuário.

## 3. Como a conexão com o HERDON é encontrada / persistida

Tabela `telegram_connections` (migration `20260706120000`):
- `owner_user_id` (raiz da conta), `user_id` (dono da conexão), `fazenda_id` (nullable),
  `telegram_chat_id`, flags de alerta/relatório, `report_time`.
- `UNIQUE (user_id)` → uma conexão ativa por usuário HERDON.
- RLS por `user_id = auth.uid()` (SELECT/UPDATE). **INSERT/DELETE não têm policy
  para `authenticated`**: só a service role (webhook) cria linhas. O frontend só
  ajusta preferências (UPDATE).
- Pareamento: `telegram_connection_codes` (código temporário, TTL 15min) — RLS
  fechada, só service role. Deep link `t.me/bot?start=CODIGO`.

## 4. Como `fazenda_id` é utilizado

Recuperado da conexão (Sprint 28). `prepararAlertasEscopados(dbConta, fazenda_id)`
(`telegramFazenda.js`):
- `fazenda_id` presente → `filtrarDbPorFazenda` (recorte por fazenda).
- ausente + conta multi-fazenda → mantém db inteiro, mas **rotula** cada alerta
  com a fazenda de origem (via lote) para não misturar sem etiqueta.

`escopoFazenda.js::filtrarDbPorFazenda` é a fonte única de recorte por fazenda —
usa `lotes.faz_id`, e propaga por `lote_id` para animais/pesagens/sanitário/etc.
Registros sem `fazenda_id` (legado) permanecem visíveis em qualquer fazenda
(nunca somem silenciosamente) — política a respeitar.

## 5. Como mensagens são enviadas

`api/_telegram.js::enviarMensagemTelegramParaChat(chatId, texto)` — `POST`
`sendMessage`, texto simples (sem `parse_mode`, sem inline keyboard hoje). Lança
erro classificado (`MISSING_TELEGRAM_ENV`/`TELEGRAM_UNREACHABLE`/`TELEGRAM_SEND_FAILED`).
Nunca expõe token. Só importado por `api/`, nunca por `src/`.

## 6. Tabelas envolvidas

| Tabela | Papel | Chave de escopo |
|--------|-------|-----------------|
| `telegram_connections` | chat ↔ usuário ↔ fazenda | `user_id`, `owner_user_id`, `fazenda_id` |
| `telegram_connection_codes` | pareamento temporário | service role |
| `telegram_notification_logs` | trilha de envio | `owner_user_id` |
| `fazendas` | id/nome (`faz_id` dos lotes) | `owner_user_id` |
| `lotes` | **agregado** (`qtd`, `p_at`, `faz_id`) | `faz_id` |
| `animais` | **agregado** (`qtd`, `p_ini`/`p_at`, `lote_id`) | `lote_id` |
| `movimentacoes_animais` | histórico (tipo/qtd/`lote_id`/`destino_lote_id`) | `lote_id` |
| `pesagens`, `sanitario`, `estoque`, `movimentacoes_*`, `tarefas` | dados operacionais | `lote_id`/`fazenda_id` |
| `profiles` | papel do usuário (`perfil`) | `owner_user_id` |

## 7. Funções / módulos reutilizáveis

Puros (`src/domain`, testáveis, sem I/O):
- `telegramIntent.js` — classifica intenção por regex (reaproveitar/estender).
- `telegramComandos.js` — comandos de barra atuais + `interpretarComandoTelegram`
  (retorna **string** nome do comando; **colisão de nome** a evitar com o novo
  interpretador estruturado).
- `telegramFazenda.js` / `escopoFazenda.js` — recorte por fazenda.
- `alertasUnificados.js`, `tratativasAlertas.js` — alertas.
- `resumoLote.js`, `calculos.js`, `calcLote` — métricas de lote (qtd, GMD, peso).
- `auth/perfis.js` — **`perfilTemPermissao(perfil, 'animais:movimentar')`** puro,
  usável server-side para autorização.

Server-side (`api/`):
- `_herdonDb.js::montarDbDaConta` — lê o db de UMA conta por `owner_user_id`.
  ⚠️ **`fazendas` NÃO está em `TABELAS_NECESSARIAS`** — precisa entrar para
  `/fazendas` e para nomear fazendas.
- `_supabaseAdmin.js` — service role (bypassa RLS; isolamento é responsabilidade
  do código, sempre filtrando por `owner_user_id`).

## 8. Modelo de transferência entre lotes (achado central — Parte 12/13)

**O HERDON é agregado, não individualizado.** `registrarSaidaAnimal(db, {tipoSaida:
'transferencia_saida', destinoLoteId})` em `src/services/movimentacoes.js` já
implementa a regra correta: valida origem≠destino e existência, decrementa `qtd`
da origem, incrementa a do destino, recalcula peso médio ponderado, cria um
`movimentacoes_animais` e registra auditoria. **Não** é só mexer em contador.

⚠️ **Porém** essa função vive em `src/services/` e está acoplada à persistência do
**frontend** (`operationalPersistence` usa `session.user.id` do browser). O
webhook roda server-side com admin client e **sem** sessão de usuário. Logo:
- A *regra de cálculo* existe e deve ser a fonte de verdade, mas
- Precisa de uma **função de domínio pura** (`transferirAnimaisEntreLotes(db,...)`)
  que só calcula o novo estado + o registro de movimentação, deixando o webhook
  aplicar os writes com o admin client. Não duplicar a regra: extrair/compartilhar.

## 9. Modelo de autorização

`profiles.perfil` → `auth/perfis.js`. Perfis: proprietário/admin (`*`), gerente,
operador, visualizador. Permissão de mutação relevante: `animais:movimentar`
(gerente/operador/proprietário têm; **visualizador não**). `perfilTemPermissao`
é puro → reusar no servidor. O perfil do `user_id` da conexão deve ser lido de
`profiles` server-side (não confiar no texto da mensagem).

## 10. Limitações encontradas

- Sem `parse_mode`/inline keyboard hoje (Parte 21 pede paginação/botões).
- Rate limit só em memória (some em cold start) — aceitável, documentado.
- `montarDbDaConta` não carrega `fazendas` nem `profiles`.
- `TELEGRAM_WEBHOOK_SECRET` ausente = webhook aberto (aceita qualquer POST).
- Nenhuma tabela de operações pendentes nem de auditoria server-side do Telegram.
- Seleção de fazenda por nome ainda não existe.

## 11. Riscos de segurança

1. **Ação mutável sem confirmação** — a criar (Parte 15): operações pendentes
   com expiração, mesmo usuário/chat/fazenda, idempotência.
2. **Escopo cruzado de fazenda** — mitigar exigindo `fazenda_id` em toda consulta
   e validando associação usuário↔fazenda; nunca reatribuir órfãos.
3. **Autorização** — validar `perfil` no servidor antes de qualquer mutação;
   visualizador não transfere.
4. **Admin client bypassa RLS** — todo acesso DEVE filtrar por `owner_user_id`
   (já é o padrão em `montarDbDaConta`; manter).
5. **Vazamento de detalhes** — nunca devolver SQL/stack ao usuário (Parte 20).

## 12. Mudanças necessárias (resumo, ordem da Parte 26)

1. Novo interpretador estruturado `src/domain/telegram/interpretarComandoTelegram.js`
   (intenção + parâmetros + `requerConfirmacao`), sem colidir com o legado.
2. Autorização server-side reusando `perfilTemPermissao` + leitura de `profiles`.
3. Escopo multi-fazenda: seleção por nome, `/fazendas`, troca com auditoria.
4. Comandos de consulta (`/lotes /estoque /financeiro /alertas /manejos /pesagens
   /resumo`) reusando domínio; `montarDbDaConta` passa a carregar `fazendas`.
5. Tabela `telegram_operacoes_pendentes` + confirmação/cancelamento.
6. Função de domínio pura de transferência (compartilha regra com `movimentacoes.js`).
7. Auditoria server-side (`telegram_bot_auditoria` ou reuso de tabela existente).
8. Renomear lote (sem ambiguidade com transferência).
9. Testes (Parte 22) + docs (`TELEGRAM_BOT_COMANDOS.md`).

**Preservar sem regressão:** pareamento (Sprint 7), `/alertas`, relatório diário,
recorte por fazenda, política de órfãos.
