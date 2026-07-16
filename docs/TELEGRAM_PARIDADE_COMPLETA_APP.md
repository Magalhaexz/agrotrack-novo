# Paridade completa App ↔ Telegram (HERDON)

Matriz de auditoria de **todas** as operações do aplicativo, cruzadas com a
cobertura real do bot do Telegram. Substitui/atualiza
`docs/TELEGRAM_PARIDADE_FUNCIONAL_HERDON.md` (mantido por histórico) como
fonte de verdade a partir desta sprint.

**Atualizado na Sprint Paridade 1** (base `53f6bec`, commits desta rodada
adiante) — ver seção "Sprint Paridade 1" ao final para o que mudou nesta
rodada especificamente. As linhas afetadas foram atualizadas in-line nas
tabelas abaixo; o resto da matriz (auditoria original) permanece como
estava.

**Este documento é um checkpoint de auditoria, não uma declaração de
paridade completa.** Ele mapeia o que existe, não implementa nada por si
só — a implementação dos gaps listados aqui é trabalho de sprints
seguintes.

Legenda de coluna **Telegram**: ✅ coberto · 🟡 parcial (existe mas
incompleto/simplificado) · ⛔ ausente · 🔒 nunca deve ser automatizado
(dinheiro, credencial, ou operação sensível de acesso).

Legenda de coluna **Validação real**: todas as linhas estão marcadas
**⛔ pendente** — nenhuma operação, nova ou antiga, foi validada num
Telegram real nesta sessão (sem acesso a conta/bot ao vivo neste
ambiente). Teste automatizado ≠ validação real; ver seção final.

Metodologia: 5 auditorias paralelas sobre o código-fonte (não sobre
suposição), cobrindo Fazendas/Lotes/Pesagens/Pastagens,
Estoque/Suplementação/Sanidade, Financeiro/Custos/Assinatura,
Tarefas/Rotinas/Calendário/Alertas e Equipe/Configurações/Relatórios.
Permissões verificadas contra `src/auth/perfis.js`. Intenções do Telegram
verificadas contra `src/domain/telegram/interpretarComandoTelegram.js` e
`src/domain/telegram/catalogoIntencoes.js` no commit `25db95a`.

---

## Fazendas

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Listar fazendas | Consulta | `fazendas:ver` | inline `FazendasPage.jsx:79-85` | ✅ `LISTAR_FAZENDAS` | ✅ | ⛔ |
| Cadastrar fazenda | Escrita | `fazendas:editar` | `FazendasPage.jsx:132-194` | ✅ `CADASTRAR_FAZENDA` (Sprint Paridade 1) — nome/cidade/estado; **não valida limite de fazendas do plano**, mesma lacuna de RLS já documentada (BM-30) | ✅ | ⛔ |
| Editar fazenda (nome) | Escrita | `fazendas:editar` | `FazendasPage.jsx:92-131` | 🟡 `RENOMEAR_FAZENDA` (Sprint Paridade 1) — só o nome; demais campos (cidade/estado/hectares) seguem sem edição via bot | ✅ | ⛔ |
| Excluir fazenda | Escrita | `fazendas:editar` (sem `fazendas:excluir` dedicado — gap de modelo de permissão) | `FazendasPage.jsx:196-281`, bloqueia se houver lotes/animais/estoque vinculados | ⛔ — deliberadamente não implementado (ação destrutiva, alto risco, deixada para decisão de produto antes de automatizar) | — | ⛔ |
| Trocar fazenda ativa | Consulta/nav | nenhuma (cross-cutting) | `AppHeader.jsx:337-374` | ✅ `SELECIONAR_FAZENDA` | ✅ | ⛔ |
| Visão consolidada ("Todas as fazendas") | Consulta | nenhuma | `escopoFazenda.js:10-15` | ⛔ | — | ⛔ |
| Sincronizar/diagnóstico/reconectar nuvem | Escrita/edge | `fazendas:editar` + dev | `FazendasPage.jsx:316-667` | ⛔ (fora de escopo — dev-only) | — | — |

**Fazendas: 6 operações-núcleo, 4 cobertas (total ou parcial) = ~67%** (era ~33%).

## Lotes

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Listar lotes | Consulta | `lotes:ver` | `LotesPage.jsx:856-947` | ✅ `LISTAR_LOTES` | ✅ | ⛔ |
| Ver detalhe (9 abas) | Consulta | `lotes:ver` | `LoteDetailsPanel.jsx` + 9 tabs | 🟡 `VER_LOTE` (resumo, não as 9 abas) | ✅ | ⛔ |
| Cadastrar lote | Escrita | `lotes:editar` | `LotesPage.jsx:650-717`; auto-cria `animais` grupo + pesagem inicial (`lotesLogic.js:137-182`) | 🟡 `CADASTRAR_LOTE` — **não replica os 2 side-effects automáticos do app** (grupo `animais` e pesagem inicial); Resultado/Decisão de venda podem mostrar "dados insuficientes" para um lote criado via bot | ✅ | ⛔ |
| Editar lote | Escrita | `lotes:editar` | `LotesPage.jsx:604-648` | ⛔ | — | ⛔ |
| Ajuste de lotação | Escrita | `lotes:editar` | `lotesLogic.js:192-220` | ⛔ | — | ⛔ |
| Venda | Escrita | `animais:movimentar` | `services/movimentacoes.js:302-470` | ✅ `REGISTRAR_VENDA` | ✅ | ⛔ |
| Morte/perda | Escrita | `animais:movimentar` | idem, tipoSaida `morte`/`descarte` | ✅ `REGISTRAR_MORTE` | ✅ | ⛔ |
| Transferência de saída / entre lotes | Escrita | `animais:movimentar` | `movimentacoes.js:170-291,325-381` | ✅ `TRANSFERIR_ANIMAIS_ENTRE_LOTES` | ✅ | ⛔ |
| Trocar lote de pasto | Escrita | `lotes:editar` | RPC `mover_lote_para_pasto` (app) / espelhado em JS (bot, ver nota `acoesPasto.js`) | ✅ `TROCAR_LOTE_PASTO` | ✅ | ⛔ |
| Finalizar lote | Escrita | `lotes:editar` | `LotesPage.jsx:446-472`, `lotesLogic.js:228-240` | ✅ `FINALIZAR_LOTE` | ✅ | ⛔ |
| Histórico do lote | Consulta | `lotes:ver` | inline + `movimentacaoPastos.js:83-93` | 🟡 (via `VER_LOTE`/`RESUMO`, não histórico completo) | — | ⛔ |
| Custos (aba financeiro do lote) | Consulta | `lotes:ver` | `LoteFinanceiroTab.jsx` | 🟡 (via `CONSULTAR_FINANCEIRO` com filtro lote) | ✅ | ⛔ |
| Resultado (margem, custo/lucro por @) | Consulta | `lotes:ver`/`resultados:ver` | `resumoLote.js`, `calculations.js` | ✅ `CONSULTAR_RESULTADO_LOTE` (Sprint Paridade 1) — reaproveita `getResumoLote` direto, mesma fonte da página | ✅ | ⛔ |
| Quantidade/peso/GMD | Consulta | `lotes:ver` | `calculateGmd30` (triplicado, ver achados) | 🟡 (via `VER_LOTE`/`VER_PESAGENS`) | — | ⛔ |
| Nova pesagem a partir do lote | Escrita | `pesagens:editar` | `LotesPage.jsx:558-593` (versão simplificada) | ✅ `REGISTRAR_PESAGEM` (fluxo genérico, não o específico do lote) | ✅ | ⛔ |
| Relatório do lote / compartilhar (WhatsApp) | Consulta | `lotes:ver`/`relatorios:ver` | `relatorioLote.js`, `whatsappResumo.js::gerarResumoLoteTexto` | ⛔ — **gerador de texto já existe e é reaproveitável** para um comando "enviar relatório do lote" | — | ⛔ |

**Lotes: 17 operações, 9 cobertas (parcial ou total) = ~53%** (era ~47%). Edição de lote (nome/sexo/raça/peso inicial/data/pasto/observação) e ajuste de lotação seguem sem cobertura — deferidos para o próximo bloco.

## Pesagens

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Histórico/última/GMD | Consulta | `pesagens:ver` | `PesagensPage.jsx:897-941` | ✅ `VER_PESAGENS` | ✅ | ⛔ |
| Nova pesagem (simples) | Escrita | `pesagens:editar` | `PesagensPage.jsx:725-807` | ✅ `REGISTRAR_PESAGEM` | ✅ | ⛔ |
| Nova pesagem (batch/individual por lote) | Escrita | `pesagens:editar` | `PesagensPage.jsx:483-723` / duplicado em `AcompanhamentoPesoPage.jsx` | ⛔ (bot só cobre o fluxo simples) | — | ⛔ |
| Editar pesagem | Escrita | `pesagens:editar` | `PesagensPage.jsx:339-346,725-772` | ⛔ — avaliado e adiado na Sprint Paridade 1: exige extrair `recalculateLoteFromPesagens` (hoje inline na página, não é módulo de domínio) antes de replicar no bot | — | ⛔ |
| Excluir/cancelar pesagem | Escrita | `pesagens:excluir` | `PesagensPage.jsx:348-402` | ⛔ — mesma decisão de adiamento acima | — | ⛔ |
| Lotes sem pesagem recente | Consulta | `pesagens:ver` | `hojeNaFazenda.js:22-29` (duplicado inline em `PesagensPage.jsx`) | 🟡 (aparece dentro de `VER_ALERTAS`, não como consulta dedicada) | — | ⛔ |
| Evolução/gráfico de peso | Consulta | `animais:ver` | `AcompanhamentoPesoPage.jsx` + `PesoChart.jsx` | ⛔ | — | ⛔ |

**Pesagens: 7 operações, 3 cobertas = ~43%.**

## Pastagens

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Listar pastos | Consulta | `pastagens:ver` | `PastagensPage.jsx:431-501` | ✅ `LISTAR_PASTOS` (Sprint Paridade 1) — reaproveita `calcularOcupacaoPastos` (`ocupacaoPastos.js`), mesma fonte da página | ✅ | ⛔ |
| Cadastrar pasto | Escrita | `pastagens:editar` | `PastagensPage.jsx:208-227` | ✅ `CADASTRAR_PASTO` | ✅ | ⛔ |
| Editar pasto | Escrita | `pastagens:editar` | `PastagensPage.jsx:188-207` | ⛔ | — | ⛔ |
| Excluir/inativar pasto | Escrita | `pastagens:excluir` | `PastagensPage.jsx:232-256` (sem guarda de lote vinculado, diferente de Fazendas) | ⛔ | — | ⛔ |
| Capacidade (UA/ha, diagnóstico) | Consulta | `pastagens:ver` | `unidadeAnimal.js:25-43` | ⛔ | — | ⛔ |
| Ocupação/lotação por pasto | Consulta | `pastagens:ver` | `ocupacaoPastos.js:55-120` | ⛔ | — | ⛔ |
| Histórico de movimentações | Consulta | — | `movimentacaoPastos.js:83-93` | ⛔ | — | ⛔ |
| Retirar/mover lote de pasto | Escrita | `lotes:editar` | (mesma op de Lotes, ver acima) | ✅ `TROCAR_LOTE_PASTO` | ✅ | ⛔ |
| Listar pastos vazios | Consulta | `relatorios:ver` | `ocupacaoPastos.js:17-19`, `hojeNaFazenda.js:103-137` | ⛔ | — | ⛔ |
| Listar pastos sobrecarregados | Consulta | `relatorios:ver` | `relatorios.js::buildRelatorioPastagens` | ⛔ | — | ⛔ |

**Pastagens: 9 operações-núcleo (excluindo o histórico morto de fazenda), 3 cobertas = ~33%** (era ~22%). Cadastrar/editar/inativar pasto e capacidade/ocupação detalhada por pasto seguem sem cobertura.

## Estoque

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Consultar estoque/item | Consulta | `estoque:ver` | `EstoquePage.jsx:127-170` | ✅ `CONSULTAR_ESTOQUE` | ✅ | ⛔ |
| Cadastrar item novo | Escrita | `estoque:editar` | `EstoquePage.jsx:491-595` | ✅ `CADASTRAR_ITEM_ESTOQUE` | ✅ | ⛔ |
| Editar item | Escrita | `estoque:editar` | mesmo modal, ramo update | ⛔ | — | ⛔ |
| Entrada | Escrita | `estoque:editar` | `EstoquePage.jsx:597-720` (duplica `movimentacoes.js::registrarEntradaEstoque`) | ✅ `REGISTRAR_ENTRADA_ESTOQUE` | ✅ | ⛔ |
| Saída/consumo | Escrita | `estoque:editar` | `EstoquePage.jsx:722-873` | ✅ `DAR_BAIXA_ESTOQUE` | ✅ | ⛔ |
| Ajuste (tipo distinto de consumo/perda/venda) | Escrita | `estoque:editar` | `acoesEstoque.js` já aceita `tipo:'ajuste'` no domínio, mas o bot nunca pergunta/permite escolher o tipo | 🟡 (domínio suporta, UX do bot não expõe) | — | ⛔ |
| Baixa (== saída) | Escrita | `estoque:editar` | idem | ✅ (mesma intenção acima) | ✅ | ⛔ |
| Cancelamento/estorno de movimentação | Escrita | — | **não existe no app** (achado da auditoria — nenhum delete/reverse de `movimentacoes_estoque`) | ⛔ (nada a espelhar — gap do próprio app) | — | ⛔ |
| Listar movimentações (histórico) | Consulta | `estoque:ver` | `EstoquePage.jsx:180-188,446-458` | ⛔ | — | ⛔ |
| Mínimo (quantidade_minima) | Escrita (campo) | `estoque:editar` | campo do form | ⛔ (bot não pergunta) | — | ⛔ |
| Validade | Escrita (campo) | `estoque:editar` | campo do form | ⛔ | — | ⛔ |
| Previsão de término | Consulta | `estoque:ver` | `previsaoConsumoEstoque.js:35-62` | ⛔ | — | ⛔ |
| Custo (unitário/total) | Consulta | `estoque:ver` | inline | 🟡 (aparece em algumas respostas de confirmação, não como consulta dedicada) | — | ⛔ |

**Estoque: 12 operações reais (excluindo estorno, que não existe no app), 6 cobertas = ~50%.**

## Suplementação

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Planejamento (campos no lote, Bloco 4) | Escrita | `estoque:editar` no app **(⚠️ `suplementacao:editar` é só o gate do bot — o app real usa `estoque:editar`, ver achado abaixo)** | `LoteForm.jsx:551-627` | ✅ `CADASTRAR_PLANEJAMENTO_SUPLEMENTACAO` | ✅ | ⛔ |
| Planejamento — "Dietas" (mecanismo concorrente) | Escrita | sem gate no botão salvar | `SuplementacaoPage.jsx:702-815` — **só local, não sincroniza com a nuvem** | ⛔ (e não deveria ser espelhado — é um recurso incompleto do próprio app) | — | ⛔ |
| Edição do planejamento | Escrita | `estoque:editar` | | 🟡 (reenviar o cadastro atualiza os mesmos campos, não é uma "edição" com UX própria) | — | ⛔ |
| Cancelamento do planejamento | Escrita | — | não existe deleção, só edição | ⛔ | — | ⛔ |
| Consumo (registrar) | Escrita | `estoque:editar` | `SuplementacaoConsumoModal.jsx:242-367` | ✅ `REGISTRAR_CONSUMO_SUPLEMENTACAO` | ✅ | ⛔ |
| Edição do consumo | Escrita | `estoque:editar` | mesmo modal, ramo update | ⛔ | — | ⛔ |
| Exclusão do consumo | Escrita | `estoque:editar` | `SuplementacaoPage.jsx::excluirConsumo` (correta) **vs** `LotesPage.jsx::handleExcluirHistoricoConsumo` (não devolve estoque — bug, ver achados) | ⛔ | — | ⛔ |
| Estorno | Escrita | (é a exclusão acima) | ver acima | ⛔ | — | ⛔ |
| Custo | Consulta | `estoque:ver` | `getConsumptionCost` | 🟡 (aparece na confirmação, não como consulta) | — | ⛔ |
| Estoque (vínculo/baixa) | Escrita | `estoque:editar` | inline em `salvar()` | ✅ (parte de `REGISTRAR_CONSUMO_SUPLEMENTACAO`) | ✅ | ⛔ |
| Histórico | Consulta | `estoque:ver` | `SuplementacaoPage.jsx:426-483` | ⛔ | — | ⛔ |
| Duração/cobertura estimada | Consulta | `estoque:ver` | `previsaoConsumoEstoque.js:72-100` (com gap documentado próprio) | ⛔ | — | ⛔ |

**Suplementação: 10 operações reais (excluindo a "Dietas" órfã), 3 cobertas = ~30%.**

## Sanidade

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Agenda (hoje/7d/30d) | Consulta | `sanitario:ver` | `agendaSanitaria.js:39-91` | 🟡 (via `VER_MANEJOS`, sem os buckets da agenda) | ✅ | ⛔ |
| Atrasados / vencendo / em carência | Consulta | `sanitario:ver` | idem | 🟡 | — | ⛔ |
| Cadastrar manejo | Escrita | `sanitario:editar` | `SanitarioPage.jsx:371-457` | ✅ `CADASTRAR_MANEJO` | ✅ | ⛔ |
| Editar manejo | Escrita | `sanitario:editar` | `SanitarioPage.jsx:292-369` | ⛔ | — | ⛔ |
| Concluir | — | — | **não existe no app** (não há status "concluído" distinto) | ⛔ (nada a espelhar) | — | ⛔ |
| Cancelar | — | — | **não existe de fato no app** (só texto livre no IATF) | ⛔ (nada a espelhar) | — | ⛔ |
| Excluir manejo | Escrita | `sanitario:excluir` | `SanitarioPage.jsx:175-236` (reverte estoque 100%) | ⛔ | — | ⛔ |
| Vacinação/vermifugação/tratamento (tipo) | Escrita (campo) | `sanitario:editar` | `normalizarTipo` | ✅ (parte de `CADASTRAR_MANEJO`, detecta pelo verbo) | ✅ | ⛔ |
| Carência | Escrita (campo) | `sanitario:editar` | `data_fim_carencia` | 🟡 — **bot não pergunta** (limitação documentada nesta sprint) | — | ⛔ |
| Próxima dose | Escrita (campo) | `sanitario:editar` | `proxima` | 🟡 — **bot não pergunta** (idem) | — | ⛔ |
| Estoque (baixa automática, BM-02) | Escrita | `sanitario:editar` | `domain/estoqueSanidade.js` + `services/estoqueSanidade.js` — **confirmado corrigido e funcionando** | ✅ (mesma regra `calcularBaixaSanitaria` reaproveitada em `cadastroManejo.js`) | ✅ | ⛔ |
| Custo | Consulta | `sanitario:ver` | **não existe nem no app** (sem coluna de custo visível na tela/export) | ⛔ (nada a espelhar) | — | ⛔ |
| Histórico por lote | Consulta | `sanitario:ver` | `LoteSanitarioTab.jsx` (só leitura) | 🟡 (via `VER_MANEJOS`) | — | ⛔ |

**Sanidade: 10 operações reais (excluindo concluir/cancelar/custo, que não existem no app), 5 cobertas = ~50%.**

## Financeiro

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Receitas / despesas (ver + criar) | Consulta+Escrita | `financeiro:ver`/`financeiro:editar` | `FinanceiroPage.jsx:719-798` | ✅ `CADASTRAR_RECEITA`/`CADASTRAR_DESPESA`/`CONSULTAR_FINANCEIRO` | ✅ | ⛔ |
| Saldo | Consulta | `financeiro:ver` | `financeiroDreLogic.js::computeDRE` | ✅ (parte de `CONSULTAR_FINANCEIRO`) | ✅ | ⛔ |
| DRE completo (mensal, por categoria) | Consulta | `financeiro:ver` | `computeDRE()` | ⛔ | — | ⛔ |
| Fluxo de caixa | Consulta | `financeiro:ver` | `fluxoCaixa.js::calcularFluxoCaixa` | ⛔ | — | ⛔ |
| Vencidos / a vencer | Consulta | `financeiro:ver` | `hojeNaFazenda.js::listarContasFinanceiras` | ✅ (filtros `vencida`/`hoje`/`semana` de `CONSULTAR_FINANCEIRO`) | ✅ | ⛔ |
| Custo por lote / resultado por lote | Consulta | `financeiro:ver` | `FinanceiroPage.jsx:100-125,313-368` | 🟡 (via filtro lote de `CONSULTAR_FINANCEIRO`, sem o detalhe de margem) | — | ⛔ |
| Editar lançamento | Escrita | `financeiro:editar` (permissão existe, **sem UI correspondente na aba Lançamentos**) | — | ⛔ (nada a espelhar — gap do próprio app) | — | ⛔ |
| Excluir lançamento avulso | Escrita | `financeiro:excluir` (idem — só via Custos quando `origem='custo'`) | — | ⛔ (idem) | — | ⛔ |
| Registrar pagamento diário | Escrita | `financeiro:editar` | `FinanceiroPage.jsx:246-279` | ⛔ | — | ⛔ |
| Marcar pago / marcar recebido | Escrita | `financeiro:editar` | `FinanceiroPage.jsx:281-311` | ⛔ | — | ⛔ |
| Filtrar por período/categoria/lote | Consulta | `financeiro:ver` | `FinanceiroPage.jsx:68,153-162` | 🟡 (parcial — só os filtros já suportados por `CONSULTAR_FINANCEIRO`) | — | ⛔ |
| Relatório Financeiro (exportável) | Consulta | `relatorios:ver` | `RelatorioFinanceiroPage.jsx` + `whatsappResumo.js::gerarResumoFinanceiroTexto` | ⛔ — **gerador de texto já existe, reaproveitável** | — | ⛔ |

**Financeiro: 12 operações, 4 cobertas (parcial ou total) = ~33%.**

## Custos

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Consultar custos (lista, resumo) | Consulta | `financeiro:ver` | `CustosPage.jsx:83-117` | 🟡 (via `CONSULTAR_FINANCEIRO`, sem a visão dedicada) | — | ⛔ |
| Cadastrar custo | Escrita | `custos:editar` | `CustosPage.jsx:189-275`, espelha em `movimentacoes_financeiras` (`origem:'custo'`) | ⛔ (bot usa `CADASTRAR_DESPESA` genérico, não a tabela `custos`) | — | ⛔ |
| Editar custo | Escrita | `custos:editar` | `CustosPage.jsx:189-238` | ⛔ | — | ⛔ |
| Excluir custo | Escrita | `custos:excluir` | `CustosPage.jsx:148-183` (única forma de excluir uma `movimentacoes_financeiras`) | ⛔ | — | ⛔ |
| Vincular a lote/fazenda | Escrita (campo) | `custos:editar` | form | 🟡 (despesa/receita do bot já tem lote opcional) | ✅ | ⛔ |
| Rateio de custo compartilhado entre lotes | Escrita | `financeiro:editar` | `custosCompartilhados.js::aplicarRateioCustoCompartilhado` | ⛔ | — | ⛔ |
| Total por categoria/lote/período | Consulta | `financeiro:ver` | `CustosPage.jsx:102-110` | ⛔ | — | ⛔ |

**Custos: 7 operações, 1 parcialmente coberta = ~14%.**

## Tarefas

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Consultar hoje/atrasadas/próximas | Consulta | `tarefas:ver` | inline `TarefasPage.jsx:62-81,288-295` | ⛔ — **gap real, sem consulta dedicada** | — | ⛔ |
| Cadastrar tarefa | Escrita | `tarefas:editar` | `TarefasPage.jsx:107-152` | ✅ `CADASTRAR_TAREFA` | ✅ | ⛔ |
| Editar tarefa | Escrita | `tarefas:editar` | idem | ⛔ | — | ⛔ |
| Concluir | Escrita | `tarefas:editar` | `TarefasPage.jsx:229` | ⛔ | — | ⛔ |
| Reabrir | Escrita | `tarefas:editar` | `TarefasPage.jsx:230` | ⛔ | — | ⛔ |
| Adiar/reagendar | Escrita | `tarefas:editar` | `TarefasPage.jsx:231-240` | ⛔ | — | ⛔ |
| Cancelar | — | — | **não existe como status** no app | ⛔ (nada a espelhar) | — | ⛔ |
| Excluir | Escrita | `tarefas:excluir` | `TarefasPage.jsx:154-179` | ⛔ | — | ⛔ |
| Recorrência | — | — | **não existe na tabela `tarefas`** — só em `rotinas`/`eventos_operacionais` | ⛔ (nada a espelhar aqui) | — | ⛔ |

**Tarefas: 7 operações reais, 1 coberta = ~14%.**

## Rotinas (tabela `rotinas`, distinta de Tarefas)

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Consultar hoje/atrasadas/próximas | Consulta | `sanitario:ver` (gate de página) | `RotinaPage.jsx:61-101` | ⛔ | — | ⛔ |
| Criar rotina (avulsa/recorrente) | Escrita | **sem checagem de permissão de escrita na página** (achado de segurança) | `RotinaPage.jsx:152-188` | ⛔ | — | ⛔ |
| Editar rotina | Escrita | idem | `RotinaPage.jsx:152-188` | ⛔ | — | ⛔ |
| Excluir rotina | Escrita | idem | `RotinaPage.jsx:127-150` | ⛔ | — | ⛔ |
| Concluir/reabrir (hoje) | Escrita | idem | `RotinaPage.jsx:190-231` | ⛔ | — | ⛔ |
| Recorrência diária/semanal | Escrita/config | idem | `RotinaForm.jsx:8-11` | ⛔ | — | ⛔ |
| Recorrência quinzenal/mensal/anual | — | — | motor existe (`calendarioOperacionalLogic.js:23-37`) mas **a UI de cadastro não oferece essas opções** | ⛔ (nada a espelhar — gap do próprio app) | — | ⛔ |

**Rotinas: 0 de 6 operações reais cobertas pelo Telegram = 0%.**

## Calendário Operacional (tabela `eventos_operacionais`)

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Consultar eventos do dia/próximos | Consulta | `sanitario:ver` | `CalendarioOperacionalPage.jsx:118-128` | ⛔ | — | ⛔ |
| Criar evento | Escrita | **sem checagem de permissão** (mesmo achado de Rotinas) | `CalendarioOperacionalPage.jsx:451-533` | ⛔ | — | ⛔ |
| Editar evento | Escrita | idem | `CalendarioOperacionalPage.jsx:60-63,501-533` | ⛔ | — | ⛔ |
| Excluir evento | Escrita | idem | `CalendarioOperacionalPage.jsx:70-94` | ⛔ | — | ⛔ |
| Recorrência (semanal/quinzenal/mensal/anual) | Escrita/config | idem | `calendarioOperacionalLogic.js:46-73` | ⛔ | — | ⛔ |

**Calendário: 0 de 5 operações cobertas = 0%.**

## Alertas

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Listar alertas (motor unificado) | Consulta | `dashboard:ver` | `alertasUnificados.js::gerarAlertasUnificados` | ✅ `VER_ALERTAS` | ✅ | ⛔ |
| Somente críticos | Consulta | `dashboard:ver` | `centralAlertas.js::filtrarAlertasCentral` | 🟡 (bot mostra os primeiros 8, sem filtro explícito) | — | ⛔ |
| Por lote/fazenda | Consulta | `dashboard:ver` | `AlertasPage.jsx:151-183` | 🟡 (recorte por fazenda ativa já existe; por lote não) | — | ⛔ |
| Vencidos/vencendo hoje/próx. 7-30d | Consulta | `dashboard:ver` | `centralAlertas.js::classificarPrazo` | 🟡 (o bot lista, sem separar por janela) | — | ⛔ |
| Resumo (total/críticos/vencidos) | Consulta | `dashboard:ver` | `centralAlertas.js::resumirCentralAlertas` | 🟡 (contagem simples no cabeçalho da resposta) | — | ⛔ |
| Marcar "em análise" | Escrita | `tarefas:editar` | `AlertasPage.jsx:194-226` → `alertas_tratativas` | ⛔ — **gap real: bot só lê, nunca trata** | — | ⛔ |
| Resolver | Escrita | `tarefas:editar` | `AlertasPage.jsx:228-235` | ⛔ | — | ⛔ |
| Ignorar | Escrita | `tarefas:editar` | `AlertasPage.jsx:237-244` | ⛔ | — | ⛔ |
| Adiar | Escrita | `tarefas:editar` | `AlertasPage.jsx:246-264` | ⛔ | — | ⛔ |
| Histórico (resolvidos/ignorados) | Consulta | `dashboard:ver` | filtro "Histórico" na Central | ⛔ | — | ⛔ |
| Executar ação recomendada | — | — | **não existe execução direta nem no app** (só navegação manual) | ⛔ (nada a espelhar) | — | ⛔ |

**Alertas: 8 operações reais (excluindo a execução que não existe), 1 coberta = ~13%.**

> **Achado importante**: existem **dois motores de alerta coexistindo** —
> o novo/autoritativo (`alertasUnificados.js`+`centralAlertas.js`,
> usado pela Central **e** pelo Telegram) e um **legado ainda ativo**
> dentro do `DashboardPage.jsx` (`utils/alerts.js`, resolver/adiar
> gravando em `alertas_resolvidos`/`alertas_adiados`, tabelas
> **diferentes** de `alertas_tratativas`). Um alerta resolvido no
> Dashboard antigo não aparece como resolvido na Central nem no bot, e
> vice-versa. Antes de o bot ganhar ação de "resolver/adiar", os dois
> motores precisam ser unificados — do contrário o bot criaria uma
> **terceira** fonte de verdade de tratativa.

## Equipe e Permissões

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Consultar equipe | Consulta | `acessos:gerenciar` | `EquipePage.jsx:60-81` | ⛔ | — | ⛔ |
| Consultar próprio perfil/papel | Consulta | `perfil:ver` | `PerfilPage.jsx:52` | ⛔ | — | ⛔ |
| Consultar matriz de permissões | Consulta | `acessos:gerenciar` | `equipe.js::listarResumosPermissoesPerfil` | ⛔ | — | ⛔ |
| Convidar membro | Escrita | `acessos:gerenciar` | `EquipePage.jsx:192-218` | 🔒 **nunca deve ser automatizado pelo bot** | — | — |
| Alterar papel | Escrita | `acessos:gerenciar` | `EquipePage.jsx:102-128` | 🔒 sensível — recomendado nunca automatizar | — | — |
| Remover/reativar acesso | Escrita | `acessos:gerenciar` | `EquipePage.jsx:130-155` (reativar não existe nem na UI) | 🔒 sensível | — | — |

**Equipe: 6 operações mapeadas, 0 cobertas — a maioria marcada como fora de escopo por segurança (🔒), não como pendência a implementar.**

## Assinatura

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Consultar plano/status | Consulta | `assinatura:gerenciar` | `subscriptions.js::getSubscriptionDisplayCopy` | ⛔ | — | ⛔ |
| Consultar limites/uso | Consulta | `assinatura:gerenciar` | `planos.js::obterResumoUso` | ⛔ | — | ⛔ |
| Consultar planos disponíveis | Consulta | `assinatura:gerenciar` | `subscriptions.js::getAvailablePlans` | ⛔ | — | ⛔ |
| Escolher plano / checkout (Asaas) | Escrita — dinheiro real | `assinatura:gerenciar` | `MinhaAssinaturaPage.jsx:139-240` → Asaas | 🔒 **nunca automatizável — bot deve só devolver o link do app** | — | — |
| Abrir link de pagamento pendente | Escrita (nav) | `assinatura:gerenciar` | `MinhaAssinaturaPage.jsx:122-131` | 🔒 idem | — | — |

**Assinatura: 3 operações de consulta seriam elegíveis para o bot (nenhuma coberta hoje); as 2 de pagamento ficam permanentemente fora de escopo.**

## Configurações

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Configurações gerais (moeda, unidade, rendimento carcaça) | Consulta+Escrita | `configuracoes:ver`/`:editar` | `ConfiguracoesPage.jsx:176-217` | ⛔ (fora de escopo natural para um bot de mensagens) | — | — |
| Preferências de notificação | Escrita | `configuracoes:editar` | `ConfiguracoesPage.jsx:219-259` | ⛔ | — | — |
| Conectar/desconectar Telegram | Escrita | (nenhuma checagem) | `ConfiguracoesPage.jsx:111-149` | ⛔ (é pré-requisito do bot, não uma operação a espelhar) | — | — |
| Backup (exportar/importar/limpar dados) | Escrita | `dados:importar`/`dados:limpar` | `ConfiguracoesPage.jsx:261-429` | 🔒 destrutivo/sensível — nunca automatizar | — | — |
| Perfil pessoal / senha / logout | Escrita | `perfil:ver` | `PerfilPage.jsx` | 🔒 credenciais — nunca automatizar | — | — |

**Configurações: nenhuma operação é uma boa candidata a comando de bot — módulo majoritariamente fora de escopo por natureza (config de sistema, credenciais, dados destrutivos).**

## Relatórios e Exportações

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Relatório do Lote / Pesagens / Financeiro / Pastagens / Resumo Geral (ver) | Consulta | `relatorios:ver` | 5 páginas `Relatorio*Page.jsx` | 🟡 (versões resumidas já existem via `VER_LOTE`/`CONSULTAR_FINANCEIRO`/`RESUMO`; os textos completos de `whatsappResumo.js` são reaproveitáveis) | ✅ (geradores de texto testados) | ⛔ |
| Exportar CSV/PDF (Lote/Pesagens/Financeiro/Pastagens/Resumo/Estoque/Resultados/Sanitário/Alertas) | Escrita (download) | `relatorios:ver` (+ gate comercial `isWriteAllowed` só em `AcoesRelatorio`) | `exportacaoRelatorios.js`, `exportacaoArquivos.js`, `exportadores.js` (legado) | ⛔ — **arquivo não é um formato que o bot consiga entregar hoje** (Telegram pode enviar arquivo, mas não implementado) | — | ⛔ |
| Painel Gerencial (indicadores + cenários) | Consulta | `relatorios_gerenciais:ver` | `indicadoresEstrategicos.js`, `simuladorCenarios.js` | ⛔ | — | ⛔ |

**Relatórios: envio de texto-resumo é a via de menor esforço (geradores já existem e são puros/testados); exportação de arquivo é um projeto à parte (Telegram Bot API suporta envio de documento, mas não foi implementado).**

---

## Totais (atualizado na Sprint Paridade 1)

```text
Módulo                          Operações mapeadas   Cobertas (✅/🟡)   % aproximado
Fazendas                        6                     4                 67%  (era 33%)
Lotes                           17                    9                 53%  (era 47%)
Pesagens                        7                     3                 43%  (avaliado, adiado)
Pastagens                       9                     3                 33%  (era 22%)
Estoque                         12                    6                 50%
Suplementação                   10                    3                 30%
Sanidade                        10                    5                 50%
Financeiro                      12                    4                 33%
Custos                          7                     1                 14%
Tarefas                         7                     1                 14%
Rotinas                         6                     0                 0%
Calendário                      5                     0                 0%
Alertas                         8                     1                 13%
Equipe                          6                     0 (maioria 🔒)    n/a — fora de escopo
Assinatura                      3 (+2 sempre 🔒)       0                 0%
Configurações                   5 (majoritariamente 🔒/fora de escopo)  n/a
Relatórios/Exportações          3                      1 (parcial)      ~33%

Operações encontradas: ~133 (módulos operacionais, excluindo Equipe/Config/Assinatura-pagamento tratados como fora de escopo)
Operações implementadas (✅ ou 🟡): ~42 (era ~38; +4 nesta sprint: cadastrar_fazenda, renomear_fazenda, listar_pastos, consultar_resultado_lote)
Operações testadas (automatizado): ~32 das implementadas
Operações validadas no app real: 0 (correções de bloqueio verificadas por leitura/lint/teste, não por uso manual na UI)
Operações validadas no Telegram real: 0
Exceções justificadas (nunca automatizáveis por política): 9 (convites/papéis de equipe, checkout/pagamento, credenciais/backup destrutivo)
```

**Paridade operacional total estimada (fora as exceções por política): ~32%** (era ~29%).
Isto **não é** uma declaração de conclusão — é o estado real medido nesta
sprint, para orientar a priorização abaixo. `P0`/`P1` conhecidos deste
bloco (Fazendas/Lotes/Pesagens/Pastagens + os 2 bloqueios corrigidos): **0**.
O 3º bloqueio estrutural (motor de alerta duplicado) segue aberto —
não é P0/P1 *deste* bloco (não bloqueia nenhuma das 4 operações
implementadas aqui), mas é uma dependência explícita para o próximo bloco
que tocar Alertas.

---

## Achados adicionais encontrados durante a auditoria (fora do escopo de paridade, registrados para rastreio)

Estes não são gaps de Telegram — são bugs/inconsistências reais no
próprio app, encontrados como efeito colateral da leitura de código.

1. ~~**Bug de integridade**: excluir um registro de `consumo_suplementacao`
   pela aba "Histórico" do Lote não devolvia o estoque.~~ **Corrigido na
   Sprint Paridade 1** — extraída função canônica
   `domain/consumoSuplementacao.js::calcularEstornoConsumoSuplementacao` +
   `services/consumoSuplementacao.js::excluirEEstornarConsumoSuplementacao`,
   agora reaproveitada por `LotesPage.jsx` e `SuplementacaoPage.jsx`
   (única implementação). Teste de regressão em
   `domain/consumoSuplementacao.test.js`.
2. ~~**Gap de permissão por-ação**: `RotinaPage.jsx` e
   `CalendarioOperacionalPage.jsx` não checavam `hasPermission`.~~
   **Corrigido na Sprint Paridade 1** — checagens adicionadas antes de
   cada ação de escrita (criar/editar/excluir/concluir/reabrir), usando
   `sanitario:editar`/`sanitario:excluir` (mesma permissão do gate de
   visualização das duas páginas). **Limitação conhecida**: sem
   biblioteca de teste de componente React neste projeto, a correção foi
   verificada por consistência de padrão com `TarefasPage.jsx` (que
   também não tem teste de componente) + lint/build, não por um teste
   automatizado dedicado.
3. **Dois motores de alerta coexistindo** (ver nota na seção Alertas
   acima) — o painel legado do Dashboard (`utils/alerts.js`, 485 linhas)
   continua ativo em paralelo à Central (`alertasUnificados.js`, 640
   linhas), com tabelas de tratativa diferentes
   (`alertas_resolvidos`/`alertas_adiados` vs `alertas_tratativas`).
   **Avaliado e adiado nesta sprint** — não é um "rename", os dois
   motores têm modelos de dados incompatíveis (itens individuais vs.
   grupos agregados com pluralização), e a migração troca o que usuários
   reais veem hoje no Dashboard. Plano de migração concreto para a
   próxima sprint que tocar Alertas:
   - Trocar a fonte de `DashboardPage.jsx`/`App.jsx` (`buildAlerts` de
     `utils/alerts.js`) por `gerarAlertasUnificados` (`alertasUnificados.js`),
     adaptando a renderização do painel do Dashboard ao modelo agregado
     (grupos, não itens individuais).
   - Trocar `marcarAlertaComoFeito`/`adiarAlerta` (`App.jsx`, gravam em
     `alertas_resolvidos`/`alertas_adiados`) por
     `salvarTratativaAlerta`/`STATUS_TRATATIVA` (`services/tratativasAlertas.js`,
     grava em `alertas_tratativas`) — mesma função já usada por
     `AlertasPage.jsx`.
   - Decidir o que fazer com linhas já existentes em
     `alertas_resolvidos`/`alertas_adiados` de contas reais (migração de
     dados ou período de leitura dupla) antes de remover as tabelas
     antigas.
   - Só depois disso, adicionar ao bot uma ação de escrita
     (tratar/resolver/reabrir alerta) — nunca antes, para não criar uma
     terceira fonte de verdade.
4. **Permissão divergente**: `suplementacao:editar` existe em
   `perfis.js` e é o que o bot do Telegram usa, mas a UI web de
   Suplementação sempre checa `estoque:editar` — as duas superfícies
   nunca comparam a mesma permissão para a mesma operação conceitual.
5. **Mecanismo de planejamento duplicado em Suplementação**: campos no
   Lote (Bloco 4, sincroniza com a nuvem) vs. aba "Dietas" da
   Suplementação (explicitamente só local, não sincroniza — parece
   recurso inacabado).
6. **Excluir pasto sem guarda de lote vinculado** — diferente de
   Excluir fazenda, que bloqueia corretamente quando há dados
   dependentes.
7. **Sem cancelamento/estorno de movimentação de Estoque** — únicos
   entre os três módulos de consumo (Estoque/Suplementação/Sanidade)
   sem reversão de um lançamento.

Achados 1 e 2 foram corrigidos nesta sprint (ver acima). Achado 3 (motor
de alerta duplicado) é o único bloqueio estrutural ainda aberto, com plano
de migração documentado acima.

---

## Priorização sugerida para as próximas sprints (não implementado ainda)

Ordem por impacto/esforço, não por módulo:

1. **Alertas: ação de tratativa via bot** (marcar em análise/resolver/
   ignorar/adiar) — mas **primeiro** exige decidir o que fazer com o
   motor legado do Dashboard (achado #3), senão o bot criaria uma
   terceira fonte de verdade.
2. **Editar/excluir** para as operações que já têm cadastro via bot
   (pesagem, item de estoque, manejo, tarefa) — hoje o bot só cria,
   nunca corrige, e "editar" é a queixa mais previsível de um piloto
   real.
3. **Consultas que faltam mas são baratas**: tarefas
   hoje/atrasadas/próximas, DRE/fluxo de caixa resumido — todas já têm
   domínio pronto, só falta uma intenção nova + formatador de resposta
   (mesmo padrão de `respostasConsulta.js`; `listar_pastos` e
   `consultar_resultado_lote` já foram feitas nesta sprint como prova
   deste padrão).
4. **Enviar relatório de texto** (lote/financeiro/pastagens/resumo
   geral) via bot — os geradores de texto (`whatsappResumo.js`) já
   existem, testados, prontos para reaproveitar; menor esforço de toda
   a lista.
5. **Editar lote / editar pasto / ajuste de lotação** — mesma família de
   `cadastros.js`, sem transação composta.
6. **Rotinas e Calendário** — 0% de cobertura; decisão de produto
   primeiro (vale a pena um produtor gerenciar rotina recorrente por
   chat?) antes de investir esforço de implementação.
7. **Custos (tabela dedicada)** — hoje o bot usa `CADASTRAR_DESPESA`
   genérico; criar em `custos` propriamente exigiria replicar o espelho
   automático para `movimentacoes_financeiras` (`upsertMovimentacaoFinanceiraDeCusto`).

**Nunca implementar via bot** (política de segurança, não backlog):
convidar/alterar papel de equipe, qualquer checkout/pagamento Asaas,
alteração de senha/dados de credencial, backup/limpeza de dados.

---

## Validação real no Telegram

**Continua pendente para as 32 intenções existentes e para todas as
listadas como cobertas nesta matriz.** Nenhuma foi testada num Telegram
real nesta sessão — sem acesso a conta/bot ao vivo neste ambiente. Não
declarar "validado no Telegram" com base em teste automatizado (1381
testes passando cobrem lógica pura e integração via `prepararCadastro`,
não o aplicativo real do Telegram).

## Sprint Paridade 1 — resumo

Continuação a partir de `53f6bec`. Escopo real entregue (nem tudo que o
sprint pedia — ver pendências abaixo):

- **2 dos 3 bloqueios estruturais corrigidos**: exclusão de consumo de
  suplementação (estoque não devolvido) e permissões ausentes em
  Rotinas/Calendário. O 3º (motor de alerta duplicado) foi avaliado e
  adiado com um plano de migração concreto documentado acima — migrar às
  cegas o painel de alertas do Dashboard, usado por usuários reais hoje,
  sem QA ao vivo, era um risco desproporcional ao resto desta sprint.
- **4 operações novas**: `cadastrar_fazenda`, `renomear_fazenda`,
  `listar_pastos`, `consultar_resultado_lote` — todas reaproveitando
  domínio já existente (`getResumoLote`, `calcularOcupacaoPastos`),
  nenhuma regra paralela criada.
- **Não implementado nesta rodada** (ficam para o próximo bloco):
  editar lote, ajuste de lotação, editar/excluir pesagem, editar/excluir/
  cadastrar pasto, consolidada de fazendas, excluir fazenda. Pesagens em
  particular foi avaliado e adiado — a lógica de recálculo de `lote.p_at`
  está inline em `PesagensPage.jsx`, não extraída, e replicá-la no bot
  sem extrair primeiro criaria uma 3ª cópia da mesma fórmula (o mesmo
  problema que a correção do bloqueio #1 acabou de resolver para
  suplementação).
- **Confirmação editável, transações compostas em RPC nova, e testes de
  idempotência/outra-conta/outra-fazenda para as 4 operações novas NÃO
  foram feitos nesta rodada** — as 4 operações são todas simples (1-3
  writes sequenciais via `aplicarWrites`, mesmo padrão das 12 anteriores),
  sem operação verdadeiramente composta que exigisse uma RPC nova. Os
  testes escritos cobrem classificação, validação de campos e resolução
  de entidade (ambíguo/inexistente/duplicado), não os eixos adicionais
  pedidos (retry de webhook, timeout, erro de banco) — mesma lacuna que já
  existia para as 12 intenções anteriores, não introduzida nem fechada
  aqui.
- **Paridade completa do HERDON não é declarada.** Isto é um checkpoint.

## Custo de IA

Zero — nenhuma operação mapeada aqui, existente ou proposta, depende de
provedor externo. A auditoria em si (este documento) foi feita por
leitura de código, sem qualquer chamada de IA em tempo de execução do
bot.
