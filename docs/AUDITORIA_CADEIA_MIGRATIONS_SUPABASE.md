# Auditoria diagnóstica — Cadeia de Migrations Supabase (HERDON)

**Tipo:** auditoria exclusivamente diagnóstica. Nenhuma migration foi aplicada, nenhum schema/RLS/função/dado foi alterado, nenhum `migration repair` foi executado.
**Projeto Supabase:** HERDON (`ljpiszxicmmuefbiixui`)
**Branch:** `audit/supabase-migration-chain` (criado a partir de `origin/main` atualizado)
**Comandos usados:** só leitura — `list_migrations`, `list_tables`, `execute_sql` (somente `SELECT`/consultas de catálogo `pg_catalog`/`information_schema`), `get_logs`, `git log`/`grep` no histórico local. Nenhum segredo aparece em nenhum comando; onde uma consulta tocaria dado de conta real, só contagens/nomes de tabela foram usados, nunca linhas de negócio.

---

## 1. Resumo executivo

**O banco não pode ser reconstruído do zero porque o schema inteiro da aplicação nunca foi capturado como migration.** De 37 tabelas em produção, **30 (81%) não têm nenhum `CREATE TABLE` em `supabase/migrations/`** — inclusive todas as tabelas centrais do negócio (`profiles`, `fazendas`, `lotes`, `animais`, `movimentacoes_financeiras`, `estoque`, `pesagens`, etc.). O mesmo vale para o enum `app_profile`, as extensions `citext`/`pgcrypto`, e pelo menos uma função de trigger (`set_updated_at`) usada em quase toda tabela. Esse schema-base foi criado fora do fluxo de migration (Painel/SQL Editor) antes de o projeto começar a versionar migrations, e **27 das 30 tabelas** tiveram esse schema capturado manualmente em `docs/supabase-production-schema.sql`/`docs/supabase-production-rls.sql` — mas esses arquivos não ficam em `supabase/migrations/`, não têm timestamp de migration, e por isso **nunca são replicados** quando o Supabase recria um banco do zero (branch preview, `db reset`, ou disaster recovery). Confirmado ao vivo: a primeira migration do histórico (`20260617020950`) já falha, porque faz `ALTER TABLE` numa tabela que, num banco vazio, ainda não existe.

Esse problema **já era conhecido** desde a Sprint 13/14 e documentado em detalhe na Sprint 17 (`docs/SPRINT17_LIMPEZA_BANCO_RLS_MIGRATIONS.md` e `docs/HERDON_PLANO_RECONCILIACAO_SUPABASE.md`) — mas o teste concreto "roda num banco vazio?" nunca tinha sido executado (o próprio checklist da Sprint 17 registra isso como pendente). Esta auditoria é a primeira confirmação empírica real da falha, via o check automático "Supabase Preview" do GitHub, acionado ao abrir o PR #122 na sprint anterior.

Há também uma **divergência secundária, menor e já conhecida**: 9 migrations aplicadas via `apply_migration` (MCP) ou similar foram registradas em `supabase_migrations.schema_migrations` sob um timestamp **diferente** do nome do arquivo local (o horário real do apply, não o do arquivo) — incluindo, ironicamente, a migration mais recente desta auditoria (`20260729220000` → registrada como `20260730004635`), que reproduziu ao vivo, nesta própria sessão, exatamente o padrão que o projeto já tenta evitar desde a Sprint 17.

## 2. Primeira falha reproduzida

**Onde:** branch de preview do Supabase criado automaticamente pelo GitHub App ao abrir o PR #122 (`fix/sprint8-app-can-access-fazenda`), projeto de preview `yypminexyxoejwszrkio` — um banco **completamente vazio**, no qual o Supabase tenta replicar `supabase/migrations/` do zero, na ordem dos arquivos.

**Migration que falha:** `20260617020950_financial_status_fields.sql` — a **primeira** migration cronologicamente em todo o histórico local.

**Erro completo (via `get_logs`, serviço `postgres`, projeto `yypminexyxoejwszrkio`):**
```
ERROR: relation "movimentacoes_financeiras" does not exist
```
capturado durante a execução de:
```sql
-- Sprint 10: Add optional financial status fields to movimentacoes_financeiras
ALTER TABLE movimentacoes_financeiras
  ADD COLUMN IF NOT EXISTS status TEXT
    CHECK (status IS NULL OR status IN ('previsto', 'realizado', 'pago', 'cancelado')),
  ADD COLUMN IF NOT EXISTS data_competencia DATE,
  ADD COLUMN IF NOT EXISTS data_vencimento DATE,
  ADD COLUMN IF NOT EXISTS data_pagamento DATE
```

**Migrations executadas com sucesso antes da falha:** **nenhuma.** Esta é a primeira migration do histórico (menor timestamp de todos os 29 arquivos) — a réplica falha no primeiro statement do primeiro arquivo.

**Por que `movimentacoes_financeiras` ainda não existe naquele momento:** porque **nenhuma migration em todo o histórico cria essa tabela** (confirmado por grep em todos os 29 arquivos — ver §4). A tabela foi criada antes de o histórico de migrations existir, provavelmente direto no Painel/SQL Editor do Supabase, e essa criação nunca foi capturada como um arquivo `.sql` versionado com timestamp anterior a `20260617020950`. A dependência que deveria existir naquele ponto — um `CREATE TABLE movimentacoes_financeiras` anterior — **nunca foi escrita**.

Esse mesmo mecanismo se repete para as outras 29 tabelas que fariam a réplica falhar em cascata logo em seguida (a auditoria não precisou continuar a réplica além do primeiro erro para confirmar isso — a ausência de `CREATE TABLE` para as 30 tabelas foi confirmada diretamente por grep no repositório, ver §4).

## 3. Linha do tempo das migrations (29 arquivos locais)

| # | Versão (arquivo) | Nome | Cria tabela | Altera tabela | Cria função | Idempotente | Roda em banco vazio? |
|---|---|---|---|---|---|---|---|
| 1 | 20260617020950 | financial_status_fields | não | `movimentacoes_financeiras` | não | sim | **não** — depende de tabela pré-existente |
| 2 | 20260618000000 | lotes_pastagem_id_uuid | não | `lotes` (tipo+FK) | não | sim (`DO $$` condicional) | não |
| 3 | 20260619113446 | lote_pastagens_historico | sim (`lote_pastagens_historico`) | `lotes` | sim | sim | não — FK para `lotes`/`fazendas`/`pastagens` inexistentes |
| 4 | 20260623220539 | fix_insecure_insert_policies | não | policies + force RLS | não | sim | não — tabelas-alvo inexistentes |
| 5 | 20260702171318 | fix_database_audit_findings | não | `profiles` (backfill), policies | drop 1 | parcial (UPDATE com `WHERE ... IS NULL`, seguro para re-execução) | não |
| 6 | 20260704173340 | equipe_profiles_status_and_manage_account_role | não | `profiles` (coluna status) | sim (redefine) | sim | não |
| 7 | 20260706120000 | telegram_multiuser_connections | sim (3 tabelas) | — | não | sim | não — FK para `fazendas`/`auth.users` |
| 8 | 20260706180142 | add_sanitario_carencia_field | não | `sanitario` (coluna) | não | sim | não |
| 9 | 20260707034513 | alertas_tratativas | sim | — | não | sim | não — FK para `fazendas` |
| 10 | 20260707161920 | indexes_and_search_path_hardening | não | 5 funções (`search_path`), 4 tabelas (force RLS), 17 índices | sim (3, hardening) | sim | não — índices em tabelas inexistentes |
| 11 | 20260710120000 | telegram_bot_operacoes_auditoria | sim (2 tabelas) | — | não | sim | não — FK para `fazendas`/`auth.users` |
| 12 | 20260710150000 | telegram_conversas | sim | — | não | sim | não — FK para `fazendas`/`auth.users` |
| 13 | 20260713193754 | rls_role_gate_block_visualizador_writes | não | — | sim (redefine) | sim | não |
| 14 | 20260713204723 | rls_role_gate_own_policies_visualizador | não | policies | não | sim | não |
| 15 | 20260713224735 | integridade_fk_entre_contas | não | — | sim (`validar_integridade_conta_fazenda`) | sim | não — trigger aplicado em tabelas inexistentes |
| 16 | 20260715142221 | telegram_ia_contexto | sim | `telegram_connections`? | não | sim | não |
| 17 | 20260715210216 | drop_telegram_ia_contexto | não | drop da tabela acima | não | sim | não (depende do estado da #16) |
| 18 | 20260716180853 | rpcs_transacionais_lote_pesagem | não | — | sim (8 RPCs) | sim (`CREATE OR REPLACE`) | não — RPCs referenciam `lotes`/`pesagens`/`animais` |
| 19 | 20260716181018 | hardening_rpcs_transacionais_revoke_anon | não | — | sim (redefine 1) | sim | não |
| 20 | 20260717120000 | sincroniza_animais_grupo_registrar_saida_lote | não | — | sim (redefine `registrar_saida_lote`) | sim | não |
| 21 | 20260717153400 | bloqueia_autoescalada_perfil_profiles | não | — | sim (trigger) | sim | não — trigger em `profiles` inexistente |
| 22 | 20260720202758 | add_estorno_financeiro_field | não | `movimentacoes_financeiras` (coluna) | não | sim | não |
| 23 | 20260721160000 | telegram_pareamento_atomico | não | — | sim (`parear_telegram_por_codigo`) | sim | não |
| 24 | 20260721210000 | telegram_estoque_rpcs_transacionais | não | — | sim (2 RPCs) | sim | não — referenciam `estoque` |
| 25 | 20260722120000 | convite_equipe_fazenda_vinculo | não | `invites`, `profiles` | sim (5) | sim (`IF NOT EXISTS`/`DROP IF EXISTS` extensivo) | não |
| 26 | 20260722150000 | fix_aceitar_convite_equipe_ambiguous_column | não | — | sim (redefine) | sim | não |
| 27 | 20260722160000 | rls_fazenda_tabelas_indiretas | não | policies (`pesagens`, `movimentacoes_*`) | não | sim | não |
| 28 | 20260722170000 | cenarios_fazenda_id_e_rls | não | `cenarios`, `cenario_eventos` | não | sim | não |
| 29 | 20260729220000 | fix_app_can_access_fazenda_cross_account | não | — | sim (redefine `app_can_access_fazenda`) | sim | não (mas seria a única a passar isoladamente, se tudo antes existisse) |

**Conclusão da linha do tempo:** nenhuma das 29 migrations roda com sucesso num banco vazio — **inclusive as que criam tabelas novas** (`lote_pastagens_historico`, as 3 do Telegram em `20260706120000`, `alertas_tratativas`, `telegram_bot_operacoes_auditoria`, `telegram_conversas`) falham igualmente, porque todas têm `REFERENCES public.fazendas(id)` / `REFERENCES public.lotes(id)` / `REFERENCES auth.users(id)` — e `fazendas`/`lotes` também estão entre as 30 tabelas sem `CREATE TABLE` no histórico.

**Risco de execução duplicada:** nenhuma migration usa `DROP TABLE`, `DROP COLUMN` ou `DELETE`. Todas seguem o padrão `IF NOT EXISTS`/`DROP ... IF EXISTS` antes de recriar (política já confirmada e mantida desde a Sprint 17). O único ponto de dado (não-schema) é o `UPDATE public.profiles SET owner_user_id = id WHERE owner_user_id IS NULL` da migration 5 — condicionado ao `WHERE`, seguro para reexecução.

## 4. Objetos ausentes no histórico de migrations

### 4.1 Tabelas (30 de 37, sem `CREATE TABLE` em nenhuma migration)

`invites`, `profiles`, `fazendas`, `lotes`, `animais`, `custos`, `pesagens`, `estoque`, `movimentacoes_estoque`, `movimentacoes_animais`, `movimentacoes_financeiras`, `funcionarios`, `tarefas`, `sanitario`, `rotinas`, `configuracoes`, `alertas_resolvidos`, `usuarios`, `suplementacao`, `auditoria`, `eventos_operacionais`, `alertas_adiados`, `pastagens`, `cenarios`, `cenario_eventos`, `subscription_plans`, `customer_subscriptions`, `billing_events`, `checkout_sessions`, `consumo_suplementacao`.

- **27 dessas 30** têm `CREATE TABLE` capturado em `docs/supabase-production-schema.sql` (arquivo de documentação, **fora** de `supabase/migrations/`, sem timestamp de migration — nunca é replicado por `db reset`/branch preview).
- **3 não têm `CREATE TABLE` em lugar nenhum do repositório** (nem migration, nem o dump manual): `cenario_eventos`, `eventos_operacionais`, `suplementacao`. Estas três existem **apenas** como schema vivo em produção — se o banco for perdido, não há SQL versionado nenhum para recriá-las.

### 4.2 Tipo, extensões e função de trigger sem origem versionada

| Objeto | Tipo | Onde está capturado |
|---|---|---|
| `public.app_profile` (enum: proprietario/gerente/operador/visualizador) | `CREATE TYPE` | só em `docs/supabase-production-schema.sql` |
| `citext` | `CREATE EXTENSION` | só em `docs/supabase-production-schema.sql` (instalada em `public`, já sinalizado como achado separado em auditoria anterior) |
| `pgcrypto` | `CREATE EXTENSION` | só em `docs/supabase-production-schema.sql` |
| `set_current_timestamp_updated_at()` | função de trigger | só em `docs/supabase-production-schema.sql` |
| `set_updated_at()` | função de trigger | **em lugar nenhum do repositório** — nem migration, nem dump. Origem confirmada só via `pg_proc.prosrc` direto no banco; o corpo usa quebra de linha `\r\n` (CRLF), indício de que foi criada manualmente pelo SQL Editor a partir de um ambiente Windows, não por uma migration `psql`/CLI (que normalmente preserva `\n`) |

**Achado colateral (fora do escopo desta migration-chain, mas relevante para "triggers sem origem"):** quase toda tabela tem **dois** triggers de `updated_at` redundantes — um usando `set_current_timestamp_updated_at` (nome de trigger `set_<tabela>_updated_at`) e outro usando `set_updated_at` (nome `trg_<tabela>_updated_at`) — confirmado via `pg_trigger` em pelo menos 20 tabelas. Isso não quebra nada (ambos fazem a mesma coisa), mas é uma duplicação sem explicação documentada, provavelmente de duas eras de bootstrap diferentes do projeto. Não investigado a fundo — fora do escopo desta auditoria (que é sobre a cadeia de *migrations*, não sobre limpeza de triggers).

### 4.3 Policies sem origem versionada

Todas as ~150+ policies das 30 tabelas-base herdam o mesmo problema: foram criadas junto com o schema-base, fora de migration. `docs/supabase-production-rls.sql` captura um snapshot manual, mas o próprio arquivo se autodeclara **não normativo** ("as migrations aplicadas...são a fonte normativa...este bundle...pode ficar temporariamente desatualizado"). Não foi feita nesta auditoria uma comparação policy-a-policy entre esse dump e o catálogo `pg_policies` ao vivo (ver §10 — não confirmado).

## 5. Comparação entre banco e repositório (`schema_migrations` × arquivos locais)

29 arquivos locais, 30 registros em `supabase_migrations.schema_migrations`. Correlacionando por **nome** (já que a correlação por versão falha na maioria dos casos):

| Categoria | Quantidade | Detalhe |
|---|---|---|
| Versão e nome idênticos | 19 | — |
| Nome igual, versão divergente | 9 | ver tabela abaixo |
| Só no repositório (sem registro no banco, sob nenhum nome) | 1 | `20260706120000_telegram_multiuser_connections` — tabelas existem em produção (aplicadas via SQL direto), mas nenhuma linha em `schema_migrations` as referencia |
| Só no banco (sem arquivo local) | 2 | `20260626221604_fix_handle_new_user_profile_perfil_constraint`, `20260626221614_backfill_missing_profiles` |

**As 9 versões divergentes (nome idêntico, timestamp diferente):**

| Nome | Versão no arquivo local | Versão registrada no banco |
|---|---|---|
| `telegram_bot_operacoes_auditoria` | `20260710120000` | `20260710215716` |
| `telegram_conversas` | `20260710150000` | `20260710222645` |
| `telegram_pareamento_atomico` | `20260721160000` | `20260721185846` |
| `telegram_estoque_rpcs_transacionais` | `20260721210000` | `20260721193447` |
| `convite_equipe_fazenda_vinculo` | `20260722120000` | `20260722145101` |
| `fix_aceitar_convite_equipe_ambiguous_column` | `20260722150000` | `20260722150014` |
| `rls_fazenda_tabelas_indiretas` | `20260722160000` | `20260722151402` |
| `cenarios_fazenda_id_e_rls` | `20260722170000` | `20260722154003` |
| **`fix_app_can_access_fazenda_cross_account`** | **`20260729220000`** | **`20260730004635`** |

Este é exatamente o padrão que a Sprint 17 já tinha documentado e corrigido para 3 arquivos anteriores (`equipe_profiles_status_and_manage_account_role`, `add_sanitario_carencia_field`, `alertas_tratativas` — hoje com versão e nome idênticos, confirmando que a correção daquela sprint permanece válida). As 9 divergências acima **aconteceram depois** da Sprint 17 e nunca foram corrigidas.

## 6. Análise específica: `20260729220000` × `20260730004635`

- **`20260729220000` está registrada no banco?** Não. Não existe nenhuma linha com essa versão em `supabase_migrations.schema_migrations`.
- **Por que a aplicação aparece como `20260730004635`:** confirmado empiricamente nesta própria sessão de trabalho — a ferramenta `apply_migration` (MCP) gera a versão registrada em `schema_migrations` a partir do **horário real do servidor no momento em que o apply roda**, não a partir do prefixo do nome do arquivo local passado como `name`. O arquivo foi escrito e commitado em `2026-07-29` (daí o prefixo `20260729220000`), mas o `apply_migration` só foi executado no dia seguinte, `2026-07-30`, às `00:46:35 UTC` — exatamente o valor `20260730004635`. É o mesmo mecanismo que a Sprint 17 já tinha descrito na seção "Como evitar nova divergência" (item 3: "acontece porque `apply_migration` usa o horário do apply, não o do arquivo").
- **As duas versões existem?** Não — só `20260730004635` existe no banco. `20260729220000` nunca foi, e nunca será, uma versão registrada (a menos que alguém a insira manualmente em `schema_migrations`, o que não foi feito nem recomendado aqui).
- **O CLI consideraria a migration local pendente?** Sim. O `supabase` CLI casa migrations pelo par `(version, name)` extraído do **nome do arquivo** contra as linhas de `schema_migrations`. Como não existe linha com versão `20260729220000`, `supabase migration list`/`db push` classificaria este arquivo como **não aplicado** e tentaria aplicá-lo de novo.
- **Há risco de reaplicação futura?** Baixo, mas real: o conteúdo do arquivo é só um `CREATE OR REPLACE FUNCTION public.app_can_access_fazenda(...)` — reexecutá-lo é seguro (idempotente por natureza do `CREATE OR REPLACE`, sem `DROP`/`INSERT`/`DELETE`). Se alguém rodar `supabase db push` contra produção sem antes corrigir esse par (version, name), o único efeito seria redefinir a função com o **mesmo** corpo — sem regressão funcional. O risco real não é nesta migration específica, mas no **padrão**: das 9 migrations com o mesmo problema, pelo menos 3 (`convite_equipe_fazenda_vinculo`, `rls_fazenda_tabelas_indiretas`, `cenarios_fazenda_id_e_rls`) fazem `ALTER TABLE`/`CREATE POLICY` com `DROP POLICY IF EXISTS` antes — também idempotentes pelo padrão observado, mas não testadas nesta auditoria com uma reaplicação real (ver §10).
- **Nota de transparência:** esta divergência é uma reprodução, ao vivo, de uma prática que a própria Sprint 17 já tinha identificado como causa-raiz e cujo antídoto documentado é "renomear o arquivo local imediatamente, no mesmo commit" após o apply. Essa etapa não foi seguida quando `20260729220000_fix_app_can_access_fazenda_cross_account.sql` foi criada e aplicada (sprint anterior a esta auditoria) — reforçando que o problema é de **processo recorrente**, não um evento isolado.

## 7. Riscos de `db push`, preview e reconstrução

| Ação | Risco confirmado |
|---|---|
| `supabase db push` (CLI) contra produção, sem reconciliar antes | Tentaria reaplicar as 9 migrations com versão divergente + a 1 só-local. Conteúdo de todas é idempotente pelos padrões observados (`IF EXISTS`/`IF NOT EXISTS`/`CREATE OR REPLACE`) — risco de dano é baixo, mas não nulo e não testado exaustivamente statement-a-statement (ver §10). O CLI pode também recusar o push por conflito de histórico, dependendo da versão do CLI. |
| Preview automático de PR (Supabase GitHub App) | **Falha hoje, comprovado.** Todo PR novo terá o check "Supabase Preview" vermelho, independentemente do que o PR mude — não é sinal de regressão introduzida pelo PR, é o estado permanente do repositório até a causa-raiz ser corrigida. |
| `supabase db reset` local (onboarding de novo desenvolvedor) | Falha na primeira migration, idêntico ao preview. Um novo desenvolvedor não consegue subir o banco local só com `supabase/migrations/` — precisa também rodar manualmente `docs/supabase-production-schema.sql` + `docs/supabase-production-rls.sql` antes (não documentado em nenhum README/setup script encontrado nesta auditoria). |
| Disaster recovery (perda do projeto Supabase) | Depende inteiramente de `docs/supabase-production-schema.sql`/`-rls.sql`, que o próprio projeto já marca como **não normativo** e possivelmente desatualizado, e que **não cobre** `cenario_eventos`/`eventos_operacionais`/`suplementacao` nem a função `set_updated_at`. Reconstrução completa hoje não é garantida só com o que está versionado. |

## 8. Proposta segura de correção (não executada nesta sprint)

1. **Reconciliar as 2 migrations só-no-banco:** `supabase link` + `supabase db pull` (precisa de CLI autenticado, que este ambiente de sessão não tem) para baixar o SQL real de `fix_handle_new_user_profile_perfil_constraint` (`20260626221604`) e `backfill_missing_profiles` (`20260626221614`) e commitar os arquivos com nome/timestamp exatos. Não recriar de memória.
2. **Registrar `telegram_multiuser_connections` no histórico:** confirmar primeiro, linha a linha, que o SQL local bate exatamente com o que existe hoje em produção (`CREATE TABLE`/índices/policies das 3 tabelas); se bater, `supabase migration repair --status applied 20260706120000` (só marca histórico, não roda SQL).
3. **Renomear os 9 arquivos com versão divergente** (mesmo conteúdo, zero mudança de schema) para o timestamp real registrado no banco — mesma técnica já usada com sucesso na Sprint 17 para 3 arquivos anteriores. Inclui renomear `20260729220000_fix_app_can_access_fazenda_cross_account.sql` para `20260730004635_fix_app_can_access_fazenda_cross_account.sql`.
4. **Escrever uma migration de baseline** (a correção estrutural real): gerar via `pg_dump --schema-only` (ou `supabase db pull` completo) contra o projeto de produção real — não confiar cegamente em `docs/supabase-production-schema.sql`, que pode estar desatualizado — cobrindo as 30 tabelas + `cenario_eventos`/`eventos_operacionais`/`suplementacao` + o enum `app_profile` + as extensions + `set_updated_at`/`set_current_timestamp_updated_at` + RLS completo. Essa migration precisa de um timestamp **anterior** a `20260617020950` para entrar na ordem certa da réplica.
5. **Testar a réplica completa do zero** (branch de desenvolvimento Supabase descartável, ou novo PR) até o status deixar de ser `MIGRATIONS_FAILED`.
6. **Atualizar `docs/HERDON_PLANO_RECONCILIACAO_SUPABASE.md`** marcando os itens resolvidos, em vez de criar um documento paralelo novo.

## 9. Divisão proposta em sprints pequenas

- **Sprint A — mecânica, baixo risco:** itens 1 e 3 da proposta (via `db pull` + renomear arquivos). Não muda nenhum SQL já aplicado, só alinha metadado local ao real.
- **Sprint B — precisa de confirmação humana antes de agir:** item 2 (`migration repair` de `telegram_multiuser_connections`), condicionado à comparação linha a linha já descrita.
- **Sprint C — a correção estrutural, dedicada, maior risco:** item 4 (a migration de baseline). Deve ser tratada como sprint própria, com revisão tabela por tabela contra o catálogo real, não apressada junto de outra mudança.
- **Sprint D — validação:** item 5 (réplica completa testada) + item 6 (atualizar a documentação de reconciliação existente). Só deve começar depois que A, B e C estiverem mescladas.

## 10. O que não foi possível confirmar

- **Se `docs/supabase-production-schema.sql`/`docs/supabase-production-rls.sql` são idênticos, campo a campo e policy a policy, ao catálogo real de produção hoje.** O próprio arquivo se autodeclara como podendo estar desatualizado; esta auditoria não fez um diff completo `pg_dump --schema-only` × dump manual (exigiria CLI local ou uma comparação linha a linha muito mais longa que o escopo desta auditoria).
- **Idempotência exaustiva, statement a statement, das 9 migrations com versão divergente e da 1 só-local.** Os padrões observados (`IF EXISTS`/`IF NOT EXISTS`/`CREATE OR REPLACE`) sugerem segurança na reaplicação, mas nenhuma delas foi de fato reexecutada nesta auditoria para confirmar (regra da sprint proíbe aplicar migrations).
- **Se `supabase migration repair` já foi tentado e falhou antes, ou simplesmente nunca foi tentado.** Nenhuma sessão até agora teve CLI autenticado disponível (confirmado também pela Sprint 17).
- **A ferramenta exata que criou o schema-base fora do histórico de migrations** (Painel/Table Editor, SQL Editor, importação de dump externo). O indício da quebra de linha `\r\n` em `set_updated_at` sugere SQL Editor a partir de um ambiente Windows, mas isso é circunstancial, não uma confirmação direta (não há log de auditoria do Supabase acessível para essa ação específica nesta sessão).
- **Se existe algum outro ambiente (staging, projeto Supabase paralelo, container local) com um bootstrap já funcional** que pudesse ser reaproveitado em vez de gerar a baseline do zero — não verificado nesta auditoria (fora do escopo "somente leitura no projeto HERDON").
- **Cobertura completa das ~150+ policies das 30 tabelas-base** contra `docs/supabase-production-rls.sql` — só foi feita uma checagem por amostragem (contagem de tabelas com policy no dump, 11), não uma comparação policy a policy contra `pg_policies`.
