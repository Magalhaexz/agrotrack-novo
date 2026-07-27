-- Sprint Funcional 15 (revisão crítica) — RPCs transacionais para a pesagem
-- individual por cabeça.
--
-- O primeiro rascunho desta sprint gravava a pesagem principal, os pesos
-- individuais, os animais virtuais e o recálculo do lote como 4+N chamadas
-- independentes do cliente (createOperationalRecord/updateOperationalRecord/
-- deleteOperationalRecord em sequência, em src/pages/PesagensPage.jsx). Isso
-- NÃO é atômico: se o processo morrer ou uma chamada falhar no meio, sobra
-- pesagem principal sem peso, peso sem principal, ou lote com peso_atual
-- desatualizado em relação ao que acabou de ser gravado. Esta migration
-- fecha esse buraco seguindo exatamente o padrão já estabelecido em
-- 20260716180853_rpcs_transacionais_lote_pesagem.sql: cada função faz tudo
-- dentro de um único corpo PL/pgSQL (transação implícita do Postgres) — ou
-- tudo é aplicado, ou nada é. `security definer` pelo mesmo motivo documentado
-- naquele arquivo (chamável tanto pelo client autenticado quanto, no futuro,
-- pelo bot do Telegram); `app_assert_owner_write` continua sendo a única
-- fronteira de autorização (RLS é ignorada de propósito dentro da função,
-- todo select/update/delete é escopado por `owner_user_id = p_owner_user_id`
-- explicitamente).
--
-- Ambiguidade de dados antigos (pré-sprint): pesagens individuais criadas
-- antes desta migration nunca tiveram `metadata.pesagem_principal_id` — hoje
-- elas só existem soltas, sem pesagem agregada vinculada. Este arquivo NÃO
-- tenta reconciliar esse legado; `registrar_pesagem_individual` só edita uma
-- pesagem principal já existente quando `p_pesagem_principal_id` é passado
-- (e nesse caso já é, por definição, uma pesagem criada por este próprio
-- fluxo). O agrupamento visual de dados órfãos continua sendo feito só em
-- memória no cliente (src/pages/PesagensPage.jsx::dadosTabela), sem nenhuma
-- ação de escrita — ver o bloqueio de edição/exclusão nesses casos no app.

-- ── 1. Criar ou editar uma pesagem individual por cabeça (principal + filhos) ─
-- Recebe todos os pesos válidos já filtrados/validados no cliente
-- (domain/pesagensLote.js::calcularPesoMedioIndividual roda de novo aqui
-- dentro, em SQL, para nunca confiar só no valor calculado no navegador).
--
-- p_pesos é um array jsonb, um item por cabeça:
--   { "animal_id": bigint|null, "virtual_index": int|null,
--     "virtual_identificacao": text|null, "peso_medio": numeric,
--     "observacao": text|null }
--
-- Quando `p_pesagem_principal_id` é omitido/null: cria uma pesagem principal
-- NOVA (tipo:'lote') com um id novo — mesmo que já exista outra pesagem do
-- mesmo lote na mesma data (duas pesagens no mesmo dia são dois eventos
-- distintos, cada um com seu próprio id principal e seus próprios filhos
-- vinculados só por `metadata.pesagem_principal_id`; nunca são misturadas).
--
-- Quando `p_pesagem_principal_id` é informado: é uma EDIÇÃO. Atualiza a
-- principal existente e reconcilia os filhos: atualiza quem continua na
-- lista, cria quem é novo, e apaga (só dentre os filhos DESSA principal) quem
-- foi removido do formulário — nunca toca pesos de outra pesagem principal,
-- mesmo que seja do mesmo lote e mesma data.
create or replace function public.registrar_pesagem_individual(
  p_owner_user_id uuid,
  p_lote_id bigint,
  p_data date,
  p_pesos jsonb,
  p_observacao text default null,
  p_rendimento_carcaca numeric default 52,
  p_preco_arroba numeric default null,
  p_cabecas_totais_lote integer default null,
  p_pesagem_principal_id bigint default null
)
returns table(
  pesagem_principal_id bigint,
  peso_medio numeric,
  quantidade_efetiva integer,
  soma_pesos numeric,
  lote_p_at numeric,
  lote_ultima_pesagem date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote public.lotes%rowtype;
  v_principal_existente public.pesagens%rowtype;
  v_item jsonb;
  v_peso numeric;
  v_animal_id bigint;
  v_virtual_index int;
  v_soma numeric := 0;
  v_qtd integer := 0;
  v_media numeric;
  v_principal_id bigint;
  v_animal_ids_usados bigint[] := '{}';
  v_existente public.pesagens%rowtype;
  v_ultimo_peso numeric;
  v_ultima_data date;
begin
  perform public.app_assert_owner_write(p_owner_user_id);

  if p_data is null then
    raise exception 'Informe a data da pesagem.' using errcode = '22004';
  end if;
  if p_pesos is null or jsonb_typeof(p_pesos) <> 'array' or jsonb_array_length(p_pesos) = 0 then
    raise exception 'Informe ao menos um peso válido.' using errcode = '22004';
  end if;

  -- Trava o lote (mesmo padrão das outras RPCs) e confirma que pertence a
  -- esta conta antes de qualquer escrita.
  select * into v_lote from public.lotes where id = p_lote_id and owner_user_id = p_owner_user_id for update;
  if not found then
    raise exception 'Lote não encontrado ou não pertence à sua conta.' using errcode = '42501';
  end if;

  -- Recalcula soma/quantidade/média AQUI, em SQL, a partir dos pesos válidos
  -- (>0) — nunca confia no valor que o cliente diz ter calculado
  -- (domain/pesagensLote.js::calcularPesoMedioIndividual é a mesma regra,
  -- espelhada, não duplicada em espírito: mesma fórmula, duas linguagens).
  for v_item in select * from jsonb_array_elements(p_pesos)
  loop
    v_peso := nullif(v_item->>'peso_medio', '')::numeric;
    if v_peso is not null and v_peso > 0 then
      v_soma := v_soma + v_peso;
      v_qtd := v_qtd + 1;
    end if;
  end loop;

  if v_qtd = 0 then
    raise exception 'Nenhum peso válido para calcular a média.' using errcode = '22003';
  end if;

  v_media := round(v_soma / v_qtd, 2);

  -- ── Pesagem principal (tipo:'lote') ──────────────────────────────────────
  if p_pesagem_principal_id is not null then
    select * into v_principal_existente
      from public.pesagens
     where id = p_pesagem_principal_id
       and owner_user_id = p_owner_user_id
       and lote_id = p_lote_id
       and coalesce(tipo, 'lote') = 'lote'
     for update;
    if not found then
      raise exception 'Pesagem principal não encontrada ou não pertence a este lote.' using errcode = '42501';
    end if;

    update public.pesagens
       set peso_medio = v_media,
           data = p_data,
           observacao = p_observacao,
           rendimento_carcaca = p_rendimento_carcaca,
           preco_arroba = p_preco_arroba,
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
             'quantidade_efetiva', v_qtd,
             'soma_pesos', v_soma,
             'cabecas_totais_lote', p_cabecas_totais_lote,
             'origem_calculo', 'pesagem_individual'
           )
     where id = p_pesagem_principal_id;

    v_principal_id := p_pesagem_principal_id;
  else
    insert into public.pesagens (
      owner_user_id, lote_id, data, peso_medio, tipo, origem, observacao,
      rendimento_carcaca, preco_arroba, metadata
    ) values (
      p_owner_user_id, p_lote_id, p_data, v_media, 'lote', 'app', p_observacao,
      p_rendimento_carcaca, p_preco_arroba,
      jsonb_build_object(
        'quantidade_efetiva', v_qtd,
        'soma_pesos', v_soma,
        'cabecas_totais_lote', p_cabecas_totais_lote,
        'origem_calculo', 'pesagem_individual'
      )
    ) returning id into v_principal_id;
  end if;

  -- ── Pesos individuais (tipo:'animal'), vinculados só a esta principal ───
  for v_item in select * from jsonb_array_elements(p_pesos)
  loop
    v_peso := nullif(v_item->>'peso_medio', '')::numeric;
    if v_peso is null or v_peso <= 0 then
      continue;
    end if;

    v_animal_id := nullif(v_item->>'animal_id', '')::bigint;
    v_virtual_index := nullif(v_item->>'virtual_index', '')::int;

    if v_animal_id is not null then
      -- Animal real informado pelo cliente: confirma que pertence a este
      -- lote/conta antes de vincular a pesagem — não confia no id vindo do
      -- navegador sem checar.
      perform 1 from public.animais
       where id = v_animal_id and owner_user_id = p_owner_user_id and lote_id = p_lote_id;
      if not found then
        raise exception 'Animal % não encontrado neste lote.', v_animal_id using errcode = '42501';
      end if;
    else
      if v_virtual_index is null then
        raise exception 'Cabeça sem identificação (nem animal_id, nem virtual_index).' using errcode = '22004';
      end if;
      -- Animal virtual: procura um já criado por uma pesagem anterior deste
      -- mesmo lote (mesmo index), senão cria agora.
      select id into v_animal_id
        from public.animais
       where owner_user_id = p_owner_user_id
         and lote_id = p_lote_id
         and (metadata->>'index')::int = v_virtual_index
       limit 1;

      if v_animal_id is null then
        insert into public.animais (
          owner_user_id, fazenda_id, lote_id, identificacao, nome, tipo_registro,
          qtd, p_ini, p_at, status, metadata
        ) values (
          p_owner_user_id, v_lote.faz_id, p_lote_id,
          coalesce(nullif(v_item->>'virtual_identificacao', ''), 'Animal #' || v_virtual_index),
          coalesce(nullif(v_item->>'virtual_identificacao', ''), 'Animal #' || v_virtual_index),
          'individual', 1, v_lote.p_ini, v_peso, 'ativo',
          jsonb_build_object('generated_from_weighing', true, 'index', v_virtual_index)
        ) returning id into v_animal_id;
      end if;
    end if;

    v_animal_ids_usados := array_append(v_animal_ids_usados, v_animal_id);

    -- Só considera "a mesma linha para atualizar" um filho que já pertença a
    -- ESTA pesagem principal — nunca um peso de outra pesagem do mesmo
    -- lote/data (é assim que duas pesagens do mesmo lote no mesmo dia nunca
    -- se misturam: uma pesagem NOVA sempre insere filhos novos).
    v_existente := null;
    if p_pesagem_principal_id is not null then
      select * into v_existente
        from public.pesagens
       where owner_user_id = p_owner_user_id
         and lote_id = p_lote_id
         and animal_id = v_animal_id
         and coalesce(tipo, 'lote') = 'animal'
         and (metadata->>'pesagem_principal_id')::bigint = p_pesagem_principal_id
       for update;
    end if;

    if v_existente.id is not null then
      update public.pesagens
         set peso_medio = v_peso,
             data = p_data,
             observacao = nullif(v_item->>'observacao', ''),
             rendimento_carcaca = p_rendimento_carcaca,
             preco_arroba = p_preco_arroba,
             metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
               'pesagem_principal_id', v_principal_id,
               'animal_identificacao', v_item->>'virtual_identificacao',
               'virtualIndex', v_virtual_index
             )
       where id = v_existente.id;
    else
      insert into public.pesagens (
        owner_user_id, lote_id, animal_id, data, peso_medio, tipo, origem, observacao,
        rendimento_carcaca, preco_arroba, metadata
      ) values (
        p_owner_user_id, p_lote_id, v_animal_id, p_data, v_peso, 'animal', 'app',
        nullif(v_item->>'observacao', ''), p_rendimento_carcaca, p_preco_arroba,
        jsonb_build_object(
          'pesagem_principal_id', v_principal_id,
          'animal_identificacao', v_item->>'virtual_identificacao',
          'virtualIndex', v_virtual_index
        )
      );
    end if;
  end loop;

  -- Reconciliação de edição: apaga pesos de cabeças que ficaram em branco
  -- desta vez — só dentre os filhos desta mesma pesagem principal.
  if p_pesagem_principal_id is not null then
    delete from public.pesagens
     where owner_user_id = p_owner_user_id
       and lote_id = p_lote_id
       and coalesce(tipo, 'lote') = 'animal'
       and (metadata->>'pesagem_principal_id')::bigint = p_pesagem_principal_id
       and not (animal_id = any(v_animal_ids_usados));
  end if;

  -- ── Recalcula o peso atual do lote a partir da pesagem de LOTE mais
  -- recente (nunca assume que a que acabou de ser gravada/editada é a mais
  -- recente — editar uma pesagem antiga não deve mexer no peso atual se
  -- existir uma pesagem posterior). Mesmo padrão de
  -- editar_ultima_pesagem_lote/excluir_ultima_pesagem_lote.
  select peso_medio, data into v_ultimo_peso, v_ultima_data
    from public.pesagens
   where lote_id = p_lote_id and owner_user_id = p_owner_user_id and coalesce(tipo, 'lote') = 'lote'
   order by data desc, id desc
   limit 1;

  update public.lotes
     set p_at = coalesce(v_ultimo_peso, p_at),
         peso_atual = coalesce(v_ultimo_peso, peso_atual),
         peso_medio_atual = coalesce(v_ultimo_peso, peso_medio_atual),
         ultima_pesagem = v_ultima_data
   where id = p_lote_id and owner_user_id = p_owner_user_id;

  return query
    select v_principal_id, v_media, v_qtd, v_soma, l.p_at, l.ultima_pesagem
      from public.lotes l
     where l.id = p_lote_id and l.owner_user_id = p_owner_user_id;
end;
$$;

revoke all on function public.registrar_pesagem_individual(uuid, bigint, date, jsonb, text, numeric, numeric, integer, bigint) from public;
grant execute on function public.registrar_pesagem_individual(uuid, bigint, date, jsonb, text, numeric, numeric, integer, bigint) to authenticated, service_role;

-- ── 2. Excluir uma pesagem individual (principal + todos os filhos vinculados) ─
-- Nunca deixa a principal sem filhos apagados nem filhos órfãos: os dois
-- deletes e o recálculo do lote acontecem na mesma transação. Mesmo fallback
-- por média ponderada de `animais` que `excluir_ultima_pesagem_lote` já usa
-- quando não sobra nenhuma pesagem de lote.
create or replace function public.excluir_pesagem_individual(
  p_owner_user_id uuid,
  p_pesagem_principal_id bigint
)
returns table(
  lote_id bigint,
  lote_p_at numeric,
  lote_ultima_pesagem date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_principal public.pesagens%rowtype;
  v_ultimo_peso numeric;
  v_ultima_data date;
  v_fallback numeric;
begin
  perform public.app_assert_owner_write(p_owner_user_id);

  select * into v_principal
    from public.pesagens
   where id = p_pesagem_principal_id and owner_user_id = p_owner_user_id and coalesce(tipo, 'lote') = 'lote'
   for update;
  if not found then
    raise exception 'Pesagem não encontrada ou não pertence à sua conta.' using errcode = '42501';
  end if;

  delete from public.pesagens
   where owner_user_id = p_owner_user_id
     and lote_id = v_principal.lote_id
     and coalesce(tipo, 'lote') = 'animal'
     and (metadata->>'pesagem_principal_id')::bigint = p_pesagem_principal_id;

  delete from public.pesagens where id = p_pesagem_principal_id;

  if v_principal.lote_id is not null then
    select peso_medio, data into v_ultimo_peso, v_ultima_data
      from public.pesagens
     where lote_id = v_principal.lote_id and owner_user_id = p_owner_user_id and coalesce(tipo, 'lote') = 'lote'
     order by data desc, id desc
     limit 1;

    if v_ultimo_peso is null then
      select sum(p_at * qtd) / nullif(sum(qtd), 0) into v_fallback
        from public.animais
       where lote_id = v_principal.lote_id and owner_user_id = p_owner_user_id;
    end if;

    update public.lotes
       set p_at = coalesce(v_ultimo_peso, v_fallback, p_at),
           peso_atual = coalesce(v_ultimo_peso, v_fallback, peso_atual),
           peso_medio_atual = coalesce(v_ultimo_peso, v_fallback, peso_medio_atual),
           ultima_pesagem = v_ultima_data
     where id = v_principal.lote_id and owner_user_id = p_owner_user_id;
  end if;

  return query
    select l.id, l.p_at, l.ultima_pesagem
      from public.lotes l
     where l.id = v_principal.lote_id and l.owner_user_id = p_owner_user_id;
end;
$$;

revoke all on function public.excluir_pesagem_individual(uuid, bigint) from public;
grant execute on function public.excluir_pesagem_individual(uuid, bigint) to authenticated, service_role;
