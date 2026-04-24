create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.fazendas (
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  nome text,
  status text default 'ativa',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (owner_user_id, id)
);

create table if not exists public.lotes (
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  faz_id bigint,
  nome text,
  status text default 'ativo',
  entrada date,
  saida date,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (owner_user_id, id),
  constraint lotes_fazenda_fk
    foreign key (owner_user_id, faz_id)
    references public.fazendas (owner_user_id, id)
    on delete set null
);

create table if not exists public.animais (
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  lote_id bigint,
  sexo text,
  gen text,
  qtd numeric,
  p_ini numeric,
  p_at numeric,
  dias numeric,
  consumo numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (owner_user_id, id),
  constraint animais_lote_fk
    foreign key (owner_user_id, lote_id)
    references public.lotes (owner_user_id, id)
    on delete set null
);

create table if not exists public.pesagens (
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  lote_id bigint,
  data_registro date,
  peso_medio numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (owner_user_id, id),
  constraint pesagens_lote_fk
    foreign key (owner_user_id, lote_id)
    references public.lotes (owner_user_id, id)
    on delete set null
);

create table if not exists public.tarefas (
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  titulo text,
  status text,
  prioridade text,
  categoria text,
  responsavel_id bigint,
  lote_id bigint,
  fazenda_id bigint,
  data_vencimento date,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (owner_user_id, id),
  constraint tarefas_lote_fk
    foreign key (owner_user_id, lote_id)
    references public.lotes (owner_user_id, id)
    on delete set null,
  constraint tarefas_fazenda_fk
    foreign key (owner_user_id, fazenda_id)
    references public.fazendas (owner_user_id, id)
    on delete set null
);

create table if not exists public.rotinas (
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  funcionario_id bigint,
  lote_id bigint,
  data_registro date,
  tarefa text,
  setor text,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (owner_user_id, id),
  constraint rotinas_lote_fk
    foreign key (owner_user_id, lote_id)
    references public.lotes (owner_user_id, id)
    on delete set null
);

create table if not exists public.sanitario (
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  lote_id bigint,
  tipo text,
  data_registro date,
  proxima date,
  status text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (owner_user_id, id),
  constraint sanitario_lote_fk
    foreign key (owner_user_id, lote_id)
    references public.lotes (owner_user_id, id)
    on delete set null
);

create table if not exists public.estoque (
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  lote_id bigint,
  nome text,
  categoria text,
  unidade text,
  quantidade_atual numeric,
  quantidade_minima numeric,
  preco_unitario numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (owner_user_id, id),
  constraint estoque_lote_fk
    foreign key (owner_user_id, lote_id)
    references public.lotes (owner_user_id, id)
    on delete set null
);

create table if not exists public.movimentacoes_animais (
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  lote_id bigint,
  tipo text,
  data_registro date,
  qtd numeric,
  peso_medio numeric,
  valor_total numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (owner_user_id, id),
  constraint mov_animais_lote_fk
    foreign key (owner_user_id, lote_id)
    references public.lotes (owner_user_id, id)
    on delete set null
);

create table if not exists public.movimentacoes_estoque (
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  item_estoque_id bigint,
  lote_id bigint,
  tipo text,
  data_registro date,
  quantidade numeric,
  custo_total numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (owner_user_id, id),
  constraint mov_estoque_item_fk
    foreign key (owner_user_id, item_estoque_id)
    references public.estoque (owner_user_id, id)
    on delete set null,
  constraint mov_estoque_lote_fk
    foreign key (owner_user_id, lote_id)
    references public.lotes (owner_user_id, id)
    on delete set null
);

create table if not exists public.movimentacoes_financeiras (
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  lote_id bigint,
  tipo text,
  categoria text,
  data_registro date,
  valor numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (owner_user_id, id),
  constraint mov_financeiras_lote_fk
    foreign key (owner_user_id, lote_id)
    references public.lotes (owner_user_id, id)
    on delete set null
);

create table if not exists public.custos (
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  id bigint not null,
  lote_id bigint,
  categoria text,
  descricao text,
  data_registro date,
  valor numeric,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (owner_user_id, id),
  constraint custos_lote_fk
    foreign key (owner_user_id, lote_id)
    references public.lotes (owner_user_id, id)
    on delete set null
);

create index if not exists fazendas_owner_idx on public.fazendas (owner_user_id);
create index if not exists lotes_owner_idx on public.lotes (owner_user_id, faz_id);
create index if not exists animais_owner_idx on public.animais (owner_user_id, lote_id);
create index if not exists pesagens_owner_idx on public.pesagens (owner_user_id, lote_id, data_registro desc);
create index if not exists tarefas_owner_idx on public.tarefas (owner_user_id, fazenda_id, lote_id, data_vencimento);
create index if not exists rotinas_owner_idx on public.rotinas (owner_user_id, lote_id, data_registro);
create index if not exists sanitario_owner_idx on public.sanitario (owner_user_id, lote_id, proxima);
create index if not exists estoque_owner_idx on public.estoque (owner_user_id, lote_id, categoria);
create index if not exists mov_animais_owner_idx on public.movimentacoes_animais (owner_user_id, lote_id, data_registro);
create index if not exists mov_estoque_owner_idx on public.movimentacoes_estoque (owner_user_id, item_estoque_id, data_registro);
create index if not exists mov_fin_owner_idx on public.movimentacoes_financeiras (owner_user_id, lote_id, data_registro);
create index if not exists custos_owner_idx on public.custos (owner_user_id, lote_id, data_registro);

drop trigger if exists touch_fazendas_updated_at on public.fazendas;
create trigger touch_fazendas_updated_at before update on public.fazendas for each row execute function public.touch_updated_at();
drop trigger if exists touch_lotes_updated_at on public.lotes;
create trigger touch_lotes_updated_at before update on public.lotes for each row execute function public.touch_updated_at();
drop trigger if exists touch_animais_updated_at on public.animais;
create trigger touch_animais_updated_at before update on public.animais for each row execute function public.touch_updated_at();
drop trigger if exists touch_pesagens_updated_at on public.pesagens;
create trigger touch_pesagens_updated_at before update on public.pesagens for each row execute function public.touch_updated_at();
drop trigger if exists touch_tarefas_updated_at on public.tarefas;
create trigger touch_tarefas_updated_at before update on public.tarefas for each row execute function public.touch_updated_at();
drop trigger if exists touch_rotinas_updated_at on public.rotinas;
create trigger touch_rotinas_updated_at before update on public.rotinas for each row execute function public.touch_updated_at();
drop trigger if exists touch_sanitario_updated_at on public.sanitario;
create trigger touch_sanitario_updated_at before update on public.sanitario for each row execute function public.touch_updated_at();
drop trigger if exists touch_estoque_updated_at on public.estoque;
create trigger touch_estoque_updated_at before update on public.estoque for each row execute function public.touch_updated_at();
drop trigger if exists touch_mov_animais_updated_at on public.movimentacoes_animais;
create trigger touch_mov_animais_updated_at before update on public.movimentacoes_animais for each row execute function public.touch_updated_at();
drop trigger if exists touch_mov_estoque_updated_at on public.movimentacoes_estoque;
create trigger touch_mov_estoque_updated_at before update on public.movimentacoes_estoque for each row execute function public.touch_updated_at();
drop trigger if exists touch_mov_financeiras_updated_at on public.movimentacoes_financeiras;
create trigger touch_mov_financeiras_updated_at before update on public.movimentacoes_financeiras for each row execute function public.touch_updated_at();
drop trigger if exists touch_custos_updated_at on public.custos;
create trigger touch_custos_updated_at before update on public.custos for each row execute function public.touch_updated_at();

alter table public.fazendas enable row level security;
alter table public.lotes enable row level security;
alter table public.animais enable row level security;
alter table public.pesagens enable row level security;
alter table public.tarefas enable row level security;
alter table public.rotinas enable row level security;
alter table public.sanitario enable row level security;
alter table public.estoque enable row level security;
alter table public.movimentacoes_animais enable row level security;
alter table public.movimentacoes_estoque enable row level security;
alter table public.movimentacoes_financeiras enable row level security;
alter table public.custos enable row level security;

drop policy if exists "owner_full_access_fazendas" on public.fazendas;
create policy "owner_full_access_fazendas" on public.fazendas for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
drop policy if exists "owner_full_access_lotes" on public.lotes;
create policy "owner_full_access_lotes" on public.lotes for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
drop policy if exists "owner_full_access_animais" on public.animais;
create policy "owner_full_access_animais" on public.animais for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
drop policy if exists "owner_full_access_pesagens" on public.pesagens;
create policy "owner_full_access_pesagens" on public.pesagens for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
drop policy if exists "owner_full_access_tarefas" on public.tarefas;
create policy "owner_full_access_tarefas" on public.tarefas for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
drop policy if exists "owner_full_access_rotinas" on public.rotinas;
create policy "owner_full_access_rotinas" on public.rotinas for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
drop policy if exists "owner_full_access_sanitario" on public.sanitario;
create policy "owner_full_access_sanitario" on public.sanitario for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
drop policy if exists "owner_full_access_estoque" on public.estoque;
create policy "owner_full_access_estoque" on public.estoque for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
drop policy if exists "owner_full_access_mov_animais" on public.movimentacoes_animais;
create policy "owner_full_access_mov_animais" on public.movimentacoes_animais for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
drop policy if exists "owner_full_access_mov_estoque" on public.movimentacoes_estoque;
create policy "owner_full_access_mov_estoque" on public.movimentacoes_estoque for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
drop policy if exists "owner_full_access_mov_financeiras" on public.movimentacoes_financeiras;
create policy "owner_full_access_mov_financeiras" on public.movimentacoes_financeiras for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
drop policy if exists "owner_full_access_custos" on public.custos;
create policy "owner_full_access_custos" on public.custos for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
