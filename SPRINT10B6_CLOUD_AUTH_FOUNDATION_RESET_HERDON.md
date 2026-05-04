# Sprint 10B.6 — Cloud Auth Foundation Reset and Reliable Sync Gate (HERDON)

## 1. Root Cause Fixed
A causa raiz era a **sessão Supabase inválida/expirada/corrompida** sendo reutilizada no navegador, o que mantinha falhas em chamadas autenticadas (REST com `Authorization` e queries via client) mesmo com REST público funcionando.

Também havia risco de continuidade de fluxo com sessão ruim em pontos de sync/diagnóstico e múltiplos textos corrompidos por encoding.

## 2. Files Changed
- `src/lib/supabase.js`
- `src/services/operationalPersistence.js`
- `src/services/supabaseDiagnostics.js`
- `src/pages/FazendasPage.jsx`
- `src/components/AppHeader.jsx`
- `src/App.jsx`
- `src/recharts.jsx`

## 3. Session Validation/Recovery Behavior
Implementado e consolidado `validateSupabaseSessionForCloud()` em `src/lib/supabase.js` com retorno estruturado:
- `ok`
- `status`: `valid | missing | expired | invalid | refresh_failed`
- `safeMessage`
- `authState` (somente booleanos):
  - `hasSession`
  - `hasAccessToken`
  - `tokenLooksJwt`
  - `tokenExpired`
  - `refreshAttempted`
  - `refreshSucceeded`

Fluxo:
- lê sessão via `supabase.auth.getSession()`
- valida presença de sessão/token
- valida formato JWT
- valida expiração via `exp` (decode seguro)
- tenta `refreshSession()` quando necessário
- se inválida, retorna bloqueio seguro sem expor segredo

## 4. Reconnect/Local Auth Cleanup Behavior
Implementada ação local-first de reconexão:
- botão **"Reconectar à nuvem"** em `FazendasPage`
- tenta `signOutLocalSafely()` (best effort)
- sempre executa `limparPersistenciaSessao()`
- limpa apenas chaves de auth Supabase (`sb-*`/supabase auth), sem `localStorage.clear()`
- preserva dados operacionais locais
- força logout local (`forceLocalSignOut`)
- mensagem exibida: **"Sessão local limpa. Entre novamente para conectar à nuvem."**

## 5. Protected Request Gate Behavior
Antes de chamadas protegidas:
- `ensureSupabaseRequestReadiness()` valida sessão por `validateSupabaseSessionForCloud()`
- sync de Fazendas/Lotes é bloqueado quando sessão inválida
- em `FazendasPage`, o botão manual valida sessão antes de disparar `syncFazendasWithCloud`/`syncLotesWithCloud`
- diagnóstico mínimo bloqueia `REST com sessão` e `Supabase client` quando sessão inválida

Mensagens seguras mantidas em português, sem token/header/session completo em log.

## 6. Diagnostics Updated
### Diagnóstico mínimo manual
Em `src/services/supabaseDiagnostics.js`:
- `runMinimalCloudDiagnostic()` com etapas:
  - `env_check`
  - `rest_without_session`
  - `session_check`
  - `rest_with_session`
  - `client_select`
- se sessão inválida:
  - `rest_with_session`: `Bloqueado por sessão inválida`
  - `client_select`: `Bloqueado por sessão inválida`

### Logs seguros
Mantidos logs seguros de auth/sync:
- `[HERDON_CLOUD_AUTH_DIAGNOSTIC]`
- `[HERDON_CLOUD_MINIMAL_DIAGNOSTIC]`
- `[HERDON_CLOUD_PRODUCTION_DIAGNOSTIC]`

Sem exposição de:
- anon key
- access token
- refresh token
- Authorization header
- objeto completo de sessão

## 7. Encoding Fixes
Foram corrigidos textos quebrados (UTF-8) no fluxo cloud/auth/UI, incluindo termos como:
- Sessão
- conexão
- configuração
- sincronização
- não
- possível
- módulo(s)

Arquivos principais corrigidos: `supabase.js`, `operationalPersistence.js`, `supabaseDiagnostics.js`, `FazendasPage.jsx`, `AppHeader.jsx`, `App.jsx`.

## 8. Build/Lint Results
### `npm.cmd run build`
- **Resultado:** sucesso

### `npm.cmd run lint`
- **Resultado:** sucesso com warnings preexistentes (`react-hooks/exhaustive-deps`)
- **Erros:** 0
- **Warnings:** 27

## 9. Manual Validation Notes
Neste ambiente de execução não foi possível validar UI/produção em navegador real ponta-a-ponta (login/relogin/sync com Supabase remoto).

Validação manual recomendada no ambiente alvo:
1. Abrir app e clicar **"Testar conexão com a nuvem"**.
2. Confirmar bloqueio de etapas protegidas quando sessão inválida.
3. Clicar **"Reconectar à nuvem"** e relogar.
4. Reexecutar diagnóstico e confirmar sessão válida.
5. Criar/editar lote e sincronizar.
6. Confirmar ausência de spam de requisições.

## 10. Preservation Confirmations
- Sync de **Fazendas** preservado.
- Sync de **Lotes** preservado.
- Fallback **local/offline** preservado.
- Nenhum módulo, aba, subaba ou rota foi removido.
- Nenhuma chave/token sensível foi adicionada em logs.
