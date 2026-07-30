# Sprint 3 — Alinhar o registro da migration Telegram

**Objetivo:** confirmar que os efeitos de `telegram_multiuser_connections` já existiam integralmente em produção e, só em caso de correspondência exata, registrar essa migration no histórico remoto.

**Branch:** `fix/sprint3-register-telegram-migration` (criado a partir de `origin/main` atualizado)

---

## Achado inesperado: o registro já havia sido feito por um mecanismo externo, antes desta sprint

Ao rodar `list_migrations` no início desta sprint (antes de qualquer ação minha além de `git fetch`/`git checkout`/leitura), o histórico remoto já aparecia com **31 registros**, incluindo:

```
{"version":"20260706120000","name":"telegram_multiuser_connections"}
```

Isso é diferente do estado confirmado ao final da Sprint 2 (30 registros, sem esta migration). Nenhum comando desta sessão até aquele ponto poderia ter causado isso — só haviam sido executados `git fetch`, `git status`, `git checkout -b`, `list_migrations` (leitura) e a leitura do arquivo local.

**Investigação da causa**, via `get_logs` (serviço `postgres`, projeto `ljpiszxicmmuefbiixui`):

- O corpo exato de `20260706120000_telegram_multiuser_connections.sql` foi executado estatement a statement em produção às **2026-07-30 14:58:14 UTC** — `CREATE TABLE IF NOT EXISTS` das 3 tabelas, os 4 índices, o trigger, as 2 policies, `ENABLE ROW LEVEL SECURITY` — sem nenhum erro no meio.
- O PR #123 (Sprint 2, que alterou arquivos em `supabase/migrations/`) foi mesclado às **2026-07-30 14:57:40 UTC** — **34 segundos antes**.
- `supabase_migrations.schema_migrations` para a versão `20260706120000` tem `created_by = null` e `idempotency_key = null` — diferente do padrão usado pela ferramenta `apply_migration` (MCP), que sempre grava `created_by` (e-mail OAuth) e um `idempotency_key`. Esse padrão "sem autor, versão = timestamp exato do nome do arquivo" é consistente com o comportamento nativo de deploy do Supabase (equivalente a `supabase db push`), não com uma chamada manual desta sessão.

**Conclusão:** a integração nativa do GitHub do Supabase (deploy automático de migrations pendentes ao mesclar no branch de produção) aplicou e registrou esta migration automaticamente, ~34 segundos depois do merge do PR #123 — antes de esta Sprint 3 sequer começar. **Não foi esta sessão, nenhum `apply_migration` nem `migration repair` foi executado por mim para chegar a esse estado.**

Diante disso, o objetivo desta sprint (verificar correspondência exata e, se comprovado, registrar) muda de natureza: a etapa de *registro* já ocorreu por fora; o trabalho que resta e que **foi executado integralmente** é a **verificação** exigida — confirmar que o que foi aplicado automaticamente bate, objeto a objeto, com o arquivo local, e que nenhum dado ou schema foi corrompido no processo.

---

## 1. Migration analisada

- **Arquivo:** `supabase/migrations/20260706120000_telegram_multiuser_connections.sql`
- **Versão local:** `20260706120000`
- **Versão remota (após o evento acima):** `20260706120000` — idêntica
- **Nome:** `telegram_multiuser_connections`

**Conteúdo SQL (resumo):**
- 3 `CREATE TABLE IF NOT EXISTS`: `telegram_connections`, `telegram_connection_codes`, `telegram_notification_logs`
- 4 `CREATE INDEX IF NOT EXISTS`: `idx_telegram_connections_owner_user_id`, `idx_telegram_connections_daily_report`, `idx_telegram_connection_codes_user_id`, `idx_telegram_notification_logs_owner_user_id`
- 1 constraint nomeada: `telegram_connections_user_id_key` (UNIQUE)
- 1 `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER set_telegram_connections_updated_at` (função `set_updated_at`)
- 3 `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- 2 `DROP POLICY IF EXISTS` + `CREATE POLICY`: `telegram_connections_select_own`, `telegram_connections_update_own`
- Nenhum `GRANT`/`REVOKE` explícito, nenhuma atualização de dados/backfill

## 2. Comparação exata com produção

| Objeto esperado | Definição na migration | Estado em produção | Correspondência |
|---|---|---|---|
| Tabela `telegram_connections` (17 colunas) | `id uuid PK`, `owner_user_id uuid NOT NULL FK auth.users`, `user_id uuid NOT NULL FK auth.users UNIQUE`, `fazenda_id bigint FK fazendas`, `telegram_chat_id text NOT NULL`, `telegram_username/first_name/last_name text`, `is_active/daily_report_enabled/alert_*_enabled boolean NOT NULL DEFAULT true`, `report_time time NOT NULL DEFAULT '07:00:00'`, `created_at/updated_at timestamptz NOT NULL DEFAULT now()` | `information_schema.columns`: 17 colunas, mesmo nome/tipo/nullable/default, na mesma ordem | **Exata** |
| Tabela `telegram_connection_codes` (8 colunas) | `id uuid PK`, `owner_user_id/user_id uuid NOT NULL FK auth.users`, `fazenda_id bigint FK fazendas`, `code text NOT NULL UNIQUE`, `expires_at timestamptz NOT NULL`, `used_at timestamptz`, `created_at timestamptz NOT NULL DEFAULT now()` | `information_schema.columns`: 8 colunas, idênticas | **Exata** |
| Tabela `telegram_notification_logs` (8 colunas) | `id uuid PK`, `owner_user_id uuid NOT NULL FK auth.users`, `telegram_connection_id uuid FK telegram_connections`, `notification_type text NOT NULL`, `status text NOT NULL CHECK IN ('sent','failed')`, `error_message text`, `sent_at timestamptz`, `created_at timestamptz NOT NULL DEFAULT now()` | `information_schema.columns` + `pg_constraint` (`telegram_notification_logs_status_check`): idênticas | **Exata** |
| PK `telegram_connections_pkey` | `id` | `pg_constraint`/`pg_indexes`: `PRIMARY KEY (id)` | **Exata** |
| UNIQUE `telegram_connections_user_id_key` | `user_id` | `pg_constraint`: `UNIQUE (user_id)` | **Exata** |
| FK `telegram_connections_owner_user_id_fkey`/`_user_id_fkey`/`_fazenda_id_fkey` | `REFERENCES auth.users`/`REFERENCES public.fazendas` | `pg_constraint`: presentes, mesmas colunas | **Exata** |
| PK/UNIQUE/FK `telegram_connection_codes_*` | `id` PK, `code` UNIQUE, FKs `owner_user_id`/`user_id`/`fazenda_id` | `pg_constraint`: todas presentes | **Exata** |
| PK/FK/CHECK `telegram_notification_logs_*` | `id` PK, FKs `owner_user_id`/`telegram_connection_id`, CHECK `status` | `pg_constraint`: todas presentes | **Exata** |
| Índice `idx_telegram_connections_owner_user_id` | `btree (owner_user_id)` | `pg_indexes`: idêntico | **Exata** |
| Índice `idx_telegram_connections_daily_report` | `btree (is_active, daily_report_enabled)` | `pg_indexes`: idêntico | **Exata** |
| Índice `idx_telegram_connection_codes_user_id` | `btree (user_id)` | `pg_indexes`: idêntico | **Exata** |
| Índice `idx_telegram_notification_logs_owner_user_id` | `btree (owner_user_id)` | `pg_indexes`: idêntico | **Exata** |
| Trigger `set_telegram_connections_updated_at` | `BEFORE UPDATE ... EXECUTE FUNCTION set_updated_at()` | `pg_trigger`: presente, mesma função | **Exata** |
| Policy `telegram_connections_select_own` | `FOR SELECT TO authenticated USING (user_id = auth.uid())` | `pg_policies`: idêntica | **Exata** |
| Policy `telegram_connections_update_own` | `FOR UPDATE TO authenticated USING/WITH CHECK (user_id = auth.uid())` | `pg_policies`: idêntica | **Exata** |
| RLS habilitada nas 3 tabelas | `ENABLE ROW LEVEL SECURITY` | `pg_class.relrowsecurity = true` nas 3 | **Exata** |
| Ausência de policy em `telegram_connection_codes`/`telegram_notification_logs` | nenhuma (comentário explícito no arquivo: só service role) | `pg_policies`: zero linhas para essas 2 tabelas | **Exata** |
| Grants | nenhum grant explícito na migration | nenhum grant customizado encontrado além do padrão do schema | **Exata (nada a comparar)** |
| Backfill/dados | nenhum | `telegram_connections`: 1 linha; `telegram_connection_codes`: 5; `telegram_notification_logs`: 0 — idêntico à contagem já registrada na auditoria original (sem perda nem duplicação) | **Exata** |

**Objetos extras encontrados em produção, não pertencentes a esta migration (verificados e explicados, não são divergência):**
- Índices `idx_telegram_connections_fazenda_id`, `idx_telegram_connection_codes_fazenda_id`, `idx_telegram_notification_logs_connection_id` → criados por `20260707161920_indexes_and_search_path_hardening.sql` (já registrada, correspondência exata confirmada em sprint anterior).
- Trigger `trg_validar_integridade_conta_fazenda` em `telegram_connections`/`telegram_connection_codes` → criado por `20260713224735_integridade_fk_entre_contas.sql` (já registrada).
- `FORCE ROW LEVEL SECURITY` nas 3 tabelas → aplicado por `20260707161920_indexes_and_search_path_hardening.sql` (confirmado por grep no próprio arquivo: `alter table public.telegram_connections/telegram_connection_codes/telegram_notification_logs force row level security`).

Nenhum desses objetos pertence a `20260706120000` — são efeito de migrations posteriores, já corretamente registradas antes desta sprint. Não indicam divergência na migration analisada.

## 3. Risco de reaplicação (avaliado antes de qualquer confirmação de correspondência)

- **O CLI consideraria pendente?** Antes do evento de 14:58:14 UTC, sim — não havia registro sob nenhum nome/versão. Depois, não mais (versão `20260706120000` presente e idêntica ao arquivo).
- **O que ocorreria se reexecutada:** todos os `CREATE TABLE`/`CREATE INDEX` usam `IF NOT EXISTS` (no-op); a constraint `telegram_connections_user_id_key` está embutida no `CREATE TABLE` (não seria recriada em uma nova execução, já que a tabela já existe); os 2 `CREATE POLICY` são precedidos de `DROP POLICY IF EXISTS`; o `CREATE TRIGGER` é precedido de `DROP TRIGGER IF EXISTS`.
- **Comandos que poderiam falhar:** nenhum, dado o padrão `IF EXISTS`/`IF NOT EXISTS` em 100% dos statements que recriam objetos existentes.
- **Riscos específicos avaliados:**
  - Coluna duplicada: não — `CREATE TABLE IF NOT EXISTS` não adiciona colunas a uma tabela já existente.
  - Índice duplicado: não — `CREATE INDEX IF NOT EXISTS`.
  - Constraint duplicada: não — a `UNIQUE` está dentro do `CREATE TABLE IF NOT EXISTS`, não re-executa se a tabela já existe.
  - Perda de dados: não — nenhum `DROP`/`DELETE`/`TRUNCATE` na migration.
  - Alteração de defaults: não — nenhum `ALTER COLUMN SET DEFAULT`.
  - Alteração de permissões: não — nenhum `GRANT`/`REVOKE`.
  - Reexecução de backfill: não aplicável — a migration não contém backfill de dados.
- **Isso já se confirmou na prática:** o evento de 14:58:14 UTC efetivamente *foi* uma execução completa desta migration contra um banco onde os objetos já existiam (criados anteriormente fora do fluxo de migration) — e não houve nenhum erro, nenhuma duplicação, nenhuma perda, exatamente como esta análise de risco previa antes de qualquer execução.

## 4. Condição para alinhamento — cumprida (por evento externo)

Todas as condições exigidas para o alinhamento foram cumpridas:
- Todos os objetos e efeitos existem em produção — confirmado, tabela por tabela, coluna por coluna, constraint por constraint, índice por índice, trigger, policy.
- Todas as definições são equivalentes — nenhuma diferença de tipo, constraint, default, policy ou grant encontrada.
- Nenhum trecho da migration está faltando.
- Não há atualização de dados pendente (a migration não contém nenhuma).
- Comprovado que a migration foi executada — porém não "fora do fluxo registrado" como se presumia no início da sprint, e sim pelo próprio mecanismo de deploy do Supabase, que rodou o arquivo e o registrou como consequência do merge do PR #123.

**Não foi necessário — e não foi executado — nenhum `migration repair` nesta sessão.** O registro já existia quando a verificação começou.

## 5. Histórico remoto antes e depois (desta sessão)

| Momento | Contagem | `20260706120000` presente? |
|---|---|---|
| Antes de qualquer ação desta sessão (herdado do evento de 14:58:14 UTC, ocorrido entre o fechamento da Sprint 2 e o início desta sprint) | 31 | Sim |
| Depois de todas as verificações desta sessão (nenhuma escrita realizada) | 31 | Sim, inalterado |

A contagem **não mudou dentro desta sessão** porque o registro já estava presente antes de ela começar. Nenhuma outra versão foi tocada, criada ou revertida por esta sessão.

## 6. Validação

| Item | Resultado |
|---|---|
| Correspondências exatas (local × remoto) | **31/31** |
| Divergentes | **0** |
| Só no banco | **0** |
| Só no repositório | **0** |
| Versões locais duplicadas | nenhuma |
| CLI consideraria alguma migration pendente? | Não |
| `npm run lint` | limpo |
| `npm run test:run` | **1859/1859** passando |
| `npm run build` | sucesso |
| Varredura de credenciais no diff | nada encontrado (diff contém só este relatório) |
| Linhas de dados alteradas nas 3 tabelas | nenhuma (contagens idênticas à auditoria original: 1/5/0) |

A ausência do schema-base (30 tabelas centrais sem `CREATE TABLE` em nenhuma migration) e a falha de reconstrução em banco vazio **continuam existindo, inalteradas** — fora do escopo desta sprint, como determinado.

## 7. Confirmações finais

- **Nenhum SQL desta migration foi executado por esta sessão.** A execução ocorrida em produção (14:58:14 UTC) precede o início desta sprint e foi causada por um mecanismo externo (deploy automático do Supabase acionado pelo merge do PR #123), não por nenhum comando desta sessão.
- **Nenhum `migration repair` foi executado por esta sessão.**
- **Nenhum `db push` foi executado por esta sessão.**
- **Schema e dados de produção permaneceram inalterados por esta sessão** — todas as consultas usadas foram `SELECT` (`information_schema`, `pg_catalog`, `pg_policies`, `pg_indexes`, `pg_trigger`, `pg_constraint`) e `list_migrations`/`get_logs` (leitura).
- **Nenhuma outra migration, tabela, coluna, função, policy ou RLS foi alterada.**
- Frontend, Telegram (código-fonte), `handle_new_user_profile` e limpeza de índices não foram tocados.
