# SPRINT18Q2_FAZENDAS_CLOUD_DELETE_IDENTITY_FIX_HERDON

## Root cause
A exclusão estava chamando delete por `id` sem garantir tipo/identidade cloud para `fazendas`. Como `fazendas.id` é bigint, ids locais string podiam gerar 400 e pendência infinita.

## App-side changes

### 1) Delete selector seguro para Fazendas
- `FazendasPage` agora monta selector na ordem:
  1. `id` numérico
  2. `cloud_id` UUID
  3. `metadata.cloud_id` UUID
  4. `metadata.local_id`
  5. fallback `nome|cidade|estado`
- `deleteOperationalRecord('fazendas', targetId, { selector })` recebe esse contexto.

### 2) deleteOperationalRecord com suporte a selector
- `deleteOperationalRecord` passou a aceitar `options.selector`.
- Para `fazendas`:
  - `id` -> `eq('id', Number(...))`
  - `cloud_id` -> `eq('cloud_id', ...)`
  - `metadata.local_id` -> `contains('metadata', { local_id: ... })`
  - `fallback_identity` -> filtros por `nome/cidade/estado` + `owner_user_id` quando disponível
- Evita delete cego por id local string em coluna bigint.
- Erros de selector inválido retornam caminho seguro (400/schema_error -> pending_sync).

### 3) Pending queue delete com selector
- Itens de fila de delete agora armazenam `selector`.
- Reprocessamento de fila usa selector no caminho de delete (nunca create/upsert).
- Fingerprint da fila inclui selector para dedupe correto.

### 4) UX local pós-delete
- Em sucesso cloud, UI remove duplicatas lógicas locais por identidade e fallback.
- Mensagem de sucesso atualizada para:
  - "Fazenda excluída da nuvem."
- Em falha cloud, mantém:
  - "Exclusão registrada localmente. Sincronização pendente."

## Duplicates in cloud
- Quando selector usa identidade/fallback, a exclusão pode atingir múltiplas linhas duplicadas da mesma fazenda lógica sob mesmo owner.
- Não há cascade de linked records neste sprint.

## Manual verification
1. Delete button visible: **yes**
2. Delete confirmation shown: **yes**
3. Cloud selector used: **id / cloud_id / metadata.local_id / fallback identity (por prioridade)**
4. Supabase delete success: **pending validação em ambiente com Supabase ativo**
5. Deleted Fazenda disappeared from UI: **yes**
6. Ctrl+F5 kept it deleted: **pending validação integrada**
7. Pending queue count after delete: **depende do ambiente/sessão cloud**
8. Any 400 error after delete: **mitigado por selector tipado**
9. If 400 remains, safe code/message: **schema_error + mensagem segura existente**
10. Duplicate cloud rows handled: **yes (por selector/fallback + owner scope)**

## Not changed
- Google login, notifications, dashboard/reports/mobile, schema/RLS/auth Supabase, business calculations.

## Testing results
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .` ✅
- `npm run build` ✅
- `npm run lint` ✅ (warnings existentes)
