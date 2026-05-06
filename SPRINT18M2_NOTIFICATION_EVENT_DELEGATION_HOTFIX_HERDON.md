# SPRINT18M2_NOTIFICATION_EVENT_DELEGATION_HOTFIX_HERDON

## Resumo
Hotfix aplicado no painel de notificações para forçar captura de eventos por delegação, com fallback local imediato (estado + localStorage) para `Resolver` e `Adiar`, e navegação robusta para `Abrir`.

## Por que o onClick anterior não disparava
A dropdown de notificações é renderizada em `createPortal`, fora do wrapper usado pelo `useDropdown`. O fechamento global por `mousedown` do wrapper podia disparar antes da ação do botão, derrubando o painel e interrompendo o fluxo de clique em cenários reais.

## Onde a delegação de eventos foi adicionada
Arquivo alterado:
- `src/components/AppHeader.jsx`

Delegação adicionada no container da lista de alertas (`.notif-list`) com:
- `onClickCapture={handleDelegatedNotificationClick}`
- `onPointerDownCapture={handleDelegatedNotificationClick}`

O handler captura o botão mais próximo com `[data-alert-action]`, aplica `preventDefault` e `stopPropagation`, registra log DEV e executa a ação centralizada.

## Data attributes adicionados
Nos três botões por alerta:
- Resolver:
  - `data-alert-action="resolve"`
  - `data-alert-key={ackKey}`
- Adiar:
  - `data-alert-action="snooze"`
  - `data-alert-key={ackKey}`
- Abrir:
  - `data-alert-action="open"`
  - `data-alert-key={ackKey}`
  - `data-alert-route={resolvedRoute || ''}`

## Comportamento de localStorage
Chaves usadas:
- `herdon-alertas-resolvidos`
- `herdon-alertas-adiados`

Fluxo implementado no AppHeader:
- Resolver:
  1. grava `ackKey` imediatamente em `herdon-alertas-resolvidos`
  2. marca alerta como descartado localmente no componente
  3. chama `onResolveAlert` para persistência padrão do app
- Adiar:
  1. calcula `snoozeUntil` para amanhã
  2. grava `{ chave, ate, snoozeUntil }` imediatamente em `herdon-alertas-adiados`
  3. marca alerta como descartado localmente no componente
  4. chama `onSnoozeAlert` para persistência padrão do app

Logs DEV adicionados:
- `[HERDON_ALERT_CLICK_CAPTURE]`
- `[HERDON_ALERT_CLICK]`
- `[HERDON_ALERT_LOCALSTORAGE]`
- `[HERDON_ALERT_OPEN]`

## Guarda anti-evento duplicado
Implementado `lastHandledRef` com assinatura `action:ackKey` e janela de 300ms para evitar execução dupla quando captura e onClick direto disparam na mesma interação.

## Ajustes de clickabilidade/CSS
Arquivo alterado:
- `src/styles/app.css`

Ajustes:
- `.notif-action-btn` com `pointer-events: auto`, `position: relative`, `z-index: 2`
- seletor adicional:
  - `.notification-action-btn, .notification-action-row button { pointer-events: auto; position: relative; z-index: 2; }`

## Ajuste estrutural adicional para não perder clique
No `AppHeader`, a notificação deixou de usar `useDropdown` para controle de fechamento e passou a usar lógica própria de click outside considerando **botão + painel portalizado** (`notifRef` e `notifPanelRef`). Isso evita fechamento prematuro no `mousedown` antes da ação.

## O que não foi alterado
- Cloud flow
- Supabase schema, RLS, auth
- Dashboard layout
- Reports
- Financeiro/Estoque
- Navegação/grupos
- Regras de negócio

## Manual verification
1. Click Resolver:
   - console shows [HERDON_ALERT_CLICK_CAPTURE]: **não verificado aqui**
   - localStorage `herdon-alertas-resolvidos` contains ackKey: **não verificado aqui**
   - alert disappears immediately: **não verificado aqui**
   - after Ctrl+F5 it stays hidden: **não verificado aqui**

2. Click Adiar:
   - console shows [HERDON_ALERT_CLICK_CAPTURE]: **não verificado aqui**
   - localStorage `herdon-alertas-adiados` contains ackKey: **não verificado aqui**
   - alert disappears immediately: **não verificado aqui**
   - after Ctrl+F5 it stays hidden: **não verificado aqui**

3. Click Abrir:
   - console shows [HERDON_ALERT_CLICK_CAPTURE]: **não verificado aqui**
   - navigates or shows safe message: **não verificado aqui**

SPRINT NOT COMPLETE — event still not reaching notification panel.

## Testes executados
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`  
  Sem conflitos encontrados (sem matches).
- `npm run build`  
  **OK**.
- `npm run lint`  
  **OK com warnings pré-existentes** (sem erros).
