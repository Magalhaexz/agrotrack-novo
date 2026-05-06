# SUPABASE_SCHEMA_ALERTAS_FAZENDAS_FIX_HERDON

Este documento é apenas guia SQL.
Nenhum comando abaixo foi aplicado automaticamente pelo app.

## 1) Inspecionar schema atual
```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('fazendas', 'alertas_resolvidos', 'alertas_adiados')
order by table_name, ordinal_position;
```

## 2) Verificar existência de tabelas
```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('fazendas', 'alertas_resolvidos', 'alertas_adiados')
order by table_name;
```

## 3) Criar `alertas_adiados` se estiver ausente
```sql
create table if not exists public.alertas_adiados (
  id bigserial primary key,
  chave text not null,
  origem text,
  ate date,
  snooze_until date,
  observacao text,
  metadata jsonb,
  owner_user_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## 4) Garantir colunas compatíveis em `alertas_resolvidos`
```sql
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='alertas_resolvidos' and column_name='chave'
  ) then
    alter table public.alertas_resolvidos add column chave text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='alertas_resolvidos' and column_name='origem'
  ) then
    alter table public.alertas_resolvidos add column origem text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='alertas_resolvidos' and column_name='resolved_at'
  ) then
    alter table public.alertas_resolvidos add column resolved_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='alertas_resolvidos' and column_name='observacao'
  ) then
    alter table public.alertas_resolvidos add column observacao text;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='alertas_resolvidos' and column_name='metadata'
  ) then
    alter table public.alertas_resolvidos add column metadata jsonb;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='alertas_resolvidos' and column_name='owner_user_id'
  ) then
    alter table public.alertas_resolvidos add column owner_user_id uuid;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='alertas_resolvidos' and column_name='created_at'
  ) then
    alter table public.alertas_resolvidos add column created_at timestamptz default now();
  end if;
end $$;
```

## 5) Índices recomendados (opcional)
```sql
create index if not exists idx_alertas_resolvidos_chave on public.alertas_resolvidos (chave);
create index if not exists idx_alertas_adiados_chave on public.alertas_adiados (chave);
create index if not exists idx_alertas_adiados_ate on public.alertas_adiados (ate);
create index if not exists idx_fazendas_owner_user_id on public.fazendas (owner_user_id);
```

## 6) RLS opcional usando owner (somente se `owner_user_id` existir)
```sql
alter table public.alertas_resolvidos enable row level security;
alter table public.alertas_adiados enable row level security;
alter table public.fazendas enable row level security;

create policy if not exists alertas_resolvidos_owner_select
on public.alertas_resolvidos
for select
using (owner_user_id = auth.uid());

create policy if not exists alertas_resolvidos_owner_insert
on public.alertas_resolvidos
for insert
with check (owner_user_id = auth.uid());

create policy if not exists alertas_adiados_owner_select
on public.alertas_adiados
for select
using (owner_user_id = auth.uid());

create policy if not exists alertas_adiados_owner_insert
on public.alertas_adiados
for insert
with check (owner_user_id = auth.uid());

create policy if not exists fazendas_owner_select
on public.fazendas
for select
using (owner_user_id = auth.uid());

create policy if not exists fazendas_owner_write
on public.fazendas
for all
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());
```

## 7) Observações de compatibilidade
- O frontend foi ajustado para tentar operar tanto com quanto sem `owner_user_id` nas tabelas de alertas.
- Se `owner_user_id` não existir em `fazendas`, o app faz fallback de leitura/escrita sem esse filtro.
- Se houver 400 por coluna ausente, a classificação no app é `schema_error`.
