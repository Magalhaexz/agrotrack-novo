-- Corrige P0: `registrar_saida_lote` (usada pelo Bot do Telegram para venda,
-- morte, abate, descarte e transferência — ver src/domain/telegram/acoesLote.js)
-- só atualizava `lotes.qtd`. A linha "grupo" de `animais` (lida diretamente
-- pela página Animais do app — resumo "Total de cabeças" e aba "Grupos")
-- nunca era sincronizada, então animais vendidos pelo Telegram continuavam
-- aparecendo lá com a quantidade antiga, mesmo após reload (bug idêntico ao
-- corrigido no lado JS em src/services/movimentacoes.js, função
-- `sincronizarAnimaisGrupoDoLote` — esta migration replica a mesma regra no
-- caminho SQL transacional).
--
-- Regra: só as linhas "grupo" (`tipo_registro` nulo ou diferente de
-- 'individual') são tocadas; distribuição proporcional à participação atual
-- quando há mais de uma linha por lote (raro — normalmente há exatamente uma).
create or replace function public.registrar_saida_lote(
  p_owner_user_id uuid,
  p_lote_id bigint,
  p_tipo text,
  p_qtd numeric,
  p_peso_medio numeric default null,
  p_valor_total numeric default null,
  p_custo_por_cabeca numeric default null,
  p_data date default current_date,
  p_comprador_fornecedor text default null,
  p_obs text default null,
  p_destino_lote_id bigint default null,
  p_peso_destino_final numeric default null
)
returns table(movimentacao_id bigint, financeiro_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote public.lotes%rowtype;
  v_destino public.lotes%rowtype;
  v_mov_id bigint;
  v_fin_id bigint;
begin
  perform public.app_assert_owner_write(p_owner_user_id);

  if p_tipo not in ('venda', 'morte', 'abate', 'descarte', 'transferencia_saida') then
    raise exception 'Tipo de saída inválido: %', p_tipo using errcode = '22023';
  end if;
  if p_qtd is null or p_qtd <= 0 then
    raise exception 'Informe uma quantidade válida.' using errcode = '22003';
  end if;

  select * into v_lote from public.lotes where id = p_lote_id and owner_user_id = p_owner_user_id for update;
  if not found then
    raise exception 'Lote não encontrado ou não pertence à sua conta.' using errcode = '42501';
  end if;
  if v_lote.status in ('encerrado', 'vendido') then
    raise exception 'Esse lote está finalizado e não aceita novas movimentações.' using errcode = '22023';
  end if;
  if p_qtd > coalesce(v_lote.qtd, 0) then
    raise exception 'Quantidade de saída (%) excede o saldo do lote (%).', p_qtd, v_lote.qtd using errcode = '22003';
  end if;

  if p_tipo = 'transferencia_saida' then
    if p_destino_lote_id is null then
      raise exception 'Informe o lote de destino.' using errcode = '22004';
    end if;
    if p_destino_lote_id = p_lote_id then
      raise exception 'Origem e destino não podem ser o mesmo lote.' using errcode = '22023';
    end if;
    select * into v_destino from public.lotes where id = p_destino_lote_id and owner_user_id = p_owner_user_id for update;
    if not found then
      raise exception 'Lote de destino não encontrado ou não pertence à sua conta.' using errcode = '42501';
    end if;
    if v_destino.status in ('encerrado', 'vendido') then
      raise exception 'O lote de destino está finalizado e não aceita novas movimentações.' using errcode = '22023';
    end if;
  end if;

  insert into public.movimentacoes_animais (
    owner_user_id, lote_id, destino_lote_id, tipo, qtd, peso_medio,
    valor_total, custo_por_cabeca, comprador_fornecedor, data, obs
  ) values (
    p_owner_user_id, p_lote_id,
    case when p_tipo = 'transferencia_saida' then p_destino_lote_id else null end,
    p_tipo, p_qtd, p_peso_medio, p_valor_total, p_custo_por_cabeca, p_comprador_fornecedor,
    coalesce(p_data, current_date), p_obs
  ) returning id into v_mov_id;

  update public.lotes set qtd = qtd - p_qtd where id = p_lote_id;

  -- Sincroniza a(s) linha(s) "grupo" de `animais` da ORIGEM com o novo saldo.
  with grupo as (
    select id, qtd,
           count(*) over () as n,
           sum(qtd) over () as total
      from public.animais
     where lote_id = p_lote_id
       and coalesce(tipo_registro, 'grupo') <> 'individual'
  )
  update public.animais a
     set qtd = greatest(round(
           case when g.total > 0
                then (coalesce(a.qtd, 0)::numeric / g.total) * (coalesce(v_lote.qtd, 0) - p_qtd)
                else (coalesce(v_lote.qtd, 0) - p_qtd) / g.n
           end
         ), 0)
    from grupo g
   where a.id = g.id;

  if p_tipo in ('venda', 'abate') and coalesce(p_valor_total, 0) > 0 then
    insert into public.movimentacoes_financeiras (
      owner_user_id, lote_id, tipo, categoria, valor, data, data_competencia,
      status, descricao, origem_tipo, origem_id
    ) values (
      p_owner_user_id, p_lote_id, 'receita',
      case when p_tipo = 'abate' then 'abate_animal' else 'venda_animal' end,
      p_valor_total, coalesce(p_data, current_date), coalesce(p_data, current_date),
      'realizado', p_obs, 'movimentacao_animal', v_mov_id
    ) returning id into v_fin_id;
  end if;

  if p_tipo = 'transferencia_saida' then
    -- `p_peso_destino_final` é opcional: quando informado (transferência),
    -- carrega a média ponderada já calculada em JS (`resumoAgregado`, sobre o
    -- `db` recém-recarregado) — a mesma reponderação que o caminho antigo
    -- (`executarTransferencia`) já fazia. Sem isso, o peso médio do lote de
    -- destino ficaria parado no valor antigo mesmo após receber animais.
    update public.lotes
       set qtd = qtd + p_qtd,
           p_at = coalesce(p_peso_destino_final, p_at)
     where id = p_destino_lote_id;

    -- Mesma sincronização acima, agora para o DESTINO da transferência.
    with grupo_destino as (
      select id, qtd,
             count(*) over () as n,
             sum(qtd) over () as total
        from public.animais
       where lote_id = p_destino_lote_id
         and coalesce(tipo_registro, 'grupo') <> 'individual'
    )
    update public.animais a
       set qtd = greatest(round(
             case when g.total > 0
                  then (coalesce(a.qtd, 0)::numeric / g.total) * (coalesce(v_destino.qtd, 0) + p_qtd)
                  else (coalesce(v_destino.qtd, 0) + p_qtd) / g.n
             end
           ), 0),
           p_at = coalesce(p_peso_destino_final, a.p_at)
      from grupo_destino g
     where a.id = g.id;
  end if;

  return query select v_mov_id, v_fin_id;
end;
$$;

revoke all on function public.registrar_saida_lote(uuid, bigint, text, numeric, numeric, numeric, numeric, date, text, text, bigint, numeric) from public;
revoke execute on function public.registrar_saida_lote(uuid, bigint, text, numeric, numeric, numeric, numeric, date, text, text, bigint, numeric) from anon;
grant execute on function public.registrar_saida_lote(uuid, bigint, text, numeric, numeric, numeric, numeric, date, text, text, bigint, numeric) to authenticated, service_role;
