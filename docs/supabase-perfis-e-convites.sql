create extension if not exists citext;
create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'app_profile'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.app_profile as enum ('admin', 'gerente', 'operador', 'visualizador');
  end if;
end $$;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null unique,
  nome text,
  perfil public.app_profile not null default 'visualizador',
  telefone text,
  cargo text,
  foto_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  nome text,
  perfil public.app_profile not null,
  status text not null default 'pendente' check (status in ('pendente', 'utilizado', 'cancelado')),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_current_timestamp_updated_at();

drop trigger if exists set_invites_updated_at on public.invites;
create trigger set_invites_updated_at
before update on public.invites
for each row
execute function public.set_current_timestamp_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invited_record public.invites%rowtype;
  assigned_profile public.app_profile := 'visualizador';
  resolved_name text;
begin
  resolved_name := coalesce(
    new.raw_user_meta_data ->> 'nome',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );

  select *
    into invited_record
  from public.invites
  where lower(email::text) = lower(new.email)
    and status = 'pendente'
  order by created_at desc
  limit 1;

  if invited_record.id is not null then
    assigned_profile := invited_record.perfil;
  end if;

  insert into public.profiles (id, email, nome, perfil)
  values (new.id, new.email, resolved_name, assigned_profile)
  on conflict (id) do update
    set
      email = excluded.email,
      nome = coalesce(excluded.nome, public.profiles.nome),
      perfil = excluded.perfil,
      updated_at = timezone('utc', now());

  if invited_record.id is not null then
    update public.invites
      set
        status = 'utilizado',
        used_by = new.id,
        used_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
      where id = invited_record.id;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

insert into public.profiles (id, email, nome, perfil)
select
  users.id,
  users.email,
  coalesce(
    users.raw_user_meta_data ->> 'nome',
    users.raw_user_meta_data ->> 'name',
    split_part(users.email, '@', 1)
  ) as nome,
  coalesce(
    (
      select invites.perfil
      from public.invites invites
      where lower(invites.email::text) = lower(users.email)
        and invites.status = 'pendente'
      order by invites.created_at desc
      limit 1
    ),
    'visualizador'::public.app_profile
  ) as perfil
from auth.users users
left join public.profiles profiles on profiles.id = users.id
where profiles.id is null;

alter table public.profiles enable row level security;
alter table public.invites enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (
  auth.uid() = id
  or exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.perfil = 'admin'
  )
);

drop policy if exists "profiles_insert_own_or_admin" on public.profiles;
create policy "profiles_insert_own_or_admin"
on public.profiles
for insert
to authenticated
with check (
  auth.uid() = id
  or exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.perfil = 'admin'
  )
);

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles
for update
to authenticated
using (
  auth.uid() = id
  or exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.perfil = 'admin'
  )
)
with check (
  auth.uid() = id
  or exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.perfil = 'admin'
  )
);

drop policy if exists "invites_admin_only" on public.invites;
create policy "invites_admin_only"
on public.invites
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.perfil = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.perfil = 'admin'
  )
);
