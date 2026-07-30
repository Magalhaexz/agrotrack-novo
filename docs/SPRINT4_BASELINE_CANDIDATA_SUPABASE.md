# Sprint 4 — Baseline candidata do schema-base do HERDON

**Branch:** `feat/sprint4-baseline-candidate`
**Data:** 2026-07-30
**Projeto Supabase:** `ljpiszxicmmuefbiixui` (produção — nunca alterado nesta sprint)
**Regra crítica seguida:** nenhum objeto criado aqui foi colocado em
`supabase/migrations/`, nenhum `apply_migration`/`db push`/`migration repair`
foi executado, nenhum SQL foi rodado contra produção além de `SELECT`
read-only sobre `information_schema`/`pg_catalog`.

---

## 1. Fontes utilizadas

- `docs/AUDITORIA_CADEIA_MIGRATIONS_SUPABASE.md` — ponto de partida: lista as
  30 tabelas sem `CREATE TABLE` em nenhuma migration e as 3 completamente não
  documentadas (`cenario_eventos`, `eventos_operacionais`, `suplementacao`).
- `docs/SPRINT2_RECONCILIACAO_VERSOES_MIGRATIONS.md` e
  `docs/SPRINT3_ALINHAMENTO_MIGRATION_TELEGRAM.md` — contexto de como as 31
  migrations hoje rastreadas chegaram ao estado atual.
- `docs/supabase-production-schema.sql` e `docs/supabase-production-rls.sql`
  — lidos por completo como ponto de partida, **mas descartados como fonte
  primária de tipos/colunas** depois que a comparação com o catálogo ao vivo
  revelou drift sistemático (ver seção 8). Usados só como guia de quais
  tabelas/policies existiam, não como fonte de verdade de definição.
- **Catálogo ao vivo de produção** (`information_schema.columns`,
  `pg_constraint`, `pg_indexes`, `information_schema.triggers`, `pg_policies`,
  `pg_proc`), consultado via Supabase MCP (`execute_sql`, somente `SELECT`)
  em 2026-07-30 — fonte de verdade final para todas as 30 tabelas.
- Todas as 31 migrations em `supabase/migrations/*.sql`, varridas por completo
  via `grep` para `CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX`,
  `CREATE TRIGGER`, `CREATE POLICY`/`DROP POLICY`, `CREATE OR REPLACE FUNCTION`
  — usadas para decidir, objeto a objeto, o que é anterior a
  `20260617020950` (entra na baseline) e o que é criado/alterado por uma
  migration rastreada (fica de fora).

---

## 2. Objetos incluídos

30 tabelas, todas com PK, FKs, índices e (pelo menos um) trigger de
`updated_at`: `profiles`, `invites`, `subscription_plans`, `fazendas`,
`customer_subscriptions`, `billing_events`, `checkout_sessions`, `pastagens`,
`funcionarios`, `lotes`, `rotinas`, `sanitario`, `animais`, `pesagens`,
`estoque`, `movimentacoes_estoque`, `movimentacoes_financeiras`,
`movimentacoes_animais`, `custos`, `tarefas`, `usuarios`, `configuracoes`,
`cenarios`, `auditoria`, `alertas_resolvidos`, `alertas_adiados`,
`consumo_suplementacao`, `cenario_eventos`, `eventos_operacionais`,
`suplementacao`.

Mais: extensões `citext`/`pgcrypto`; enum `app_profile`; funções
`set_current_timestamp_updated_at()` e `set_updated_at()` (as duas — ver nota
de duplicação na seção 5); as 4 funções de RLS
(`app_current_owner_user_id`, `app_current_profile_role`,
`app_is_same_account`, `app_can_manage_account`); RLS habilitada e forçada em
todas as 30 tabelas com as policies `_owner`/`_own`/`_same_account` na forma
pré-gate de escrita; grants mínimos (`usage`/`select`/`insert`/`update`/`delete`
para `authenticated`, `usage` de schema para `anon`).

---

## 3. Objetos deliberadamente excluídos (e por quê)

| Objeto | Motivo da exclusão | Migration que o cria/altera |
|---|---|---|
| `handle_new_user_profile()`, trigger `on_auth_user_created` | Primeiro `CREATE OR REPLACE` rastreado é posterior a `20260617020950` — não precisa existir antes | `20260626221604` |
| `movimentacoes_financeiras.status/data_competencia/data_vencimento/data_pagamento` + seus índices | Colunas adicionadas pela própria primeira migration rastreada | `20260617020950` |
| `movimentacoes_financeiras.estornado_em` | Coluna adicionada depois | `20260720202758` |
| `sanitario.data_fim_carencia` | Coluna adicionada depois | `20260706180142` |
| `profiles.status`, `profiles.fazenda_id` | Colunas adicionadas depois | `20260704173340`, `20260722145101` |
| `invites.fazenda_id`, `invites.expires_at` | Colunas adicionadas depois | `20260722145101` |
| `cenarios.fazenda_id` (bigint) | Coluna adicionada depois (não confundir com `fazenda_id_legado_uuid`, que é baseline-original) | `20260722154003` |
| `profiles_bloquear_autoescalada()`, trigger `trg_profiles_bloquear_autoescalada` | Criados depois | `20260717153400` |
| `set_cenarios_owner()`, `set_pastagens_owner()`, `set_cenario_eventos_owner()` + triggers | Criados depois | `20260707161920` |
| `validar_integridade_conta_fazenda()`, trigger `trg_validar_integridade_conta_fazenda` (em 15 tabelas) | Criados depois | `20260713224735` |
| `app_current_role_can_write()` | Criada depois; as policies de escrita `_owner`/`_own`/`_same_account` da baseline usam a forma **anterior** a este gate (`owner_user_id = auth.uid()` puro), que é exatamente a forma que a migration abaixo espera encontrar (ela roda um `DO` dinâmico sobre `pg_policies` filtrando por esse texto exato de `qual`/`with_check`) | `20260713193754`, `20260713204723` |
| `app_can_access_fazenda()` e todas as policies `_same_account` que dependem dela | Função e policies fazenda-aware criadas depois | `20260722145101`, `20260722151402`, `20260702171318`, `20260722154003` (ver tabela na seção 4) |
| `idx_eventos_operacionais_fazenda_id/lote_id/funcionario_id/origem`, `idx_customer_subscriptions_farm_id/fazenda_id`, `idx_sanitario_rotina_automatica_id`, `idx_movimentacoes_*_origem`, `ALTER FUNCTION set_current_timestamp_updated_at() SET search_path` | Índices/hardening adicionados depois | `20260707161920` |
| `lote_pastagens_historico`, `alertas_tratativas`, `telegram_operacoes_pendentes`, `telegram_bot_auditoria`, `telegram_ia_contexto`, `telegram_conversas`, `telegram_connections`, `telegram_connection_codes`, `telegram_notification_logs` | Tabelas com `CREATE TABLE` próprio em uma migration rastreada — não fazem parte do schema-base | `20260619113446`, `20260707034513`, `20260710215716`, `20260715142221`, `20260710222645`, `20260706120000` |

---

## 4. Ordem de criação

Extensions → enum `app_profile` → funções utilitárias →
`profiles, invites, subscription_plans, fazendas, customer_subscriptions,
billing_events, checkout_sessions, pastagens, funcionarios, lotes, rotinas,
sanitario, animais, pesagens, estoque, movimentacoes_estoque,
movimentacoes_financeiras, movimentacoes_animais, custos, tarefas, usuarios,
configuracoes, cenarios, auditoria, alertas_resolvidos, alertas_adiados,
consumo_suplementacao, cenario_eventos, eventos_operacionais, suplementacao`
(ordem que respeita toda dependência de FK observada no catálogo ao vivo) →
grants → funções de RLS → policies.

**Compatibilidade cronológica das policies `_same_account`** — para cada
tabela, registrado se a policy `_same_account` atual é anterior a
`20260617020950` (incluída na baseline) ou recriada por uma migration
posterior via `DROP POLICY IF EXISTS` + `CREATE POLICY` (idempotente — a
baseline pode omitir com segurança, a migration recria do zero quando
replayada):

| Tabela | `_same_account` recriada por | Incluído na baseline? |
|---|---|---|
| `animais`, `custos`, `estoque`, `sanitario`, `tarefas`, `rotinas`, `funcionarios`, `movimentacoes_financeiras`, `lotes`, `pastagens` | `20260722145101` (loop `fazenda_column_tables`/`faz_column_tables`) | Sim — a versão pré-fazenda continua na baseline; `20260722145101` a substitui ao rodar |
| `movimentacoes_animais`, `movimentacoes_estoque`, `pesagens` | `20260722151402` | Sim, mesma lógica |
| `eventos_operacionais` | `20260702171318` | Não tem versão pré-existente (tabela nunca documentada) — as 4 `_owner` ficam, as 4 `_same_account` nascem só quando `20260702171318` roda |
| `cenarios`, `cenario_eventos` | `20260722154003` | `cenarios`: as 4 `_own` ficam; `cenario_eventos`: as 4 `_own` ficam, as 4 `_same_account` nascem só quando `20260722154003` roda |
| `suplementacao` (só `insert`) | `20260623220539` | As 4 `_owner` + `select/update/delete_same_account` ficam; `insert_same_account` nasce só quando `20260623220539` roda |
| `fazendas` (só `select`/`update`) | `20260722145101` (bloco explícito) | Todas as 4 ficam na baseline (loop genérico); `select`/`update` são substituídas quando `20260722145101` roda |
| `usuarios`, `configuracoes`, `alertas_resolvidos`, `alertas_adiados`, `consumo_suplementacao`, `auditoria` | Nenhuma migration rastreada toca | Sim, definitivas |

---

## 5. Divergências encontradas entre o dump manual e a produção real

Achado não previsto pelo escopo original da sprint, mas relevante: os
arquivos `docs/supabase-production-schema.sql` e `docs/supabase-production-rls.sql`
(mantidos manualmente, usados como plano de disaster-recovery) estão
**significativamente desatualizados** em relação ao estado real de produção.
Exemplos concretos, confirmados via `information_schema.columns`:

- `cenarios.id`, `pastagens.id` e `alertas_adiados.id` são **`uuid`** em
  produção (`gen_random_uuid()`), não `bigint generated by default as identity`
  como o dump afirma. Isso se propaga: `lotes.pastagem_id` e
  `cenario_eventos.cenario_id` são `uuid` (corretamente compatíveis com o
  `id` real das tabelas que referenciam), não `bigint` como uma leitura
  ingênua do dump sugeriria.
- `funcionarios` tem `cpf`, `salario`, `data_admissao` em produção — nenhuma
  das três está no dump.
- `lotes` tem pelo menos 11 colunas em produção ausentes do dump
  (`tem_recria`, `dias_recria`, `p_ini_recria`, `p_fim_recria`,
  `tem_engorda`, `dias_engorda`, `outras_desp_pc_mes`, `motivo_encerramento`,
  `peso_atual`, `peso_medio_atual`, `supl_estoque_kg`).
- `cenarios` tem `premissas_json`, `resultado_projetado`, `created_by`,
  `updated_by`, `fazenda_id_legado_uuid` em produção — nenhuma está no dump.
- `estoque` tem `data_entrada`, `alerta_dias_antes`; `usuarios` tem
  `user_ref` (FK própria para `auth.users`) — ausentes do dump.
- `billing_events`/`checkout_sessions`/`customer_subscriptions` têm um
  segundo conjunto de colunas de integração de pagamento (`provider`,
  `asaas_*`, `payment_url`, `invoice_url`, etc.) parcialmente sobreposto mas
  não idêntico ao que o dump descreve.
- **Toda tabela "owner" tem dois triggers de `updated_at` redundantes** — um
  chamando `set_current_timestamp_updated_at()` (nomeado `set_<tabela>_updated_at`)
  e outro chamando `set_updated_at()` (nomeado `trg_<tabela>_updated_at`).
  Nenhuma das 31 migrations cria nenhum dos dois conjuntos — ambos já
  existiam antes de `20260617020950`. É dívida técnica pré-existente (mesmo
  padrão já documentado em sprints anteriores para os pares de RLS
  `_owner`/`_same_account`), não um bug desta sprint — a baseline reproduz os
  dois pares fielmente, sem tentar "limpar".
- `sanitario` tem **duas** foreign keys redundantes para `rotina_automatica_id`
  (`sanitario_rotina_automatica_id_fkey` e `sanitario_rotina_automatica_fk`,
  mesma definição) — também dívida pré-existente; a baseline cria só uma.

**Implicação prática:** o dump manual não deve mais ser tratado como fonte
confiável de estrutura de tabela sem cross-check contra o catálogo ao vivo —
ele reflete um estado anterior do produto que evoluiu significativamente por
fora do fluxo de migrations. Isso é consistente com a nota de autoridade já
presente no topo de `docs/supabase-production-rls.sql` ("este bundle pode
ficar desatualizado"), mas o tamanho do drift encontrado aqui é maior do que
essa nota sugere. Recomendação para uma sprint futura: regenerar os dois
dumps a partir do catálogo ao vivo, ou aposentá-los em favor de um
`pg_dump --schema-only` real.

---

## 6. Teste em ambiente descartável — **BLOQUEADO, não executado**

Nenhum Postgres/Docker/Supabase CLI local está disponível neste ambiente
(confirmado: `which docker/supabase/psql/postgres/pg_ctl/initdb` não
encontram nada). A alternativa autorizada pelo usuário — criar uma branch de
desenvolvimento paga do Supabase (`create_branch`, ~US$0,01344/hora) — **falhou**:

```
PaymentRequiredException: Branching is supported only on the Pro plan or above
```

O projeto `ljpiszxicmmuefbiixui` não está no plano Pro, então branching não
está disponível independentemente de custo. Nenhuma branch foi criada
(confirmado via `list_branches`: só existe `main`), então nenhum custo foi
incorrido e produção não foi tocada.

Diante disso, e por decisão explícita do usuário (registrada nesta sessão),
esta sprint entrega a candidata **sem** o teste de replay
"baseline → 31 migrations em sequência" ter sido executado de fato. Isso é um
risco real e está listado como tal na seção 9. **Próximo passo obrigatório
antes de qualquer promoção desta candidata**: alguém com acesso a um dos dois
ambientes abaixo precisa rodar o teste descrito no plano original da sprint
(aplicar a baseline num banco vazio, aplicar as 31 migrations em ordem,
registrar a primeira falha, corrigir só a baseline, repetir até as 31
passarem):

- Postgres local ou `supabase start` (Docker) em outra máquina/ambiente; ou
- Fazer upgrade do projeto Supabase para o plano Pro e então usar
  `create_branch`.

## 7. Validação estrutural (comparação com produção) — **não executado**

Depende do passo 6 (precisa de um ambiente reconstruído para comparar contra
produção). Não realizado nesta sprint pelo mesmo motivo.

## 8. Testes do aplicativo

O que **pôde** ser executado sem um banco reconstruído:

| Verificação | Resultado |
|---|---|
| `npm run lint` | Limpo, 0 erros |
| `npm run build` | Sucesso |
| `npm run test:run` | 1859/1859 testes passando, 0 falhas |

O que **não pôde** ser executado (depende do banco reconstruído do passo 6):
testes SQL de RLS (`supabase/tests/app_can_access_fazenda.sql` e afins),
confirmação de que o app inicializa contra a base reconstruída. Nenhuma
credencial de produção foi usada em nenhum momento desta sprint.

---

## 9. Riscos de transformar esta candidata em migration oficial hoje

1. **Não testada de ponta a ponta** (seção 6) — o risco mais alto. É
   inteiramente possível que a baseline tenha um erro de ordem de criação,
   tipo de coluna ou definição de policy que só um replay real revelaria.
2. Duas foreign keys redundantes em `sanitario.rotina_automatica_id`
   existem em produção hoje; a baseline cria só uma — se alguma migration
   rastreada (ou código do app) depender do nome específico da segunda FK,
   isso quebraria no replay. Não encontrado nenhum uso assim via grep, mas
   não foi possível confirmar via teste real.
3. Nomes de sequência: a baseline usa `generated by default as identity`
   (que cria sua própria sequência) em vez de replicar os nomes exatos de
   sequência de produção (ex.: `fazendas_id_seq`). Funcionalmente equivalente
   para reconstrução do zero, mas não é uma cópia 1:1 se algum código externo
   (fora do que os testes cobrem) referenciar o nome da sequência
   diretamente.
4. O dump manual provou ter drift significativo (seção 5) — mesmo tendo
   evitado usá-lo como fonte de tipos, é possível que colunas/índices/
   triggers adicionais existam em produção que nem o dump nem a auditoria
   original mencionavam e que minha varredura do catálogo ao vivo não
   capturou (por exemplo, checks constraints não solicitados nas consultas
   feitas, ou triggers em `after`/`instead of` que as consultas de
   `information_schema.triggers` cobriram mas eu não revisei linha a linha
   contra cada tabela individualmente).
5. `consumo_suplementacao.id` e as 3 tabelas de billing usam colunas de
   identidade sem sequência nomeada visível via `column_default` — inferido
   como `GENERATED ... AS IDENTITY`, mas não confirmado via
   `information_schema.columns.is_identity` (consulta não feita).

## 10. Plano da próxima sprint

1. Resolver o bloqueio do ambiente de teste (upgrade para Pro, ou Postgres
   local em outra máquina) e rodar o loop completo: baseline → 31 migrations
   → primeira falha → corrigir só a baseline → repetir até passar.
2. Comparação estrutural completa (tabelas/colunas/tipos/defaults/PKs/FKs/
   uniques/índices/funções/triggers/policies/RLS/enums/extensions) entre o
   ambiente reconstruído e produção, classificando cada diferença.
3. Rodar `supabase/tests/app_can_access_fazenda.sql` e testes de RLS
   equivalentes contra o ambiente reconstruído.
4. Confirmar `is_identity`/nome de sequência real de
   `consumo_suplementacao.id`, `billing_events.id`, `checkout_sessions.id`,
   `customer_subscriptions.id` via `information_schema.columns` para fechar
   o risco 5.
5. Decidir, com base no resultado de 1–4, se a candidata deve virar migration
   oficial (e como: uma única migration `0000...` ou dividida) ou se precisa
   de mais uma rodada de ajustes.
6. Considerar regenerar `docs/supabase-production-schema.sql` e
   `docs/supabase-production-rls.sql` a partir do catálogo ao vivo, dado o
   drift documentado na seção 5.

---

## 11. Resumo para fechamento

- **Branch:** `feat/sprint4-baseline-candidate`
- **Hash do commit:** (preenchido após o commit, ver mensagem de fechamento)
- **Ambiente descartável utilizado:** nenhum — bloqueado (branch paga
  indisponível no plano atual do projeto; sem Docker/Postgres local)
- **Tabelas criadas pela baseline:** 30
- **Resultado das 31 migrations sobre a baseline:** não executado
- **Diferenças estruturais restantes vs. produção:** não avaliado (depende
  do item acima)
- **Lint:** limpo · **Testes:** 1859/1859 passando · **Build:** sucesso
- **Produção:** confirmado inalterada (só `SELECT`s read-only foram
  executados; `list_branches` mostra apenas `main`; nenhum `apply_migration`/
  `db push`/`migration repair` foi chamado)
- **Deploy automático:** não disparado (nenhum arquivo foi colocado em
  `supabase/migrations/`; a candidata vive inteiramente em
  `supabase/baseline-candidate/`, fora do gatilho da integração Supabase↔GitHub)
