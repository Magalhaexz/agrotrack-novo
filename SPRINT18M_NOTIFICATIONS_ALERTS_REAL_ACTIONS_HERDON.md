# SPRINT18M_NOTIFICATIONS_ALERTS_REAL_ACTIONS_HERDON

## Root cause found
- O principal bloqueio de ação em UI real estava no dropdown de notificação: havia interceptação de clique em contêiner de ações/menu (`onClickCapture`) que podia impedir a execução consistente dos botões internos.
- A estratégia de estado estava parcialmente correta, mas precisava garantir atualização otimista imediata + fallback local mesmo quando a persistência assíncrona falha.

## Stable ackKey strategy
- Mantida função única `getAlertAckKey(alert)` em `src/App.jsx`.
- Ela é usada para:
  - `render key` no `AppHeader`
  - `Resolver`
  - `Adiar`
  - `debug DEV`
  - filtros de `resolved/snoozed`
  - payload de persistência
- Fallback aplicado:
  - `alert.ackKey`
  - `alert.id`
  - derivado de `tipo/title/route(dataRef)`

## Resolver
- `Resolver` aplica:
  - update otimista imediato em memória (`db.alertas_resolvidos`)
  - fallback localStorage (`herdon-alertas-resolvidos`)
  - persistência assíncrona (`createOperationalRecord('alertas_resolvidos', { chave, resolvedAt, origem }, session)`)
- Em DEV, log seguro no console:
  - `action`, `ackKey`, `beforeCount`, `afterCount`
- Toast: `Notificação resolvida.`

## Adiar
- `Adiar` aplica:
  - update otimista imediato em memória (`db.alertas_adiados`)
  - fallback localStorage (`herdon-alertas-adiados`)
  - persistência assíncrona (`createOperationalRecord('alertas_adiados', { chave, ate, snoozeUntil, origem }, session)`)
- Opções:
  - Amanhã
  - 3 dias
  - 7 dias
- Em DEV, log seguro no console:
  - `action`, `ackKey`, `beforeCount`, `afterCount`
- Toast: `Lembrete adiado.`

## Abrir
- `Abrir` mantém:
  - `preventDefault` + `stopPropagation`
  - resolução de rota por fallback:
    - `route`
    - `rota`
    - `acao.rota`
    - `pagina`
  - navegação quando rota existe
  - mensagem segura quando não existe:
    - `Não há destino configurado para este alerta.`

## LocalStorage fallback behavior
- Filtro de alertas ativos combina:
  - `db.alertas_resolvidos` + `localStorage herdon-alertas-resolvidos`
  - `db.alertas_adiados` + `localStorage herdon-alertas-adiados`
- Alertas resolvidos ficam ocultos.
- Alertas adiados ficam ocultos enquanto `ate/snoozeUntil >= hoje`.

## Persistence behavior
- Persistência continua usando o fluxo existente `createOperationalRecord`.
- Quando persistência falha, fallback local em memória + localStorage é mantido.

## Dashboard alert reuse
- `DashboardPage` continua reutilizando handlers centrais:
  - `onResolveAlert`
  - `onSnoozeAlert`
  - `onAlertNavigate`
- Não foi duplicada lógica de alerta no dashboard.

## Manual verification results
1. Header Resolver clicked: não verificado manualmente neste ambiente
2. Header alert disappeared immediately: no
3. Header refresh kept it hidden: no
4. Header Adiar clicked: não verificado manualmente neste ambiente
5. Header alert disappeared immediately: no
6. Header refresh kept it hidden: no
7. Header Abrir navigated or showed safe message: no
8. Dashboard Resolver clicked, if dashboard alert exists: não verificado manualmente neste ambiente
9. Dashboard alert disappeared immediately: no
10. Dashboard refresh kept it hidden: no

## What was intentionally not changed
- Supabase schema
- RLS policies
- auth rules
- sync core behavior
- cloud diagnostic flow
- business calculations
- reports
- navigation grouping
- stock/finance/sanitary forms
- dashboard layout (apenas wiring de handlers já existente)

## Testing results
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .` sem conflitos
- `npm run build` OK
- `npm run lint` OK sem erros (warnings preexistentes de hooks)

## Files changed
- `src/App.jsx`
- `src/components/AppHeader.jsx`
