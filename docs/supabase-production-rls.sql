-- HERDON production RLS bundle
-- Run after docs/supabase-production-schema.sql

create or replace function public.app_current_owner_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_owner uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  select p.owner_user_id
    into current_owner
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  return coalesce(current_owner, auth.uid());
end;
$$;

create or replace function public.app_current_profile_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_role text;
begin
  if auth.uid() is null then
    return null;
  end if;

  select p.perfil::text
    into current_role
  from public.profiles p
  where p.id = auth.uid()
  limit 1;

  return current_role;
end;
$$;

create or replace function public.app_is_same_account(target_owner_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and target_owner_user_id is not null
    and public.app_current_owner_user_id() = target_owner_user_id
$$;

create or replace function public.app_can_manage_account(target_owner_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.app_is_same_account(target_owner_user_id)
    and coalesce(public.app_current_profile_role(), '') in ('proprietario', 'gerente')
$$;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

drop policy if exists profiles_select_same_account on public.profiles;
create policy profiles_select_same_account
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or public.app_is_same_account(owner_user_id)
);

drop policy if exists profiles_insert_self_or_manager on public.profiles;
create policy profiles_insert_self_or_manager
on public.profiles
for insert
to authenticated
with check (
  (
    auth.uid() = id
    and coalesce(owner_user_id, auth.uid()) = public.app_current_owner_user_id()
  )
  or public.app_can_manage_account(owner_user_id)
);

drop policy if exists profiles_update_self_or_manager on public.profiles;
create policy profiles_update_self_or_manager
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
  or public.app_can_manage_account(owner_user_id)
)
with check (
  (
    auth.uid() = id
    and public.app_is_same_account(owner_user_id)
  )
  or public.app_can_manage_account(owner_user_id)
);

alter table public.invites enable row level security;
alter table public.invites force row level security;

drop policy if exists invites_select_same_account_managers on public.invites;
create policy invites_select_same_account_managers
on public.invites
for select
to authenticated
using (public.app_can_manage_account(owner_user_id));

drop policy if exists invites_insert_same_account_managers on public.invites;
create policy invites_insert_same_account_managers
on public.invites
for insert
to authenticated
with check (public.app_can_manage_account(owner_user_id));

drop policy if exists invites_update_same_account_managers on public.invites;
create policy invites_update_same_account_managers
on public.invites
for update
to authenticated
using (public.app_can_manage_account(owner_user_id))
with check (public.app_can_manage_account(owner_user_id));

drop policy if exists invites_delete_same_account_managers on public.invites;
create policy invites_delete_same_account_managers
on public.invites
for delete
to authenticated
using (public.app_can_manage_account(owner_user_id));

do $$
declare
  table_name text;
  owner_tables text[] := array[
    'fazendas',
    'pastagens',
    'lotes',
    'animais',
    'pesagens',
    'sanitario',
    'estoque',
    'movimentacoes_estoque',
    'movimentacoes_financeiras',
    'movimentacoes_animais',
    'custos',
    'funcionarios',
    'rotinas',
    'tarefas',
    'usuarios',
    'configuracoes',
    'cenarios',
    'auditoria',
    'alertas_resolvidos',
    'alertas_adiados',
    'consumo_suplementacao'
  ];
begin
  foreach table_name in array owner_tables loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_select_same_account', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.app_is_same_account(owner_user_id))',
      table_name || '_select_same_account',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_insert_same_account', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.app_is_same_account(owner_user_id))',
      table_name || '_insert_same_account',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_update_same_account', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.app_is_same_account(owner_user_id)) with check (public.app_is_same_account(owner_user_id))',
      table_name || '_update_same_account',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_delete_same_account', table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.app_is_same_account(owner_user_id))',
      table_name || '_delete_same_account',
      table_name
    );
  end loop;
end $$;
