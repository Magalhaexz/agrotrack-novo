# Sprint 8F.2 — Animals and Weighing Form Layout Polish

## Files changed
- `src/components/AnimalForm.jsx`
- `src/components/PesagemForm.jsx`
- `src/styles/app.css`

## Sections/layouts improved
### Animals form
- Introdução de seções visuais para melhorar agrupamento:
  - Registro
  - Identificação e vínculo
  - Dados zootécnicos
  - Preço e rendimento
- Grid 2 colunas mantido para desktop e empilhamento responsivo preservado no mobile.
- Espaçamento interno e ritmo vertical refinados para labels/campos.

### Weighing form
- Introdução de seções visuais para consistência com Animals:
  - Tipo e referência
  - Medição
  - Indicadores de valor
- Melhoria de agrupamento entre campos de medição, observação e indicadores.
- Ajuste de espaçamento e alinhamento para leitura mais limpa.

### Shared styling
- Novos estilos para blocos de seção, headers de seção, densidade de campos e equilíbrio visual dark premium.

## Validation results
- `npm.cmd run build` (não disponível neste ambiente Linux)
- `npm.cmd run lint` (não disponível neste ambiente Linux)
- `npm run build` ✅
- `npm run lint` ✅ (warnings preexistentes)

## Confirmation
- Fluxo de cadastro individual e por lote/grupo de animais preservado.
- Fluxo de pesagem por lote e por animal preservado.
- Nenhuma regra de negócio alterada.
- Nenhuma ação/campo removido.
