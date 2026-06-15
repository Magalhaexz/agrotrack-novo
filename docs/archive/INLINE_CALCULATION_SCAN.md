# INLINE_CALCULATION_SCAN

## Objetivo

Fazer uma varredura focada em cálculos inline remanescentes nas áreas operacionais e estratégicas do HERDON, separando o que precisava de correção imediata do que pode ficar para limpeza futura.

## Arquivos revisados

- `src/pages/LotesPage.jsx`
- `src/pages/AnimaisPage.jsx`
- `src/pages/PesagensPage.jsx`
- `src/pages/AcompanhamentoPesoPage.jsx`
- `src/pages/SuplementacaoPage.jsx`
- `src/pages/EstoquePage.jsx`
- `src/pages/FinanceiroPage.jsx`
- `src/pages/CustosPage.jsx`
- `src/pages/PastagensPage.jsx`
- `src/pages/EvolucaoRebanhoPage.jsx`
- `src/pages/IndicadoresPage.jsx`
- `src/pages/DashboardPage.jsx`
- `src/pages/DashboardPremiumPage.jsx`
- `src/pages/RelatoriosGerenciaisPage.jsx`
- `src/pages/CenariosPage.jsx`
- `src/domain/indicadoresEstrategicos.js`
- `src/domain/simuladorCenarios.js`
- `src/domain/unidadeAnimal.js`
- `src/domain/calculos.js`
- `src/domain/arroba.js`
- `src/utils/calculations.js`
- `src/utils/alerts.js`
- `src/utils/formatters.js`

## High-risk fixes aplicadas

### 1. Ordenação segura por data em acompanhamento de peso

- Arquivo: `src/pages/AcompanhamentoPesoPage.jsx`
- Problema: o helper `getLatestByDate` comparava datas com `new Date(...)`, o que podia produzir ordenação inconsistente quando havia datas inválidas ou formatos irregulares.
- Correção: a ordenação passou a usar `toDateKey(...)` e comparação lexicográfica segura em formato `YYYY-MM-DD`.
- Efeito: melhora a escolha da pesagem anterior sem mudar layout nem persistência.

### 2. Ordenação segura por data em custos

- Arquivo: `src/pages/CustosPage.jsx`
- Problema: a lista de custos era ordenada com `new Date(...)`, o que podia quebrar a ordem quando existiam datas inválidas ou vazias.
- Correção: a listagem agora normaliza a data com `toDateKey(...)`, filtra entradas inválidas e ordena pelo valor seguro.
- Efeito: melhora a consistência visual e evita ordenação errada em históricos financeiros.

## Remaining inline calculations found

### Cálculos de negócio já centralizados, mas ainda consumidos inline

- `src/pages/PastagensPage.jsx`
  - área total de pastagem
  - taxa de lotação
  - pasto a arrendar
  - capacidade por pasto na tabela
- `src/pages/PesagensPage.jsx`
  - média de GMD por lote
  - variação entre pesagens
  - média geral de pesagens
  - peso médio por grupo
- `src/pages/AcompanhamentoPesoPage.jsx`
  - média, maior, menor e variação do conjunto de pesagens do dia
  - ganho médio por animal com base no histórico
- `src/pages/SuplementacaoPage.jsx`
  - previsão de consumo diário por lote
  - realizado médio por lote
  - diferença entre previsto e realizado
  - custo estimado por lote
- `src/pages/DashboardPremiumPage.jsx`
  - seleção do melhor cenário por maior margem projetada
  - formatação de valores projetados
- `src/pages/CustosPage.jsx`
  - total lançado
  - total por categoria
  - ordenação da tabela já ajustada na correção acima
- `src/domain/indicadoresEstrategicos.js`
  - UA total por animal e por lote
  - lotação total, saldo UA e pasto a arrendar
  - taxas técnicas e econômicas
- `src/domain/simuladorCenarios.js`
  - projeções de estoque, margem, UA e saldo
- `src/domain/calculos.js`
  - consolidação de custos, receitas, lucro e indicadores do lote
- `src/domain/arroba.js`
  - cálculo de arroba viva, arroba de carcaça e valor estimado
- `src/utils/calculations.js`
  - totais operacionais e alertas derivados
- `src/utils/alerts.js`
  - ordenação e pontuação de alertas operacionais

## Itens deixados para futura limpeza

- Fórmulas de exibição que já dependem de helpers centrais e não mostraram inconsistência funcional neste scan.
- Totais e médias simples usados apenas para renderização de cartões, tabelas e resumos.
- Pequenas conversões locais de número que funcionam no fluxo atual, mas poderiam ser unificadas em uma segunda limpeza de consistência.
- Cálculos de projeção visual do dashboard premium, que são derivados de helpers estratégicos e não alteram persistência.

## Observação de qualidade

- A maior parte dos cálculos críticos já estava centralizada depois da Sprint 22A.
- Esta passada encontrou principalmente lógica de ordenação e exibição residual, não uma nova fonte de verdade de negócio.

## Validação executada

- `npm run lint` ✅
- `npm run build` ✅
- `npm test -- --runInBand` ✅

## Status final

Scan concluído. Os pontos de maior risco foram corrigidos e o restante ficou classificado como cleanup de baixo risco para futura manutenção.
