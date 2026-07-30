# Sprint 2 — Reconciliação local das versões de migrations

**Objetivo único:** alinhar nomes/versões das migrations locais com as versões registradas em `supabase_migrations.schema_migrations`, sem aplicar migration e sem alterar produção. Esta sprint **não** cria a migration de baseline (isso é a Sprint C/D da proposta em `docs/AUDITORIA_CADEIA_MIGRATIONS_SUPABASE.md`).

**Branch:** `fix/sprint2-reconcile-migration-versions` (criado a partir de `origin/main` atualizado — não reaproveita `audit/supabase-migration-chain`)
**Fontes usadas:** `docs/AUDITORIA_CADEIA_MIGRATIONS_SUPABASE.md` (principal), `docs/HERDON_PLANO_RECONCILIACAO_SUPABASE.md`, `docs/SPRINT17_LIMPEZA_BANCO_RLS_MIGRATIONS.md`.
**Confirmação de que produção não foi alterada:** nenhum `apply_migration`, `migration repair` ou DDL foi executado. Todas as consultas usadas foram `SELECT` em `information_schema`/`pg_catalog`/`pg_policies`/`pg_proc` e `list_migrations` (somente leitura). `list_migrations` antes e depois desta sprint retorna exatamente os mesmos 30 registros — nenhuma linha nova em `schema_migrations`.

---

## 1. Mapeamento antes e depois

| Nome lógico | Versão local (antes) | Versão remota | Situação (antes) | Ação | Versão local (depois) |
|---|---|---|---|---|---|
| financial_status_fields | 20260617020950 | 20260617020950 | exata | nenhuma | 20260617020950 |
| lotes_pastagem_id_uuid | 20260618000000 | 20260618000000 | exata | nenhuma | 20260618000000 |
| lote_pastagens_historico | 20260619113446 | 20260619113446 | exata | nenhuma | 20260619113446 |
| fix_insecure_insert_policies | 20260623220539 | 20260623220539 | exata | nenhuma | 20260623220539 |
| **fix_handle_new_user_profile_perfil_constraint** | *ausente* | 20260626221604 | só no banco | **recuperada do Git** (ver §3) | 20260626221604 |
| **backfill_missing_profiles** | *ausente* | 20260626221614 | só no banco | **recuperada do Git** (ver §3) | 20260626221614 |
| fix_database_audit_findings | 20260702171318 | 20260702171318 | exata | nenhuma | 20260702171318 |
| equipe_profiles_status_and_manage_account_role | 20260704173340 | 20260704173340 | exata | nenhuma | 20260704173340 |
| **telegram_multiuser_connections** | 20260706120000 | *nenhum registro sob nenhum nome* | só no repositório | **análise, sem ação** (ver §4) | 20260706120000 |
| add_sanitario_carencia_field | 20260706180142 | 20260706180142 | exata | nenhuma | 20260706180142 |
| alertas_tratativas | 20260707034513 | 20260707034513 | exata | nenhuma | 20260707034513 |
| indexes_and_search_path_hardening | 20260707161920 | 20260707161920 | exata | nenhuma | 20260707161920 |
| **telegram_bot_operacoes_auditoria** | 20260710120000 | 20260710215716 | versão divergente | **`git mv`** (comprovado, §2) | 20260710215716 |
| **telegram_conversas** | 20260710150000 | 20260710222645 | versão divergente | **`git mv`** (comprovado, §2) | 20260710222645 |
| rls_role_gate_block_visualizador_writes | 20260713193754 | 20260713193754 | exata | nenhuma | 20260713193754 |
| rls_role_gate_own_policies_visualizador | 20260713204723 | 20260713204723 | exata | nenhuma | 20260713204723 |
| integridade_fk_entre_contas | 20260713224735 | 20260713224735 | exata | nenhuma | 20260713224735 |
| telegram_ia_contexto | 20260715142221 | 20260715142221 | exata | nenhuma | 20260715142221 |
| drop_telegram_ia_contexto | 20260715210216 | 20260715210216 | exata | nenhuma | 20260715210216 |
| rpcs_transacionais_lote_pesagem | 20260716180853 | 20260716180853 | exata | nenhuma | 20260716180853 |
| hardening_rpcs_transacionais_revoke_anon | 20260716181018 | 20260716181018 | exata | nenhuma | 20260716181018 |
| sincroniza_animais_grupo_registrar_saida_lote | 20260717120000 | 20260717120000 | exata | nenhuma | 20260717120000 |
| bloqueia_autoescalada_perfil_profiles | 20260717153400 | 20260717153400 | exata | nenhuma | 20260717153400 |
| add_estorno_financeiro_field | 20260720202758 | 20260720202758 | exata | nenhuma | 20260720202758 |
| **telegram_pareamento_atomico** | 20260721160000 | 20260721185846 | versão divergente | **`git mv`** (comprovado, §2) | 20260721185846 |
| **telegram_estoque_rpcs_transacionais** | 20260721210000 | 20260721193447 | versão divergente | **`git mv`** (comprovado, §2) | 20260721193447 |
| **convite_equipe_fazenda_vinculo** | 20260722120000 | 20260722145101 | versão divergente | **`git mv`** (comprovado, §2) | 20260722145101 |
| **fix_aceitar_convite_equipe_ambiguous_column** | 20260722150000 | 20260722150014 | versão divergente | **`git mv`** (comprovado, §2) | 20260722150014 |
| **rls_fazenda_tabelas_indiretas** | 20260722160000 | 20260722151402 | versão divergente | **`git mv`** (comprovado, §2) | 20260722151402 |
| **cenarios_fazenda_id_e_rls** | 20260722170000 | 20260722154003 | versão divergente | **`git mv`** (comprovado, §2) | 20260722154003 |
| **fix_app_can_access_fazenda_cross_account** | 20260729220000 | 20260730004635 | versão divergente | **`git mv`** (comprovado, §2) | 20260730004635 |

## 2. Migrations renomeadas (mesmo conteúdo, timestamp corrigido)

9 arquivos, todos com correspondência **comprovada** contra o estado real do banco antes de qualquer `git mv` (não só por nome igual — cada um foi verificado por conteúdo):

| Arquivo (versão antiga → nova) | Evidência de correspondência verificada nesta sprint |
|---|---|
| `telegram_bot_operacoes_auditoria` (20260710120000→20260710215716) | Colunas de `telegram_operacoes_pendentes` e `telegram_bot_auditoria` no arquivo local batem, coluna a coluna (nome/tipo/nullable/default), com `information_schema.columns` ao vivo |
| `telegram_conversas` (20260710150000→20260710222645) | Colunas de `telegram_conversas` no arquivo local batem, coluna a coluna, com `information_schema.columns` ao vivo |
| `telegram_pareamento_atomico` (20260721160000→20260721185846) | Corpo de `parear_telegram_por_codigo` no arquivo idêntico, caractere a caractere, a `pg_proc.prosrc` ao vivo |
| `telegram_estoque_rpcs_transacionais` (20260721210000→20260721193447) | Corpos de `registrar_entrada_estoque_telegram` e `registrar_saida_estoque_telegram` idênticos a `pg_proc.prosrc` ao vivo |
| `convite_equipe_fazenda_vinculo` (20260722120000→20260722145101) | `handle_new_user_profile()` e `profiles_bloquear_autoescalada()` idênticos a `pg_proc.prosrc`; colunas `invites.fazenda_id`/`expires_at`/`profiles.fazenda_id` confirmadas em `information_schema.columns`; policies `animais_*`/`lotes_*`/`fazendas_select_same_account`/`fazendas_update_same_account` idênticas a `pg_policies` ao vivo. (A definição antiga de `app_can_access_fazenda` presente neste arquivo é histórica — foi legitimamente substituída pela migration `20260730004635`, aplicada depois; não é uma divergência, é a ordem normal da linha do tempo) |
| `fix_aceitar_convite_equipe_ambiguous_column` (20260722150000→20260722150014) | Corpo de `aceitar_convite_equipe` (versão corrigida, sem a referência ambígua) idêntico a `pg_proc.prosrc` ao vivo — esta é a versão realmente ativa hoje |
| `rls_fazenda_tabelas_indiretas` (20260722160000→20260722151402) | Policy `pesagens_select_same_account` (o `EXISTS (SELECT 1 FROM lotes l WHERE l.id = pesagens.lote_id AND app_can_access_fazenda(l.faz_id))`) idêntica a `pg_policies` ao vivo |
| `cenarios_fazenda_id_e_rls` (20260722170000→20260722154003) | Coluna `cenarios.fazenda_id` (bigint) e `fazenda_id_legado_uuid` (uuid, renomeada) confirmadas em `information_schema.columns`; policy `cenarios_select_same_account` idêntica a `pg_policies` ao vivo |
| `fix_app_can_access_fazenda_cross_account` (20260729220000→20260730004635) | Migration desta própria linha de trabalho (Sprint 8): autoria e aplicação confirmadas diretamente, mesmo `apply_migration` que gerou a divergência |

Todos os 9 `git mv` foram confirmados como **renomeação pura** — `git diff --cached -M100% --stat` mostra `0 insertions(+), 0 deletions(-)` para os 9 arquivos. Nenhum conteúdo SQL foi alterado.

## 3. Migrations recuperadas do Git

**`20260626221604_fix_handle_new_user_profile_perfil_constraint.sql`** e **`20260626221614_backfill_missing_profiles.sql`** — recuperadas, não recriadas de memória.

**Fonte:** commit `9a7d512` ("fix: garantir profiles e padronizar UX", 2026-06-26), que documenta em `docs/AUDITORIA_VISUAL_UX_HERDON.md` (seção "10. Correção — usuários autenticados sem `public.profiles`") o SQL **exato** aplicado via `apply_migration` no mesmo dia — escrito na própria sessão em que a correção foi feita, não uma reconstrução posterior. O texto do doc afirma explicitamente: *"Banco: função `handle_new_user_profile()`, default da coluna `profiles.perfil` (via migrations do Supabase MCP, não há arquivo `.sql` no repo)"* — confirmando que essas duas correções nunca tiveram arquivo, exatamente o gap que esta sprint fecha.

**Correspondência confirmada com o estado real do banco antes de recuperar os arquivos** (somente leitura):
- `information_schema.columns` → `profiles.perfil` tem `column_default = 'admin'::text` hoje — efeito exato do `ALTER TABLE public.profiles ALTER COLUMN perfil SET DEFAULT 'admin';` da primeira migration.
- `SELECT count(*) FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE p.id IS NULL` → **0** — confirma que o backfill (segunda migration) já rodou e não há usuário órfão hoje.

O conteúdo dos dois arquivos criados é uma **cópia literal** dos blocos `sql` do commit `9a7d512` — nenhuma linha foi adicionada, removida ou "corrigida para ficar idempotente" (a instrução da sprint proíbe isso). O `handle_new_user_profile()` recuperado nesta versão não precisa bater com o estado *atual* da função (que foi substituída por uma versão posterior, `20260722145101_convite_equipe_fazenda_vinculo.sql`, quando o vínculo por convite foi adicionado) — só precisa representar fielmente o que **esta** migration, especificamente, aplicou naquele ponto da linha do tempo. Isso é o comportamento normal e esperado de uma cadeia de migrations.

## 4. Migration existente só no repositório — análise, sem ação

**`20260706120000_telegram_multiuser_connections.sql`** — não tem nenhuma linha correspondente em `supabase_migrations.schema_migrations`, sob nenhum nome ou versão.

- **Objetos que cria:** 3 tabelas (`telegram_connections`, `telegram_connection_codes`, `telegram_notification_logs`), 4 índices, 1 trigger (`set_telegram_connections_updated_at`), 2 policies (`telegram_connections_select_own`, `telegram_connections_update_own`).
- **O efeito já existe em produção?** Sim — confirmado nesta sprint via `information_schema.columns`: as 17 colunas de `telegram_connections` e as 8 colunas de `telegram_connection_codes` no arquivo local batem, coluna a coluna (nome, tipo, nullable, default), com o catálogo real. As 3 tabelas existem e têm RLS habilitada.
- **Foi executada anteriormente por SQL direto?** Tudo indica que sim — os objetos existem, mas nenhuma linha em `schema_migrations` os referencia sob qualquer versão/nome (diferente das 9 divergências do §2, que têm registro só que com timestamp diferente; aqui não há registro nenhum). É o mesmo padrão de origem já confirmado para o schema-base inteiro em `docs/AUDITORIA_CADEIA_MIGRATIONS_SUPABASE.md` — aplicação manual (Painel/SQL Editor), sem passar pelo fluxo de migration.
- **Risco se o CLI tentasse reaplicá-la:** baixo, mas não nulo. Todos os `CREATE TABLE`/`CREATE INDEX` usam `IF NOT EXISTS` (no-op se já existir); os 2 `CREATE POLICY` são precedidos de `DROP POLICY IF EXISTS`; o `CREATE TRIGGER` é precedido de `DROP TRIGGER IF EXISTS`. Pelo padrão observado, uma reaplicação não destruiria dado nem duplicaria objeto — mas isso **não foi testado por execução real** nesta sprint (proibido pelo escopo).
- **Decisão:** **não tomada nesta sprint**, propositalmente. Registrar esta migration no histórico (`migration repair --status applied`) fica para a sprint seguinte, que exige confirmação humana explícita antes de tocar em `supabase_migrations.schema_migrations` — exatamente como a Fase 2 do plano de reconciliação já previa.

## 5. Divergências ainda pendentes

Só resta **uma** pendência, deixada deliberadamente sem ação nesta sprint:

| Item | Situação | Por quê continua pendente |
|---|---|---|
| `telegram_multiuser_connections` (20260706120000) | só no repositório, sem registro em `schema_migrations` | Requer `migration repair`, uma ação de banco que exige confirmação humana explícita numa sprint própria (§4) |

A **ausência do schema-base** (30 tabelas centrais sem `CREATE TABLE` em nenhuma migration, confirmada em `docs/AUDITORIA_CADEIA_MIGRATIONS_SUPABASE.md`) e a **falha de replicação em banco vazio** continuam existindo sem alteração — como esperado, essa é a Sprint C/D (baseline), fora do escopo desta Sprint 2.

## 6. Confirmação de que produção não foi alterada

- `list_migrations` executado antes e depois desta sprint retorna **exatamente os mesmos 30 registros**, nenhuma linha nova, nenhuma removida.
- Nenhum `apply_migration`, `migration repair`, `db push` ou DDL foi executado — todas as consultas usadas nesta sprint são `SELECT` (`information_schema.columns`, `pg_proc.prosrc`, `pg_policies`) ou o `list_migrations` somente leitura.
- Nenhuma policy, função, RLS ou dado foi alterado.
- Nenhuma alteração no frontend.

## 7. Preparação necessária para a futura baseline

- A lista de 30 tabelas/objetos sem origem versionada (enum `app_profile`, extensions `citext`/`pgcrypto`, função `set_updated_at`) permanece exatamente como documentada em `docs/AUDITORIA_CADEIA_MIGRATIONS_SUPABASE.md` §4 — esta sprint não adicionou nem removeu nenhum item dessa lista.
- Com a reconciliação de versões concluída (30/31 migrations locais agora com correspondência exata no banco), a Sprint C (baseline) pode ser escrita com uma base local limpa — sem o ruído de 9 arquivos com timestamp errado ou 2 migrations fantasma competindo por atenção.
- A migration de baseline (Sprint C) precisará de um timestamp anterior a `20260617020950` para entrar na ordem certa da réplica — nenhuma mudança nesta sprint afeta essa recomendação.
- `telegram_multiuser_connections` deve ser resolvida (Fase 2, `migration repair`) **antes ou junto** da Sprint C, já que ambas mexem na consistência do histórico de migrations.

## 8. Validação executada

| Validação | Resultado |
|---|---|
| Migrations locais recontadas (antes → depois) | 29 → 31 (2 recuperadas) |
| Correspondências exatas (nome + versão) | 19 → **30** |
| Divergências de versão (nome igual, timestamp diferente) | 9 → **0** |
| Só no banco (sem arquivo local) | 2 → **0** |
| Só no repositório (sem registro no banco) | 1 → 1 (mantido, decisão adiada) |
| Versões locais duplicadas | nenhuma |
| Conteúdo alterado durante os renomeios | nenhum (`git diff -M100%`: 0 insertions/deletions nos 9 arquivos) |
| `list_migrations` (Supabase, somente leitura) | 30 registros, idêntico antes/depois desta sprint |
| `npm run lint` | limpo |
| `npm run test:run` | **1859/1859** passando |
| `npm run build` | sucesso |
| Varredura de credenciais no diff | nada encontrado |
