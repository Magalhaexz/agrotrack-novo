# Baseline candidata do schema-base — HERDON (Sprint 4)

> **NÃO É UMA MIGRATION ATIVA.** Este diretório existe deliberadamente **fora**
> de `supabase/migrations/` para não ser detectado/executado pela integração
> automática Supabase↔GitHub (que aplica em produção qualquer migration
> adicionada a `supabase/migrations/` em `main`, em segundos — comportamento
> confirmado empiricamente na Sprint 3, ver `docs/SPRINT3_ALINHAMENTO_MIGRATION_TELEGRAM.md`).

## O que é isto

`00000000000000_herdon_schema_base.sql` é uma candidata de **baseline**: um
script que, aplicado a um banco Postgres **vazio**, recria apenas os objetos
que precisavam existir imediatamente **antes** da primeira migration hoje
rastreada em `supabase/migrations/`
(`20260617020950_financial_status_fields.sql`). O objetivo é permitir, no
futuro, reconstruir o schema-base do HERDON do zero — hoje isso não é
possível: 30 das ~37 tabelas de produção nunca tiveram um `CREATE TABLE`
capturado em nenhuma migration (ver `docs/AUDITORIA_CADEIA_MIGRATIONS_SUPABASE.md`).

## Regras de uso — leia antes de tocar neste arquivo

- **Nunca mover para `supabase/migrations/`** sem antes concluir a validação
  completa (teste de replay + comparação estrutural + testes do app) e sem
  uma decisão explícita e documentada de que a candidata está pronta para
  virar migration oficial.
- **Nunca aplicar contra o projeto Supabase de produção**
  (`ljpiszxicmmuefbiixui`) nem qualquer outro ambiente com dados reais.
- **Nunca rodar via `db push`, `apply_migration` (MCP) ou `migration repair`.**
- Use apenas em banco Postgres **local, descartável e vazio** (Docker,
  `supabase start`, ou uma branch de desenvolvimento Supabase — nenhuma dessas
  opções estava disponível no ambiente em que esta candidata foi escrita; ver
  `docs/SPRINT4_BASELINE_CANDIDATA_SUPABASE.md`, seção "Teste em ambiente
  descartável", para o estado exato desse bloqueio).
- **Ainda em fase de validação.** Este arquivo foi construído por
  engenharia reversa do catálogo ao vivo de produção (`information_schema` +
  `pg_catalog`, consultados em 2026-07-30) cruzado com grep de todas as 31
  migrations rastreadas, mas **nunca foi de fato aplicado e testado
  ponta-a-ponta** (baseline → as 31 migrations em sequência) por falta de
  ambiente descartável acessível nesta sessão. Trate como "melhor esforço
  documentado", não como verdade validada, até que o teste de replay seja
  executado por alguém com acesso a um Postgres local ou a uma branch paga do
  Supabase (plano Pro).

## O que está e o que não está aqui

Inclui: extensions, o enum `app_profile`, as funções utilitárias
`set_current_timestamp_updated_at()`/`set_updated_at()`, as 30 tabelas sem
`CREATE TABLE` em nenhuma migration rastreada (incluindo as 3 completamente
não documentadas em qualquer lugar do repositório: `cenario_eventos`,
`eventos_operacionais`, `suplementacao`), PKs, FKs, índices e triggers de
`updated_at` de cada uma, grants mínimos, e a RLS inicial (funções
`app_current_owner_user_id`/`app_current_profile_role`/`app_is_same_account`/
`app_can_manage_account` + as policies `_owner`/`_own`/`_same_account` na
forma **anterior** ao gate de papel de escrita introduzido por
`20260713193754`/`20260713204723`).

Não inclui, deliberadamente: `handle_new_user_profile()` e o trigger
`on_auth_user_created` (o primeiro `CREATE OR REPLACE` rastreado desta função
é `20260626221604`, já posterior à primeira migration — não precisam existir
antes dela); nenhuma coluna/índice/trigger/policy criada por uma das 31
migrations rastreadas (lista completa por objeto no relatório da sprint);
`app_current_role_can_write()` e `app_can_access_fazenda()` (criadas por
migrations posteriores); dados reais de qualquer tipo.

Detalhamento objeto-a-objeto (origem de cada coluna/índice/trigger/policy,
por que foi incluído ou excluído) está em
`docs/SPRINT4_BASELINE_CANDIDATA_SUPABASE.md`.
