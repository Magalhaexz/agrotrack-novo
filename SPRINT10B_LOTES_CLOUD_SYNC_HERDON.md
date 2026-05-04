# SPRINT10B_LOTES_CLOUD_SYNC_HERDON

## Executive summary
Foi implementado um pipeline dedicado de sincronizacao de Lotes, espelhando o padrao de Fazendas e mantendo fallback local/offline. O fluxo manual de sincronizacao agora processa Fazendas e Lotes no mesmo clique, sem remover funcionalidades existentes.

## Files changed
- src/services/operationalPersistence.js
- src/pages/FazendasPage.jsx

## Lotes payload mapping (mapLoteToCloudPayload)
Campos mapeados para `public.lotes`:
- owner_user_id
- nome
- faz_id
- entrada
- saida
- status
- tipo
- sistema
- gmd_meta
- preco_arroba
- rendimento_carcaca
- investimento
- peso_alvo
- raca
- sexo
- categoria
- obs
- p_ini
- p_at
- ultima_pesagem
- data_saida
- fechamento
- metadata
- cloud_id (somente quando UUID valido)

Metadados incluidos:
- metadata.local_id
- metadata.synced_from = `herdon_manual_lotes_sync`
- metadata.synced_at

## Sync behavior implemented
Nova funcao: `syncLotesWithCloud({ lotes, session })`.

Comportamento:
1. Valida readiness com `ensureSupabaseRequestReadiness`.
2. Busca lista remota de lotes do usuario (`owner_user_id`).
3. Para cada lote local, tenta reconciliar por:
   - `cloud_id` local vs `id` remoto
   - `cloud_id` local vs `cloud_id` remoto
   - `id` local vs `metadata.local_id` remoto
   - `id` local vs `id` remoto
4. Se encontrou match remoto: `update` no registro remoto.
5. Se nao encontrou match: `insert`.
6. Retorna lista reconciliada via `mergeLotesSafe` para atualizar estado local sem duplicacao no re-sync.
7. Mantem fallback local seguro em caso de erro.

## Manual sync flow updated
Em `FazendasPage`:
- O botao manual agora sincroniza Fazendas + Lotes.
- Se Fazendas sincronizar e Lotes falhar, exibe aviso seguro de Lotes sem quebrar Fazendas.
- Fazendas continua sendo sincronizada pelo fluxo original (`syncFazendasWithCloud`).

## Diagnostics added
Classificacao dedicada para Lotes (`classifyLotesSyncError`):
- Tabela ausente/schema: "Tabela de lotes não encontrada na nuvem. Verifique a estrutura do Supabase."
- RLS/permissao: "Permissão insuficiente para sincronizar lotes."
- Config/env: "Configuração da nuvem incompleta. Verifique as variáveis do Supabase."
- Rede: "Não foi possível conectar à nuvem. Verifique sua conexão e tente novamente."
- Validacao de payload: "Não foi possível validar os dados do lote para sincronização na nuvem."

Tambem foi mantida classificacao operacional segura sem logging de secrets/tokens.

## Validation commands
- `npm.cmd run build` -> OK
- `npm.cmd run lint` -> OK com warnings pre-existentes (27 warnings, 0 errors)

## Manual validation status
Nao foi possivel validar manualmente contra Supabase real neste ambiente (sem execucao interativa remota aqui). O fluxo foi preparado para os cenarios pedidos:
- criar/editar lote local
- sync manual
- re-sync sem duplicacao
- fallback local em falha cloud

## Confirmations
- Fazendas sync preservado: SIM
- Funcionarios sync implementado nesta sprint: NAO
- Modulos/tabs/subtabs removidos: NAO
- Fallback local/offline removido: NAO
