# QA Visual HERDON — Sprint 13

**Data da revisão:** 2026-06-17

## Checklist por tela

| Tela | Status visual | Problema encontrado | Prioridade | Correção feita | Pendência |
|------|--------------|---------------------|------------|----------------|-----------|
| Painel Geral | OK | Textos sem acentos; KpiPanel com variação artificial | Alta | Acentos corrigidos (Cabeças, crítico, Pendências, etc.) | Variação % é calculada sobre base fictícia |
| Fazendas | OK | Empty state usa `.ui-card empty-state` sem `EmptyState` component | Baixa | — | Padronizar com `EmptyState` |
| Lotes e Rebanho | OK | — | — | — | — |
| Detalhe do Lote | Não testada | Tabs internas (Overview, Pesagens, Sanitário, Financeiro, Nutrição) | — | — | Revisar na Sprint 14 |
| Animais | Não testada | — | — | — | — |
| Pesagens | Não testada | — | — | — | — |
| Estoque | OK | — | — | — | — |
| Suplementação | Não testada | — | — | — | — |
| Movimentações Financeiras | Precisa ajuste leve | Textos sem acentos no modal e detalhe; "Financeiro do lote" sem PageHeader | Alta | Acentos corrigidos (Distribuição, Deduções, Lançamentos, etc.) | h1 detalhe de lote sem PageHeader |
| Fluxo de Caixa | Precisa ajuste leve | KpiCard local usava token CSS errado `--color-muted` | Média | Corrigido para `--color-text-muted` | KpiCard local deveria usar CSS classes |
| Rateio de Custos | OK | Título correto (`<h1>Rateio de Custos</h1>`) | — | — | — |
| Resultado dos Lotes | OK | Bem estruturado com filtros, tabs, KPIs, tabelas | — | — | — |
| Simulador de Decisão | OK | Título nav e PageHeader eram "Cenários" | Alta | Corrigido para "Simulador de Decisão" | — |
| Indicadores | Precisa ajuste leve | Usa `metric-tile` sem fallback visível para token | Baixa | — | Verificar estilo de metric-tile |
| Relatórios | OK | — | — | — | — |
| Equipe | OK | Título era "Funcionários" | Alta | Corrigido para "Equipe" | — |
| Planos e Assinatura | OK | h1 era "Minha Assinatura" | Alta | Corrigido para "Planos e Assinatura" | — |
| Configurações | Não testada | — | — | — | — |
| Perfil | Não testada | — | — | — | — |

---

## Problemas encontrados e status

### Críticos (quebra de coerência nav/título) — todos corrigidos

| Problema | Arquivo | Correção |
|---------|---------|---------|
| PageHeader "Cenários" ≠ nav "Simulador de Decisão" | `CenariosPage.jsx` | Título → "Simulador de Decisão" |
| h1 "Minha Assinatura" ≠ nav "Planos e Assinatura" | `MinhaAssinaturaPage.jsx` | h1 → "Planos e Assinatura" |
| PageHeader "Funcionários" ≠ nav "Equipe" | `FuncionariosPage.jsx` | Título → "Equipe" |

### Textos sem acento (português incorreto) — todos corrigidos

| Antes | Depois | Localização |
|-------|--------|-------------|
| "Cabecas ativas" | "Cabeças ativas" | DashboardPage (3 ocorrências) |
| "Estoque critico" | "Estoque crítico" | DashboardPage (2 ocorrências) |
| "Pendencias hoje" | "Pendências hoje" | DashboardPage |
| "Proximos pagamentos" | "Próximos pagamentos" | DashboardPage |
| "Resultado do mes" | "Resultado do mês" | DashboardPage |
| "Peso medio atual" | "Peso médio atual" | DashboardPage |
| "Focos prioritarios" | "Focos prioritários" | DashboardPage |
| "Pendencias com vencimento" | "Pendências com vencimento" | DashboardPage |
| "Situacao diaria" | "Situação diária" | DashboardPage |
| "Visao objetiva" | "Visão objetiva" | DashboardPage |
| "criticos" (badge) | "críticos" | DashboardPage |
| "Critico" (badge) | "Crítico" | DashboardPage (2 ocorrências) |
| "Media prioridade" | "Média prioridade" | DashboardPage |
| "atencao recomendada" | "atenção recomendada" | DashboardPage |
| "requer acao imediata" | "requer ação imediata" | DashboardPage |
| "operacao esta em dia" | "operação está em dia" | DashboardPage |
| "Nao definido" | "Não definido" | DashboardPage |
| "Distribuicao de custos" | "Distribuição de custos" | FinanceiroPage |
| "Distribuicao de despesas" | "Distribuição de despesas" | FinanceiroPage |
| "Deducoes" | "Deduções" | FinanceiroPage |
| "Receita liquida" | "Receita líquida" | FinanceiroPage |
| "Lucro/prejuizo" | "Lucro/prejuízo" | FinanceiroPage |
| "Lucro por cabeca" | "Lucro por cabeça" | FinanceiroPage |
| "Custo de aquisicao" | "Custo de aquisição" | FinanceiroPage |
| "Lancamentos" (título card) | "Lançamentos" | FinanceiroPage |
| "Novo lancamento financeiro" | "Novo lançamento financeiro" | FinanceiroPage |
| "Salvar lancamento" | "Salvar lançamento" | FinanceiroPage |
| "Observacoes" | "Observações" | FinanceiroPage |
| "Nao" (opção) | "Não" | FinanceiroPage |
| "Numero de parcelas" | "Número de parcelas" | FinanceiroPage |
| "analise financeira" | "análise financeira" | FinanceiroPage |
| "Responsavel" (select) | "Responsável" | DashboardPage |
| "Descricao" (placeholder) | "Descrição" | DashboardPage |

### Tokens CSS incorretos — corrigidos

| Problema | Arquivo | Correção |
|---------|---------|---------|
| `--color-muted` (inexistente) | `FluxoCaixaPage.jsx` | → `--color-text-muted` |

---

## Pendências (para Sprint 14+)

- [ ] `FinanceiroPage`: detalhe de lote usa `<h1>Financeiro do lote...` sem `PageHeader` — layout inconsistente
- [ ] `FluxoCaixaPage`: `KpiCard` local deveria usar classes CSS `.kpi-card`, `.kpi-label`, `.kpi-value` em vez de inline styles
- [ ] `FazendasPage`: empty state usa `<div className="ui-card empty-state">` em vez do componente `EmptyState`
- [ ] `DashboardPage`: KpiPanel mostra variação % calculada com base fictícia (+8%) — enganoso
- [ ] Detalhe do Lote e suas abas internas (Overview, Pesagens, Sanitário, etc.) — não revisadas nesta sprint
- [ ] AnimaisPage, PesagensPage, SuplementacaoPage, ConfiguracoesPage, PerfilPage — não revisadas
- [ ] Responsividade completa de tabelas mobile não verificada visualmente
