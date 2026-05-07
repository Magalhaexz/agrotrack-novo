# SPRINT18U2C_FAZENDAS_DIRECT_CLOUD_EDIT_HERDON

## Objetivo
Garantir que **edição de Fazenda** atualize direto no Supabase, sem criar nova linha/card, usando seletor robusto.

## Implementação

### 1) Seletor de update na edição
Em `FazendasPage`, ao editar, o fluxo agora constrói selector por prioridade:
1. `id` numérico cloud
2. `cloud_id`
3. `metadata.cloud_id`
4. `metadata.local_id`
5. fallback `nome|cidade|estado`

Esse selector é enviado para:
- `updateOperationalRecord('fazendas', targetId, patch, session, { selector })`

### 2) updateOperationalRecord com selector
Em `operationalPersistence`:
- `updateOperationalRecord` passou a aceitar `options.selector`.
- Para tabela `fazendas`, o update aplica filtro por:
  - `id`
  - `cloud_id`
  - `metadata.local_id`
  - fallback `nome/cidade/estado`
- Mantém `owner_user_id` scope quando disponível.
- Não converte update em create.

### 3) Pendência de update com selector completo
Se update falhar:
- cria pendência de update incluindo `selector`.
- replay de fila agora passa `selector` também para `updateOperationalRecord`.

### 4) Mensagens e comportamento
- Sucesso: `Fazenda atualizada na nuvem.`
- Falha: `Fazenda atualizada localmente. Sincronização pendente.`
- Atualização local continua reconciliada por identidade lógica já existente no fluxo.

## Verificação manual (nesta execução)
> Ambiente CLI sem interação UI/Supabase em tempo real.

1. Editar Fazenda:
- atualizou mesma linha no Supabase: **pendente validação integrada**
- criou duplicata: **mitigado por update seletivo + reconciliação; pendente validação UI**
- toast: **implementado**
- criou pendência: **sim, apenas quando falha cloud**

## Validação
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .` ✅
- `npm run build` ✅
- `npm run lint` ✅ (warnings existentes)
