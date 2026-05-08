# SPRINT18V3_FAZENDAS_CLOUD_ID_NULL_FIX_HERDON

## Objetivo
Corrigir erro `400/23502` no create de fazendas causado por envio de `cloud_id: null`.

## Correção aplicada
- Arquivo alterado: `src/services/operationalPersistence.js`
- No builder de payload de create para `fazendas`:
  - `cloud_id` agora **só é incluído** se for UUID válido.
  - Se `cloud_id` vier `null`, `undefined`, `""` ou inválido, a chave é removida do payload final.
  - Assim o default do banco pode gerar `cloud_id` automaticamente.
- Mantidos requisitos existentes:
  - `owner_user_id` obrigatório via `session.user.id`.
  - `nome` obrigatório e normalizado.
  - `id` não enviado no create.
  - `metadata.local_id` preservado.
- Validação reforçada antes do insert:
  - `owner_user_id` presente
  - `nome` presente
  - `id` ausente
  - `cloud_id` ausente ou UUID válido
  - `metadata` objeto válido
- Log DEV seguro adicionado:
  - `[HERDON_FAZENDA_CLOUD_ID_PAYLOAD_CHECK]`
  - Campos: `hasOwnerUserId`, `hasNome`, `hasCloudIdKey`, `cloudIdValid`, `cloudIdRemoved`, `payloadKeys`, `syncStatus`, `code`, `safeMessage`

## Verificação manual no relatório
1. Payload tinha cloud_id null antes da correção: **sim** (confirmado pelo erro 23502 informado)
2. Payload final removeu cloud_id inválido/null: **sim** (validado por código)
3. POST /fazendas retornou 400: **não validado manualmente neste ciclo**
4. Fazenda salvou na nuvem: **não validado manualmente neste ciclo**
5. Supabase gerou cloud_id: **não validado manualmente neste ciclo**
6. Criou pendência: **não validado manualmente neste ciclo**
7. Toast exibido: **não validado manualmente neste ciclo**
8. Header depois do create: **não validado manualmente neste ciclo**
9. Fila depois do create: **não validado manualmente neste ciclo**

## Validação executada
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`
  - sem conflitos de merge (sem matches)
- `npm.cmd run build`
  - OK
- `npm.cmd run lint`
  - OK com warnings preexistentes (0 errors, 30 warnings)
