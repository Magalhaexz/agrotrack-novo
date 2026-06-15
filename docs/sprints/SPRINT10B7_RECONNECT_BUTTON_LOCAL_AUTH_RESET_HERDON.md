# Sprint 10B.7 — Fix Reconnect Button Crash and Local-Only Supabase Auth Reset

## 1. Root Cause Fixed
O crash ao clicar em **"Reconectar à nuvem"** era causado porque o fluxo ainda passava por `signOut` do Supabase Auth (mesmo em modo local), podendo disparar requisição de auth e quebrar com `ERR_CONNECTION_RESET` / `TypeError: Failed to fetch`.

## 2. Files Changed
- `src/lib/supabase.js`
- `src/pages/FazendasPage.jsx`

## 3. Reconnect Behavior
- Reconexão foi alterada para **local-only**:
  - novo helper `resetSupabaseAuthLocally()`
  - limpa apenas chaves de auth Supabase em `localStorage`/`sessionStorage`
  - regras: `sb-*`, `supabase.auth`, e chaves contendo `supabase`
  - não usa `localStorage.clear()`
  - não remove dados operacionais locais HERDON
- O botão **Reconectar à nuvem**:
  - possui estado de carregamento (`Reconectando...`)
  - captura erro com `try/catch/finally`
  - nunca propaga exceção para UI
  - mantém mensagem segura: **"Sessão local limpa. Entre novamente para conectar à nuvem."**
- Log seguro adicionado:
  - `[HERDON_CLOUD_RECONNECT_DIAGNOSTIC]`
  - campos: `action`, `localCleanupStarted`, `localCleanupSucceeded`, `remoteSignOutSkipped`, `safeMessage`

## 4. Protected Request Blocking Behavior
- Diagnóstico mínimo já bloqueava chamadas protegidas em sessão inválida; UI foi ajustada para exibir explicitamente:
  - `REST com sessão: Bloqueado por sessão inválida`
  - `Supabase client: Bloqueado por sessão inválida`
- Gate de sync já preservado:
  - com sessão inválida, não chama `syncFazendasWithCloud` nem `syncLotesWithCloud`
  - mantém fallback local/offline ativo

## 5. Build/Lint Results
- `npm.cmd run build`: **OK**
- `npm.cmd run lint`: **OK** (0 erros, 27 warnings preexistentes de hooks)

## 6. Local/Offline Data Preservation
Confirmado: o reset de reconexão não limpa banco operacional local, apenas estado de auth Supabase no navegador.

## 7. Fazendas/Lotes Sync Preservation
Confirmado: fluxos de sync de **Fazendas** e **Lotes** foram preservados, com bloqueio seguro quando sessão inválida.
