# SPRINT10B4_PRODUCTION_CLOUD_RUNTIME_HOTFIX_HERDON

## 1. Root cause
Os requests de nuvem estavam sendo amplificados por dois pontos no runtime:
- `useOperationalData` ainda permitia hidratação/sync automática (via flag), gerando chamadas Supabase no boot em cenários específicos.
- O botão manual da tela de Fazendas executava pré-checks extras (`checkSupabaseCloudConnection` + probe), antes dos syncs de módulo, aumentando volume de requests por clique.

Com falha de transporte no navegador (ERR_HTTP2_PROTOCOL_ERROR / ERR_CONNECTION_RESET / ERR_CONNECTION_CLOSED), isso piorava percepção de loop e timeout.

## 2. Hotfix aplicado

### 2.1 Desativação de auto cloud sync no boot
Arquivo: `src/hooks/useOperationalData.js`
- Fluxo agora é estritamente local-first por padrão no boot.
- Sem sync automático no carregamento.
- Mantido `syncNow` manual.
- Estado inicial permanece passivo: dados locais ativos / nuvem não verificada.

### 2.2 Sync manual com tentativa única por clique
Arquivo: `src/pages/FazendasPage.jsx`
- Removidos pré-checks extras antes do sync de módulos no botão manual.
- O clique executa somente:
  1. `syncFazendasWithCloud`
  2. `syncLotesWithCloud`
- Debounce/guard de execução simultânea preservado.
- Sem retry infinito.
- Loading sempre finaliza no `finally`.

### 2.3 Diagnóstico seguro de produção em falha
Arquivos:
- `src/pages/FazendasPage.jsx`
- `src/services/operationalPersistence.js`

- Adicionado log seguro em falha manual:
  - `[HERDON_CLOUD_PRODUCTION_DIAGNOSTIC]`
- Campos incluídos:
  - `appOrigin`
  - `supabaseHost`
  - `module`
  - `table`
  - `stage`
  - `failureType`
  - `httpStatus`
  - `postgrestCode`
  - `safeMessage`
  - `cooldownState`

- Exportado helper de cooldown do circuito:
  - `getCloudSyncCooldownState(moduleName)`

### 2.4 Mensagens de falha de transporte no navegador
Arquivo: `src/services/operationalPersistence.js`
- Classificação para falhas sem resposta HTTP foi mantida como erro de rede/transporte.
- Mensagem segura adotada no sync de módulo:
  - "Falha de conexão do navegador com o Supabase. O modo local continua ativo."

## 3. Comportamento final
- Boot sem spam de requests automáticos de sync.
- Aplicação continua funcional em modo local/offline quando nuvem falha.
- Sync manual continua disponível e com feedback por módulo.
- Falha em Lotes não impede Fazendas de sincronizar.
- UI não fica presa em loading indefinido.

## 4. Validação
- `npm.cmd run build` ?
- `npm.cmd run lint` ? (27 warnings existentes; 0 errors)

## 5. Arquivos alterados
- `src/hooks/useOperationalData.js`
- `src/pages/FazendasPage.jsx`
- `src/services/operationalPersistence.js`

## 6. Preservações confirmadas
- Sync de Fazendas preservado.
- Sync de Lotes preservado.
- Fallback local/offline preservado.
- Nenhum módulo, aba, subaba ou rota foi removido.
