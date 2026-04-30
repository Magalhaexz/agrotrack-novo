# Sprint 8F.1 — Modal Footer Layout Fix (Animals + Weighing)

## Files changed
- `src/styles/ui.css`

## Exact selectors/components fixed
- `.ui-modal`
- `.ui-modal-head`
- `.ui-modal-body`
- `.ui-modal-body.has-footer`
- `.ui-modal-foot`
- `@media (max-width: 900px) .ui-modal`
- `@media (max-width: 900px) .ui-modal-body`

## What was fixed
- Modal container agora usa layout vertical estável (flex coluna):
  - header fixo
  - body com scroll interno
  - footer sempre visível
- Removido comportamento de scroll quebrado no container inteiro da modal.
- Footer ganhou camada visual própria para não “sumir” em conteúdo extenso.
- Body recebeu padding inferior adicional para evitar colisão visual da última seção com a barra de ações.
- Ajuste de altura máxima com `dvh` defensivo para desktop/mobile.

## Validation results
- `npm.cmd run build` (não disponível neste ambiente Linux)
- `npm.cmd run lint` (não disponível neste ambiente Linux)
- `npm run build` ✅
- `npm run lint` ✅ (warnings preexistentes)

## Confirmation
- Nenhuma funcionalidade removida.
- Fluxo de cadastro individual de animal preservado.
- Fluxos de pesagem por lote e por animal preservados.
- Nenhuma aba/subaba/módulo/página/ação removida.
