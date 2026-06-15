# SPRINT10A_CLOUD_SYNC_ARCHITECTURE_AUDIT_HERDON

## 1. Executive summary
A auditoria confirmou que o HERDON possui sincronizacao cloud robusta e dedicada para Fazendas, mas ainda nao possui pipeline equivalente para Lotes e Funcionarios. O comportamento atual desses modulos depende de tentativas CRUD diretas no Supabase; quando schema/RLS/config falham, o app continua local (fallback), sem reconciliacao completa por modulo.

## 2. Current Fazenda sync path
### Persistencia local
- Fonte local: `db.fazendas` em estado operacional (`useOperationalData` + `setDb`).
- CRUD local+cloud na tela: `FazendasPage` usa `createOperationalRecord`, `updateOperationalRecord`, `deleteOperationalRecord`.

### Sync cloud dedicado
- Botao manual em `FazendasPage`: `sincronizarFazendasComNuvem`.
- Validacao previa: `checkSupabaseCloudConnection({ session })`.
- Pipeline principal: `syncFazendasWithCloud({ fazendas, session })`.

### Campos enviados em Fazendas
Mapeamento em `mapFazendaToCloudPayload`:
- `owner_user_id`
- `nome`
- `proprietario` (fallback de `responsavel`)
- `cidade`
- `estado`
- `area_total_ha` (fallback `hectares`/`area`)
- `area_pastagem_ha` (fallback `hectares_pastagem`)
- `capacidade_ua` (fallback `capacidade_lotacao`)
- `tipo_producao`
- `inscricao_estadual`
- `cnpj_cpf`
- `telefone`
- `email`
- `endereco`
- `status`
- `observacoes` (fallback `observacao`/`obs`)
- `metadata`

### owner_user_id / cloud_id / metadata / timestamps
- `owner_user_id`: sempre anexado com `session.user.id`.
- `cloud_id`: resolvido via `metadata.cloud_id` ou `cloud_id` local (`getCloudIdMarker`), e reforcado no merge com remoto.
- `metadata.local_id`: preenchido na sanitizacao (`sanitizeMetadata`) para reconciliar local x cloud.
- `metadata.synced_from`/`metadata.synced_at`: adicionados no sync de fazendas.
- timestamps: o frontend nao controla `created_at/updated_at` de forma central no sync de fazendas; isso deve ser responsabilidade do banco/trigger.

### RLS/session readiness
- `ensureSupabaseRequestReadiness` valida:
  - variaveis Supabase configuradas (`getSupabaseEnvStatus`)
  - sessao app com `session.user.id`
  - sessao ativa no SDK (`supabase.auth.getSession` / `refreshSession`)
  - token presente e user consistente.

### Classificacao de erros
- Persistencia operacional: `classifyOperationalError` (rede, permissao/RLS, schema, config).
- Sync dedicado Fazendas: `classifyFazendasSyncError` + checks por status/codigo.
- Diagnostico geral: `runSupabaseConnectivityDiagnostics` (REST + SDK), hoje orientado a tabela `fazendas`.

## 3. Why Lotes are not syncing
### Campos locais reais de Lotes (encontrados no codigo)
Cadastro/edicao e operacao usam principalmente:
- IDs/relacoes: `id`, `faz_id`
- Identificacao/base: `nome`, `tipo`, `sistema`, `status`
- Datas: `entrada`, `saida`, `data_saida`, `data_encerramento`, `ultima_pesagem`
- Peso/meta: `p_ini`, `p_at`, `peso_alvo`, `gmd_meta`
- Financeiro/produtivo: `investimento`, `preco_arroba`, `rendimento_carcaca`
- Classificacao zootecnica: `raca`, `sexo`, `categoria`
- Suplementacao no lote: `supl_nome`, `supl_rkg`, `supl_pv_pct`, `supl_estoque_kg`, `supl_meta_dias`
- Fechamento: `fechamento` (objeto com `mortalidade`, `motivo_saida`)
- Observacao: `obs`

### Motivos de nao sincronizacao completa
- Nao existe rotina dedicada equivalente a `syncFazendasWithCloud` para lotes.
- Nao existe merge/reconciliacao por `metadata.local_id` + `cloud_id` para lotes.
- Nao existe diagnostico especifico de lotes no fluxo manual como existe para fazendas.
- O modulo depende de `create/updateOperationalRecord('lotes', ...)` em pontos especificos (criacao e fechamento), e outras operacoes ficam locais (ex.: varias atualizacoes derivadas de movimentacao/pesagem feitas via `setDb`).
- Se schema/RLS da tabela `lotes` estiver ausente/incompleto, persiste local com aviso, sem pipeline de reparo do modulo.

## 4. Why Funcionarios are not syncing
### Campos locais reais de Funcionarios
- `id`
- `nome`
- `cpf`
- `telefone`
- `cargo`
- `salario`
- `data_admissao`
- `fazenda_id`
- `status`
- `observacoes`
- `created_at` (em massa local inicial)

### Motivos de nao sincronizacao completa
- Nao existe sync manual dedicado de funcionarios (sem equivalente ao botao/processo de Fazendas).
- Nao existe reconciliacao de `metadata.local_id`/`cloud_id` para funcionarios.
- Fluxo atual usa apenas CRUD direto (`create/update/deleteOperationalRecord('funcionarios', ...)`) e fallback local se falhar.
- Sem tabela/politicas prontas no Supabase, o modulo tende a operar localmente com aviso.

## 5. Required Lotes schema
Foi especificado em `SUPABASE_LOTES_FUNCIONARIOS_SCHEMA_FIX_HERDON.md`:
- `public.lotes` com `owner_user_id`, campos operacionais reais de lote, `metadata`, `cloud_id`, `created_at`, `updated_at`.
- Bloco de `create table if not exists` + `alter table add column if not exists`.

## 6. Required Funcionarios schema
Foi especificado em `SUPABASE_LOTES_FUNCIONARIOS_SCHEMA_FIX_HERDON.md`:
- `public.funcionarios` com campos reais do modulo, `owner_user_id`, `metadata`, `cloud_id`, `created_at`, `updated_at`.
- Bloco de `create table if not exists` + `alter table add column if not exists`.

## 7. Required RLS policies
Definidas no arquivo SQL/guia para ambas as tabelas:
- `select`: `auth.uid() = owner_user_id`
- `insert`: `with check (auth.uid() = owner_user_id)`
- `update`: `using` e `with check` no mesmo criterio
- `delete`: `using (auth.uid() = owner_user_id)`

## 8. Diagnostics added/updated if any
Ajuste seguro aplicado em `src/services/operationalPersistence.js` para classificar melhor erros de schema/config/rede/permissao em mutacoes operacionais:
- Lotes: "Tabela de lotes não encontrada na nuvem. Verifique a estrutura do Supabase."
- Funcionarios: "Tabela de funcionários não encontrada na nuvem. Verifique a estrutura do Supabase."
- Permissao: "Permissão insuficiente para sincronizar este registro."
- Configuracao: "Configuração da nuvem incompleta. Verifique as variáveis do Supabase."
- Rede: "Não foi possível conectar à nuvem. Verifique sua conexão e tente novamente."

Sem alteracao de fluxo de negocio e sem exposicao de segredo/token.

## 9. Files changed
- `src/services/operationalPersistence.js`
- `SUPABASE_LOTES_FUNCIONARIOS_SCHEMA_FIX_HERDON.md`
- `SPRINT10A_CLOUD_SYNC_ARCHITECTURE_AUDIT_HERDON.md`

## 10. Validation commands and results
- `npm.cmd run build` -> OK (sucesso).
- `npm.cmd run lint` -> OK com warnings existentes (27 warnings, 0 errors).
- `git diff --name-only` -> `src/services/operationalPersistence.js`.
- `git status --short` -> mostra tambem novos arquivos `.md` nao rastreados.

## 11. Next sprint recommendation
Sprint 10B (Implement Lotes Cloud Sync):
1. Criar pipeline dedicado `syncLotesWithCloud` (espelhando estrategia segura de Fazendas).
2. Incluir reconciliacao `metadata.local_id` + `cloud_id` em lotes.
3. Definir regra de persistencia para efeitos derivados (pesagem/movimentacao) para evitar divergencia local/cloud.
4. Depois de lotes estabilizado, repetir o padrao para Funcionarios.
