-- Bug bash — integridade entre conta/fazenda/lote (P0, achado residual da
-- sprint anterior): o RLS (via app_is_same_account/app_current_role_can_write)
-- so valida o owner_user_id da PROPRIA linha, nunca se fazenda_id/lote_id/
-- item_estoque_id/animal_id referenciados realmente pertencem a mesma conta.
-- Qualquer usuario autenticado (mesmo de conta nao relacionada) conseguia
-- inserir owner_user_id = seu proprio auth.uid() com uma FK apontando para
-- fazenda/lote de OUTRA conta (fica invisivel ao dono real via SELECT, mas
-- e sujeira/possivel abuso). validar_integridade_conta_fazenda() fecha isso:
-- sempre que a linha tiver uma dessas colunas preenchida, o dono do registro
-- referenciado precisa ser o mesmo owner_user_id da linha.
create or replace function public.validar_integridade_conta_fazenda()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  row_data jsonb := to_jsonb(NEW);
  owner uuid;
  ref_id bigint;
  ref_owner uuid;
begin
  if not (row_data ? 'owner_user_id') then
    return NEW;
  end if;
  owner := (row_data->>'owner_user_id')::uuid;
  if owner is null then
    return NEW;
  end if;

  if row_data ? 'lote_id' and row_data->>'lote_id' is not null then
    ref_id := (row_data->>'lote_id')::bigint;
    select owner_user_id into ref_owner from public.lotes where id = ref_id;
    if ref_owner is not null and ref_owner <> owner then
      raise exception 'lote_id % nao pertence a mesma conta do registro' , ref_id
        using errcode = '23514';
    end if;
  end if;

  if row_data ? 'fazenda_id' and row_data->>'fazenda_id' is not null then
    ref_id := (row_data->>'fazenda_id')::bigint;
    select owner_user_id into ref_owner from public.fazendas where id = ref_id;
    if ref_owner is not null and ref_owner <> owner then
      raise exception 'fazenda_id % nao pertence a mesma conta do registro', ref_id
        using errcode = '23514';
    end if;
  end if;

  if row_data ? 'faz_id' and row_data->>'faz_id' is not null then
    ref_id := (row_data->>'faz_id')::bigint;
    select owner_user_id into ref_owner from public.fazendas where id = ref_id;
    if ref_owner is not null and ref_owner <> owner then
      raise exception 'faz_id % nao pertence a mesma conta do registro', ref_id
        using errcode = '23514';
    end if;
  end if;

  if row_data ? 'item_estoque_id' and row_data->>'item_estoque_id' is not null then
    ref_id := (row_data->>'item_estoque_id')::bigint;
    select owner_user_id into ref_owner from public.estoque where id = ref_id;
    if ref_owner is not null and ref_owner <> owner then
      raise exception 'item_estoque_id % nao pertence a mesma conta do registro', ref_id
        using errcode = '23514';
    end if;
  end if;

  if row_data ? 'animal_id' and row_data->>'animal_id' is not null then
    ref_id := (row_data->>'animal_id')::bigint;
    select owner_user_id into ref_owner from public.animais where id = ref_id;
    if ref_owner is not null and ref_owner <> owner then
      raise exception 'animal_id % nao pertence a mesma conta do registro', ref_id
        using errcode = '23514';
    end if;
  end if;

  return NEW;
end;
$$;

-- Anexa o trigger em toda tabela que tem owner_user_id junto com pelo menos
-- uma das colunas de referencia (fazenda_id/faz_id/lote_id/item_estoque_id/
-- animal_id) -- sem enumerar tabela por tabela na mao.
do $$
declare
  tbl record;
begin
  for tbl in
    select distinct c1.table_name
    from information_schema.columns c1
    where c1.table_schema = 'public'
      and c1.column_name = 'owner_user_id'
      and exists (
        select 1 from information_schema.columns c2
        where c2.table_schema = 'public'
          and c2.table_name = c1.table_name
          and c2.column_name in ('fazenda_id', 'faz_id', 'lote_id', 'item_estoque_id', 'animal_id')
      )
  loop
    execute format('drop trigger if exists trg_validar_integridade_conta_fazenda on public.%I;', tbl.table_name);
    execute format(
      'create trigger trg_validar_integridade_conta_fazenda before insert or update on public.%I for each row execute function public.validar_integridade_conta_fazenda();',
      tbl.table_name
    );
  end loop;
end $$;
