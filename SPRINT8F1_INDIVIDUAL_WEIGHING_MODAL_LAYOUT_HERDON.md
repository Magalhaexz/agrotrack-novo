# Sprint 8F.1 — Fix Individual Weighing Modal Layout

## Files changed
- `src/components/PesagemForm.jsx`
- `src/styles/app.css`

## What layout issues were fixed
- Reorganização da estrutura visual do formulário da modal de **Nova pesagem** para reduzir sensação de campos soltos.
- Agrupamento explícito de campos principais:
  - Tipo de pesagem
  - Lote
  - Animal
  - Data
  - Peso médio
  - Observação
  - Rendimento de carcaça
  - Preço por @
- Padronização de espaçamento vertical e entre colunas com classes dedicadas (`pesagem-form-*`).
- Ajuste de largura/altura visual dos inputs para ritmo consistente.
- Card de **Indicadores em tempo real** mantido e encapsulado com melhor hierarquia visual.
- Ajustes responsivos para a modal em telas menores (stack de grids em coluna).
- Sem alteração de lógica de negócio dos fluxos por lote e por animal.

## Validation results
- `npm.cmd run build` (não disponível neste ambiente Linux)
- `npm.cmd run lint` (não disponível neste ambiente Linux)
- `npm run build` ✅
- `npm run lint` ✅ (warnings preexistentes)

## Confirmation
- Fluxo de pesagem por lote preservado.
- Fluxo de pesagem por animal preservado.
- Seleção de lote e animal preservadas.
- Nenhuma aba/módulo/navegação removida.
