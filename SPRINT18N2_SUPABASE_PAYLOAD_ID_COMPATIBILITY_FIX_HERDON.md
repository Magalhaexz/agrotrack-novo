# SPRINT18N2_SUPABASE_PAYLOAD_ID_COMPATIBILITY_FIX_HERDON

## Escopo aplicado
- `src/services/operationalPersistence.js`
- `src/hooks/useOperationalData.js`

## Objetivo
Corrigir `400 Bad Request` por incompatibilidade de payload/tipo com o schema real (especialmente `id` em tabelas bigint e campos não suportados em alertas).

## Parte A — Nunca enviar `id` incompatível
### Ajuste
No builder de payload de create:
- `fazendas`: **não envia `id`** (bigint gerado pelo Supabase).
- `alertas_resolvidos` / `alertas_adiados`: **não envia `id`**.
- `local_id` é preservado em `metadata.local_id`.
- `cloud_id` em `fazendas` é enviado apenas quando UUID válido.

## Parte B — Compatibilidade de payload dos alertas
### `alertas_resolvidos` payload normalizado
Campos enviados:
- `owner_user_id`
- `chave`
- `ack_key`
- `origem`
- `resolved_at` (ISO/timestamptz)
- `metadata` (jsonb)
- `created_at` / `updated_at` quando capacidade ativa

Campos **não enviados**:
- `id`
- `observacao`
- outros não suportados

### `alertas_adiados` payload normalizado
Campos enviados:
- `owner_user_id`
- `chave`
- `origem`
- `ate` (ISO/timestamptz)
- `snooze_until` (ISO/timestamptz)
- `metadata` (jsonb)
- `created_at` / `updated_at` quando capacidade ativa

Campos **não enviados**:
- `id`
- `observacao`
- campos não suportados

## Parte C — Compatibilidade de payload de `fazendas`
Payload de create restringido a colunas existentes no schema confirmado:
- `owner_user_id`
- `nome`
- `proprietario`
- `responsavel`
- `cidade`
- `estado`
- `area_total_ha`
- `area_pastagem_ha`
- `capacidade_ua`
- `tipo_producao`
- `inscricao_estadual`
- `cnpj_cpf`
- `telefone`
- `email`
- `endereco`
- `status`
- `observacoes`
- `metadata`
- `hectares`
- `area`
- `hectares_pastagem`
- `capacidade_lotacao`
- `synced_from`
- `cloud_id`

Normalizações:
- numéricos -> `number | null`
- `metadata` sempre objeto JSON compatível
- `cloud_id` só quando UUID válido
- `id` omitido

## Parte D — Reads/queries
- `useOperationalData` voltou a tratar tabelas operacionais com owner scope por padrão (`OWNER_SCOPED_TABLES` inclui alertas e fazendas).
- Mantido fallback seguro de leitura sem owner scope em caso de erro de coluna (compatibilidade retroativa).

## Parte E — Diagnóstico seguro
Em erro 400, logs DEV continuam exibindo apenas dados seguros:
- `table`, `action`, `httpStatus`, `errorCode`, `requestStage`, `safeDetails`, `safeHint`, `syncStatus`.

Sem logs de tokens/headers/session completa/segredos.

## Verificação manual solicitada
1. `alertas_resolvidos` payload after normalization:
- Conforme seção Parte B (`owner_user_id`, `chave`, `ack_key`, `origem`, `resolved_at`, `metadata`, `created_at`, `updated_at`).

2. `alertas_adiados` payload after normalization:
- Conforme seção Parte B (`owner_user_id`, `chave`, `origem`, `ate`, `snooze_until`, `metadata`, `created_at`, `updated_at`).

3. `fazendas` payload after normalization:
- Conforme seção Parte C (somente colunas existentes do schema confirmado).

4. Whether id is omitted for bigint tables:
- **Sim**, `id` não é enviado no create de `fazendas` e alertas.

5. Resolver cloud save result:
- **Requer validação manual no ambiente Supabase real**.

6. Adiar cloud save result:
- **Requer validação manual no ambiente Supabase real**.

7. Fazenda create syncStatus:
- **Requer validação manual no ambiente Supabase real**.

8. If any 400 remains, exact safe message/details:
- Classificação padrão: `schema_error`
- Mensagem segura: `Registro salvo localmente. Sincronização pendente.`
- `safeDetails/safeHint` disponíveis em DEV log quando retornados pelo PostgREST.

## O que não foi alterado
- comportamento de clique das notificações
- layout/UI
- schema Supabase
- RLS e auth rules
- cálculos de negócio
- relatórios/dashboard/navegação

## Validação
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`:
  - sem conflitos encontrados
- `npm run build`:
  - OK
- `npm run lint`:
  - OK com warnings preexistentes (sem erros)
