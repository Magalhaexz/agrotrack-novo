# Sprint 6 — Telegram: Relatório Diário e Alertas Proativos — HERDON

> Data: 2026-07-05. Escopo: `api/_telegram.js` (novo), `api/telegram-relatorio-diario.js` (novo), `src/domain/telegramRelatorio.js` (novo) + teste, `.env.example` (atualizado). Nenhuma migration, nenhum RLS, nenhum Supabase alterado. `getResumoLote`, DRE, financeiro e simulador **não foram tocados**. Nenhum sistema de alerta paralelo — tudo reaproveita `gerarAlertasUnificados()` (Sprint 5).

---

## 1. Arquivos criados/alterados

| Arquivo | O que é |
|---|---|
| `api/_telegram.js` | Helper server-side: `enviarMensagemTelegram(texto)` (chama a API do Telegram) e `getTelegramEnvStatus()`. Só é importado por functions em `api/` — nunca pelo frontend. |
| `api/telegram-relatorio-diario.js` | Endpoint `POST` protegido por segredo. Busca os dados da conta configurada, monta o `db`, chama `gerarAlertasUnificados` (Sprint 5) e `gerarRelatorioDiarioTelegram`, envia ao Telegram. |
| `src/domain/telegramRelatorio.js` | Formatador puro — recebe a lista já padronizada de alertas e devolve o texto da mensagem. Zero I/O, zero acesso a rede/banco. |
| `src/domain/telegramRelatorio.test.js` | 5 testes (`node --test`) cobrindo agrupamento por prioridade, omissão de dados sensíveis, limite de itens, mensagem de "tudo em dia" e nome da conta no cabeçalho. |
| `.env.example` | 4 variáveis novas documentadas (sem valores reais): `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_REPORT_SECRET`, `TELEGRAM_OWNER_USER_ID`. |

Nenhum arquivo de domínio financeiro/zootécnico foi alterado (`gerarAlertasUnificados`, `getResumoLote`, `alertasInteligentes.js`, `hojeNaFazenda.js` — todos lidos/importados, nenhum editado).

---

## 2. Como o endpoint funciona

```
POST /api/telegram-relatorio-diario
Authorization: Bearer <TELEGRAM_REPORT_SECRET>
Content-Type: application/json
Body (opcional): { "dryRun": true }
```

1. **Rejeita se `TELEGRAM_REPORT_SECRET` não estiver configurado no servidor** (erro `500 MISSING_REPORT_SECRET`) — nunca fica "aberto por omissão".
2. **Exige `Authorization: Bearer <segredo>` batendo exatamente com `TELEGRAM_REPORT_SECRET`** — sem isso, `401 Não autorizado`. Não há nenhuma outra forma de disparar o envio.
3. **Rejeita se faltar `TELEGRAM_BOT_TOKEN` ou `TELEGRAM_CHAT_ID`** (`500 MISSING_TELEGRAM_ENV`).
4. **A conta a consultar vem só de `TELEGRAM_OWNER_USER_ID`** (variável de ambiente do servidor) — o corpo da requisição é ignorado para isso; não existe parâmetro `owner_user_id` aceito no body. Isso evita que alguém com o segredo consiga pedir o relatório de outra conta.
5. Busca (via Supabase admin, `service_role`, sempre filtrado por `.eq('owner_user_id', TELEGRAM_OWNER_USER_ID)`) as tabelas: `lotes`, `animais`, `pesagens`, `movimentacoes_financeiras`, `estoque`, `movimentacoes_estoque`, `tarefas`, `sanitario`, `pastagens` — exatamente as fontes que `gerarAlertasUnificados` já usa (Sprint 5), nada a mais.
6. Chama `gerarAlertasUnificados(db)` → `gerarRelatorioDiarioTelegram(alertas)` → texto final.
7. Com `"dryRun": true` no corpo: devolve o texto formatado em JSON **sem enviar nada ao Telegram** (para testar sem gastar/poluir o chat). Sem `dryRun`, envia de verdade via `enviarMensagemTelegram`.
8. Resposta sempre em JSON, nunca inclui o token nem o segredo, só `{ ok, totalAlertas }` (ou o `mensagem` de preview no modo `dryRun`).

---

## 3. O que a mensagem contém (e o que foi omitido por segurança)

Exemplo de mensagem enviada:

```
📋 HERDON — Relatório de hoje (05/07/2026)

🔴 CRÍTICO
• 2 contas estão vencidas
• 1 item está com estoque crítico

🟡 ATENÇÃO
• 1 pagamento vence hoje
• 3 lotes precisam de pesagem

🟢 DECISÃO
• 1 lote está pronto para avaliar venda

Abra o HERDON para ver detalhes e agir.
```

**Omitido deliberadamente** (regra 7/8 do sprint):
- **Nenhum valor em R$** aparece na mensagem — só contagens ("2 contas...", nunca "R$ 4.320,00 vencidos").
- **Nenhuma descrição individual** de despesa/lote entra na mensagem — o formatador usa só `alerta.titulo` (já um resumo por categoria), nunca `alerta.descricao` (que poderia conter nome de fornecedor ou descrição de lançamento). Coberto por teste (`telegramRelatorio.test.js`).
- **Nenhum nome de fornecedor/comprador.**
- Cada grupo de prioridade mostra no máximo 6 linhas — o excedente vira "+N outro(s) alerta(s) nesta faixa", para a mensagem nunca ficar gigante.
- Itens com `prioridade: 'informativo'` não entram na mensagem (mesmo critério do Dashboard).

---

## 4. Como configurar

### 4.1 Criar o bot no Telegram
1. Abra uma conversa com **@BotFather** no Telegram.
2. Envie `/newbot`, escolha um nome e um username (precisa terminar em `bot`).
3. O BotFather devolve o **token** (formato `123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`) — esse é o `TELEGRAM_BOT_TOKEN`.

### 4.2 Obter o `chat_id`
- **Chat pessoal:** envie qualquer mensagem para o bot recém-criado, depois acesse `https://api.telegram.org/bot<TOKEN>/getUpdates` no navegador — o `chat.id` aparece no JSON de resposta.
- **Grupo:** adicione o bot ao grupo, mande uma mensagem no grupo, e repita o `getUpdates` — o `chat.id` de grupo costuma vir negativo (ex.: `-1001234567890`).

### 4.3 Variáveis de ambiente (Vercel → Project Settings → Environment Variables, nunca no frontend)
```
TELEGRAM_BOT_TOKEN=<token do BotFather>
TELEGRAM_CHAT_ID=<chat_id obtido acima>
TELEGRAM_REPORT_SECRET=<uma string aleatória só sua, ex.: gerada com `openssl rand -hex 32`>
TELEGRAM_OWNER_USER_ID=<uuid do owner_user_id da conta a monitorar>
```
Localmente, adicione as mesmas 4 linhas em `.env.local` (arquivo já é ignorado pelo git — confirmado em `.gitignore`, nunca commitado).

### 4.4 Testar via curl (preview, sem enviar nada)
```bash
curl -X POST "https://SEU-DOMINIO/api/telegram-relatorio-diario" \
  -H "Authorization: Bearer $TELEGRAM_REPORT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'
```
Resposta esperada: `{"ok":true,"dryRun":true,"totalAlertas":N,"mensagem":"📋 HERDON — ..."}`.

### 4.5 Testar envio real
```bash
curl -X POST "https://SEU-DOMINIO/api/telegram-relatorio-diario" \
  -H "Authorization: Bearer $TELEGRAM_REPORT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```
Resposta esperada: `{"ok":true,"totalAlertas":N}` e a mensagem chega no chat configurado.

### 4.6 Exemplo de payload/resposta seguros
```json
// Request
{ "dryRun": true }

// Response 200
{ "ok": true, "dryRun": true, "totalAlertas": 5, "mensagem": "📋 HERDON — Relatório de hoje (05/07/2026)\n\n..." }

// Response 401 (sem o header correto)
{ "ok": false, "message": "Não autorizado." }

// Response 500 (env ausente)
{ "ok": false, "code": "MISSING_TELEGRAM_ENV", "message": "Telegram não está configurado no servidor." }
```
Em nenhuma resposta o `TELEGRAM_BOT_TOKEN` ou `TELEGRAM_REPORT_SECRET` aparecem.

---

## 5. Limitações (documentadas, não implementadas de propósito)

- **Uma conta só por vez.** `TELEGRAM_OWNER_USER_ID` é uma única variável — não existe (ainda) tabela de preferências por usuário/fazenda para múltiplas contas terem seu próprio chat. Ver §6.
- **Sem log persistente de envio.** Não gravei nada em `auditoria` nem em nenhuma tabela nesta sprint (regra 9 do enunciado) — se o envio falhar, só o retorno HTTP registra isso, nada fica salvo no banco. Fica para uma versão futura decidir se vale um log (e se `auditoria` é o lugar certo ou se merece tabela própria — decisão de produto, não técnica).
- **Sem cron automático.** O endpoint é 100% manual/sob demanda (curl, Postman, ou qualquer chamador que tenha o segredo) — nada dispara sozinho.
- **Sem WhatsApp.** Não implementado, como pedido.
- **`getUpdates` para achar o `chat_id` é manual** — não construí nenhuma tela ou fluxo de onboarding para isso; é um passo de configuração feito uma vez, fora do app.

---

## 6. O que fica para o futuro

- **Agendamento automático (cron):** este endpoint já está pronto para ser chamado por um Vercel Cron Job (`vercel.json` → chave `crons`) ou por um serviço externo de agendamento — só falta configurar o disparo periódico. Não configurado nesta sprint (regra 2 do enunciado aprovado).
- **WhatsApp:** mesma arquitetura (`gerarAlertasUnificados` → formatador dedicado → helper de envio) pode ser replicada para WhatsApp Business API quando for priorizado — não é este sprint.
- **Preferências por usuário/fazenda:** para múltiplas contas terem seu próprio `chat_id`/token, seria necessária uma tabela nova (ex.: `notificacoes_config` com `owner_user_id`, `canal`, `destino`) — **migration fora do escopo aprovado desta sprint**, registrada aqui como arquitetura recomendada, não implementada.
- **Log de envio:** se decidido, uma tabela `notificacoes_enviadas` (ou reaproveitar `auditoria`) registraria cada disparo — também fora do escopo aprovado.

---

## 7. Validação

| Comando | Resultado |
|---|---|
| `npm run lint` | ✅ 0 erros (1 erro corrigido durante o desenvolvimento: `fetch` já é global no ambiente de lint, removido do comentário `/* global */` redundante em `api/_telegram.js`) |
| `npm run test` | ✅ 794/794 testes (789 anteriores + 5 novos de `telegramRelatorio.test.js`), 0 falhas |
| `npm run build` | ✅ build ok |
| Token no frontend | ✅ Confirmado — `grep` em `dist/` por `TELEGRAM_BOT_TOKEN`/`TELEGRAM_REPORT_SECRET`/`TELEGRAM_CHAT_ID` não encontra nada (as functions em `api/` não entram no bundle do Vite) |
| Token commitado | ✅ Confirmado — `.env.example` só tem placeholders (`SERVER_ONLY_*`); `.env.local` não foi tocado nesta sprint e já está no `.gitignore` (linha 33) |
| Migration criada | ✅ Nenhuma — `git diff --stat -- supabase/` vazio |
| RLS/Supabase alterado | ✅ Nenhum — só leitura (`select`) filtrada por `owner_user_id`, mesmo padrão de `api/cloud-diagnostic.js` |
| `getResumoLote`/DRE/financeiro/simulador | ✅ Intocados — `git diff --stat` vazio para todos |
| Formatação testada com fixture | ✅ 5 testes automatizados cobrindo agrupamento, omissão de dados sensíveis, limite de itens, estado "tudo em dia" e nome da conta |
| Envio real testado | ⚠️ Não testado nesta sessão — não há `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`/`TELEGRAM_REPORT_SECRET` configurados neste ambiente. Teste manual documentado no §4.4/§4.5 para quando as variáveis forem configuradas na Vercel. |

**Observação sobre o comando de commit:** o comando final fornecido não incluía `src/domain/telegramRelatorio.test.js` (o arquivo de teste criado para validar o formatador). Incluí esse arquivo no commit junto com os demais — deixá-lo de fora significaria perder a verificação automatizada que valida exatamente a regra de não vazar dados sensíveis (§3).
