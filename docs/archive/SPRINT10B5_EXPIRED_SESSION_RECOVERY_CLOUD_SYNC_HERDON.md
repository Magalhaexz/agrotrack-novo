# SPRINT10B5_EXPIRED_SESSION_RECOVERY_CLOUD_SYNC_HERDON

## 1. Root cause
A sessão local do Supabase podia estar expirada/corrompida (token inválido), mas o app ainda tentava chamadas protegidas em alguns fluxos, gerando falhas de auth no diagnóstico/sync.

## 2. Correções aplicadas

### Validação de sessão antes de endpoints protegidos
- Arquivo: `src/lib/supabase.js`
- Adicionado `validateSupabaseSessionForCloud()` com:
  - `getSession()`
  - validação de existência de sessão/token
  - validação de formato JWT (boolean)
  - checagem de expiração via `exp` (quando disponível)
  - tentativa de `refreshSession()` quando necessário

### Sync bloqueado quando sessão inválida
- Arquivo: `src/services/operationalPersistence.js`
- `ensureSupabaseRequestReadiness()` agora usa `validateSupabaseSessionForCloud()`.
- Se inválida:
  - não segue para Fazendas/Lotes protegidos
  - retorna mensagem de sessão expirada
  - evita spam/retry em loop
- Log seguro adicionado em DEV:
  - `[HERDON_CLOUD_AUTH_DIAGNOSTIC]`

### Diagnóstico mínimo alinhado com auth/session
- Arquivo: `src/services/supabaseDiagnostics.js`
- `runMinimalCloudDiagnostic()` agora:
  - valida/refresh sessão antes de REST com sessão e client
  - não chama endpoints protegidos se sessão inválida
  - classifica como `session_failure`
  - retorna `authState` seguro

### Ação de reconexão
- Arquivo: `src/pages/FazendasPage.jsx`
- Botão adicionado: **"Reconectar à nuvem"**
- Fluxo:
  - `signOutLocalSafely()`
  - `limparPersistenciaSessao()`
  - `forceLocalSignOut()`
  - mantém dados operacionais locais

### Diagnóstico seguro na UI
- Arquivo: `src/pages/FazendasPage.jsx`
- Em diagnóstico, quando houver `authState`, loga:
  - `[HERDON_CLOUD_AUTH_DIAGNOSTIC]`
  - somente campos seguros (booleans + safeMessage)

## 3. Preservações
- Sync de Fazendas preservado.
- Sync de Lotes preservado.
- Fallback local/offline preservado.
- Nenhum módulo/aba/subaba removido.

## 4. Validação
- `npm.cmd run build` ?
- `npm.cmd run lint` ? (27 warnings existentes, 0 errors)

## 5. Arquivos alterados
- `src/lib/supabase.js`
- `src/services/operationalPersistence.js`
- `src/services/supabaseDiagnostics.js`
- `src/pages/FazendasPage.jsx`
