# Sprint 17 — Limpeza de Banco, Migrations e RLS

Auditoria completa do schema Supabase (local × remoto), RLS/policies, funções/triggers e índices, com correções mínimas e seguras aplicadas onde havia evidência clara e baixo risco. Ver também [HERDON_SCHEMA_OFICIAL.md](HERDON_SCHEMA_OFICIAL.md) (schema resumido por módulo) e [HERDON_PLANO_RECONCILIACAO_SUPABASE.md](HERDON_PLANO_RECONCILIACAO_SUPABASE.md) (plano para o que ficou pendente).

## Contexto (Sprints 13-16)

- **Sprint 13** (auditoria 360°) apontou deriva entre migrations locais e remoto, 92 policies permissivas duplicadas, 97 ocorrências de `auth.uid()` não cacheado, 16 FKs sem índice, 38 índices duplicados, 5 funções com `search_path` mutável.
- **Sprint 14** mapeou a deriva de migrations com precisão (2 só-remoto, 1 só-local sem registro, 2 com timestamp divergente) mas não alterou nada — auditoria pura.
- **Sprint 15/16** resolveram bugs de integridade (Sanidade↔Estoque, Central de Alertas) sem tocar em schema além do estritamente necessário (Sprint 16 criou `alertas_tratativas`).

## Etapa 0 — Pré-checks

| Check | Resultado |
|---|---|
| `npm run lint` | limpo, sem warnings |
| `npm test -- --run` | **922/922** passando |
| `npm run build` | ok (~3s) |
| `git status --short` | árvore com apenas arquivos do vault Obsidian não versionados (fora de escopo desta sprint, não commitados) |

## Etapa 2/3 — Migrations: local (10 arquivos) × remoto (10 registros)

Auditado via leitura de todos os arquivos `.sql` locais e `mcp__supabase__list_migrations` (schema real). Todas as 10 migrations locais são aditivas/idempotentes: usam `IF NOT EXISTS`/`DROP ... IF EXISTS` antes de recriar, nenhuma contém `DROP TABLE`/`DROP COLUMN`.

| Arquivo local | Tabelas afetadas | CREATE TABLE | ALTER TABLE | RLS/policy | Índice | Idempotente |
|---|---|---|---|---|---|---|
| `20260617020950_financial_status_fields` | movimentacoes_financeiras | não | sim | não | sim | sim |
| `20260618000000_lotes_pastagem_id_uuid` | lotes | não | sim (tipo+FK) | não | não | sim (DO $$ condicional) |
| `20260619113446_lote_pastagens_historico` | lote_pastagens_historico | sim | não | sim (owner+same_account) | sim | sim |
| `20260623220539_fix_insecure_insert_policies` | cenario_eventos, suplementacao, +4 force RLS | não | não | sim (corrige `with_check(true)`) | não | sim |
| `20260702171318_fix_database_audit_findings` | profiles, eventos_operacionais | não | não (function drop + update) | sim | não | parcial (UPDATE de backfill não é reversível, mas idempotente na prática) |
| `20260704173340_equipe_profiles_status_and_manage_account_role` | profiles | não | sim (coluna status) | não (function redefinida) | não | sim |
| `20260706120000_telegram_multiuser_connections` | telegram_connections, telegram_connection_codes, telegram_notification_logs | sim (3 tabelas) | não | sim | sim | sim |
| `20260706180142_add_sanitario_carencia_field` | sanitario | não | sim (coluna) | não | não | sim |
| `20260707034513_alertas_tratativas` | alertas_tratativas | sim | não | sim (só same_account) | sim | sim |
| `20260707161920_indexes_and_search_path_hardening` **(novo)** | 11 tabelas (índices) + 5 funções + 4 tabelas (force RLS) | não | não | não | sim | sim |

**Nenhuma migration usa `owner_user_id`/`fazenda_id` sem RLS correspondente** nas tabelas que criam. Todas as que criam tabela nova habilitam RLS na mesma migration.

### Reconciliação de nomes de arquivo (feita nesta sprint)

Três arquivos tinham o conteúdo já aplicado no remoto, mas com timestamp de nome diferente do registrado em `supabase_migrations.schema_migrations` — o mesmo problema que a Sprint 14 mapeou para outros 2 arquivos (já corrigidos antes desta sprint, provavelmente na iteração identificada nos comentários como "Sprint 30.1"). Como o `supabase` CLI casa migrations pelo par exato (version, name), isso impedia `supabase db pull` de reconhecer os arquivos como já aplicados. Renomeado (mesmo conteúdo, zero mudança de schema):

| Antes | Depois (timestamp real do remoto) |
|---|---|
| `20260704120000_equipe_profiles_status_and_manage_account_role.sql` | `20260704173340_equipe_profiles_status_and_manage_account_role.sql` |
| `20260706130000_add_sanitario_carencia_field.sql` | `20260706180142_add_sanitario_carencia_field.sql` |
| `20260708090000_alertas_tratativas.sql` | `20260707034513_alertas_tratativas.sql` |

A migration nova desta sprint também sofreu o mesmo efeito ao ser aplicada via `apply_migration` (nome de arquivo `20260709100000`, registrada no remoto como `20260707161920`) — corrigida na hora, para não reintroduzir o mesmo problema que a sprint existe para resolver.

### Divergências que permanecem (não corrigidas nesta sprint — ver plano de reconciliação)

| Situação | Item | Risco | Por que não foi corrigido agora |
|---|---|---|---|
| Só no remoto, sem arquivo local | `20260626221604_fix_handle_new_user_profile_perfil_constraint` | P1 | Recriar sem ver o SQL original arrisca reescrever incorretamente; requer `supabase db pull` com CLI |
| Só no remoto, sem arquivo local | `20260626221614_backfill_missing_profiles` | P1 | Mesmo motivo — é um backfill de dados, mais arriscado ainda de recriar de memória |
| Só local, não registrado no histórico remoto (tabela existe, aplicada via SQL direto) | `20260706120000_telegram_multiuser_connections` | P1 | Registrar exigiria `supabase migration repair`, que este ambiente não tem CLI para rodar; a regra da sprint proíbe editar `supabase_migrations.schema_migrations` manualmente sem autorização explícita |
| Comentário desatualizado | `20260618000000_lotes_pastagem_id_uuid.sql` diz que a migration "nunca foi registrada" — **isso não é mais verdade**, `list_migrations` confirma que está registrada hoje | nenhum (só documentação) | Não editamos o corpo de migrations já aplicadas; ver nota no plano de reconciliação |

## Etapa 3 — Schema remoto (auditoria estrutural, sem dados reais)

**35 tabelas** em `public`, todas com `RLS habilitado`. Detalhes por tabela em [HERDON_SCHEMA_OFICIAL.md](HERDON_SCHEMA_OFICIAL.md). Nenhuma tabela existe no remoto sem migration local correspondente (e vice-versa) — a deriva é só de **registro de histórico**, não de **estrutura viva**: todo objeto (tabela/coluna/policy/índice) que existe no remoto tem um arquivo local que o descreve, mesmo quando esse arquivo não está listado no histórico oficial de migrations.

## Etapa 5 — RLS e policies

- **31 das 35 tabelas** seguem o padrão consolidado: par de policies `_owner` (dono direto) + `_same_account` (mesma conta, via `app_is_same_account`) por comando (SELECT/INSERT/UPDATE/DELETE) — é o padrão dominante do projeto, deliberado desde a Sprint 13 (não é bug, é a estratégia de "policies permissivas duplicadas" já documentada como dívida de performance aceita, não de segurança).
- **`alertas_tratativas`** (Sprint 16) e **`billing_events`/`checkout_sessions`/`customer_subscriptions`/`consumo_suplementacao`/`alertas_adiados`** usam só `_same_account`, sem o par duplicado — padrão mais novo, adotado deliberadamente para não crescer mais a dívida (documentado na própria migration da Sprint 16).
- **`telegram_connections`** usa só `_own` (por `user_id`, não `owner_user_id`) — modelo diferente de propósito (Sprint 7): conexão pessoal, não visível a outros membros da mesma conta.
- **`telegram_connection_codes`/`telegram_notification_logs`** têm RLS habilitado **sem nenhuma policy** para `authenticated` — intencional (só service role acessa), confirmado como INFO (não WARN) pelo advisor.
- **`subscription_plans`** tem a única policy `USING (true)` do schema — correta: é catálogo público de planos, sem dado de conta.
- **`profiles`** tem nomenclatura de policy inconsistente (`"Users can update own profile basics"`, `"Users can view own profile"` — em inglês e com espaço — misturadas com `profiles_select_same_account`, `profiles_update_self_or_manager` no padrão snake_case do resto do projeto). Funcional, mas é a única tabela com esse desvio de convenção — registrado no plano de reconciliação como limpeza P3.
- **Nenhuma policy com `with_check(true)`/`using(true)` insegura** foi encontrada (a única desprotegida é a de `subscription_plans`, que é correta). O achado da Sprint 13 sobre esse padrão (`cenario_eventos`/`suplementacao`) já foi corrigido pela migration `20260623220539`, confirmado nesta auditoria.
- **Nenhuma tabela multi-tenant está sem `owner_user_id`.**

**Ação:** nenhuma policy foi removida ou alterada nesta sprint (além do `force row level security` em 4 tabelas, que não muda quem acessa o quê — só padroniza a defesa contra o role `owner` da tabela, nunca usado pelo app). A consolidação dos pares `_owner`+`_same_account` (BM-10 do backlog) segue como item de sprint futura — mudar 31 tabelas de uma vez é risco maior do que o "reduzir risco, não aumentar" desta sprint permite.

## Etapa 6 — Funções, triggers, search_path

11 funções em `public` (fora as internas da extensão `citext`). Antes desta sprint, **5 tinham `search_path` mutável** (WARN do advisor): `set_updated_at`, `set_cenarios_owner`, `set_cenario_eventos_owner`, `set_current_timestamp_updated_at`, `set_pastagens_owner`. As outras 6 (`app_is_same_account`, `app_current_owner_user_id`, `app_current_profile_role`, `app_can_manage_account`, `handle_new_user_profile`, `mover_lote_para_pasto`) já tinham `SET search_path = public` (ou `public, auth`) desde que foram criadas.

**Corrigido nesta sprint** (migration `20260707161920`): as 5 funções passaram a ter `SET search_path = public`, sem alterar o corpo/comportamento de nenhuma — confirmado no advisor pós-migration (o lint `function_search_path_mutable` não aparece mais no relatório). As 3 que são `SECURITY DEFINER` (`set_cenarios_owner`, `set_cenario_eventos_owner`, `set_pastagens_owner`) são as que efetivamente importavam para hardening — são triggers simples (`if new.owner_user_id is null then new.owner_user_id = auth.uid()`), sem lookup de tabela, então o risco prévio era baixo, mas a correção é trivial e o padrão já era usado em outras 6 funções do projeto.

**Não corrigido (fora do escopo seguro desta sprint):**
- `app_can_manage_account`/`app_current_owner_user_id`/`app_current_profile_role`/`app_is_same_account`/`handle_new_user_profile`/`set_cenarios_owner`/`set_cenario_eventos_owner`/`set_pastagens_owner` aparecem no advisor como **executáveis por `anon`/`authenticated` via RPC** (`SECURITY DEFINER` exposto). Isso é o design intencional do projeto (funções auxiliares de RLS/trigger, chamadas pelo próprio Postgres ou pelo client via `.rpc()`), não uma regressão nova — revogar `EXECUTE` sem mapear todos os chamadores no frontend arrisca quebrar RLS em produção. Registrado no plano de reconciliação para uma sprint dedicada a esse assunto.
- `citext` instalada em `public` em vez de um schema dedicado — mover exige recriar a extensão e revisar todo uso de tipo `citext` nas colunas que a usam; fora do escopo "migration mínima" desta sprint.
- Proteção de senha vazada (HaveIBeenPwned) desabilitada — configuração do painel Auth do Supabase, não uma migration SQL.

## Etapa 7 — Índices

**13 colunas de foreign key sem índice líder** (Sprint 13 relatou 16; a diferença são os índices já criados por migrations das Sprints 15/16) e **5 tabelas usando o padrão genérico `origem`/`origem_tipo`+`origem_id`** (convenção usada por Sanidade→Estoque desde a Sprint 15, e por outros módulos) sem índice composto, apesar de serem consultadas por esse par.

**Corrigido nesta sprint** (migration `20260707161920`, 17 `CREATE INDEX IF NOT EXISTS`):
- FKs: `alertas_tratativas.fazenda_id`, `customer_subscriptions.farm_id`, `customer_subscriptions.fazenda_id`, `eventos_operacionais.{fazenda_id,lote_id,funcionario_id}`, `lote_pastagens_historico.{pastagem_destino_id,pastagem_origem_id}`, `sanitario.rotina_automatica_id`, `telegram_connection_codes.fazenda_id`, `telegram_connections.fazenda_id`, `telegram_notification_logs.telegram_connection_id`.
- Composto `(origem_tipo, origem_id)` ou `(origem, origem_id)`: `movimentacoes_estoque`, `movimentacoes_animais`, `movimentacoes_financeiras`, `custos`, `eventos_operacionais`.

**Não corrigido (documentado, ação futura):**
- **~40 índices duplicados** (mesma coluna, dois nomes diferentes — ex.: `fazendas.owner_user_id` tem 3 índices idênticos: `fazendas_owner_user_id_idx`, `idx_fazendas_owner`, `idx_fazendas_owner_user_id`). Padrão recorrente: quase toda tabela tem um índice do padrão antigo (`idx_<tabela>_<coluna>`, curto) e um do padrão novo (`<tabela>_<coluna>_idx`, gerado por alguma migration/tool posterior) cobrindo a mesma coluna. Não removido porque **dropar índice é uma ação destrutiva de fato** (a sprint proíbe `drop table`/`drop column`, mas o espírito — "reduzir risco, não aumentar" — se aplica aqui também): identificar com certeza qual nome cada camada de código/relatório pode depender exige grep completo antes de remover, fora do orçamento desta sprint. Custo real hoje é só espaço em disco e overhead marginal de escrita — nada que afete a experiência do piloto. Ver plano de reconciliação para o critério de remoção segura.
- `auth_rls_initplan` (RLS não cacheado, ~97 ocorrências) — mesma dívida de performance da Sprint 13, não within escopo (exigiria reescrever `using`/`with_check` de quase toda policy do projeto).

## Etapa 8 — Naming e entidades duplicadas (documentação, sem ação)

Confirmado que os achados de nomenclatura da Sprint 13 continuam presentes — nenhum foi corrigido nesta sprint por decisão explícita da regra ("não renomear colunas salvo indispensável e seguro"):

| Padrão | Onde aparece | Risco | Recomendação |
|---|---|---|---|
| `faz_id` (bigint) × `fazenda_id` | `lotes`, `pastagens` (`pastagens` tem as duas ao mesmo tempo, tipos diferentes) | Alto — código pode ler a coluna errada silenciosamente | BM-07 do backlog; padronizar em `fazenda_id` numa sprint dedicada com backfill validado |
| `farm_id` × `fazenda_id` | `customer_subscriptions` (as duas) | Médio | BM-08; mesmo tratamento, escopo menor (1 tabela) |
| `p_at` × `peso_atual` × `peso_medio_atual` | `lotes` (as três) | Médio — risco de atualização parcial | BM-09; escolher uma fonte de verdade, migrar as outras para view/alias se algum consumidor externo depender |
| `usuarios` × `profiles` | tabelas inteiras | Médio — não fica claro qual é autoritativa para papel/perfil | BM-12; decisão de arquitetura, não migration simples |
| `cat`/`desc`/`val` × `categoria`/`descricao`/`valor` | `custos` vs `movimentacoes_financeiras` | Baixo (cosmético, mas dificulta onboarding) | Renomear só se `custos` for consolidada/aposentada — não vale migration isolada |
| `funcionarios` × `equipeAcessos` | duplicação de conceito "Equipe", não de coluna | Médio (UX) | BM-25; fora do escopo de banco, é limpeza de página/rota |
| Tabelas de billing em inglês (`billing_events`, `checkout_sessions`, `customer_subscriptions`, `subscription_plans`) | schema majoritariamente em português | Baixo | Aceitar como reflexo da integração Asaas; não renomear (risco alto, benefício baixo) |

Nenhuma dessas foi tratada nesta sprint — todas exigem migração de dados/backfill, maior que o orçamento de "migration mínima" definido pela regra da sprint.

## Etapa 9/10 — Ação escolhida

**Opção C (migration corretiva pequena)**, não Opção A (só documentação) nem B (baseline completo): havia itens com evidência clara, baixo risco e alto valor (índices faltantes em colunas realmente consultadas pelo app, search_path de funções já usando o padrão do projeto, `force row level security` seguindo o precedente da migration `20260623220539`). Critério aplicado em cada item candidato: **só entrou na migration o que já tinha um padrão idêntico aplicado em produção antes** (nenhuma decisão nova de arquitetura).

Migration criada e **aplicada no remoto**: [`supabase/migrations/20260707161920_indexes_and_search_path_hardening.sql`](../supabase/migrations/20260707161920_indexes_and_search_path_hardening.sql). Confirmado via `get_advisors(security)` pós-aplicação: os 5 avisos de `function_search_path_mutable` desapareceram; nenhum aviso novo apareceu.

**Rollback manual, se necessário:** todos os `CREATE INDEX` podem ser revertidos com `DROP INDEX IF EXISTS <nome>`; as 3 funções podem voltar ao estado anterior reaplicando o `CREATE OR REPLACE FUNCTION` sem a linha `SET search_path = public` (corpo idêntico, documentado acima); o `FORCE ROW LEVEL SECURITY` pode ser revertido com `ALTER TABLE ... NO FORCE ROW LEVEL SECURITY` nas 4 tabelas.

## Testes e validação final (Etapa 15)

- `npm run lint` — limpo.
- `npm test -- --run` — **922/922**, sem alteração de contagem (migration de banco não tem código de aplicação associado, então nenhum teste novo era esperado).
- `npm run build` — ok.
- `mcp__supabase__get_advisors(security)` pós-migration — sem regressão, 5 avisos resolvidos.
- Nenhum `.env` alterado, nenhum dado real exportado/impresso, nenhuma alteração destrutiva.

## Limitações restantes

- As 2 migrations só-remoto e a 1 só-local-sem-registro (`telegram_multiuser_connections`) continuam pendentes — exigem `supabase` CLI autenticado (`db pull`/`migration repair`), que este ambiente de sessão não tem. Plano detalhado em [HERDON_PLANO_RECONCILIACAO_SUPABASE.md](HERDON_PLANO_RECONCILIACAO_SUPABASE.md).
- ~40 índices duplicados seguem sem remoção — documentados, não removidos (risco de identificar dependência errada).
- RLS com pares `_owner`+`_same_account` duplicados (BM-10) e `auth.uid()` não cacheado (`auth_rls_initplan`) seguem como dívida de performance conhecida, não segurança — não tratados, mudança grande demais para "reduzir risco, não aumentar".
- Naming duplicado (`faz_id`/`fazenda_id`, `farm_id`/`fazenda_id`, 3 colunas de peso, `usuarios`/`profiles`) não foi tocado — decisão explícita da regra da sprint.
- `citext` fora de schema dedicado e proteção de senha vazada desabilitada seguem como hardening pendente (o segundo é configuração de painel, não SQL).

## Próximos passos recomendados

1. Rodar `supabase db pull` num ambiente com CLI autenticado para baixar o SQL real das 2 migrations só-remoto e registrar `telegram_multiuser_connections` via `supabase migration repair --status applied 20260706120000` (ou o timestamp real, se diferente).
2. Sprint dedicada a BM-07/BM-08/BM-09 (naming) com backfill e teste de regressão — não misturar com hardening de performance.
3. Sprint dedicada a BM-10 (consolidar pares de policy) — mudança ampla, precisa de teste de regressão de RLS por tabela, não só lint/build.
4. Avaliar remoção dos ~40 índices duplicados com um grep completo de `.from('<tabela>')`/`.rpc(...)` antes de dropar qualquer um.
