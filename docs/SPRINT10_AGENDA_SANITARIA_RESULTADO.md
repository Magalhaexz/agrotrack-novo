# Sprint 10 — Agenda Sanitária com Vencimentos

Objetivo: dar ao produtor uma visão real de vacina, vermífugo, carência,
reaplicações e manejos sanitários vencidos ou próximos do vencimento,
alimentando o Motor Único de Alertas (Sprint 5/9) — sem criar um sistema
paralelo.

## 1. Estrutura sanitária encontrada (auditoria)

Consultado diretamente no Postgres (`information_schema.columns`), a tabela
`public.sanitario` já existia com:

| Campo desejado (enunciado) | Existe? | Nome real na tabela |
|---|---|---|
| `tipo_manejo` | ✅ | `tipo` (vacina/vermifugo/medicamento/exame/outro) |
| `produto` | ⚠️ parcial | `desc` (texto livre) + `metadata.item_estoque_id` (link opcional pro item de estoque) — não existe coluna dedicada, mas a informação já é capturada |
| `data_aplicacao` | ✅ | `data_aplic` |
| `data_proxima_aplicacao` | ✅ | `proxima` |
| `data_fim_carencia` | ❌ **faltava** | — (adicionada nesta sprint) |
| `lote_id` | ✅ | `lote_id` |
| `animal_id` | — não existe | Granularidade da tabela é por lote, igual pesagens/custos — consistente com o resto do app, não é uma lacuna |
| `fazenda_id` | ✅ (coluna existe, mas não é preenchida pelo formulário atual — fora do escopo desta sprint) | `fazenda_id` |
| `status` | ⚠️ computado, não guardado | `SanitarioPage.jsx#obterStatus(proxima, alerta_dias_antes)` calcula on-the-fly (vencido/proximo/em-dia/sem-data) — mesmo padrão de outros status derivados no app (ex.: `decisaoVenda`) |
| `observacao` | ✅ | `obs` |

Campos extras já existentes e reaproveitados: `alerta_dias_antes` (janela de
aviso configurável por registro), `funcionario_responsavel_id`,
`rotina_automatica_id` (cria uma tarefa em `db.rotinas` quando há próxima
data + responsável), `metadata` (jsonb, usado para agrupar procedimentos de
um mesmo manejo composto).

### Onde a sanidade já aparecia

- **Dashboard**: `alertasInteligentes.js#detectarSanidadeProxima` já gera
  alertas de manejo vencido/vencendo (lê `sanitario.proxima` +
  `alerta_dias_antes`), entram no Motor Único (`gerarAlertasUnificados`,
  origem `sanidade`) e aparecem na "Central de Alertas Internos".
- **Telegram**: `/lotes`... na verdade sanidade não tinha comando dedicado
  no assistente do Sprint 8, mas já entrava em `/prioridades` e `/relatorio`
  via `gerarAlertasUnificados` (origem `sanidade` não é filtrada por nenhum
  comando específico — só aparece nos agregados gerais).
- **Página Sanitário**: só mostrava o que já foi registrado, numa tabela
  única (`dadosTabela`), sem nenhuma visão agrupada por urgência.

**Conclusão da auditoria:** "manejo sanitário vencido/vencendo" já estava
coberto pelo motor único — não havia nada a duplicar ali. A lacuna real era
**carência** (não existia em nenhum lugar) e a **visão agrupada por janela**
na tela (só existia lista única, sem "vencidos/hoje/7 dias/30 dias").

## 2. Migration — por que foi necessária

Uma migration mínima e justificada:
`supabase/migrations/20260706130000_add_sanitario_carencia_field.sql`

```sql
ALTER TABLE public.sanitario ADD COLUMN IF NOT EXISTS data_fim_carencia date;
```

- Coluna nullable, sem default, sem backfill (impossível inferir carência de
  registros antigos).
- **RLS não muda**: as policies existentes (`sanitario_select_owner`,
  `sanitario_insert_owner`, `sanitario_update_owner`,
  `sanitario_delete_owner` + as `_same_account` equivalentes) filtram por
  `owner_user_id` **por linha**, não por coluna — cobrem a coluna nova
  automaticamente. Confirmado consultando `pg_policies` antes de migrar.
- Aplicada via Supabase MCP (`apply_migration`) e verificada com
  `get_advisors` depois — nenhum novo achado de segurança/RLS relacionado a
  `sanitario`.

Nenhuma tabela nova foi criada.

## 3. Agenda Sanitária (visão nova)

`src/domain/agendaSanitaria.js` (`construirAgendaSanitaria(db)`) — função
pura, bucketiza `db.sanitario` em 6 janelas, sem recalcular nada que os
detectores de alerta já calculam:

- **vencidos** — `proxima` no passado
- **vencendoHoje** — `proxima` = hoje
- **proximos7Dias** — `proxima` em até 7 dias
- **proximos30Dias** — `proxima` em até 30 dias
- **realizados** — últimos 10 registros por `data_aplic` (histórico recente)
- **emCarencia** — `data_fim_carencia` ainda não vencida

Cada item devolve `{ id, tipo, produto, loteNome, dataPrevista, status,
acaoSugerida }` — `produto` vem do campo `desc` (que já é preenchido com o
nome/descrição do procedimento, sem precisar de coluna nova).

Renderizada em `src/pages/SanitarioPage.jsx`, num novo card "Agenda
Sanitária" (6 seções lado a lado, até 5 itens por seção + contador do
restante) — **aditivo**: a tabela existente, o formulário e o planejamento
IATF não foram alterados.

## 4. Alertas novos no Motor Único

`src/domain/alertasUnificados.js` ganhou `agruparCarenciaAtiva(db, hoje)`:

- **`carencia-ativa`** (atenção) — lote com `data_fim_carencia` a mais de 3
  dias no futuro. Ação sugerida: "Não vender ou abater até o fim da
  carência."
- **`carencia-vencendo`** (atenção) — `data_fim_carencia` dentro de 3 dias.
  Ação sugerida: "Confirmar o fim da carência antes de liberar a venda."

"Manejo sanitário vencido/vencendo" **não foi duplicado** — continua vindo
só de `alertasInteligentes.js#detectarSanidadeProxima`, sem nenhuma
alteração. A carência é um sinal novo e complementar (nenhum dos dois
sistemas de alerta cobria isso antes desta sprint).

## 5. Impacto no Dashboard

Nenhuma mudança de código no Dashboard. `gerarAlertasUnificados` agora pode
devolver até 2 itens a mais (`carencia-ativa`/`carencia-vencendo`, origem
`sanidade`, prioridade `atencao`) — a "Central de Alertas Internos" já sabe
exibir qualquer item com essa prioridade/origem sem nenhum código novo
(`ORIGEM_LABEL.sanidade` já existe). Build confirma que `DashboardPage.jsx`
compila sem alteração.

## 6. Impacto no Telegram

Nenhuma mudança de código. `api/telegram-webhook.js` e
`api/telegram-relatorio-diario.js` continuam importando
`gerarAlertasUnificados` sem alteração de assinatura — os novos alertas de
carência aparecem automaticamente em `/relatorio`, `/prioridades` e no
relatório diário agendado, formatados pelo mesmo `telegramRelatorio.js` de
sempre (agrupa por prioridade, não por tipo).

## Limitações

- `produto` continua sem coluna dedicada — depende do texto livre em `desc`
  (ou do item de estoque vinculado via `metadata`). Suficiente para exibição,
  mas não permite filtrar/relatar por produto de forma estruturada.
- Sem backfill: registros sanitários antigos não têm `data_fim_carencia` e
  nunca vão aparecer em "Em carência" — só manejos cadastrados/editados a
  partir de agora com esse campo preenchido.
- `fazenda_id`/`status` existem como colunas na tabela mas continuam sem
  serem preenchidos pelo formulário — não fazia parte do escopo desta
  sprint (nenhum consumidor hoje depende deles).
- Card "Agenda Sanitária" mostra só os 5 itens mais próximos por seção (evita
  poluir a tela) — o restante segue disponível na tabela completa abaixo.

## Validação

- lint: 0 erros
- testes: 823 passando (10 novos — `agendaSanitaria.test.js` +
  `alertasUnificados.test.js` cobrindo carência)
- build: ok
- migration aplicada (`add_sanitario_carencia_field`), confirmada via
  `information_schema.columns`; RLS não alterado (confirmado via
  `pg_policies` antes e `get_advisors` depois — nenhum novo achado)
- `getResumoLote`, DRE, financeiro, simulador e domínio pecuário: **não
  alterados**
- `DashboardPage.jsx` compila sem alteração de código
- Telegram (`telegram-webhook.js`, `telegram-relatorio-diario.js`) continua
  importando `gerarAlertasUnificados` sem mudança de assinatura
