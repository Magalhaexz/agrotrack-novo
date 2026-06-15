# SPRINT 3 — Executive Lot Summary (HerdOn)

## Escopo entregue
- Implementada a seção **Resumo executivo do lote** na aba `visao` da tela de detalhes do lote.
- Integração feita com `getResumoLote(db, lote.id)` para consolidar indicadores financeiros e produtivos em um único ponto.
- Adicionados KPIs em português:
  - Receita total
  - Custo total
  - Lucro total
  - Margem %
  - Lucro por cabeça
  - Lucro por arroba
  - GMD médio
  - Arrobas produzidas
  - Classificação
- Badge de classificação com mapeamento:
  - `lucro` → **Lucro**
  - `empate` → **Empate**
  - `prejuizo` → **Prejuízo**
- Inclusão da seção **Insights do lote** baseada em `resumoLote.insights`.
- Fallback de insights quando vazio: **“Nenhum alerta relevante para este lote.”**
- Inclusão de texto de apoio sobre a origem dos cálculos:
  - “Resumo calculado com base nos lançamentos financeiros, animais, custos e pesagens disponíveis.”

## Decisões técnicas
- Foi mantida a estrutura atual da `LotesPage` sem refatorações amplas para reduzir risco funcional.
- Os usos legados de `calcLote` fora do novo bloco executivo **foram preservados** para compatibilidade com o restante da tela e fluxos já existentes.
- Ajuste complementar: inclusão de `CartesianGrid` no import de `recharts`, pois o componente já era usado no JSX da página.

## Arquivos alterados
- `src/pages/LotesPage.jsx`

## Validações executadas
- `npm run build` ✅
- `npm run lint` ❌ (falhas preexistentes em múltiplos arquivos fora do escopo desta sprint)
- `rg` checks ✅ para confirmar integração do `getResumoLote`, presença do bloco executivo e fallback de insights.

## Risco e impacto
- Alteração localizada apenas na renderização da aba `visao` do detalhe do lote.
- Sem mudanças de regra de negócio no domínio; uso de serviço já existente (`getResumoLote`).
