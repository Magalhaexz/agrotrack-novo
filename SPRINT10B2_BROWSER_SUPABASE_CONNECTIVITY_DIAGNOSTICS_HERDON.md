# SPRINT10B2_BROWSER_SUPABASE_CONNECTIVITY_DIAGNOSTICS_HERDON

## 1. Root cause found
A falha recorrente no navegador vinha da combinacao de:
- chamadas cloud em cadeia no boot/sync sem visibilidade de endpoint exato;
- feedback generico de erro/timeout sem separar modulo/tabela;
- cliques manuais proximos que podiam acionar fluxo concorrente.

No navegador, o ponto critico de diagnostico foi concentrado em `public.lotes` (endpoint REST equivalente `/rest/v1/lotes?select=id&limit=1`) para detectar falhas de transporte HTTP2/reset/closed com timeout controlado.

## 2. Files changed
- src/services/supabaseDiagnostics.js
- src/pages/FazendasPage.jsx
- src/components/AppHeader.jsx

## 3. Which endpoint/table was failing
Endpoint/tabela alvo de probe e diagnostico:
- `public.lotes`
- path seguro: `/rest/v1/lotes?select=id&limit=1`

Com esse probe, quando ocorre erro de navegador, agora fica explicito no console/feedback que o modulo/tabela em falha eh `lotes` (em vez de timeout generico).

## 4. What automatic calls were removed or cooled down
- Mantido modelo local-first: sem disparo automatico de sync manual.
- Boot continua com hidratacao local e auth minima, sem loop de manual sync.
- Sync manual recebeu debounce/guard (ja aplicado em 10B.1 e preservado aqui), evitando chamadas concorrentes.
- Probe browser-safe foi adicionado apenas no fluxo manual (uma vez por clique), sem retries infinitos.

## 5. Diagnostics added
### Browser-safe probe
Nova funcao:
- `runBrowserSafeCloudProbe({ table: 'lotes', timeoutMs, session })`

Retorno seguro:
- `ok`
- `table`
- `endpoint`
- `httpStatus`
- `postgrestCode`
- `failureType` (`network_reset`, `http2_protocol_error`, `timeout`, `auth`, `rls`, `schema`, `payload`, `unknown`)
- `safeMessage`

### Console grouped diagnostic on failure
Adicionado grupo temporario quando sync falha:
- `[HERDON_CLOUD_DIAGNOSTIC]`

Campos seguros:
- app origin
- supabase host
- module
- table
- stage
- failure type
- http status
- postgrest code
- safe message
- retry/cooldown state

Sem anon key, token, Authorization ou sessao completa.

## 6. Manual sync behavior after fix
Ao clicar sync:
- bloqueia cliques duplicados enquanto em execucao
- executa probe de navegador para `lotes` com timeout bounded
- sincroniza Fazendas e Lotes
- mostra resultado por modulo (sucesso/erro) com mensagem especifica
- em falha de rede no navegador, para de insistir em loop e preserva dados locais

## 7. Build/lint results
- `npm.cmd run build` -> OK
- `npm.cmd run lint` -> OK (27 warnings preexistentes, 0 errors)

## 8. Confirmation Fazendas and Lotes sync were preserved
- Fazendas sync: preservado
- Lotes sync: preservado
- fallback local/offline: preservado

## 9. Confirmation no functionality/modules/tabs/subtabs were removed
- Confirmado: nenhuma remocao de funcionalidades, modulos, tabs ou subtabs.
