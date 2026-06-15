# Sprint 8A — Fix Negative SVG Rect Height Runtime Error

## Objetivo
Corrigir o erro de runtime no console:
`<rect> attribute height: A negative value is not valid.`

## Causa raiz encontrada
- O projeto usa alias de `recharts` para implementação local:
  - `vite.config.js` -> `recharts: '/src/recharts.jsx'`
- No `BarChart` customizado em `src/recharts.jsx`, a altura da barra era calculada diretamente:
  - `barHeight = (value / maxYValue) * (height - padding * 2)`
- Quando o valor era negativo (ex.: cenários financeiros), `barHeight` ficava negativo e era enviado diretamente para:
  - `<rect height={barHeight}>`
- Isso dispara exatamente o erro do SVG com altura negativa.

## Arquivos alterados
- `src/recharts.jsx`

## Componentes corrigidos
- `ResponsiveContainer`
- `BarChart`

## Correções aplicadas
- Adicionado helper de sanitização:
  - `sanitizeNonNegative(value, fallback)`
  - garante `Number.isFinite(...)` e `>= 0`
- `ResponsiveContainer`:
  - altura numérica agora é normalizada para não-negativa
- `BarChart`:
  - `safeChartHeight` e `chartInnerHeight` protegidos
  - `barHeight` normalizada para nunca ser negativa
  - coordenadas `x` e `y` também protegidas com fallback finito
  - `barWidth` normalizada
- A semântica dos dados negativos foi preservada (os dados continuam negativos), mas os atributos SVG inválidos não são mais emitidos.

## Validação

### Build
- `npm.cmd run build`
- Resultado: sucesso

### Lint
- `npm.cmd run lint`
- Resultado: sucesso com `30 warnings` preexistentes de `react-hooks/exhaustive-deps` e `0` erros

## Estado do diff
- `git diff --name-only`:
  - `src/recharts.jsx`

## Confirmações
- Nenhuma funcionalidade removida
- Nenhum módulo removido
- Nenhuma tab/subtab removida
- Nenhuma regra de negócio alterada
- Nenhum gráfico removido

## Validação manual
- Não executada em navegador nesta sessão.
- Passos recomendados:
  1. Abrir as páginas com gráficos (Dashboard, Financeiro, Lotes, Relatórios).
  2. Verificar ausência do erro `<rect> ... negative value`.
  3. Confirmar que os gráficos continuam renderizando normalmente.
