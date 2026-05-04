# Sprint 10B.9.1 — Secure Serverless Cloud Sync Auth

## 1. Root Cause Fixed
A rota serverless de sync aceitava `userId` do payload do navegador enquanto usava `SUPABASE_SERVICE_ROLE_KEY`, permitindo risco de spoof de ownership. Agora o usuário é derivado exclusivamente do token Bearer validado no servidor.

## 2. Files Changed
- `api/_supabaseAdmin.js`
- `api/cloud-diagnostic.js`
- `api/cloud-sync.js`
- `src/services/supabaseDiagnostics.js`
- `src/pages/FazendasPage.jsx`

## 3. Auth Hardening Implemented

### Frontend
- Chamadas para `/api/cloud-diagnostic` e `/api/cloud-sync` agora enviam:
  - `Authorization: Bearer <access_token>`
- Token não é logado.

### Server-side validation
- Novos helpers server-side:
  - `extractBearerToken(req)`
  - `resolveAuthenticatedUser(req)` via `supabase.auth.getUser(token)`
- Se token ausente/inválido nas rotas API, retorno 401 seguro:
```json
{
  "ok": false,
  "message": "Sessão expirada. Entre novamente para sincronizar com a nuvem."
}
```

### Ownership derivation
- `cloud-sync` ignora `userId` do body para ownership.
- `owner_user_id` é sempre `verifiedUser.id`.
- `cloud-diagnostic` também usa `verifiedUser.id` para checks owner-scoped.

## 4. Security Checks
- `SUPABASE_SERVICE_ROLE_KEY` aparece somente em `api/`.
- Nenhum uso de service role em `src/`.
- Sem log de token, header Authorization, refresh token ou sessão completa.

## 5. Validation Results
- `npm.cmd run build` -> **OK**
- `npm.cmd run lint` -> **OK** (0 erros, warnings preexistentes de hooks)

## 6. Manual Validation Checklist
1. Sessão inválida/logged out: chamar `/api/cloud-sync` -> retorna 401 com mensagem segura.
2. Sessão válida: diagnóstico funciona via server route com Authorization.
3. Sync grava `owner_user_id` usando usuário validado no servidor.
4. Alterar `userId` no payload não muda ownership real (spoof bloqueado).
5. Fallback local/offline continua funcional em falhas server/cloud.

## 7. Preservation Confirmation
- Sync de Fazendas preservado.
- Sync de Lotes preservado.
- Fallback local/offline preservado.
- Sem remoção de módulos/abas/subabas.
