# Sprint 14 — Reconciliação de Migrations (auditoria, sem alteração no remoto)

Auditoria pura, conforme regra da sprint: **nenhuma migration foi criada ou aplicada no banco remoto**. Este documento mapeia a divergência com precisão (usando o MCP do Supabase, schema real) e propõe um plano seguro — a execução do plano fica para autorização explícita numa sprint futura.

## Método

- `supabase/migrations/*.sql` local (8 arquivos) comparado com `mcp__supabase__list_migrations` (9 entradas no histórico real do projeto).
- `mcp__supabase__list_tables` e `mcp__supabase__get_advisors(security)` para confirmar que o schema vivo não regrediu desde a auditoria de 2026-07-05/Sprint 13.

## Migrations locais (8)

```
20260617020950_financial_status_fields.sql
20260618000000_lotes_pastagem_id_uuid.sql
20260619113446_lote_pastagens_historico.sql
20260623220539_fix_insecure_insert_policies.sql
20260702171318_fix_database_audit_findings.sql
20260704120000_equipe_profiles_status_and_manage_account_role.sql
20260706120000_telegram_multiuser_connections.sql
20260706130000_add_sanitario_carencia_field.sql
```

## Migrations no histórico remoto (9)

```
20260617020950_financial_status_fields
20260618000000_lotes_pastagem_id_uuid
20260619113446_lote_pastagens_historico
20260623220539_fix_insecure_insert_policies
20260626221604_fix_handle_new_user_profile_perfil_constraint   ← só no remoto
20260626221614_backfill_missing_profiles                        ← só no remoto
20260702171318_fix_database_audit_findings
20260704173340_equipe_profiles_status_and_manage_account_role   ← mesmo nome, timestamp diferente do local
20260706180142_add_sanitario_carencia_field                     ← mesmo nome, timestamp diferente do local
```

## Divergências encontradas (mais precisas que a estimativa da Sprint 13)

| Situação | Local | Remoto | Impacto | Risco |
|---|---|---|---|---|
| Só no remoto, sem arquivo local nenhum | — | `20260626221604_fix_handle_new_user_profile_perfil_constraint` | Quem rodar `supabase db reset` localmente ou clonar o projeto do zero **não aplica** essa correção — ambiente local/staging fica sem ela | Médio |
| Só no remoto, sem arquivo local nenhum | — | `20260626221614_backfill_missing_profiles` | Mesmo risco acima — é um backfill de dados, então rodar do zero localmente pode deixar `profiles` incompleta para contas de teste antigas | Médio |
| Mesmo nome, timestamp diferente | `20260704120000_equipe_profiles_status_and_manage_account_role.sql` | `20260704173340_equipe_profiles_status_and_manage_account_role` | O conteúdo provavelmente é o mesmo (mesmo nome), mas o **timestamp diferente confunde `supabase db pull`**: o CLI casa migrations pelo par (version, name) exato — com versões diferentes, o pull não reconhece como "já aplicada" e pode tentar duplicar ou reportar conflito | Médio |
| Mesmo nome, timestamp diferente | `20260706130000_add_sanitario_carencia_field.sql` | `20260706180142_add_sanitario_carencia_field` | Mesmo problema acima, para a migration de carência sanitária (Sprint 10) | Médio |
| Só localmente, **sem nenhuma correspondência no remoto** (nem por nome) | `20260706120000_telegram_multiuser_connections.sql` | — | Confirma o achado da Sprint 13. A tabela `telegram_connections` **existe** no schema remoto (verificado agora via `list_tables`, 0 linhas mas presente com RLS habilitado) — ou seja, o efeito da migration foi aplicado, só não ficou registrado no histórico de migrations do projeto (provável aplicação via `execute_sql`/SQL Editor direto, não via `apply_migration`/CLI) | Alto — é a divergência mais arriscada: o arquivo local promete uma migration que, do ponto de vista do histórico oficial, nunca rodou |

## Verificação do schema vivo (não houve regressão desde a Sprint 13)

- 33 tabelas em `public`, todas com RLS habilitado (confirmado agora).
- `telegram_connections`, `telegram_connection_codes`, `telegram_notification_logs` existem e têm dados coerentes com o uso real (4 códigos de pareamento, 0 conexões ativas na amostra atual).
- Advisor de segurança idêntico ao da Sprint 13: mesmos itens de hardening (funções com `search_path` mutável, `citext` fora de schema dedicado, funções `SECURITY DEFINER` expostas a `anon`/`authenticated`, proteção de senha vazada desligada) — nenhum item novo, nenhuma regressão.

## Recomendação (plano seguro — não executado nesta sprint)

1. **Não recriar as 2 migrations só-remoto localmente "do zero"** — o risco de reescrever incorretamente uma migration de correção de constraint/backfill sem ver o SQL original é maior que o benefício. Em vez disso, rodar `supabase db pull` (ou `supabase migration list` + `supabase db diff`) num ambiente com acesso de escrita ao projeto, para baixar o SQL real dessas duas migrations e adicioná-las ao repositório local com o nome/timestamp exatos do remoto.
2. **Para os 2 arquivos com timestamp divergente** (`equipe_profiles...`, `add_sanitario_carencia_field`), comparar o conteúdo SQL local vs. o que está de fato aplicado (via `execute_sql` contra `information_schema`, já parcialmente feito) para confirmar que são idênticos — se forem, renomear o arquivo local para o timestamp do remoto (renomear arquivo, não é uma migration nova); se divergirem, investigar por quê antes de qualquer ação.
3. **Para `telegram_multiuser_connections`**: como o efeito já está em produção, a ação correta não é "aplicar" a migration de novo (arriscaria erro de "already exists" ou, pior, duplicar objetos) — é **registrar** essa migration no histórico remoto como já aplicada (`supabase migration repair` ou equivalente), depois de confirmar exatamente quais objetos ela cria batem com o que já existe no schema.
4. Depois dos 3 passos acima, rodar `supabase db pull` novamente e confirmar zero diffs — só então a pasta `supabase/migrations/` volta a ser a fonte confiável do schema.

**Por que nenhuma dessas 4 ações foi executada nesta sprint:** todas envolvem escrever no histórico de migrations do projeto remoto (mesmo que não alterem dados/schema diretamente), o que a regra desta sprint proíbe sem autorização explícita ("não aplicar migration no banco remoto sem confirmação explícita"). Fica registrado como plano pronto para a próxima vez que alguém autorizar a execução.

## Status final

- Nenhuma migration criada.
- Nenhuma migration aplicada no remoto.
- Divergência mapeada com precisão (5 pontos, tabela acima), mais granular que a estimativa "2 só remoto / 1 só local" da Sprint 13 — na prática são 2 só-remoto, 1 só-local-sem-correspondência, e 2 com timestamp divergente (não contados como "iguais" pela Sprint 13, mas também não são migrations extras — é desalinhamento de nome de arquivo).
