# HERDON — Plano de Reconciliação Supabase (local × remoto)

Plano de execução para o que a Sprint 17 mapeou mas não pôde corrigir sem CLI autenticado ou sem risco maior que o orçado. Ver [SPRINT17_LIMPEZA_BANCO_RLS_MIGRATIONS.md](SPRINT17_LIMPEZA_BANCO_RLS_MIGRATIONS.md) para o relatório completo da sprint.

## Divergências exatas (estado após Sprint 17)

| # | Objeto | Local | Remoto | Ação |
|---|---|---|---|---|
| 1 | `fix_handle_new_user_profile_perfil_constraint` | ausente | `20260626221604` | `supabase db pull` |
| 2 | `backfill_missing_profiles` | ausente | `20260626221614` | `supabase db pull` |
| 3 | `telegram_multiuser_connections` | `20260706120000` (arquivo existe, tabelas aplicadas via SQL direto) | não registrado no histórico | `supabase migration repair --status applied` |

As 3 divergências de timestamp (equipe_profiles, sanitario_carencia, alertas_tratativas) e a nova migration desta sprint **já foram corrigidas** (arquivos renomeados para bater com o remoto, sem alteração de conteúdo).

## Fase 1 — Automatizável (precisa só de `supabase` CLI autenticado, sem julgamento humano)

1. `supabase link --project-ref ljpiszxicmmuefbiixui` (ou equivalente já configurado).
2. `supabase db pull` — baixa o SQL real de `fix_handle_new_user_profile_perfil_constraint` e `backfill_missing_profiles` e cria os arquivos locais com nome/timestamp exatos.
3. Revisar os 2 arquivos baixados (leitura, não edição) e commitar.
4. Rodar `supabase db pull` novamente — deve retornar zero diffs adicionais para essas duas.

**Por que não foi feito nesta sessão:** este ambiente não tem o Supabase CLI instalado/autenticado, só o MCP (`execute_sql`/`apply_migration`), que não expõe o SQL histórico exato de uma migration já aplicada sem reconstruí-lo manualmente — risco de reescrever incorretamente uma correção de constraint ou um backfill de dados.

## Fase 2 — Precisa de confirmação manual (decisão, não só mecânica)

1. **Registrar `telegram_multiuser_connections` como aplicada:** antes de rodar `supabase migration repair --status applied 20260706120000`, confirmar que o SQL do arquivo local bate **exatamente** com o que existe no remoto hoje (comparar `CREATE TABLE`/índices/policies linha a linha contra `mcp__supabase__list_tables`/`pg_policies` — já feito nesta sprint para as 3 tabelas, ver `HERDON_SCHEMA_OFICIAL.md` §8). Se bater, o `repair` é seguro (só marca histórico, não roda SQL). Se não bater, investigar a diferença antes.
2. **Índices duplicados (~40):** antes de dropar qualquer um, `grep -rn "\.from('<tabela>')" src/ api/` para confirmar que nenhum código depende do nome específico do índice (não deveria — Postgres escolhe o índice pelo otimizador, não por nome — mas confirmar que não há `.rpc()`/query com `USE INDEX` ou hint equivalente). Critério de remoção: manter o índice de nome mais recente/consistente com o padrão `<tabela>_<coluna>_idx`, dropar o mais antigo (`idx_<tabela>_<coluna>`) com `DROP INDEX CONCURRENTLY IF EXISTS` (não bloqueia escrita).
3. **BM-10 (consolidar `_owner`+`_same_account`):** decisão de arquitetura — ou (a) manter os pares e aceitar o custo, documentando formalmente que é intencional, ou (b) reescrever a policy única por comando cobrindo os dois casos (`owner_user_id = auth.uid() OR app_is_same_account(owner_user_id)`), testado tabela por tabela com conta de teste real (não só lint/build). Opção (b) é preferível a longo prazo mas precisa de sprint dedicada com validação visual — 31 tabelas, alto risco de regressão silenciosa de RLS se testado só por leitura de SQL.
4. **BM-07/BM-08/BM-09 (naming):** qualquer renomeação de coluna precisa de: (1) grep completo de todos os usos no frontend/api, (2) migration com `ALTER TABLE ... RENAME COLUMN` ou view de compatibilidade temporária, (3) deploy coordenado (renomear coluna sem atualizar o client quebra produção instantaneamente, diferente de adicionar coluna). Não é uma migration "mínima" — tratar como sprint própria.

## O que NÃO deve ser feito automaticamente

- **Não** recriar `fix_handle_new_user_profile_perfil_constraint`/`backfill_missing_profiles` "do zero" a partir de suposição — só via `db pull` do SQL real.
- **Não** rodar `migration repair` sem antes confirmar equivalência exata do SQL (passo Fase 2.1).
- **Não** dropar índice duplicado sem grep prévio e sem `CONCURRENTLY`.
- **Não** renomear coluna (`faz_id`→`fazenda_id` etc.) sem migration de compatibilidade + deploy coordenado — renomear direto quebra o client em produção no intervalo entre a migration e o deploy do frontend.
- **Não** revogar `EXECUTE` das funções `SECURITY DEFINER` expostas a `anon`/`authenticated` sem mapear todos os pontos do frontend que chamam `.rpc(...)` — algumas dessas funções (`app_is_same_account`, `app_current_owner_user_id`) são chamadas implicitamente por outras policies de RLS, não só pelo client.

## Checklist para novo ambiente (clonar o projeto do zero)

- [ ] `supabase db pull` roda sem diff depois da Fase 1 (hoje ainda gera diff nas 2 migrations só-remoto).
- [ ] `supabase migration repair` aplicado para `telegram_multiuser_connections` (hoje: tabela existe no remoto, `supabase db reset` local não a recria porque o histórico não a reconhece).
- [ ] Todas as migrations locais aplicam em ordem sem erro num banco vazio (`supabase db reset`) — não testado nesta sessão (sem CLI); recomendado antes de qualquer onboarding de novo desenvolvedor.

## Checklist para produção (antes de qualquer deploy que toque schema)

- [ ] Rodar `mcp__supabase__get_advisors(security)` e `(performance)` antes e depois de qualquer migration nova — comparar diff, não só ausência de erro.
- [ ] Toda migration nova usa `IF NOT EXISTS`/`IF EXISTS` (idempotente) — confirmado como padrão 100% seguido nas 10 migrations atuais, manter.
- [ ] Nenhuma migration com `DROP TABLE`/`DROP COLUMN` sem confirmação explícita fora do fluxo automatizado.
- [ ] Migration aplicada via `apply_migration` (MCP) ou `supabase db push` (CLI) — nunca via SQL Editor direto sem depois criar o arquivo local correspondente (é exatamente essa mistura de caminhos que gerou a deriva atual).

## Como evitar nova divergência

A causa raiz da deriva observada nesta e nas sprints anteriores é **aplicar SQL fora do fluxo de migration** (SQL Editor direto ou `execute_sql` para DDL) sem depois criar/commitar o arquivo `.sql` correspondente com o timestamp real. A partir desta sprint, o padrão a seguir é:

1. Escrever a migration como arquivo em `supabase/migrations/` primeiro.
2. Aplicar via `mcp__supabase__apply_migration` (ou `supabase db push`), nunca via `execute_sql` para DDL.
3. Depois de aplicada, conferir com `mcp__supabase__list_migrations` o timestamp real registrado — se divergir do nome do arquivo (acontece porque `apply_migration` usa o horário do apply, não o do arquivo), **renomear o arquivo local imediatamente**, no mesmo commit. Foi o que esta sprint fez para a própria migration nova (`20260707161920`), evitando reintroduzir o problema que ela mesma existe para resolver.
