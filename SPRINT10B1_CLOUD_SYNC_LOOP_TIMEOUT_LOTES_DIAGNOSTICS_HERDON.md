# SPRINT10B1_CLOUD_SYNC_LOOP_TIMEOUT_LOTES_DIAGNOSTICS_HERDON

## 1. Root cause found
Foram identificados dois gatilhos principais para comportamento de spam/repeticao de requests:
- No boot operacional (`useOperationalData`), a validacao de readiness baseada em sessao podia reacionar ciclo de auth/sessao e disparar nova hidracao em cascata.
- A sincronizacao manual nao tinha debounce/gate robusto em nivel de tela, permitindo cliques muito proximos e sobreposicao de fluxo em cenarios de latencia.

Tambem havia classificacao de erro pouco precisa para lotes (misturando cenarios HTTP com rede sem resposta), o que mascarava causa real.

## 2. Files changed
- src/services/operationalPersistence.js
- src/hooks/useOperationalData.js
- src/pages/FazendasPage.jsx

## 3. Request loop fix
### Boot/hydration
- Removido o passo de readiness remoto dentro do ciclo de hidratacao no `useOperationalData`.
- Mantido carregamento com timeout/circuit de snapshot, evitando gatilho extra de sessao.
- Adicionado cooldown para auto-sync (`AUTO_SYNC_COOLDOWN_MS`) para reduzir reentrada imediata.

### Manual sync
- Adicionado guard com `manualSyncRef` (inFlight + timestamp) em `FazendasPage`.
- Debounce de clique manual (~1.2s) para evitar reentrada/acoplamento de requests.

## 4. Timeout/circuit breaker behavior
### Circuit breaker por modulo
- Implementado circuito de rede em `operationalPersistence` por modulo (`fazendas` e `lotes`) com janela de pausa de 45s.
- Em falhas de rede sem resposta HTTP, o modulo entra em `skipped` temporario e evita novo spam imediato.

### Timeout/result estruturado
- `syncFazendasWithCloud` e `syncLotesWithCloud` agora retornam formato estruturado com:
  - `module`
  - `status` (`success | error | skipped | timeout`)
  - `message`
  - `code`
  - `httpStatus`
  - contadores e dados reconciliados
- Timeout de lotes passa a retornar mensagem especifica:
  - "A sincronização de lotes demorou mais que o esperado."

## 5. Lotes diagnostics added
Melhoria de classificacao para Lotes:
- 400 / `42703` / `PGRST204` ->
  "Estrutura da tabela de lotes incompatível com o app. Verifique as colunas no Supabase."
- 404 / `PGRST205` / `42P01` ->
  "Tabela de lotes não encontrada na nuvem. Verifique a estrutura do Supabase."
- 403 / `42501` / RLS ->
  "Permissão insuficiente para sincronizar lotes."
- 401 ->
  "Sessão expirada. Entre novamente para sincronizar com a nuvem."
- Sem resposta HTTP / reset / DNS / timeout de rede ->
  "Não foi possível conectar ao Supabase. Verifique sua conexão, DNS ou variáveis da nuvem."

Tambem foi adicionado log seguro estruturado por modulo (`HERDON_CLOUD_MODULE_SYNC`) contendo apenas:
- module, stage, table, host, httpStatus, postgrestCode, safeMessage

Sem chaves/tokens/session completos.

## 6. Build/lint results
- `npm.cmd run build` -> OK
- `npm.cmd run lint` -> OK (27 warnings preexistentes, 0 errors)

## 7. Fazendas sync preserved
- Preservado.
- `syncFazendasWithCloud` continua ativo e funcional, agora com retorno estruturado e guard de circuito de rede.

## 8. No module/tab/subtab removal
- Confirmado: nenhuma funcionalidade, modulo, aba ou subaba foi removida.
- Fallback local/offline foi preservado.
