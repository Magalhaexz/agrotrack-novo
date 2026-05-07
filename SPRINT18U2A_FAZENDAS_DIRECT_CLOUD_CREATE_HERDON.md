# SPRINT18U2A_FAZENDAS_DIRECT_CLOUD_CREATE_HERDON

## Objetivo
Garantir que **cadastro de Fazenda** tente salvar direto no Supabase quando houver sessão real (`session.user.id`) e só use fila pendente em falha real.

## Ajustes aplicados

1. Mantido create cloud-first
- Fluxo de cadastro continua chamando `createOperationalRecord('fazendas', createPayload, session)`.
- Resultado é aguardado e tratado por `syncStatus`.

2. Regras de UX preservadas
- `cloud_success` -> toast: **"Registro salvo na nuvem."**
- falha (`pending_sync`/`local_only`) -> toast: **"Registro salvo localmente. Sincronização pendente."**

3. Sem append cego
- Lista local continua reconciliada por identidade lógica (id/cloud_id/metadata.local_id/fallback), evitando card duplicado no create.

4. Log DEV obrigatório adicionado
- Novo log: `[HERDON_FAZENDA_DIRECT_CREATE]`
- Campos logados (somente seguros):
  - `hasSession`
  - `hasUserId`
  - `attemptedCloud`
  - `syncStatus`
  - `code`
  - `safeMessage`
  - `payloadKeys`
- Não loga token/JWT/anon key/headers/sessão completa/segredos.

## Payload de create
- O payload de Fazenda é montado pelo serviço de persistência e enviado com normalização cloud-safe.
- `id` local não deve ser usado em insert (tabela com bigint auto).
- `metadata.local_id` permanece garantido no create local do formulário.

## Verificação manual (nesta execução)
> Ambiente CLI sem interação UI/Supabase em tempo real.

1. Criar Fazenda sem clicar em Sincronizar:
- toast: implementado por `syncStatus`
- syncStatus: `cloud_success` ou `pending_sync`
- hasSession: observado por log DEV
- hasUserId: observado por log DEV
- criou linha no Supabase: não validado nesta sessão
- criou item na fila: apenas em falha
- duplicou no app: mitigado por reconciliação

## Critério de não conclusão
- Ainda depende de validação integrada (browser + Supabase) para afirmar 100% dos cenários reais.

## Validação
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .` ✅
- `npm run build` ✅
- `npm run lint` ✅ (warnings existentes)
