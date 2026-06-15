# SPRINT 10B.3 — Minimal Cloud Diagnostic (HERDON)

## 1. Resumo
Foi implementado um diagnóstico mínimo e isolado de conectividade Supabase no navegador, acionado **apenas por clique manual** em "Testar conexão com a nuvem". O fluxo não depende do pipeline completo de sincronização e separa claramente validação de ambiente, REST sem sessão, REST com sessão e cliente Supabase.

## 2. Etapas implementadas
Arquivo principal: `src/services/supabaseDiagnostics.js`

### A) Runtime env check
Validações seguras:
- `supabaseUrlPresent`
- `anonKeyPresent`
- `host`
- `urlValid`
- `anonKeyLooksValid` (boolean)

### B) REST sem Authorization
Requisição direta:
- `GET /rest/v1/lotes?select=id&limit=1`
- Header: `apikey`
- Sem `Authorization`

Captura segura:
- `ok`
- `httpStatus`
- `postgrestCode`
- `failureType`
- `safeMessage`

### C) REST com Authorization (se sessão existir)
Requisição direta:
- mesmo endpoint
- headers: `apikey` + `Authorization: Bearer <token>`

Captura segura sem expor token.

### D) Supabase client select
Consulta:
- `supabase.from('lotes').select('id,nome,cloud_id').limit(1)`

Captura segura de status/código/tipo de falha.

## 3. UI de diagnóstico manual
Arquivo: `src/pages/FazendasPage.jsx`

Foi conectado o botão manual:
- Label: **"Testar conexão com a nuvem"**
- Não roda no boot
- Não roda em loop
- Bloqueado durante execução (`diagnosticandoNuvem`)

Feedback por etapa em português:
- "Ambiente configurado: OK/Erro"
- "REST sem sessão: OK/Erro"
- "REST com sessão: OK/Erro"
- "Supabase client: OK/Erro"

Conclusões exibidas:
- "Falha de conexão do navegador com o Supabase. O modo local continua ativo."
- "Falha no cliente Supabase. Verifique sessão e configuração."
- "Sessão inválida ou expirada. Entre novamente."
- "Conectividade com a nuvem validada."

## 4. Console seguro
Foi adicionado log agrupado:
- `[HERDON_CLOUD_MINIMAL_DIAGNOSTIC]`

Campos seguros:
- `appOrigin`
- `supabaseHost`
- `envStatus` (booleans)
- `step`
- `table`
- `endpointPath`
- `httpStatus`
- `postgrestCode`
- `failureType`
- `safeMessage`

Sem exposição de:
- anon key
- access token
- authorization header
- refresh token
- sessão completa

## 5. Classificação de falhas
Classificação separada para:
- `auth`
- `rls`
- `schema`
- `payload`
- `timeout`
- `http2_protocol_error`
- `network_reset`
- `unknown`

## 6. Preservação de funcionalidades
Confirmado nesta entrega:
- Sync de Fazendas preservado
- Sync de Lotes preservado
- Fallback local/offline preservado
- Nenhum módulo/taba/subtaba removido
- Sem alteração de regra de negócio

## 7. Validação
Comandos executados:
- `npm.cmd run build` ?
- `npm.cmd run lint` ? (27 warnings já existentes, 0 errors)

## 8. Próxima recomendação
Executar o novo botão em navegador normal e anônimo para capturar o primeiro passo que falha e, com isso, decidir o próximo sprint:
1. Se falhar em REST sem sessão com `network_reset/http2_protocol_error`: foco em transporte/browser/proxy/CDN.
2. Se REST sem sessão OK e com sessão falhar: foco em sessão JWT/Auth.
3. Se REST OK e client falhar: foco no cliente Supabase/config local.
4. Se tudo OK: foco no pipeline de sync (reconciliação/fluxo de módulos).
