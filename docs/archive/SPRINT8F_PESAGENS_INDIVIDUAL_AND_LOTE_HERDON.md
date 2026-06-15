# Sprint 8F — Pesagens individual e por lote

## Files changed
- `src/pages/PesagensPage.jsx`
- `src/components/PesagemForm.jsx`
- `src/styles/app.css`

## Implementado
- Reorganização da página Pesagens com hierarquia de UX mais clara:
  - header/hero
  - área de ação
  - seletor de modo (Por lote / Por animal)
  - KPIs de resumo
  - histórico
- Inclusão de estado explícito de modo de pesagem para abrir o modal já no contexto correto (lote ou animal).
- Fluxo de pesagem por lote preservado com persistência e recálculo dos lotes mantidos.
- Fluxo de pesagem por animal reforçado:
  - seleção de animal
  - data da pesagem
  - peso medido
  - lote opcional no payload
  - histórico com origem (Animal/Lote) preservado
- Ajustes de estilo para manter identidade dark premium, melhorar equilíbrio visual e espaçamento.

## Validação
- `npm.cmd run build` (não disponível neste ambiente Linux)
- `npm.cmd run lint` (não disponível neste ambiente Linux)
- `npm run build` executado com sucesso
- `npm run lint` executado com sucesso (apenas warnings preexistentes)

## Confirmações
- Fluxo de pesagem por lote preservado: **Sim**
- Fluxo de pesagem individual adicionado/fortalecido: **Sim**
