# HERDON Strategic Planning Architecture (Sprint 5)

## 1) Current App Structure Audit

### 1.1 Existing architectural baseline
- Frontend is a React single-shell app (`src/App.jsx`) with in-app page switching (`currentPage`) instead of URL routing.
- Main navigation is centralized in `src/navigation/navConfig.js`.
- Permissions are centralized in `src/auth/perfis.js` using `permissoesPorPagina` and profile-level grants.
- Operational data is centralized in `useOperationalData` (`src/hooks/useOperationalData.js`) with:
  - local fallback DB (`initialDb` + normalization),
  - Supabase hydration by table,
  - owner-scoped reads when available,
  - sync fallback/circuit behavior.
- Persistence pattern is operational-record based (`createOperationalRecord`, `updateOperationalRecord`, etc.).

### 1.2 Current domain modules mapped to requested audit scope
- **Lotes**: `src/pages/LotesPage.jsx` + `src/components/lotes/*`
  - Owns lot lifecycle (ativo/encerrado/vendido), lot-level KPIs, and lot detail tabs.
  - Integrates animais, pesagens, sanitário, financeiro, retiradas.
- **Animais**: `src/pages/AnimaisPage.jsx`
  - Supports group and individual records.
  - Stores exits/sales via `movimentacoes_animais` (+ optional financial reflection).
- **Pesagens**: `src/pages/PesagensPage.jsx`
  - Supports lot and individual weighing.
  - Recalculates lot current weight from pesagem history.
- **Financeiro**: `src/pages/FinanceiroPage.jsx`
  - DRE, lot-level financials, ledger (`movimentacoes_financeiras`), daily payments.
- **Estoque**: `src/pages/EstoquePage.jsx` (+ movements in operational tables)
  - Inventory balances and movement history.
- **Suplementação**: `src/pages/SuplementacaoPage.jsx`
  - Nutrition/supplement operational parameters tied to lots/stock.
- **Resultados**: `src/pages/ResultadosPage.jsx`
  - Consolidated reporting bundle by lot/farm/sanitary/stock/financial/performance.
  - Export-ready structures (CSV/XLS).
- **Relatórios**:
  - User-facing reporting currently lives mainly under **Resultados**.
  - Existing report components also exist in `src/components/relatorios/*`.

### 1.3 Data structures already aligned with planning foundations
- `fazendas` already has base pasture capacity signals (`area_pastagem_ha`, `capacidade_ua`).
- `lotes`, `animais`, `pesagens`, `movimentacoes_animais`, `movimentacoes_financeiras` already provide key event streams for strategic modules.
- Existing calculations (`src/utils/calculations.js`, `src/domain/resumoLote.js`, `src/domain/indicadores.js`) provide reusable KPI baseline.

### 1.4 Gaps identified for premium planning
- No dedicated entities for pasture units/arrendamento strategy/scenario assumptions.
- No first-class historical rebanho evolution ledger by period (stock opening/closing as explicit dataset).
- Indicators are spread across pages/functions, not normalized into one premium analytics layer.
- Scenario simulation is not modeled as versioned/pluggable data objects.
- No premium dashboard composition layer focused on strategic planning.

---

## 2) Proposed Navigation Structure

## 2.1 IA placement (Portuguese labels preserved)
- New top-level section: **Planejamento Premium**
  - **Planejamento** (overview + strategic assumptions)
  - **Pastagens** (pastures, lotação, capacidade de suporte)
  - **Cenários** (scenario simulation workspace)
  - **Indicadores** (technical + economic KPI center)
  - **Relatórios Gerenciais** (executive outputs)

## 2.2 Relationship with existing modules
- Keep existing operational modules where they are (Lotes/Animais/Pesagens/etc.).
- New planning modules should consume operational data, not duplicate operational CRUD.
- `Resultados` remains operational reporting; **Relatórios Gerenciais** is premium strategic reporting.

## 2.3 Suggested `pageMap` additions (future)
- `planejamento`
- `pastagens`
- `cenarios`
- `indicadores`
- `relatoriosGerenciais`
- `dashboardPremium`

---

## 3) Required Data Models (Planning Layer)

All models should include operational metadata fields:
- `id`, `owner_user_id`, `fazenda_id`, `created_at`, `updated_at`, `created_by`, `updated_by`, `status`.

## 3.1 Pastagens
Table suggestion: `pastagens`
- `nome`
- `fazenda_id`
- `area_ha`
- `capacidade_suporte_ua_ha`
- `taxa_lotacao_atual_ua_ha`
- `custo_pasto_mensal`
- `arrendamento_ativo` (bool)
- `arrendamento_area_ha`
- `arrendamento_custo_mensal`
- `observacoes`

## 3.2 Unidade Animal (derived + persisted snapshots)
Table suggestion: `ua_snapshots`
- `referencia_data`
- `fazenda_id`
- `lote_id` (nullable for farm aggregate rows)
- `peso_vivo_kg`
- `ua` (rule: `peso_vivo_kg / 450`)
- `qtd_animais_base`
- `ua_total_lote`
- `ua_total_fazenda`
- `fonte` (`pesagens`, `estimativa`, `manual_ajuste`)

## 3.3 Evolução do Rebanho
Table suggestion: `rebanho_evolucao_periodos`
- `periodo_inicio`
- `periodo_fim`
- `fazenda_id`
- `lote_id` (nullable)
- `estoque_inicial`
- `compras`
- `vendas`
- `mortes`
- `nascimentos`
- `transferencias_entrada`
- `transferencias_saida`
- `estoque_final`
- `variacao_inventario`

## 3.4 Indicadores Técnicos e Econômicos
Table suggestion: `indicadores_periodicos`
- `periodo_inicio`
- `periodo_fim`
- `fazenda_id`
- `lote_id` (nullable)
- `desfrute_pct`
- `taxa_abate_pct`
- `taxa_crescimento_pct`
- `kg_vivo_ha`
- `arrobas_vendidas`
- `receita_total`
- `custos_totais`
- `margem_bruta`
- `metodo_calculo_version`

## 3.5 Cenários
Table suggestions:
- `cenarios`
  - `nome`
  - `periodo_inicio`
  - `periodo_fim`
  - `status` (`rascunho`, `ativo`, `arquivado`)
  - `premissas_json`
- `cenario_eventos`
  - `cenario_id`
  - `compras_simuladas`
  - `vendas_simuladas`
  - `mortalidade_pct`
  - `natalidade_pct`
  - `capacidade_suporte_ua`
  - `resultado_projetado`

---

## 4) Integration Points (New Modules x Existing Core)

## 4.1 Animais
- Source for headcount, active/inactive status, individual lifecycle events.
- Feeds rebanho evolution opening/closing and growth metrics.

## 4.2 Lotes
- Strategic aggregation grain for most indicators.
- Provides lot context (entry/exit windows, production system, farm linkage).

## 4.3 Pesagens
- Primary source for `peso_vivo` and UA calculations.
- Feeds growth rate and `kg vivo/ha`.

## 4.4 Financeiro
- Source for revenue/cost/margem bruta and scenario economic projections.
- Scenario engine must support “realized + simulated delta” mode.

## 4.5 Suplementação
- Input for carrying-capacity pressure and productivity assumptions.
- Optional scenario cost drivers (feed strategy variants).

## 4.6 Resultados
- Reuse existing report calculations where stable.
- Premium indicators should become reusable services that Resultados can consume later.

## 4.7 Relatórios
- Add executive report templates driven by `indicadores_periodicos` and `cenarios`.
- Keep export parity with current CSV/XLS strategy.

---

## 5) Implementation Plan by Sprint

## Sprint 6 — Pastagens e Lotação
- Create `pastagens` model and CRUD page (`Pastagens`).
- Add lotação and suporte formulas at farm/pasture level.
- Integrate with fazenda selection context and permissions.

## Sprint 7 — Unidade Animal e Capacidade de Suporte
- Implement UA calculation service (`UA = peso / 450`) with lot/farm aggregation.
- Add periodic UA snapshots and baseline trend visualization.
- Wire pesagens as primary source with fallback estimation rules.

## Sprint 8 — Evolução do Rebanho
- Build period-close service for stock evolution (`estoque inicial/final` chain).
- Materialize movement buckets (compras/vendas/mortes/nascimentos/transferências).
- Expose `Evolução do Rebanho` analytical view.

## Sprint 9 — Indicadores Técnicos e Econômicos
- Implement centralized KPI engine and `indicadores_periodicos`.
- Standardize formulas for desfrute, taxa de abate, crescimento, kg vivo/ha, @ vendidas, receita, custos, margem.
- Launch `Indicadores` module with farm/lot/period filters.

## Sprint 10 — Simulador de Cenários
- Create scenario workspace (`cenarios`, `cenario_eventos`).
- Implement projection engine (baseline + simulation assumptions).
- Enable compare mode: cenário vs realizado.

## Sprint 11 — Dashboard Premium
- Build executive dashboard with cards, trends, capacity stress, margin outlook, scenario deltas.
- Add `Relatórios Gerenciais` outputs and export bundles.
- Finalize premium navigation and role-gated access.

---

## 6) Technical Guidelines for Future Implementation

- Keep Portuguese labels in UI and component copy.
- Keep planning entities in separate tables to avoid contaminating operational CRUD.
- Prefer computed services with versioned formulas (`metodo_calculo_version`) for auditability.
- Reuse existing persistence/sync infrastructure (`operationalPersistence`) and permission model.
- Add lightweight automated tests per sprint for formula stability and cross-module regressions.

