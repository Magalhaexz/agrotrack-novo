# QA Visual HERDON — Sprint 15

**Atualizado em:** 2026-06-17
**Histórico:** Sprint 13 (criado) → Sprint 14 (pendências corrigidas) → Sprint 15 (atualização de status)

---

## Status por tela

| Tela | Sprint 13 | Sprint 14 | Sprint 15 | Pendência |
|------|-----------|-----------|-----------|-----------|
| Painel Geral | Acentos corrigidos | — | ✅ | Variação % fictícia (+8%) |
| Fazendas | — | `EmptyState` migrado | ✅ | — |
| Lotes e Rebanho | OK | — | ✅ | — |
| Detalhe do Lote (abas) | Não testada | Não testada | ⚠️ | Abas internas não revisadas |
| Animais | Não testada | Não testada | ⚠️ | — |
| Pesagens | Não testada | Não testada | ⚠️ | — |
| Estoque | OK | — | ✅ | — |
| Suplementação | Não testada | Não testada | ⚠️ | — |
| Movimentações Financeiras | Acentos corrigidos | `PageHeader` no detalhe | ✅ | — |
| Fluxo de Caixa | Token CSS corrigido | `KpiCard` → classes CSS | ✅ | — |
| Rateio de Custos | OK | — | ✅ | — |
| Resultado dos Lotes | OK | — | ✅ | — |
| Simulador de Decisão | Título corrigido | — | ✅ | — |
| Indicadores | `metric-tile` não revisado | Não testada | ⚠️ | Verificar estilo `metric-tile` |
| Relatórios | OK | — | ✅ | — |
| Equipe | Título corrigido | — | ✅ | — |
| Planos e Assinatura | Título corrigido | — | ✅ | — |
| Configurações | Não testada | Não testada | ⚠️ | — |
| Perfil | Não testada | Não testada | ⚠️ | — |

---

## Correções consolidadas por sprint

### Sprint 13 — Correções aplicadas

| Problema | Arquivo(s) | Status |
|----------|-----------|--------|
| Títulos de tela ≠ nav (Cenários, Funcionários, Minha Assinatura) | `CenariosPage`, `FuncionariosPage`, `MinhaAssinaturaPage` | ✅ Corrigido |
| 30+ textos sem acento (Cabeças, crítico, Pendências, Próximos...) | `DashboardPage`, `FinanceiroPage` | ✅ Corrigido |
| Token CSS inexistente `--color-muted` | `FluxoCaixaPage` | ✅ Corrigido |

### Sprint 14 — Correções aplicadas

| Problema | Arquivo | Status |
|----------|---------|--------|
| `KpiCard` local com inline styles | `FluxoCaixaPage.jsx` | ✅ Migrado para `.kpi-card` / `.kpi-val gn/rd/am` |
| Empty state com `<div>` manual | `FazendasPage.jsx` | ✅ Migrado para `<EmptyState>` |
| Detalhe de lote sem `PageHeader` | `FinanceiroPage.jsx` | ✅ Substituído por `<PageHeader>` |

---

## Pendências abertas (pós Sprint 15)

| Item | Prioridade | Arquivo | Observação |
|------|-----------|---------|------------|
| Detalhe do Lote — abas internas | Alta | `LotesPage` / `LoteDetailsPanel` | Overview, Pesagens, Sanitário, Financeiro, Nutrição não verificadas |
| AnimaisPage | Média | `AnimaisPage.jsx` | Nunca revisada visualmente |
| PesagensPage | Média | `PesagensPage.jsx` | Nunca revisada visualmente |
| SuplementacaoPage | Baixa | `SuplementacaoPage.jsx` | Nunca revisada visualmente |
| ConfiguracoesPage | Baixa | `ConfiguracoesPage.jsx` | Nunca revisada visualmente |
| PerfilPage | Baixa | `PerfilPage.jsx` | Nunca revisada visualmente |
| IndicadoresPage — `metric-tile` | Baixa | `IndicadoresPage.jsx` | Estilo `metric-tile` não confirmado |
| Dashboard — variação % fictícia | Média | `DashboardPage.jsx` | Variação % usa base simulada (+8%) |

---

## Telas aprovadas para go-live (Sprint 15)

Aprovadas ✅: Painel Geral, Fazendas, Lotes, Financeiro, Fluxo de Caixa, Rateio de Custos, Resultado dos Lotes, Simulador de Decisão, Relatórios, Estoque, Equipe, Planos e Assinatura.

Não bloqueadoras ⚠️: Animais, Pesagens, Suplementação, Detalhe de Lote, Indicadores, Configurações, Perfil — presentes e funcionais, verificação visual pendente.
