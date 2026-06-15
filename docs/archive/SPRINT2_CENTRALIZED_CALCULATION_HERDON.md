# Sprint 2 — Centralized Lot Calculation

## Summary
- **Branch used:** `feature/sprint-2-centralized-lot-calculation`.
- **What was created:** a new centralized lot summary module at `src/domain/resumoLote.js` with `getResumoLote(db, loteId)`.
- **What was changed:** migrated 3 safe consumers to the new summary contract:
  1. `src/components/ResultadoLoteCard.jsx`
  2. `src/pages/FinanceiroPage.jsx`
  3. `src/pages/DashboardPage.jsx`
- **What was intentionally not changed:** risky or broad consumers (`LotesPage`, `ResultadosPage`, `ComparativoPage`, `ComparativoLotesPage`, `RelatorioLote`) were left for Sprint 3 to reduce regression risk.

## New calculation contract
`getResumoLote(db, loteId)` now returns a normalized object:

```js
{
  lote,

  totalAnimais,
  pesoInicialMedio,
  pesoAtualMedio,
  gmdMedio,
  gmdKgDia,
  gmdGramasDia,
  dias,
  arrobasProduzidas,
  arrobasCarcaca,

  custoTotal,
  receitaTotal,
  lucroTotal,
  margemPct,

  custoPorCabeca,
  custoPorArroba,
  lucroPorCabeca,
  lucroPorArroba,

  classificacao,
  insights,

  // legacy compatibility aliases
  margem,
  receita,
  custo
}
```

## Calculation decisions
- **Official cost source:** `calcularResultadoLote(...).custoTotal` (from `src/domain/calculos.js`).
- **Official revenue source:** `calcularResultadoLote(...).receitaTotal` (from `src/domain/calculos.js`).
- **Official profit formula:** `lucroTotal = receitaTotal - custoTotal`.
- **Official GMD unit:** **kg/day** (`gmdKgDia`, also exposed as `gmdMedio` for compatibility).
- **Legacy compatibility fields:** `margem`, `receita`, `custo` are provided as aliases for gradual migration.

## Files changed
- `src/domain/resumoLote.js`
  - **Reason:** create single source of truth that merges productive + financial outputs.
  - **Risk level:** Medium (new business aggregation layer).

- `src/components/ResultadoLoteCard.jsx`
  - **Reason:** migrate card to centralized summary and normalized naming.
  - **Risk level:** Low (isolated consumer migration).

- `src/pages/FinanceiroPage.jsx`
  - **Reason:** replace duplicated lot-level computations with centralized summary and normalized fields.
  - **Risk level:** Medium (many UI bindings in one page).

- `src/pages/DashboardPage.jsx`
  - **Reason:** replace direct `calcLote` usage with centralized summary on safe paths.
  - **Risk level:** Low/Medium.

## Consumers migrated
Now using `getResumoLote`:
- `src/components/ResultadoLoteCard.jsx`
- `src/pages/FinanceiroPage.jsx`
- `src/pages/DashboardPage.jsx`

## Consumers not migrated yet
Still using direct `calcLote` or `calcularResultadoLote`:
- `src/utils/calculations.js` (internal alert logic)
- `src/pages/LotesPage.jsx`
- `src/pages/ResultadosPage.jsx`
- `src/pages/ComparativoPage.jsx`
- `src/pages/ComparativoLotesPage.jsx`
- `src/components/relatorios/RelatorioLote.jsx`
- `src/domain/resumoLote.js` (intentionally composes both `calcLote` + `calcularResultadoLote`)

## Validation results
- `npm run build`
  - ✅ Passed.
- `npm run lint`
  - ⚠️ Fails due to existing strict/quality rules unrelated to Sprint 2 scope.
  - ✅ No parsing errors or missing-symbol (`no-undef`) regressions introduced by this sprint.
- `rg -n "lucroporCabeca|lucro_por_cabeca|lucroPorCabeça" src`
  - ✅ No matches.
- `rg -n "calcLote\(|calcularResultadoLote\(" src`
  - ✅ Expected matches remain in non-migrated consumers and in centralized aggregator.

## Manual validation scenarios
1. **Profitable lot**
   - Setup: lot with receitas > custos.
   - Expected: `classificacao = "lucro"`, positive `lucroTotal`, positive margin, insight contains positive-result message.

2. **Break-even lot**
   - Setup: lot with receitas == custos.
   - Expected: `classificacao = "empate"`, `lucroTotal = 0`, `margemPct = 0`.

3. **Loss-making lot**
   - Setup: lot with receitas < custos.
   - Expected: `classificacao = "prejuizo"`, negative `lucroTotal`, loss insight.

4. **Lot with missing animals**
   - Setup: lot exists but no `animais` entries.
   - Expected: safe zeroes for per-head/per-arroba denominators, "insufficient data" insight when applicable.

5. **Lot with no financial movements**
   - Setup: lot without `movimentacoes_financeiras`.
   - Expected: cost/revenue/profit all handled safely by `toNumber` + zero-denominator guards.

## Remaining issues
- **Critical**
  - None identified in Sprint 2 scope (build passes, no parsing regressions).

- **High**
  - Full consumer migration is incomplete; some screens still compute lot metrics directly.

- **Medium**
  - Lint still fails on repository-wide strict rules (`no-unused-vars`, `react-hooks/set-state-in-effect`, etc.).

- **Low**
  - Legacy aliases still present and should be removed after full migration.

## Recommended Sprint 3
- Executive Lot Summary UI.
- Lot insights panel.
- Dashboard polish after full consumer migration.
- User flow tests over lot lifecycle (create, move, weigh, cost, sell).
