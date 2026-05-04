# Sprint 10B.9 — Move Cloud Sync to Vercel Serverless API

## 1. Root Cause Addressed
A causa principal era falha de transporte no navegador para chamadas autenticadas diretas ao Supabase (`ERR_CONNECTION_RESET` / sem resposta HTTP), mesmo com REST público funcionando.

A solução foi mover sync crítico e diagnóstico autenticado para **rotas serverless Vercel**, evitando dependência de conexão browser->Supabase para operações autenticadas.

## 2. Files Changed
- `api/_supabaseAdmin.js`
- `api/cloud-diagnostic.js`
- `api/cloud-sync.js`
- `src/services/supabaseDiagnostics.js`
- `src/pages/FazendasPage.jsx`

## 3. API Routes Created

### 3.1 `api/_supabaseAdmin.js`
- Cliente Supabase **server-only** usando:
  - `process.env.SUPABASE_URL`
  - `process.env.SUPABASE_SERVICE_ROLE_KEY`
- Não exporta para frontend.
- Sem logs de segredos.

### 3.2 `api/cloud-diagnostic.js`
- Método: `POST` apenas.
- Checks server-side:
  - env server presente
  - leitura de `public.lotes`
  - leitura de `public.fazendas`
  - checks por `owner_user_id` quando `userId` informado
- Retorno seguro:
```json
{
  "ok": true,
  "checks": [
    { "name": "...", "status": "success|error", "table": "...", "httpStatus": 200, "code": null, "message": "..." }
  ]
}
```

### 3.3 `api/cloud-sync.js`
- Método: `POST` apenas.
- Payload esperado:
  - `userId`
  - `fazendas[]`
  - `lotes[]`
- Valida entrada.
- Sync server-side com service role.
- `owner_user_id = userId`.
- Preserva `metadata.local_id`.
- Preserva `cloud_id` quando UUID válido.
- Reconciliação por:
  - `cloud_id`
  - `metadata.local_id`
  - `id` quando seguro
- Evita duplicação em sync repetido.
- Retorna resultado por módulo com contagens e dados reconciliados.

## 4. Frontend Sync Changes

### Diagnóstico
- `runMinimalCloudDiagnostic()` agora usa **primariamente** `POST /api/cloud-diagnostic`.
- Mantém fallback para diagnóstico direto (debug/fallback), caso rota falhe.

### Sync manual
- Em `FazendasPage`, sync manual agora usa **primariamente** `POST /api/cloud-sync`.
- Atualiza estado local com dados reconciliados retornados pela API.
- Se rota falhar, mantém fallback direto (`syncFazendasWithCloud` / `syncLotesWithCloud`) e preserva modo local.

### Mensagens
Incluídas mensagens em português conforme solicitado:
- "Nuvem conectada pelo servidor."
- "Fazendas sincronizadas com a nuvem."
- "Lotes sincronizados com a nuvem."
- "Não foi possível sincronizar pelo servidor. O modo local continua ativo."
- "Configuração do servidor de nuvem incompleta."
- "Falha ao conectar o servidor à nuvem."

## 5. Security Notes
- `SUPABASE_SERVICE_ROLE_KEY` usado apenas em `api/`.
- Não usado em `src/`.
- Sem exposição de token/header/sessão completa nos retornos.
- Logs server-side limitados a status, módulo, tabela e contagens (sem segredos).

## 6. Build/Lint Results
- `npm.cmd run build`: **OK**
- `npm.cmd run lint`: **OK** (0 erros, warnings preexistentes de hooks)

## 7. Required Vercel Environment Variables
Frontend:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server-side:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 8. Manual Validation Steps
1. No Vercel, configurar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no Project Settings.
2. Redeploy.
3. Abrir app e clicar **"Testar conexão com a nuvem"**.
4. Confirmar que diagnóstico usa rota server e retorna checks.
5. Criar/editar lote e clicar sync.
6. Confirmar persistência em `public.lotes`.
7. Repetir sync e confirmar ausência de duplicatas.
8. Confirmar sync de `public.fazendas` permanece funcional.
9. Confirmar ausência de segredos em console/network.

## 9. Preservation Confirmations
- Sync de **Fazendas** preservado.
- Sync de **Lotes** preservado.
- Fallback local/offline preservado.
- Nenhum módulo/aba/subaba/rota removido.
