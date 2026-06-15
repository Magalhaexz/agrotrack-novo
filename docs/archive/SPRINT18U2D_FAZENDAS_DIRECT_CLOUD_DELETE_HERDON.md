# SPRINT18U2D_FAZENDAS_DIRECT_CLOUD_DELETE_HERDON

## Objetivo
Garantir exclusão de Fazenda direto na nuvem (Supabase), sem depender de sincronização manual, mantendo bloqueio por vínculos.

## Ajustes aplicados

1. **Bloqueio por vínculos locais (preservado)**
- Antes de excluir, segue checando:
  - lotes
  - animais
  - movimentacoes_financeiras
  - estoque
  - sanitario
- Se houver vínculo, mostra:
  - "Esta fazenda possui registros vinculados. Remova ou transfira os registros antes de excluir."

2. **Delete cloud-first com selector seguro (preservado)**
- Fluxo usa selector por prioridade:
  - id numérico cloud
  - cloud_id
  - metadata.cloud_id
  - metadata.local_id
  - fallback nome|cidade|estado

3. **Pendência de delete nunca só `{ id }`**
- `deleteOperationalRecord` agora aceita `options.pendingPayload`.
- Em falha cloud/readiness, pendência usa payload completo quando informado.
- `FazendasPage` passou `pendingPayload` com:
  - `id`
  - `selector`
  - `metadata.local_id`
  - `nome`
  - `cidade`
  - `estado`

4. **Mensagens de resultado**
- Sucesso cloud: "Fazenda excluída da nuvem."
- Falha cloud: "Exclusão registrada localmente. Sincronização pendente."

## Verificação manual (nesta execução)
> Ambiente CLI sem UI/Supabase interativa em tempo real.

1. Excluir Fazenda sem vínculo:
- removeu do Supabase sem sincronizar manualmente: **pendente validação integrada**
- removeu da UI: **implementado**
- voltou após Ctrl + F5: **pendente validação integrada**
- criou pendência: **apenas em falha cloud**

2. Excluir Fazenda com vínculo:
- bloqueou exclusão: **implementado**
- mostrou aviso correto: **implementado**

## Validação
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .` ✅
- `npm run build` ✅
- `npm run lint` ✅ (warnings existentes)
