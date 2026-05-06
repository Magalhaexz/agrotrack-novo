# SPRINT18M1_EMERGENCY_NOTIFICATION_BUTTONS_REWRITE_HERDON

## What was blocking clicks
- O bloco de ações no dropdown ainda usava wrappers de interação (botão custom + menu de adiar) que podiam interceptar ou desviar o clique em UI real.
- A ação de `Adiar` dependia de um submenu/toggle (`snoozeMenuFor`) antes de executar, adicionando um ponto extra de falha.

## What was simplified in AppHeader
- Reescrita emergencial do bloco de ações para botões HTML diretos por alerta:
  - `<button type="button">Resolver</button>`
  - `<button type="button">Adiar</button>`
  - `<button type="button">Abrir</button>`
- Cada botão agora tem handler direto com:
  - `event.preventDefault()`
  - `event.stopPropagation()`
  - `console.debug` DEV imediato:
    - `[HERDON_ALERT_CLICK] { action, ackKey, route? }`
- Removido fluxo de submenu de adiar no AppHeader (hotfix simplificado):
  - `Adiar` aplica direto para amanhã (`'1'`).

## Exact localStorage keys used
- `herdon-alertas-resolvidos`
- `herdon-alertas-adiados`

## Stable ackKey strategy
- Mantida função única `getAlertAckKey(alert)` em `src/App.jsx`.
- Usada para:
  - render key
  - resolver
  - adiar
  - abrir debug
  - filtros de resolvidos/adiados
  - payload persistido

## Resolver manual result
- Não verificado manualmente neste ambiente.

## Adiar manual result
- Não verificado manualmente neste ambiente.

## Abrir manual result
- Não verificado manualmente neste ambiente.

## Testing results
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`:
  - sem conflitos.
- `npm run build`:
  - sucesso.
- `npm run lint`:
  - sucesso sem erros (warnings preexistentes de hooks).

## Files changed
- `src/App.jsx`
- `src/components/AppHeader.jsx`
- `src/styles/app.css`

## Status
SPRINT NOT COMPLETE — notification actions still require manual verification.
