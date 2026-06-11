# HERDON Supabase Production Setup

This bundle provisions the Supabase tables and row-level security required by the current HERDON production runtime after Sprint 20A demo-data removal.

## Files

- `docs/supabase-production-schema.sql`
- `docs/supabase-production-rls.sql`

## What this bundle covers

Runtime tables provisioned:

- `profiles`
- `invites`
- `subscription_plans`
- `customer_subscriptions`
- `billing_events`
- `checkout_sessions`
- `fazendas`
- `pastagens`
- `lotes`
- `animais`
- `pesagens`
- `sanitario`
- `estoque`
- `movimentacoes_estoque`
- `movimentacoes_financeiras`
- `movimentacoes_animais`
- `custos`
- `funcionarios`
- `rotinas`
- `tarefas`
- `usuarios`
- `configuracoes`
- `cenarios`
- `auditoria`
- `alertas_resolvidos`
- `alertas_adiados`
- `consumo_suplementacao`

Idempotency note:

- `billing_events.provider_event_id` is indexed uniquely so repeated webhook deliveries stay safe.

Local-only or not provisioned by this bundle:

- `suplementacao`
- `dietas`
- any demo/mock/sample dataset

Those structures are still UI-local today and are not created here on purpose, because the current production runtime does not use a dedicated Supabase persistence helper for them.

## Internal subscription structure

This bundle also prepares the internal SaaS subscription model, even before payment checkout exists.

Subscription statuses supported by the app:

- `trialing`
- `active`
- `past_due`
- `canceled`
- `blocked`
- `internal_test`

Planned internal plans:

- `FUNDADOR` - R$ 297/mês, acesso completo durante o lançamento
- `ESSENCIAL` - R$ 197/mês, até 1 fazenda, 300 animais e 2 usuários
- `PRO` - R$ 397/mês, até 3 fazendas, 1000 animais e 5 usuários
- `PREMIUM` - R$ 697/mês, até 10 fazendas, 3000 animais e 10 usuários
- `ENTERPRISE` - sob consulta, com limites personalizados

Behavior notes:

- assinaturas `active`, `trialing` e `internal_test` podem usar o app normalmente
- assinaturas `past_due` entram no app, mas mostram aviso
- assinaturas `canceled` e `blocked` levam a uma tela de bloqueio
- `internal_test` fica disponível para validação interna sem expor detalhes ao usuário normal
- os limites do plano vivem em `plan_entitlements` como JSON para facilitar a evolução futura

## Fresh project setup

1. Create a new Supabase project.
2. In Supabase, open `SQL Editor`.
3. Run `docs/supabase-production-schema.sql`.
4. Run `docs/supabase-production-rls.sql`.
5. In `Authentication > Sign In / Providers`, enable the provider(s) you will use in production, typically Email.
6. In `Project Settings > API`, copy:
   - `Project URL`
   - `anon public` key
7. Set the app environment variables:

```env
VITE_SUPABASE_URL=YOUR_PROJECT_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

## First production test user

Recommended flow:

1. Create the first user from the normal HERDON login/register flow.
2. Complete signup with a brand-new email that does not exist in the project.
3. The schema trigger will create a `profiles` row automatically.
4. If there is no matching invite, that first user becomes:
   - `owner_user_id = auth.uid()`
   - `perfil = proprietario`

Optional verification query:

```sql
select id, owner_user_id, email, perfil, created_at
from public.profiles
order by created_at desc;
```

## Team access model

The production bundle uses account ownership for isolation:

- each account has an `owner_user_id`
- operational tables are scoped by `owner_user_id`
- invited users inherit the account owner from `invites.owner_user_id`
- `profiles` and `invites` use RLS helpers so access management does not leak data across customers

Current role behavior in the database:

- `proprietario` and `gerente` can manage `invites`
- same-account authenticated users can read their own account data
- operational writes are owner-scoped by account, matching the current app runtime

## Persistence validation checklist

After configuring env vars and logging into HERDON with the first user:

1. Create one `Fazenda`.
2. Refresh the page.
3. Confirm the `Fazenda` remains visible.
4. Create one `Lote` linked to that `Fazenda`.
5. Refresh the page.
6. Confirm the `Lote` remains visible.
7. Create one `Animal`.
8. Refresh the page.
9. Confirm the `Animal` remains visible.
10. Save `Configurações`.
11. Refresh the page.
12. Confirm the settings remain applied.

Useful verification queries:

```sql
select id, owner_user_id, nome, created_at
from public.fazendas
order by created_at desc;
```

```sql
select id, owner_user_id, nome, faz_id, created_at
from public.lotes
order by created_at desc;
```

```sql
select id, owner_user_id, identificacao, lote_id, created_at
from public.animais
order by created_at desc;
```

```sql
select id, owner_user_id, geral, notificacoes, updated_at
from public.configuracoes
order by updated_at desc;
```

## User isolation test

Use two separate users in two separate browser sessions.

1. Sign in as User A.
2. Create:
   - one `Fazenda`
   - one `Lote`
   - one `Animal`
3. Sign out.
4. Sign in as User B with a different email and no invite from User A.
5. Confirm User B does not see User A data.
6. Sign back in as User A.
7. Confirm User A still sees only User A data.

Optional SQL check:

```sql
select owner_user_id, count(*) as fazendas
from public.fazendas
group by owner_user_id
order by fazendas desc;
```

If you want User B to join User A's account:

1. Sign in as User A.
2. Create an invite in `Configurações`.
3. Register User B with that invited email.
4. Confirm User B can see only User A account data, not other customers.

## Troubleshooting

### Missing table or relation errors

Symptoms:

- Supabase returns `42P01`
- PostgREST returns `PGRST205`
- HERDON falls back with messages about missing schema or incompatible structure

Fix:

1. Re-run `docs/supabase-production-schema.sql`.
2. Confirm the table exists:

```sql
select tablename
from pg_tables
where schemaname = 'public'
order by tablename;
```

### Missing column or schema cache errors

Symptoms:

- PostgREST returns `PGRST204`
- PostgreSQL returns `42703`
- the app saves locally instead of persisting to cloud

Fix:

1. Re-run both SQL files in order.
2. Confirm the target columns exist:

```sql
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

### RLS or permission denied errors

Symptoms:

- PostgreSQL returns `42501`
- the app reports insufficient permission

Fix:

1. Re-run `docs/supabase-production-rls.sql`.
2. Confirm RLS is enabled:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

3. Confirm the user has a `profiles` row with the expected `owner_user_id` and `perfil`.

### New signup created no profile

Symptoms:

- user can authenticate
- access-dependent screens fail or show missing role/profile behavior

Fix:

1. Confirm trigger exists:

```sql
select trigger_name, event_object_table
from information_schema.triggers
where event_object_schema = 'auth'
   or trigger_schema = 'public'
order by event_object_table, trigger_name;
```

2. Re-run `docs/supabase-production-schema.sql`.
3. Backfill missing profiles:

```sql
insert into public.profiles (id, owner_user_id, email, nome, perfil)
select
  users.id,
  users.id,
  users.email,
  coalesce(users.raw_user_meta_data ->> 'nome', users.raw_user_meta_data ->> 'name', split_part(users.email, '@', 1)),
  'proprietario'::public.app_profile
from auth.users users
left join public.profiles profiles on profiles.id = users.id
where profiles.id is null;
```

## Notes for production rollout

- This bundle is intentionally seed-free. No demo rows, sample farms, or mock operational records are created.
- The app can still keep local fallback behavior for resilience, but a paid production tenant should not rely on it after this bundle is applied correctly.
- If you later add real cloud persistence for `suplementacao` or `dietas`, create a dedicated migration instead of overloading the current tables.
