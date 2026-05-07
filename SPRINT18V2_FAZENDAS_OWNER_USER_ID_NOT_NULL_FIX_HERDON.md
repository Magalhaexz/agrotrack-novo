# SPRINT18V2_FAZENDAS_OWNER_USER_ID_NOT_NULL_FIX_HERDON

## Objetivo
Corrigir falha 400/23502 no create de fazendas garantindo `owner_user_id` e `nome` obrigatorios no fluxo cloud-first.

## Ajustes realizados
- `src/pages/FazendasPage.jsx`
  - Garantido uso de `session` por prop (`sessionProp`) com fallback para `useAuth`.
  - Normalizacao obrigatoria de `nome` no create: `String(nome ?? '').trim()`.
  - Bloqueio de create com toast: `Informe o nome da fazenda.` quando vazio.
  - Mensagem explicita quando nao ha `session.user.id`: `Sessão da nuvem não encontrada. Faça login novamente para salvar na nuvem.`

- `src/services/operationalPersistence.js`
  - Builder de fazendas agora sempre define `owner_user_id` a partir da sessao (`userId || null`) para evitar perda por capability cache.
  - Adicionada validacao dedicada `validateFazendaCreatePayload` antes do insert:
    - `owner_user_id` presente
    - `nome` presente
    - sem `id` no payload
    - `cloud_id` somente se UUID valido
    - `metadata` JSON objeto valido
  - Adicionado log DEV seguro:
    - `[HERDON_FAZENDA_CREATE_PAYLOAD_CHECK]`
    - campos: `hasSession`, `hasUserId`, `hasOwnerUserId`, `hasNome`, `payloadKeys`, `syncStatus`, `code`, `safeMessage`
  - Quando faltou sessao em `create` de fazendas, fallback passa mensagem especifica:
    - `Sessão da nuvem não encontrada. Faça login novamente para salvar na nuvem.`

## Resultado funcional esperado
- Com usuario logado e sessao valida, create de fazenda envia `owner_user_id` e `nome`, tenta nuvem primeiro e evita `pending_sync`.
- Sem sessao valida, nao tenta POST valido, fica local com pendencia e mensagem clara de sessao.

## Verificacao manual no relatorio
1. session.user.id chegou em FazendasPage: **parcial (validado por codigo)**
2. payload enviado tinha owner_user_id: **parcial (validado por codigo)**
3. payload enviado tinha nome: **parcial (validado por codigo)**
4. POST /fazendas retornou 400: **nao validado manualmente neste ciclo**
5. Fazenda salvou na nuvem: **nao validado manualmente neste ciclo**
6. Criou pendência: **nao validado manualmente neste ciclo**
7. Toast exibido: **nao validado manualmente neste ciclo**
8. Header depois do create: **nao validado manualmente neste ciclo**
9. Fila depois do create: **nao validado manualmente neste ciclo**

## Validacao tecnica executada
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`  
  - Sem conflitos de merge (exit 1 por ausencia de matches).
- `npm.cmd run build`  
  - OK.
- `npm.cmd run lint`  
  - OK com warnings preexistentes (0 errors, 30 warnings).
