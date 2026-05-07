# SPRINT18U2B_FAZENDAS_DEDUP_AND_HYDRATION_FIX_HERDON

## Objetivo
Eliminar duplicação visual de Fazendas após create, sync manual e refresh, garantindo uma única Fazenda lógica por identidade.

## Ajuste aplicado

### Deduplicação robusta na hidratação (`useOperationalData`)
Foi reforçada a função de dedupe de `fazendas` com:

1. **Identidade lógica** (prioridade de chave)
- `id` cloud
- `cloud_id`
- `metadata.cloud_id`
- `metadata.local_id`
- fallback `nome|cidade|estado`

2. **Regra de winner em duplicatas**
- preferir registro com identidade cloud
- preferir maior `updated_at` (fallback `created_at`)
- fallback determinístico por texto estável

3. **Efeito esperado**
- local + cloud da mesma fazenda não renderizam 2 cards
- duplicatas antigas no Supabase são colapsadas para 1 fazenda lógica
- refresh (Ctrl+F5) mantém lista deduplicada

## Verificação manual (nesta execução)
> Ambiente CLI sem interação UI em tempo real.

1. Criar Fazenda:
- apareceu 1 card: **pendente validação UI**

2. Clicar em Sincronizar depois:
- criou duplicata: **mitigado por dedupe/hidratação; pendente validação UI**

3. Ctrl + F5:
- continuou 1 card: **pendente validação UI**

4. Supabase com duplicatas antigas:
- UI mostra apenas uma Fazenda lógica: **mitigado por dedupe; pendente validação UI**

## Não alterado
- Create cloud-first U2A.
- Edit/Delete flows.
- Login/notifications/dashboard/relatórios.
- Schema/RLS/auth.

## Validação
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .` ✅
- `npm run build` ✅
- `npm run lint` ✅ (warnings existentes)
