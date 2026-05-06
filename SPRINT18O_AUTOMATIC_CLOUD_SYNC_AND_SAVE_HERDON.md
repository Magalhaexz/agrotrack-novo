# SPRINT18O_AUTOMATIC_CLOUD_SYNC_AND_SAVE_HERDON

## Resumo
Foi implementada uma base de sincronização automática cloud-first com fila de pendências, retry em background e indicador de pendências no header, mantendo o sync manual como backup.

## Arquivos alterados
- `src/services/operationalPersistence.js`
- `src/hooks/useOperationalData.js`
- `src/hooks/useCloudControls.js`
- `src/App.jsx`
- `src/components/AppHeader.jsx`

## 1) Cloud-first automático
### Comportamento aplicado
As operações centrais:
- `createOperationalRecord`
- `updateOperationalRecord`
- `deleteOperationalRecord`

continuam tentando cloud primeiro quando configuração/sessão estão prontas.

### Resultado de sucesso
- `syncStatus: "cloud_success"`
- mantém atualização local com retorno cloud (já existente nos fluxos)

### Resultado de falha
- fallback local preservado
- `syncStatus: "pending_sync"` ou `"local_only"`
- código seguro DEV (`schema_error`, `permission_denied`, `auth_not_ready`, `config_error`, `network_error`, `unknown`)
- mensagem segura: `Registro salvo localmente. Sincronização pendente.`

## 2) Fila de pendências (pending sync queue)
Implementada em `operationalPersistence` com `localStorage`:
- chave: `herdon-pending-sync-queue`
- item da fila inclui:
  - `table`
  - `action`
  - `localId`
  - `cloudId`
  - `payload`
  - `createdAt`
  - `lastAttemptAt`
  - `retryCount`
  - `code`
  - `message`

### Segurança
A fila não guarda tokens, JWT, headers, sessão completa ou segredos.

### APIs criadas
- `getPendingSyncQueueSnapshot()`
- `processPendingSyncQueue(session, { maxItems })`

### Estratégia de retry
- retry processa lote de itens com limite (`maxItems`)
- em sucesso remove item da fila
- em falha atualiza `retryCount`, `lastAttemptAt`, `code`, `message`

## 3) Gatilhos automáticos de retry
Em `App.jsx`:
- boot com sessão válida
- evento de pendência (`herdon-pending-sync-updated`)
- `online` (rede voltou)
- diagnóstico cloud verificado (`herdon-cloud-diagnostic-state` com `verified=true`)

Todos com debounce via `setTimeout` para evitar tempestade de requests.

Em `useCloudControls` (sync manual):
- após sync manual, tenta sincronizar pendências também.

## 4) Estado de header/cloud
`App` agora passa `pendingCount` para `syncStatus` do `AppHeader`.

`AppHeader` mostra estado compacto:
- `Sincronizacao pendente`
- detalhe: `1 pendencia de sync` ou `N pendencias de sync`

## 5) Leitura/hidratação automática
`useOperationalData` foi ajustado para não exigir sync manual para hidratar.

Antes:
- sem `syncNow`, ficava em `local_offline`.

Agora:
- com sessão válida, inicia ciclo automático (`auto_sync`) com debounce de boot já existente.

## 6) Estratégia de prevenção de duplicidade
- fila usa fingerprint lógico (`table:action:cloudId:localId`) para deduplicar entradas novas semelhantes.
- payloads já usam `metadata.local_id` / `cloud_id` onde aplicável nos fluxos compatíveis.
- create não afirma sucesso cloud sem confirmação real.

## 7) Fluxos auditados
A camada central de persistência foi aplicada aos fluxos que já usam os helpers operacionais (incluindo os módulos principais):
- Fazendas
- Lotes
- Animais
- Estoque
- Suplementação
- Financeiro / Pagamentos
- Sanitário / IATF
- Tarefas
- Pesagens
- Alertas resolvidos
- Alertas adiados

Obs.: a auditoria prática por tela depende de execução manual na UI (seção abaixo).

## 8) O que não foi alterado
- schema Supabase
- RLS/auth rules
- cálculos de negócio
- dashboard/reports/layout/navegação
- comportamento de clique das notificações

## 9) Manual verification (obrigatória)
### 1. Create Fazenda
- syncStatus: **não verificado manualmente**
- cloud row created: **não verificado manualmente**
- local fallback used: **não verificado manualmente**

### 2. Create Estoque item
- syncStatus: **não verificado manualmente**
- cloud row created: **não verificado manualmente**
- local fallback used: **não verificado manualmente**

### 3. Create Lote
- syncStatus: **não verificado manualmente**
- cloud row created: **não verificado manualmente**

### 4. Create Pagamento Diário
- syncStatus: **não verificado manualmente**
- cloud row created: **não verificado manualmente**

### 5. Create IATF protocol
- syncStatus: **não verificado manualmente**
- cloud row created: **não verificado manualmente**

### 6. Resolve alert
- syncStatus: **não verificado manualmente**
- cloud row created: **não verificado manualmente**

### 7. Adiar alert
- syncStatus: **não verificado manualmente**
- cloud row created: **não verificado manualmente**

### 8. Simulate local fallback
- pending item created: **não verificado manualmente**
- automatic retry attempted: **não verificado manualmente**

### 9. Header state
- before save: **não verificado manualmente**
- during sync: **não verificado manualmente**
- after success: **não verificado manualmente**

## Status de conclusão do sprint
De acordo com o critério solicitado, **não pode ser marcado como completo sem verificação manual em Fazenda, Estoque, alertas resolvidos e alertas adiados**.

**SPRINT NOT COMPLETE — manual verification pendente.**

## Testes executados
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`
  - sem conflitos encontrados
- `npm run build`
  - OK
- `npm run lint`
  - OK com warnings preexistentes (sem erros)
