# Auditoria de RLS e Isolamento entre Contas (Sprint 30, validada ao vivo na Sprint 30.1)

## Método

**Sprint 30:** sem acesso às ferramentas de Supabase (MCP desconectado) e sem credenciais de conta autenticada, a auditoria original foi feita só por leitura de `docs/supabase-production-schema.sql`/`docs/supabase-production-rls.sql` — sem confirmar o estado real do banco.

**Sprint 30.1 (esta revisão):** com o MCP do Supabase reconectado, toda a auditoria abaixo foi **revalidada consultando o banco de produção real** (`pg_policies`, `pg_class.relrowsecurity`/`relforcerowsecurity`, `supabase_migrations.schema_migrations`, `get_advisors`). Duas conclusões da Sprint 30 estavam **erradas** porque foram baseadas só nos arquivos `.sql` versionados, que não refletiam o banco real — corrigidas abaixo.

## Função de isolamento

```sql
app_current_owner_user_id() -- resolve o owner_user_id da conta do usuário logado (via profiles; fallback auth.uid())
app_is_same_account(target_owner_user_id) -- true se o usuário logado pertence à mesma conta da linha
app_can_manage_account(target_owner_user_id) -- app_is_same_account() + perfil in ('proprietario','gerente')
```

Confirmado ao vivo: todas com `security definer` e `search_path` fixo. Isolamento por **conta** (`owner_user_id`), não por usuário individual.

## Tabelas e RLS — situação confirmada no banco real

**30 tabelas em `public`, todas com `rowsecurity = true` (RLS habilitado).** Lista completa consultada via `pg_class`: `alertas_adiados`, `alertas_resolvidos`, `animais`, `auditoria`, `billing_events`, `cenario_eventos`, `cenarios`, `checkout_sessions`, `configuracoes`, `consumo_suplementacao`, `customer_subscriptions`, `custos`, `estoque`, `eventos_operacionais`, `fazendas`, `funcionarios`, `invites`, `lote_pastagens_historico`, `lotes`, `movimentacoes_animais`, `movimentacoes_estoque`, `movimentacoes_financeiras`, `pastagens`, `pesagens`, `profiles`, `rotinas`, `sanitario`, `subscription_plans`, `suplementacao`, `tarefas`, `usuarios`.

**Duas tabelas existem no banco real e não estavam em `docs/supabase-production-schema.sql`/`docs/supabase-production-rls.sql`:** `cenario_eventos` e `eventos_operacionais`. Foram criadas diretamente no banco (SQL editor ou MCP), fora do bundle versionado — por isso a Sprint 30 não as encontrou e concluiu (errado) que "cenario_eventos não existe". O mesmo vale para `suplementacao`, que **não é** o mesmo que `consumo_suplementacao` (são duas tabelas diferentes, ambas reais) — a Sprint 30 também errou ao assumir que eram a mesma coisa.

### Padrão real de policies (confirmado, a maioria das tabelas operacionais)

Cada tabela operacional tem **8 policies** (não 4 como o script genérico sugeria): `_own` (filtro direto `owner_user_id = auth.uid()`) e `_same_account` (filtro `app_is_same_account(owner_user_id)`) para cada um dos 4 comandos (select/insert/update/delete) — uma combinação mais explícita do que o bundle versionado documentava, mas equivalente em efeito (`_own` é um caso particular de `_same_account`).

## Achado real #1 (corrigido nesta sprint): INSERT sem restrição em `cenario_eventos` e `suplementacao`

**Confirmado ao vivo, não suposição:** as policies `cenario_eventos_insert_same_account` e `suplementacao_insert_same_account` tinham `with_check: true` — sem filtro nenhum. Como policies permissivas do mesmo comando são combinadas com `OR`, isso anulava a policy `_insert_own` correta que existia ao lado. **Qualquer usuário autenticado podia inserir uma linha em `cenario_eventos` ou `suplementacao` com o `owner_user_id` de qualquer outra conta** — uma falha real de isolamento entre contas, ativa em produção até esta correção.

**Correção aplicada (Sprint 30.1, migration `20260623220539_fix_insecure_insert_policies`, aplicada via MCP `apply_migration` direto no banco real):**
```sql
drop policy if exists cenario_eventos_insert_same_account on public.cenario_eventos;
create policy cenario_eventos_insert_same_account on public.cenario_eventos
  for insert to authenticated
  with check (public.app_is_same_account(owner_user_id));

drop policy if exists suplementacao_insert_same_account on public.suplementacao;
create policy suplementacao_insert_same_account on public.suplementacao
  for insert to authenticated
  with check (public.app_is_same_account(owner_user_id));
```

**Confirmado depois da correção** (consulta direta a `pg_policies`): as duas policies agora exigem `app_is_same_account(owner_user_id)`. Nenhum dado existente foi alterado ou apagado — a correção só muda a regra para inserções futuras.

## Achado real #2 (corrigido nesta sprint): `forcerowsecurity = false` em 4 tabelas

Confirmado ao vivo: `cenario_eventos`, `eventos_operacionais`, `lote_pastagens_historico` e `suplementacao` tinham `forcerowsecurity = false`, diferente das outras 26 tabelas (`true`). Isso não afeta as conexões normais do app (que sempre usam o papel `authenticated`, que já respeita RLS independente do `force`); o `force` só importa para o papel *owner* da tabela, que o app nunca usa diretamente. Risco baixo, mas corrigido para consistência — `alter table ... force row level security` aplicado às 4 tabelas na mesma migration acima. Confirmado depois: as 4 tabelas agora têm `forcerowsecurity = true`, igual às demais.

## `auditoria` — confirmado imutável no banco real

A Sprint 30 tinha corrigido só o **script-fonte** (`docs/supabase-production-rls.sql`), sem poder confirmar o banco vivo. Agora confirmado diretamente: `auditoria` só tem policies `auditoria_select_owner`, `auditoria_select_same_account`, `auditoria_insert_owner`, `auditoria_insert_same_account` — **nenhuma policy de UPDATE ou DELETE existe hoje**. A preocupação da Sprint 30 (que o script poderia recriar essas policies se re-executado) continua válida como prevenção, mas **não havia problema ativo no banco** — confirmado antes e depois da migration desta sprint (a migration não toca em `auditoria`).

## Outras observações (sem ação nesta sprint — fora do escopo aprovado)

- **RLS garante isolamento de conta, não de papel/perfil** — mesma observação da Sprint 30, ainda válida e não corrigida (ver pendências).
- **`get_advisors(type: 'security')` retornou avisos pré-existentes, não relacionados a esta correção:** funções de trigger (`set_updated_at`, `set_cenarios_owner`, `set_cenario_eventos_owner`, `set_current_timestamp_updated_at`, `set_pastagens_owner`) sem `search_path` fixo; extensão `citext` instalada no schema `public`; várias funções `security definer` (`app_is_same_account`, `app_can_manage_account`, `handle_new_user`, etc.) expostas como RPC pública para `anon`/`authenticated`; proteção contra senha vazada (HaveIBeenPwned) desativada no Auth. Nenhum desses é crítico e nenhum foi introduzido por esta sprint — documentados como pendência para avaliação dedicada (alguns, como revogar EXECUTE de funções RPC, exigem teste cuidadoso para não quebrar o uso interno dessas funções dentro das próprias policies RLS).

## Conclusão

Isolamento entre contas confirmado correto em 30 tabelas reais (não 28 — a Sprint 30 não via 2 delas), com **duas falhas reais corrigidas** nesta sprint (INSERT sem restrição em 2 tabelas, `forcerowsecurity` inconsistente em 4) e a imutabilidade de `auditoria` confirmada diretamente no banco, não só no script-fonte. Pendências de defesa em profundidade (RLS por papel/perfil) e os avisos do `get_advisors` ficam para a Sprint 31.
