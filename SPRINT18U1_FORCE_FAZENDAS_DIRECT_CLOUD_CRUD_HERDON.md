# SPRINT18U1_FORCE_FAZENDAS_DIRECT_CLOUD_CRUD_HERDON

## Por que ainda era necessário sincronizar manualmente
O fluxo ainda sofria com pendências antigas sendo reprocessadas e com replay de delete que podia manter estado pendente indevido. Isso fazia o usuário ver "Sincronização pendente" mesmo após operações válidas em nuvem e abria espaço para duplicação visual.

## Como o create automático foi corrigido
- Mantido create cloud-first via `createOperationalRecord('fazendas', payload, session)`.
- UI de create continua sem append cego; reconcilia por identidade lógica.
- Adicionados logs DEV seguros de create:
  - `[HERDON_FAZENDA_CREATE_FLOW]`
  - `[HERDON_FAZENDA_CREATE_RESULT]`
- Campos logados somente permitidos (sessão booleana, syncStatus, code, safeMessage, cloud id retornado, localId, dedupedCount).

## Como a duplicação foi impedida
- Reconciliação de create/update por identidade lógica (id/cloud_id/metadata.local_id/fallback).
- Limpeza automática de pendências correlatas após `cloud_success` (create/update/delete), evitando replay posterior que reintroduz duplicatas.
- Replay de delete separado de create/update (não passa por normalize de create).

## Como o edit automático funciona
- `updateOperationalRecord` segue cloud-first.
- Em sucesso cloud, pendências antigas correlatas de update são removidas.
- Em falha, fallback local + pendência segura.

## Como o delete automático funciona
- Delete usa seletor seguro (id numérico/cloud_id/metadata.local_id/fallback).
- Em sucesso cloud, remove pendências correlatas e não depende de sync manual.
- Em falha, cria pendência com selector (não apenas `{ id }`).

## Como a fila virou fallback de verdade
- Fila só permanece para falhas reais.
- `cloud_success` limpa pendências relacionadas automaticamente.
- Replay manual processa apenas pendências reais e não deve criar dados novos quando não há pendências.

## Verificação manual (nesta execução)
> Ambiente CLI sem UI/Supabase interativa para confirmar cliques e estado visual em tempo real.

1. Criar Fazenda sem clicar em Sincronizar
- toast: implementado por syncStatus
- syncStatus: cloud_success/pending_sync
- criou linha no Supabase: não validado nesta sessão CLI
- criou item na fila: apenas quando falha cloud
- duplicou no app: mitigado por reconciliação/dedupe

2. Clicar em Sincronizar depois
- criou duplicata: mitigado
- fila ficou vazia: depende de pendências reais

3. Ctrl + F5 após create
- continuou 1 card: depende de validação integrada

4. Editar Fazenda
- atualizou nuvem: fluxo implementado
- criou duplicata: mitigado
- toast: implementado

5. Excluir Fazenda
- removeu da nuvem: fluxo implementado
- voltou após refresh: depende de validação integrada

6. Fila pendente
- antes/depois create/edit/delete: não observável via CLI (localStorage/UI runtime)

## O que foi intencionalmente não alterado
- Login Google, notificações, dashboard, relatórios, mobile.
- Schema/RLS/auth Supabase.
- Cálculos de negócio, pagamentos, PRO/plans.

## Build/lint
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .` ✅
- `npm run build` ✅
- `npm run lint` ✅ (warnings existentes)
