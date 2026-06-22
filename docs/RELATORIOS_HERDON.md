# Relatórios HERDON (Sprint 24)

## O que existe

Um hub "Relatórios" (menu **Gestão**) com 5 relatórios simples, pensados para uso diário do produtor — não é um módulo de BI.

| Relatório | Página | O que mostra |
|---|---|---|
| Relatório do Lote | `RelatorioLotePage.jsx` | Identificação, peso, GMD, custo/receita/lucro, ROI, últimas pesagens de um lote selecionado |
| Relatório de Pesagens | `RelatorioPesagensPage.jsx` | Histórico de pesagens filtrável por fazenda/lote/período, com variação e GMD entre pesagens |
| Relatório Financeiro | `RelatorioFinanceiroPage.jsx` | Entrou / saiu / saldo, maiores custos, contas vencidas e próximas do vencimento |
| Relatório de Pastos | `RelatorioPastagensPage.jsx` | Pastos com/sem lote, lotes sem pasto, status de lotação, cabeças/peso estimados e percentual de ocupação por pasto (Sprint 25) |
| Resumo Geral da Fazenda | `RelatorioResumoGeralPage.jsx` | Totais de fazendas/pastos/lotes/cabeças, resultado financeiro, alertas críticos e pendências do dia |

Todos têm: ações de baixar PDF, copiar resumo e enviar por WhatsApp (ver `RELATORIOS_WHATSAPP_PDF_HERDON.md`), e estados vazios em linguagem simples quando não há dados.

## Onde está o cálculo (reuso, sem duplicar lógica)

Todo o cálculo já existia no app antes desta sprint. O arquivo novo `src/domain/relatorios.js` apenas combina e filtra:

- `getResumoLote()` (`src/domain/resumoLote.js`) — peso, GMD, custo, receita, lucro, ROI do lote.
- `calcularFluxoCaixa()` (`src/domain/fluxoCaixa.js`) — entrou/saiu/saldo.
- `listarContasFinanceiras()`, `construirResumoPastos()`, `construirHojeNaFazenda()` (`src/domain/hojeNaFazenda.js`) — contas vencidas/próximas, ocupação de pastos, pendências do dia.
- `calcularOcupacaoPastos()` (`src/domain/ocupacaoPastos.js`, Sprint 25) — status de lotação por pasto. Ver [OCUPACAO_PASTOS_HERDON.md](OCUPACAO_PASTOS_HERDON.md).
- `buildAlerts()` (`src/utils/alerts.js`) — alertas críticos.

Os textos de WhatsApp ficam em `src/domain/whatsappResumo.js`, separados da montagem dos relatórios.

## Limitações conhecidas

- A pesagem não guarda quantidade de cabeças por registro (campo não existe na tabela `pesagens`); o relatório de pesagens mostra a quantidade **atual** do lote, não a quantidade no momento da pesagem.
- A ocupação de pastos (Sprint 25) usa UA estimada (peso vivo ÷ 450) comparada à capacidade do próprio pasto — estimativa operacional, não um cálculo técnico de lotação. Ver limitações completas em [OCUPACAO_PASTOS_HERDON.md](OCUPACAO_PASTOS_HERDON.md).
- Nenhuma tabela nova foi criada nesta sprint.

## Permissões e planos

Novo permission key `relatorios:ver`, concedido a Gerente, Operador e Visualizador (mesma régua de `relatorios_gerenciais:ver`). Os 6 novos `pageId` (`relatorios`, `relatorioLote`, `relatorioPesagens`, `relatorioFinanceiro`, `relatorioPastagens`, `relatorioResumoGeral`) foram adicionados a `MODULES_BASIC` em `src/services/subscriptions.js` — disponíveis em todos os planos, sem alteração de preço/limite/Asaas.
