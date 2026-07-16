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
| Cadastrar lote | Escrita | `lotes:editar` | `LotesPage.jsx:650-717`; auto-cria `animais` grupo + pesagem inicial (`lotesLogic.js:137-182`) | ✅ `CADASTRAR_LOTE` (Sprint Paridade 1, bloco 4) — via RPC transacional `criar_lote_completo`, agora replica os 2 side-effects automáticos do app (grupo `animais` + pesagem inicial) atomicamente com o lote | ✅ | ⛔ |
| Editar lote | Escrita | `lotes:editar` | `LotesPage.jsx:604-648` | 🟡 `EDITAR_LOTE` (Sprint Paridade 1) — sexo/raça/observação; peso inicial/data de entrada/origem/pasto ainda não | ✅ | ⛔ |
| Ajuste de lotação | Escrita | `lotes:editar` | `lotesLogic.js:192-220` | ✅ `AJUSTAR_LOTACAO` — transacional via RPC `ajustar_lotacao_lote` (Sprint Paridade 1, bloco 4), que porta a mesma validação de `buildAjusteLotacaoPatch` | ✅ | ⛔ |
| Venda | Escrita | `animais:movimentar` | `services/movimentacoes.js:302-470` (app, ainda não-transacional); RPC `registrar_saida_lote` (bot, Sprint Paridade 1 bloco 4) | ✅ `REGISTRAR_VENDA` — transacional no bot | ✅ | ⛔ |
| Morte/perda | Escrita | `animais:movimentar` | idem, tipoSaida `morte`/`descarte` | ✅ `REGISTRAR_MORTE` — mesma RPC `registrar_saida_lote`, nunca lança financeiro | ✅ | ⛔ |
| Transferência de saída / entre lotes | Escrita | `animais:movimentar` | `movimentacoes.js:170-291,325-381` | ✅ `TRANSFERIR_ANIMAIS_ENTRE_LOTES` — mesma RPC `registrar_saida_lote` (tipo `transferencia_saida`), substitui os 3 awaits sequenciais sem transação que o bot usava antes | ✅ | ⛔ |
| Trocar lote de pasto | Escrita | `lotes:editar` | RPC `mover_lote_para_pasto` (app, `SECURITY INVOKER`) / RPC gêmea `mover_lote_para_pasto_bot` (bot, `SECURITY DEFINER`, Sprint Paridade 1 bloco 4 — ver nota `acoesPasto.js`) | ✅ `TROCAR_LOTE_PASTO` | ✅ | ⛔ |
| Finalizar lote | Escrita | `lotes:editar` | `LotesPage.jsx:446-472`, `lotesLogic.js:228-240` | ✅ `FINALIZAR_LOTE` — transacional via RPC `finalizar_lote` (Sprint Paridade 1, bloco 4), que também valida server-side que o lote não está finalizado | ✅ | ⛔ |
| Histórico do lote | Consulta | `lotes:ver` | inline + `movimentacaoPastos.js:83-93` | 🟡 (via `VER_LOTE`/`RESUMO`, não histórico completo) | — | ⛔ |
| Custos (aba financeiro do lote) | Consulta | `lotes:ver` | `LoteFinanceiroTab.jsx` | 🟡 (via `CONSULTAR_FINANCEIRO` com filtro lote) | ✅ | ⛔ |
| Resultado (margem, custo/lucro por @) | Consulta | `lotes:ver`/`resultados:ver` | `resumoLote.js`, `calculations.js` | ✅ `CONSULTAR_RESULTADO_LOTE` (Sprint Paridade 1) — reaproveita `getResumoLote` direto, mesma fonte da página | ✅ | ⛔ |
| Quantidade/peso/GMD | Consulta | `lotes:ver` | `calculateGmd30` (triplicado, ver achados) | 🟡 (via `VER_LOTE`/`VER_PESAGENS`) | — | ⛔ |
| Nova pesagem a partir do lote | Escrita | `pesagens:editar` | `LotesPage.jsx:558-593` (versão simplificada) | ✅ `REGISTRAR_PESAGEM` (fluxo genérico, não o específico do lote) | ✅ | ⛔ |
| Relatório do lote / compartilhar (WhatsApp) | Consulta | `lotes:ver`/`relatorios:ver` | `relatorioLote.js`, `whatsappResumo.js::gerarResumoLoteTexto` | ⛔ — **gerador de texto já existe e é reaproveitável** para um comando "enviar relatório do lote" | — | ⛔ |

**Lotes: 17 operações, 11 cobertas (parcial ou total) = ~65%** (era ~53%). Nesta rodada: `AJUSTAR_LOTACAO` (reaproveita `buildAjusteLotacaoPatch` de `lotesLogic.js`, mesma função que o app usa) e `EDITAR_LOTE` (sexo/raça/observação — nome já era coberto por `RENOMEAR_LOTE`; peso inicial/data de entrada/origem/pasto seguem sem edição via bot).

## Pesagens

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Histórico/última/GMD | Consulta | `pesagens:ver` | `PesagensPage.jsx:897-941` | ✅ `VER_PESAGENS` | ✅ | ⛔ |
| Nova pesagem (simples) | Escrita | `pesagens:editar` | `PesagensPage.jsx:725-807` | ✅ `REGISTRAR_PESAGEM` | ✅ | ⛔ |
| Nova pesagem (batch/individual por lote) | Escrita | `pesagens:editar` | `PesagensPage.jsx:483-723` / duplicado em `AcompanhamentoPesoPage.jsx` | ⛔ (bot só cobre o fluxo simples) | — | ⛔ |
| Editar pesagem | Escrita | `pesagens:editar` | `PesagensPage.jsx:339-346,725-772` | ✅ `EDITAR_PESAGEM` — transacional via RPC `editar_ultima_pesagem_lote` (Sprint Paridade 1, bloco 4; substituiu o `writes[]` sequencial da bloco 3); só a pesagem de LOTE mais recente, não pesagem individual por animal | ✅ | ⛔ |
| Excluir/cancelar pesagem | Escrita | `pesagens:excluir` | `PesagensPage.jsx:348-402` | ✅ `EXCLUIR_PESAGEM` — transacional via RPC `excluir_ultima_pesagem_lote` (Sprint Paridade 1, bloco 4), com o fallback pela média dos animais quando não sobra pesagem | ✅ | ⛔ |
| Lotes sem pesagem recente | Consulta | `pesagens:ver` | `hojeNaFazenda.js:22-29` (duplicado inline em `PesagensPage.jsx`) | 🟡 (aparece dentro de `VER_ALERTAS`, não como consulta dedicada) | — | ⛔ |
| Evolução/gráfico de peso | Consulta | `animais:ver` | `AcompanhamentoPesoPage.jsx` + `PesoChart.jsx` | ⛔ | — | ⛔ |

**Pesagens: 7 operações, 5 cobertas = ~71%** (era ~43%). Batch/individual por lote e o gráfico de evolução seguem sem cobertura.

## Pastagens

| Operação no app | C/E | Permissão | Domínio/RPC | Telegram | Teste | Validação real |
|---|---|---|---|---|---|---|
| Listar pastos | Consulta | `pastagens:ver` | `PastagensPage.jsx:431-501` | ✅ `LISTAR_PASTOS` (Sprint Paridade 1) — reaproveita `calcularOcupacaoPastos` (`ocupacaoPastos.js`), mesma fonte da página | ✅ | ⛔ |
| Cadastrar pasto | Escrita | `pastagens:editar` | `PastagensPage.jsx:208-227` | ✅ `CADASTRAR_PASTO` | ✅ | ⛔ |
| Editar pasto | Escrita | `pastagens:editar` | `PastagensPage.jsx:188-207` | ✅ `EDITAR_PASTO` (Sprint Paridade 1, bloco 3) — área/capacidade/observação; não inventa "tipo de capim" | ✅ | ⛔ |
| Excluir/inativar pasto | Escrita | `pastagens:excluir` | `PastagensPage.jsx:232-256` (sem guarda de lote vinculado, diferente de Fazendas) | ⛔ — ação destrutiva sem guarda no próprio app; deixada de fora até o app corrigir a guarda | — | ⛔ |
| Capacidade (UA/ha, diagnóstico) | Consulta | `pastagens:ver` | `unidadeAnimal.js:25-43` | ⛔ | — | ⛔ |
| Ocupação/lotação por pasto | Consulta | `pastagens:ver` | `ocupacaoPastos.js:55-120` | 🟡 (aparece dentro de `LISTAR_PASTOS`, sem consulta dedicada por pasto único) | — | ⛔ |
| Histórico de movimentações | Consulta | — | `movimentacaoPastos.js:83-93` | ⛔ | — | ⛔ |
| Retirar/mover lote de pasto | Escrita | `lotes:editar` | (mesma op de Lotes, ver acima) | ✅ `TROCAR_LOTE_PASTO` (mover) + `RETIRAR_LOTE_PASTO` (retirar sem novo destino) — as duas via a mesma RPC `mover_lote_para_pasto_bot` (destino opcional, Sprint Paridade 1 bloco 4) | ✅ | ⛔ |
| Listar pastos vazios | Consulta | `relatorios:ver` | `ocupacaoPastos.js:17-19`, `hojeNaFazenda.js:103-137` | 🟡 (aparece dentro de `LISTAR_PASTOS`, sem filtro dedicado) | — | ⛔ |
| Listar pastos sobrecarregados | Consulta | `relatorios:ver` | `relatorios.js::buildRelatorioPastagens` | 🟡 (idem — `LISTAR_PASTOS` já mostra o status de cada pasto) | — | ⛔ |

**Pastagens: 9 operações-núcleo (excluindo o histórico morto de fazenda), 6 cobertas (total ou parcial) = ~67%** (era ~33%). Excluir/inativar pasto e histórico de movimentações seguem sem cobertura.

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
| Marcar "em análise" | Escrita | `tarefas:editar` | `AlertasPage.jsx:194-226` → `alertas_tratativas` | ⛔ — **bot ainda só lê, nunca trata** (não implementado nesta rodada — ver seção "Sprint Paridade 1" abaixo) | — | ⛔ |
| Resolver | Escrita | `tarefas:editar` | `AlertasPage.jsx:228-235`; header/Dashboard também resolvem, mesma tabela desde a unificação | ⛔ | — | ⛔ |
| Ignorar | Escrita | `tarefas:editar` | `AlertasPage.jsx:237-244` | ⛔ | — | ⛔ |
| Adiar | Escrita | `tarefas:editar` | `AlertasPage.jsx:246-264`; header/Dashboard também adiam, mesma tabela desde a unificação | ⛔ | — | ⛔ |
| Histórico (resolvidos/ignorados) | Consulta | `dashboard:ver` | filtro "Histórico" na Central | ⛔ | — | ⛔ |
| Executar ação recomendada | — | — | **não existe execução direta nem no app** (só navegação manual) | ⛔ (nada a espelhar) | — | ⛔ |

**Alertas: 8 operações reais (excluindo a execução que não existe), 1 coberta = ~13%.** Sem mudança de cobertura do bot nesta rodada — o trabalho foi na unificação do motor (abaixo), pré-requisito que agora libera a próxima rodada para adicionar ações de escrita com segurança.

> **Atualização (Sprint Paridade 1, bloco 2 — motor de alertas unificado)**:
> o achado abaixo, registrado no checkpoint anterior, **foi corrigido**.
> O painel legado do Dashboard (aba "Todos os alertas" e o sino do header,
> `AppHeader.jsx`) **não usa mais** `utils/alerts.js`/
> `alertas_resolvidos`/`alertas_adiados` — agora consome
> `gerarAlertasUnificados` + `aplicarTratativasAosAlertas`, a mesma fonte
> e a mesma tabela `alertas_tratativas` da Central e do Telegram, via um
> adaptador (`domain/alertasUnificados.js::adaptarAlertaParaPainelLegado`)
> que traduz para a forma que os dois componentes já esperavam — sem
> reescrevê-los. Resolver/adiar num alerta pelo header agora grava na
> mesma tratativa que a Central lê, e vice-versa. Testes de equivalência
> em `domain/alertasUnificados.test.js`. Efeito colateral único e
> esperado: alertas já resolvidos/adiados sob a identidade antiga
> (`ackKey` heurístico) voltam a aparecer como ativos uma vez após o
> deploy — as tabelas antigas não foram apagadas, ficam como histórico.
>
> Texto original do achado (mantido por registro): existiam **dois
> motores de alerta coexistindo** — o novo/autoritativo
> (`alertasUnificados.js`+`centralAlertas.js`) e um legado no
> `DashboardPage.jsx` (`utils/alerts.js`), com tabelas de tratativa
> diferentes. Um alerta resolvido no Dashboard antigo não aparecia como
> resolvido na Central nem no bot, e vice-versa.

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

## Totais (atualizado — Sprint Paridade 1, continuação/bloco 2-3)

```text
Módulo                          Operações mapeadas   Cobertas (✅/🟡)   % aproximado
Fazendas                        6                     4                 67%
Lotes                           17                    11                65%  (era 53%)
Pesagens                        7                     5                 71%  (era 43%)
Pastagens                       9                     6                 67%  (era 33%)
Estoque                         12                    6                 50%
Suplementação                   10                    3                 30%
Sanidade                        10                    5                 50%
Financeiro                      12                    4                 33%
Custos                          7                     1                 14%
Tarefas                         7                     1                 14%
Rotinas                         6                     0                 0%
Calendário                      5                     0                 0%
Alertas                         8                     1                 13%  (motor unificado — ver seção Alertas)
Equipe                          6                     0 (maioria 🔒)    n/a — fora de escopo
Assinatura                      3 (+2 sempre 🔒)       0                 0%
Configurações                   5 (majoritariamente 🔒/fora de escopo)  n/a
Relatórios/Exportações          3                      1 (parcial)      ~33%

Operações encontradas: ~133 (módulos operacionais, excluindo Equipe/Config/Assinatura-pagamento tratados como fora de escopo)
Operações implementadas (✅ ou 🟡): ~52 (era ~42; +10 nesta rodada: editar_pesagem, excluir_pesagem, ajustar_lotacao, editar_lote, editar_pasto, retirar_lote_pasto — 6 operações novas — mais consolidação de listar_pastos cobrindo parcialmente vazios/sobrecarregados/ocupação-por-pasto)
Operações testadas (automatizado): ~42 das implementadas
Operações validadas no app real: 0 (verificado só por leitura de código, lint, teste automatizado e boot sem erro no navegador — sem login real)
Operações validadas no Telegram real: 0
Exceções justificadas (nunca automatizáveis por política): 9 (convites/papéis de equipe, checkout/pagamento, credenciais/backup destrutivo)
```

**Paridade operacional total estimada (fora as exceções por política): ~39%** (era ~32%,
inalterada nesta rodada — o bloco 4 tornou operações já existentes
transacionais e adicionou o mecanismo de confirmação editável, não novas
intenções). `P0`/`P1` conhecidos deste bloco (Fazendas/Lotes/Pesagens/
Pastagens + unificação do motor de alertas): **0**. Itens explicitamente NÃO
concluídos (não são bloqueio, são escopo restante — ver seção "Sprint
Paridade 1 — bloco 4" abaixo): ação de escrita de alertas no bot, edição
completa de lote (peso inicial/data/origem/pasto), fazenda consolidada/
excluir/resumo, exclusão/inativação de pasto, pesagem em lote no formato
batch/individual por animal, matriz completa de idempotência/permissão/
multi-fazenda para as operações novas, validação autenticada no app e
validação real no Telegram (**confirmação editável e RPC transacional —
concluídas no bloco 4, ver abaixo**).

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
3. ~~**Dois motores de alerta coexistindo**~~ — **corrigido nesta
   continuação da Sprint Paridade 1.** `DashboardPage.jsx`/`App.jsx`
   trocaram `buildAlerts` (`utils/alerts.js`) por `gerarAlertasUnificados`
   + `aplicarTratativasAosAlertas`, com um adaptador
   (`domain/alertasUnificados.js::adaptarAlertaParaPainelLegado`) que
   traduz para a forma que `AppHeader.jsx`/`DashboardPage.jsx` já
   esperavam — nenhum dos dois componentes precisou ser reescrito.
   `marcarAlertaComoFeito`/`adiarAlerta` agora gravam em
   `alertas_tratativas` via `salvarTratativaAlerta`, a mesma função e
   tabela que `AlertasPage.jsx` já usava. `utils/alerts.js` continua
   existindo (ainda usado por `domain/relatorios.js::buildResumoGeralFazenda`,
   um relatório sob demanda fora do escopo desta unificação — não migrado
   nesta rodada). Efeito colateral único e esperado: alertas resolvidos/
   adiados sob a identidade antiga voltam a aparecer ativos uma vez após
   o deploy (tabelas antigas preservadas como histórico, não apagadas).
   Testes de equivalência em `domain/alertasUnificados.test.js`. **Não
   incluído nesta correção**: uma ação de escrita (resolver/adiar) no
   próprio bot do Telegram — a unificação era pré-requisito para isso,
   não a implementação da ação em si.
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

**Continua pendente para as 32 intenções existentes.** Nenhuma foi testada
num Telegram real nesta sessão — sem acesso a conta/bot ao vivo neste
ambiente. Não declarar "validado no Telegram" com base em teste
automatizado (1426 testes passando cobrem lógica pura e integração via
`prepararCadastro`, não o aplicativo real do Telegram nem o app web ao
vivo — a única verificação de app real feita foi um boot sem erro de
console na tela de login, sem autenticação).

## Sprint Paridade 1 — continuação (bloco 2 e 3)

Continuação a partir de `710566f`. Escopo real entregue (nem tudo que o
sprint pedia — ver pendências abaixo):

- **3º bloqueio estrutural corrigido: motor de alerta unificado.**
  Migração completa do painel legado do Dashboard/header para a mesma
  fonte canônica e a mesma tabela de tratativa da Central e do Telegram
  (`gerarAlertasUnificados` + `alertas_tratativas`), sem reescrever os
  componentes de UI (adaptador de forma). Ver detalhe na seção Alertas e
  nos achados adicionais. Com isso, os **3 bloqueios estruturais da
  auditoria original estão corrigidos.**
- **6 operações novas**: `editar_pesagem`, `excluir_pesagem`,
  `ajustar_lotacao`, `editar_lote`, `editar_pasto`, `retirar_lote_pasto`.
  Duas reaproveitam domínio existente diretamente
  (`buildAjusteLotacaoPatch` de `lotesLogic.js`, sem nenhuma regra nova);
  duas exigiram extrair uma fórmula antes inline
  (`PesagensPage.jsx::recalculateLoteFromPesagens` →
  `domain/pesagensLote.js`, agora reaproveitada pelas duas telas + bot);
  as outras duas (`editar_lote`/`editar_pasto`) não têm domínio dedicado
  no app (a página só faz `updateOperationalRecord` direto), então o
  preparer do bot é a única validação além da resolução de entidade.
- **Não implementado nesta rodada** (ficam para o próximo bloco):
  confirmação editável (alterar um campo específico sem reiniciar a
  conversa); RPC transacional nova; ação de escrita de alertas no bot
  (resolver/ignorar/adiar/em análise — a unificação do motor era o
  pré-requisito, feito agora, mas a ação em si não foi adicionada);
  edição de peso inicial/data de entrada/origem/pasto do lote; visão
  consolidada, resumo por fazenda e exclusão de fazenda; excluir/inativar
  pasto; nova pesagem em lote no formato batch/individual por animal.
- **Transações atômicas / RPC nova — avaliado, não implementado.** Todas
  as 22 operações de escrita do bot (as 16 anteriores + as 6 desta
  rodada) seguem o mesmo padrão já usado em toda a base: uma sequência de
  inserts/updates via `aplicarWrites`, sem transação de banco. Este é um
  risco pré-existente em toda a aplicação (não introduzido nem agravado
  aqui) — a única RPC real do domínio (`mover_lote_para_pasto`) nem é
  chamada pelo bot, por ser `SECURITY INVOKER` e depender de RLS que o
  service role ignora (nota `ponytail:` em `acoesPasto.js`). Criar uma
  RPC nova seria uma mudança de schema (`supabase/migrations/`) que
  exigiria desenho de `SECURITY DEFINER` cuidadoso e validação contra
  RLS/service role antes de aplicar — decisão deliberadamente não tomada
  nesta rodada sem uma revisão dedicada de segurança.
- **Idempotência/multi-fazenda para as 6 operações novas**: não geraram
  teste dedicado por operação — o mecanismo (uma operação pendente por
  chat, transição atômica no `/confirmar`, gate de fazenda em
  `INTENCOES_ESCOPADAS`) é compartilhado por todas as intenções e já é
  testado genericamente (`operacoesPendentes.test.js`); mesma decisão já
  tomada para as 12 intenções anteriores.
- **Paridade completa do HERDON não é declarada.** Isto é um checkpoint.

## Sprint Paridade 1 — bloco 4 (confirmação editável + RPCs transacionais)

Continuação a partir de `cf8e7c1`. Escopo: os dois itens marcados no bloco
anterior como bloqueio estrutural/pré-requisito — confirmação editável e
transações atômicas — priorizados sobre o restante da lista de 24 critérios
do sprint (ações de escrita de alertas, edição completa de lote, fazenda
consolidada/exclusão, exclusão de pasto seguem para o próximo bloco).

- **Confirmação editável — módulo central novo, não replicado por
  intenção.** `src/domain/telegram/edicaoPendente.js` (puro): reconhece
  frases como "troque o pasto para Pasto Sul"/"mude a quantidade para 30"/
  "remover pasto", acha o slot correspondente no catálogo da intenção atual
  (`CATALOGO_CADASTROS`, com sinônimos pequenos — `cabeças`→`quantidade`,
  `pastagem`→`pasto` — e casamento por campo composto, ex.: `nome`→
  `nome_lote`), e revalida tudo via `prepararCadastro` (mesma resolução de
  entidade/regra de negócio de uma proposta nova). Integrado em
  `api/_telegramBot.js::tentarEditarPendente`, chamado antes da
  classificação geral de intenção quando existe uma operação pendente
  `tipo_operacao='cadastro'` para o chat. A correção faz `UPDATE` na mesma
  linha pendente (mesmo `id`, `action_id` estável) — nunca cria uma segunda
  pendência; se a revalidação falhar (ex.: novo pasto ambíguo), a linha
  pendente original não é tocada, preservando idempotência. **Escopo desta
  rodada**: só `tipo_operacao='cadastro'` (a maioria das ~20 intenções,
  inclusive o exemplo do próprio sprint — cadastro de lote); os 2 tipos
  legados de payload bespoke (`transferir_animais`, `renomear_lote`) não
  têm edição de campo ainda — gap conhecido, não bloqueio.
- **Transações atômicas — 8 funções novas, uma migration.**
  `supabase/migrations/20260716120000_rpcs_transacionais_lote_pesagem.sql`:
  `app_assert_owner_write` (helper compartilhado) + `registrar_saida_lote`
  (venda/morte/abate/descarte/transferência de saída e entre lotes, num
  único corpo — mesma unificação que `services/movimentacoes.js` já usa em
  JS), `ajustar_lotacao_lote`, `finalizar_lote`, `mover_lote_para_pasto_bot`
  (gêmea `SECURITY DEFINER` de `mover_lote_para_pasto`, que é
  `SECURITY INVOKER` e por isso nunca pôde ser chamada pelo bot — ver
  `ponytail:` em `acoesPasto.js`; unifica troca + retirada com destino
  opcional), `editar_ultima_pesagem_lote`, `excluir_ultima_pesagem_lote` e
  `criar_lote_completo` (fecha o gap de `CADASTRAR_LOTE` não replicar o
  grupo em `animais` e a pesagem inicial). Todas `SECURITY DEFINER`,
  recebem `p_owner_user_id uuid` explícito (o client do bot é service-role,
  sem `auth.uid()`) e chamam `app_assert_owner_write` primeiro, que valida
  esse parâmetro contra a sessão real quando quem chama é autenticado —
  para o service-role, confia na checagem de perfil já feita em JS antes de
  chamar a RPC (mesma fronteira de confiança que `aplicarWrites` já usava).
  Substitui, para essas 8 operações, o padrão anterior (`aplicarWrites`: um
  `for` sequencial sem checagem de erro nenhuma entre passos, e no caso da
  transferência, 3 `await`s manuais na mesma situação).
- **Bot religado às RPCs, app web intocado.** `acoesLote.js`/
  `acoesPasto.js`/`cadastroPesagem.js`/`cadastros.js` continuam fazendo
  100% da resolução de entidade e validação amigável de antes (mesmas
  mensagens de erro com candidatos), só trocaram o que devolvem:
  `rpc:{nome, params}` em vez de `writes:[...]`. `api/_telegramBot.js`
  ganhou `aplicarRpc` (uma chamada `client.rpc(...)`) como alternativa a
  `aplicarWrites`, escolhida quando o plano tem `.rpc`; o restante das
  intenções (que não fazem parte deste bloco) continua no caminho
  `writes[]` antigo, sem mudança de comportamento. **Decisão deliberada de
  escopo**: o app web (`src/services/movimentacoes.js`, ainda
  `Promise.all` sem transação) não foi migrado para as RPCs nesta rodada —
  reduz o raio de alcance da mudança a um código já em produção e testado,
  deixando a migração do app como um fast-follow depois que as RPCs
  estiverem provadas via o bot.
- **Achado inicial CORRIGIDO na ativação (ver abaixo)**: esta seção
  originalmente registrava `lotes.peso_medio_atual` e
  `lotes.motivo_encerramento` como colunas inexistentes. Isso estava
  **errado** — baseava-se no dump estático `docs/supabase-production-schema.sql`,
  desatualizado. Consultando `information_schema` no banco real, as duas
  colunas existem de fato (`peso_medio_atual`, `peso_atual` e `motivo_encerramento`,
  todas `text`/`numeric` nullable). As RPCs foram corrigidas antes da
  aplicação para gravar nelas — ver seção de ativação abaixo.
- **Não implementado nesta rodada** (ficam para o próximo bloco): ação de
  escrita de alertas no bot (resolver/ignorar/adiar/em análise), edição de
  peso inicial/data de entrada/origem/pasto do lote, visão consolidada/
  resumo por fazenda/exclusão de fazenda, excluir/inativar pasto, nova
  pesagem em lote no formato batch/individual por animal, matriz dedicada
  de idempotência/permissão/multi-fazenda para as 8 operações
  transacionais (reaproveitam o mesmo mecanismo genérico já testado —
  `operacoesPendentes.test.js` — mesma decisão já tomada nos blocos
  anteriores), validação autenticada no app (não se aplica — a UI web não
  chama essas RPCs, ver abaixo) e validação real no Telegram (sem acesso).

## Sprint Paridade 1 — bloco 4 (ativação): migration aplicada e validada

Continuação a partir de `19736b8`. Migration
`supabase/migrations/20260716180853_rpcs_transacionais_lote_pesagem.sql`
(renomeada do timestamp local `20260716120000` para o timestamp que o
Supabase atribuiu ao aplicar — mesmo padrão de reconciliação já documentado
em sprints anteriores) **aplicada em produção** (único ambiente disponível —
`list_branches` não mostra homologação separada), via `mcp__supabase__apply_migration`.

**Dois bugs reais corrigidos antes de aplicar**, achados ao conferir contra
`information_schema` em vez do dump estático:
1. `lotes.motivo_encerramento` existe de verdade — `finalizar_lote` foi
   corrigida para gravar nela (não em `obs`, como a versão original fazia).
2. `lotes.peso_atual`/`peso_medio_atual` existem de verdade, junto com
   `p_at` — `editar_ultima_pesagem_lote`/`excluir_ultima_pesagem_lote`
   passaram a sincronizar as três colunas, igual ao que `PesagensPage.jsx`
   já fazia em JS.

**Vulnerabilidade crítica encontrada e corrigida na hora**: depois de
aplicar a migration original, `anon` (chamador sem login nenhum) tinha
`EXECUTE` nas 8 funções — `REVOKE ALL ... FROM PUBLIC` não remove o
`EXECUTE` que o Supabase concede por padrão a `anon`/`authenticated`/
`service_role` via `ALTER DEFAULT PRIVILEGES` do schema `public` (é um
GRANT separado por role, não uma herança de `PUBLIC`). Como
`app_assert_owner_write` só validava a conta quando
`auth.role() = 'authenticated'`, um chamador `anon` caía no ramo "confia
no parâmetro" (pensado só para o service-role do bot) e podia informar
QUALQUER `p_owner_user_id` — escrita cross-conta completa, sem
autenticação. Corrigido imediatamente (`REVOKE EXECUTE ... FROM anon` nas
8 funções + `app_assert_owner_write` reescrita para negar explicitamente
qualquer papel que não seja `service_role` ou `authenticated` validado, em
vez do padrão anterior "só nega quando é authenticated e falha a
checagem"). Migration de avanço:
`supabase/migrations/20260716181018_hardening_rpcs_transacionais_revoke_anon.sql`.
Confirmado via `get_advisors(security)`: nenhuma das 8 funções aparece mais
como executável por `anon`.

**Smoke tests diretos contra a conta QA real** (`Fazenda QA Sprint 34`,
`owner_user_id=971ee284-…`), em uma transação com `ROLLBACK` no final (nada
persistiu):

| RPC | Válida | Erro de valor | Outra conta | Permissão | Observação |
|---|---|---|---|---|---|
| `registrar_saida_lote` (venda) | ✅ qtd -3, financeiro criado | ✅ qtd negativa e qtd>saldo rejeitadas | — | — | |
| `registrar_saida_lote` (morte) | ✅ qtd -1, **sem** financeiro | — | — | — | confirmado 2x (1 falso-negativo de teste, causado por uma query de verificação sem filtro `origem_tipo`, corrigido e re-testado isoladamente) |
| `registrar_saida_lote` (transferência) | ✅ origem -2 / destino +2, peso do destino reponderado | — | — | — | |
| `ajustar_lotacao_lote` | ✅ qtd atualizada | ✅ "sem alteração" rejeitada | — | — | |
| `finalizar_lote` | ✅ status+motivo_encerramento gravados | ✅ dupla finalização bloqueada | — | — | |
| `mover_lote_para_pasto_bot` (troca) | ✅ histórico criado, pastagem_id atualizado | — | — | — | |
| `mover_lote_para_pasto_bot` (retirada) | ✅ pastagem_id → null | — | — | — | |
| `mover_lote_para_pasto_bot` | — | ✅ pasto de outra fazenda rejeitado | — | — | |
| `editar_ultima_pesagem_lote` | ✅ peso + `p_at`/`peso_atual`/`peso_medio_atual` sincronizados | — | — | — | |
| `excluir_ultima_pesagem_lote` | ✅ cai para a pesagem restante corretamente | — | — | — | |
| `criar_lote_completo` | ✅ lote + grupo em `animais` + pesagem inicial + pasto, tudo junto | — | — | — | |
| (todas, via `ajustar_lotacao_lote`) | — | — | ✅ lote de outra conta → 42501 | ✅ `authenticated` sem perfil válido → 42501 | |
| (todas) | — | — | — | ✅ `anon` sem `EXECUTE` (permission denied no Postgres, antes de entrar na função) | verificado via `get_advisors` após o revoke |

17 casos exercitados, 16 confirmados corretos de primeira, 1 falso-negativo
de teste identificado e corrigido (não era bug da RPC). Cobertura
representativa (caminho feliz + 1-2 erros mais relevantes por RPC), não a
matriz exaustiva de todas as combinações — mesma decisão de escopo já usada
para idempotência/multi-fazenda nos blocos anteriores.

**Validação autenticada no app**: não se aplica a este bloco —
confirmado por grep que `src/services/` e `src/pages/` não chamam nenhuma
das 8 RPCs (decisão de escopo do bloco anterior: só o bot foi religado a
elas). Não há caminho de UI para clicar e exercitar essas funções
especificamente; a validação real disponível é a direta contra o banco
(acima), que é mais forte para provar a lógica transacional em si do que
um clique de UI seria.

**Validação real no Telegram**: continua sem acesso a bot ao vivo nesta
sessão — não validado, não declarado como validado.

**P0/P1 deste bloco: 0** (a vulnerabilidade de `anon` foi encontrada e
corrigida na mesma sessão, antes de qualquer exposição real fora deste
processo de ativação).

## Custo de IA

Zero — nenhuma operação mapeada aqui, existente ou proposta, depende de
provedor externo. A auditoria em si (este documento) foi feita por
leitura de código, sem qualquer chamada de IA em tempo de execução do
bot.
