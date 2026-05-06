# SPRINT18L2_HARD_FIX_NOTIFICATIONS_AND_CLOUD_DEBUG_HERDON

## Escopo executado
- `src/App.jsx`
- `src/components/AppHeader.jsx`
- `src/pages/FazendasPage.jsx`
- `src/pages/EstoquePage.jsx`
- `src/services/operationalPersistence.js`
- `src/styles/app.css`

## Root cause - notificações
- A chave do alerta ainda estava distribuída entre múltiplos fallbacks locais, em vez de passar por uma função única e consistente.
- O filtro de alertas ativos ainda dependia demais do estado persistido em `db`, sem combinar corretamente o fallback em `localStorage`.
- As ações do AppHeader fechavam o dropdown, mas não faziam atualização otimista suficiente para garantir desaparecimento imediato mesmo quando a persistência falhasse.
- O `Abrir` ainda podia falhar em alertas cujo destino vinha por `acao.rota` ou `pagina`.

## Root cause - cloud save fallback
- O app já fazia tentativa cloud-first, mas a razão da queda para local não ficava visível o suficiente em DEV no fluxo do usuário.
- O mecanismo central de persistência não publicava um evento explícito com `syncStatus`, `code` e mensagem segura para inspeção visual.
- Os fluxos de Fazenda/Estoque não distinguiam claramente `cloud_success` de `pending_sync/local_only` no feedback final.

## Correções aplicadas

### Notificações
- Adicionada função única `getAlertAckKey(alert)` em `App.jsx`.
- A mesma chave agora é usada para:
  - renderização
  - resolver
  - adiar
  - filtro de ativos
  - payload de persistência
- `Resolver` agora:
  - atualiza `db.alertas_resolvidos` imediatamente
  - grava fallback em `localStorage` (`herdon-alertas-resolvidos`)
  - tenta persistir via `createOperationalRecord`
  - mantém a remoção visual mesmo se a persistência falhar
- `Adiar` agora:
  - atualiza `db.alertas_adiados` imediatamente
  - grava fallback em `localStorage` (`herdon-alertas-adiados`)
  - usa `ate` + `snoozeUntil`
  - tenta persistir via `createOperationalRecord`
  - mantém a remoção visual mesmo se a persistência falhar
- O filtro ativo agora combina:
  - `db.alertas_resolvidos`
  - `db.alertas_adiados`
  - `localStorage herdon-alertas-resolvidos`
  - `localStorage herdon-alertas-adiados`
- `Abrir` agora usa fallback completo:
  - `alert.route`
  - `alert.rota`
  - `alert.acao?.rota`
  - `alert.pagina`
- No `AppHeader`, os botões passaram a usar clique protegido com `preventDefault`/`stopPropagation` nos pontos críticos e chave unificada no render.

### DEV debug de notificações
- Adicionada linha DEV-only em cada card de notificação com:
  - `ackKey`
  - `resolved: sim/não`
  - `adiado: sim/não`
  - `route found: sim/não`
- Nenhum segredo, token, JWT, header ou sessão completa é exibido.

### Cloud debug
- `operationalPersistence.js` agora publica evento seguro `herdon-cloud-save-state` em:
  - readiness fail
  - success
  - write fail
- O evento inclui apenas:
  - `table`
  - `action`
  - `syncStatus`
  - `code`
  - mensagem segura
  - `cloudConfigured`
  - `sessionPresent`
  - `userIdPresent`
- `App.jsx` agora escuta esse evento e mantém estado DEV-only de diagnóstico.
- `AppHeader` mostra bloco DEV-only com:
  - `cloudConfigured`
  - `sessionPresent`
  - `userIdPresent`
  - `lastCloudSaveTable`
  - `lastCloudSaveStatus`
  - `lastCloudSaveCode`
  - mensagem segura

### Fazenda / Estoque
- Os fluxos de cadastro agora mostram feedback correto:
  - `Registro salvo na nuvem.` quando `syncStatus === "cloud_success"`
  - `Registro salvo localmente. Sincronização pendente.` quando `syncStatus === "pending_sync"` ou `local_only`
- Em DEV, o motivo seguro do fallback é anexado ao toast.

## O que não foi alterado
- Schema
- RLS
- regras de auth
- cálculos de negócio
- relatórios
- layout do dashboard
- agrupamento de navegação

## Validação
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`
  - sem conflitos encontrados
- `npm run build`
  - sucesso
- `npm run lint`
  - sucesso sem erros; warnings preexistentes de hooks

## Manual UI verification
1. Resolver clicked on alert title: não verificado manualmente neste ambiente
2. Alert disappeared immediately: no
3. Refresh kept it hidden: no
4. Adiar clicked on alert title: não verificado manualmente neste ambiente
5. Alert disappeared immediately: no
6. Refresh kept it hidden: no
7. Abrir navigated or showed safe message: no
8. Fazenda save syncStatus: não verificado manualmente neste ambiente
9. Estoque item save syncStatus: não verificado manualmente neste ambiente
10. Cloud fallback reason/code if not cloud_success: não verificado manualmente neste ambiente

## Status
- Sprint não marcada como concluída.
- O código foi corrigido e validado por build/lint, mas a verificação manual real de UI exigida ainda precisa ser executada para confirmar comportamento final.
