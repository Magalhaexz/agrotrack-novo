# Sprint 20 — Telegram Production-Ready

## Objetivo

Deixar a integração Telegram do HERDON robusta para operação real: rate
limit, diagnóstico de webhook, painel de conexão, logs seguros e
documentação operacional — sem quebrar o que já funciona em produção.

## Problema anterior

Corrigido no hotfix anterior (commit `30faf4a`): o webhook rejeitava 100%
das requisições com 401 por divergência de `secret_token`. Já resolvido;
esta sprint parte do bot funcionando.

## O que foi auditado

`api/telegram-webhook.js`, `api/telegram-relatorio-diario.js`,
`api/telegram-gerar-codigo.js`, `api/_telegram.js`,
`api/_telegramConnections.js`, `src/domain/telegramComandos.js`,
`src/services/telegramConnection.js`, `src/pages/ConfiguracoesPage.jsx`,
migration `20260706120000_telegram_multiuser_connections.sql`,
`docs/TELEGRAM_COMANDOS.md`.

Achados principais:
- Logs seguros já existiam desde o hotfix (4 pontos, sem token/texto livre).
- `telegram_notification_logs` já existe, mas é trilha de envio do
  relatório diário (`sent`/`failed`), não um contador de rate limit.
- Painel de conexão Telegram **já existia** e é completo (conectar via
  QR/deep link, preferências por tipo de alerta, horário do relatório,
  desconectar) — só faltava chat_id mascarado e data de conexão visíveis.
- Diagnóstico de `getWebhookInfo`/`setWebhook` já estava totalmente
  documentado em `docs/TELEGRAM_COMANDOS.md` (curl manual); faltava só um
  script para não precisar montar o comando toda vez.
- Nenhum rate limit existia.
- `/status`, `/contas`, `/alertas` e o relatório diário já eram robustos:
  não quebram sem vínculo, tratam falha do Supabase com mensagem amigável,
  nunca vazam dados de outra conta (sempre via `owner_user_id` da conexão,
  nunca do texto da mensagem).

## Rate limit adotado

`src/domain/telegramRateLimit.js` (puro) + `Map` em memória no módulo do
webhook. 10 eventos/60s por chat, 20/60s para `/start`/`HERDON-XXXXXX`.
Sem migration — decisão e trade-offs documentados em
`docs/DECISAO_TELEGRAM_PRODUCAO.md`.

## Logs seguros

Mantidos os 4 pontos existentes + 1 novo: rejeição por rate limit
(`quantidadeNaJanela`, nunca o texto). Nenhum log imprime
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` ou texto livre do usuário.

## Painel/admin

Estendido o painel self-service existente em Configurações → Integrações:
chat_id mascarado (`••••1234`) e data de conexão. Não foi criada uma tela
de administração multiusuário (lista de conexões de toda a conta) porque a
RLS de `telegram_connections` é por `user_id`, não por `same_account` — uma
visão de equipe exigiria policy nova (migration) para um caso de uso ainda
não solicitado. Fica de backlog, documentado em
`docs/DECISAO_TELEGRAM_PRODUCAO.md`.

## Impacto em /alertas

Nenhuma mudança de comportamento — já respeitava vínculo e tratativas
(Sprint 16). Passa a ser protegido pelo rate limit compartilhado do
webhook, como todos os outros comandos.

## Impacto no relatório diário

Nenhuma mudança: `api/telegram-relatorio-diario.js` não passa pelo rate
limit do webhook (é um endpoint separado, autenticado por
`TELEGRAM_REPORT_SECRET`, chamado pelo cron da Vercel, não pelo Telegram).
Já era sequencial (evita rajada no Bot API), já respeitava
`daily_report_enabled`/`is_active`, já tinha `dryRun`.

## Limitações

- Rate limit em memória reseta em cold start (documentado, aceito).
- Sem tela de administração multiusuário de conexões Telegram.
- Sem teste automatizado de nível "webhook HTTP" (não existe esse padrão em
  nenhum outro endpoint de `api/`; cobertura fica nas funções puras de
  domínio, que é o padrão do projeto).
- Verificação visual do painel de Configurações não foi feita
  interativamente (sem credencial de teste disponível nesta sessão) — só
  build/lint/screenshot da tela de login confirmando que o app carrega sem
  erro de console.

## Validações executadas

- `npm run lint` — sem erros.
- `npm test -- --run` — ver resumo final da sprint (todos os testes
  passando, incluindo os 8 novos de `telegramRateLimit.test.js`).
- `npm run build` — build ok.
