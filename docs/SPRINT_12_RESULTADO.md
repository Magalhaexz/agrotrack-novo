# Sprint 12 — Resultado

**Data:** 2026-06-17
**Objetivo:** Polimento Visual Global, Navegação e Estrutura de Produto HERDON
**Status:** ✅ Concluída

---

## O que mudou

### Navegação

| Item | Antes | Depois |
|------|-------|--------|
| Grupos do menu | 6+ grupos desorganizados | 5 grupos claros: Início, Operação, Financeiro, Decisão, Gestão |
| Dashboard (nav) | "Dashboard" | "Painel Geral" |
| Lotes (nav) | "Lotes" | "Lotes e Rebanho" |
| Financeiro (nav) | "Financeiro" | "Movimentações Financeiras" |
| Suplementação (nav) | "Nutrição e Suplementação" | "Suplementação" |
| Sanitário (nav) | "Sanitário" | "Sanidade" |
| Cenários (nav) | "Cenários" | "Simulador de Decisão" |
| Resultados (nav) | "Resultados e Relatórios" | "Resultado dos Lotes" |
| Assinatura (nav) | "Minha Assinatura" | "Planos e Assinatura" |
| Funcionários (nav) | "Funcionários" | "Equipe" |
| Relatórios Gerenciais (nav) | "Relatórios Gerenciais" | "Relatórios" |

### Mobile Bottom Nav

| Posição | Antes | Depois |
|---------|-------|--------|
| 1 | Dashboard / Home | Início / Home |
| 2 | Rebanho / Tractor | Rebanho / Tractor |
| 3 | Calendário / Calendar | Financeiro / Receipt |
| 4 | Estoque / Package | Estoque / Package |
| 5 | Mais / MoreHorizontal | Mais / MoreHorizontal |

### Títulos de páginas (h1)

| Página | Antes | Depois |
|--------|-------|--------|
| DashboardPage | "Dashboard" | "Painel Geral" |
| FinanceiroPage | "Financeiro" | "Movimentações Financeiras" |
| ResultadosPage | "Relatórios / Resultados" | "Resultado dos Lotes" |
| RelatoriosGerenciaisPage | "Relatórios Gerenciais" | "Relatórios" |
| LotesPageHeader | "Lotes / Rebanho" | "Lotes e Rebanho" |

### Estados vazios

- **Painel Geral:** banner de onboarding quando não há lotes ativos (guia o produtor para criar fazenda → criar lote)
- **Simulador de Decisão:** texto orientativo substituído por mensagem ativa sobre decisão de compra/venda

### Componentes

- **KpiCard:** reescrito para usar classes CSS definidas (`.kpi-card`, `.kpi-label`, `.kpi-value`, `.kpi-sub-value`) em vez de classes inexistentes
- **Tones:** `.kpi-val.gn` (verde), `.kpi-val.rd` (vermelho), `.kpi-val.am` (âmbar), `.kpi-val.nt` (neutro)

### Ícones (src/lucide-react.js)

6 novos ícones adicionados ao arquivo customizado:

| Ícone | Uso |
|-------|-----|
| `CreditCard` | Planos e Assinatura |
| `FileBarChart` | Relatórios |
| `BarChart3` | Resultado dos Lotes |
| `Calculator` | Simulador de Decisão |
| `Layers` | Rateio de Custos |
| `Receipt` | Movimentações Financeiras |

### CSS (src/styles/)

Adicionado ao final de `app.css` (seção Sprint 12):

- `.kpi-val` com `font-size: clamp(1.4rem, 1.8vw, 1.85rem)`
- `.kpi-val.gn/rd/am` — tones de cor
- `.kpi-unit` — unidade do KPI
- `.ph` / `.ph-actions` — PageHeader
- `.sidebar-group-label` — cabeçalho de grupo no menu
- `.empty-state-icon`, `.empty-state-title`, `.empty-state-subtitle` — estados vazios
- `.metric-tile` — tile de métrica alternativo
- Breakpoints responsivos: `640px`, `900px`, `1024px`

Adicionado ao final de `dashboard.css`:

- `.dashboard-onboarding-banner` — banner de onboarding
- `.dashboard-onboarding-content`, `.dashboard-onboarding-actions`
- Variantes mobile

---

## Arquivos modificados

| Arquivo | Tipo de mudança |
|---------|----------------|
| `src/navigation/navConfig.js` | Reescrita completa (5 grupos, labels atualizados) |
| `src/lucide-react.js` | +6 ícones |
| `src/components/KpiCard.jsx` | Reescrita (classes CSS corretas) |
| `src/components/MobileBottomNav.jsx` | Calendário → Financeiro |
| `src/pages/DashboardPage.jsx` | Título + onboarding banner + acento corrigido |
| `src/pages/FinanceiroPage.jsx` | Título atualizado |
| `src/pages/ResultadosPage.jsx` | Título atualizado |
| `src/pages/RelatoriosGerenciaisPage.jsx` | Título atualizado |
| `src/pages/CenariosPage.jsx` | Empty state reescrito |
| `src/components/lotes/LotesPageHeader.jsx` | Título + subtítulo |
| `src/styles/app.css` | +Sprint 12 tokens e utilitários |
| `src/styles/dashboard.css` | +onboarding banner |
| `tests/subscription-surface.test.js` | Atualizado label esperado |

---

## Gates finais

| Gate | Resultado |
|------|-----------|
| `npm test` | ✅ 246 testes, 0 falhas |
| `npm run lint` | ✅ Sem erros |
| `npm run build` | ✅ Build bem-sucedido |

---

## O que NÃO foi alterado

Conforme especificado, esta sprint não tocou em:

- Cálculos financeiros ou agronômicos
- Regras de negócio
- Alertas
- Funcionalidades de IA
- Integração com Asaas / Supabase
- Preços de mercado
