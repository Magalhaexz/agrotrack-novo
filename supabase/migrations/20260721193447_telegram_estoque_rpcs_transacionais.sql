-- P1-03 — RPCs transacionais para entrada/saída de estoque via Telegram.
--
-- O executor legado do bot (`api/_telegramBot.js::aplicarWrites`) aplicava os
-- planos multiwrite de entrada/saída de estoque (`src/domain/telegram/
-- cadastros.js`, case REGISTRAR_ENTRADA_ESTOQUE; `src/domain/telegram/
-- acoesEstoque.js::prepararSaidaEstoque`, usado por DAR_BAIXA_ESTOQUE) como
-- uma sequência de insert+update (+insert financeiro na saída) SEM checar
-- `{ error }` entre os passos — se o update do saldo falhasse depois do
-- insert da movimentação (ou o financeiro depois do saldo), a operação ficava
-- pela metade e o bot ainda respondia como se tivesse dado certo. Estas RPCs
-- aplicam o mesmo conjunto de gravações numa única transação, com
-- `SELECT ... FOR UPDATE` no item de estoque (mesmo padrão de
-- `registrar_saida_lote`, 20260716180853).
--
-- Os planos em `src/domain/telegram/cadastros.js`/`acoesEstoque.js`
-- continuam puros e sem I/O: o executor (`api/_telegramBot.js`) remonta os
-- MESMOS campos já validados em params de RPC, sem duplicar a lógica de
-- negócio — a RPC revalida saldo/existência de novo sob lock.
--
-- SECURITY DEFINER e grant só para service_role: hoje só o bot do Telegram
-- (client de service-role) chama estas RPCs — o app web continua no caminho
-- próprio (`src/services/movimentacoes.js`), fora do escopo deste ticket.

create or replace function public.registrar_entrada_estoque_telegram(
  p_owner_user_id uuid,
  p_item_estoque_id bigint,
  p_quantidade numeric,
  p_data date default current_date,
  p_obs text default null
)
returns table(movimentacao_id bigint, novo_saldo numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.estoque%rowtype;
  v_mov_id bigint;
  v_novo_saldo numeric;
begin
  perform public.app_assert_owner_write(p_owner_user_id);

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Informe uma quantidade válida.' using errcode = '22003';
  end if;

  select * into v_item from public.estoque where id = p_item_estoque_id and owner_user_id = p_owner_user_id for update;
  if not found then
    raise exception 'Item de estoque não encontrado ou não pertence à sua conta.' using errcode = '42501';
  end if;

  insert into public.movimentacoes_estoque (
    owner_user_id, item_estoque_id, tipo, quantidade, data, obs, origem
  ) values (
    p_owner_user_id, p_item_estoque_id, 'entrada', p_quantidade, coalesce(p_data, current_date), p_obs, 'telegram'
  ) returning id into v_mov_id;

  v_novo_saldo := coalesce(v_item.quantidade_atual, 0) + p_quantidade;
  update public.estoque
     set quantidade_atual = v_novo_saldo,
         quantidade = coalesce(v_item.quantidade, 0) + p_quantidade
   where id = p_item_estoque_id;

  return query select v_mov_id, v_novo_saldo;
end;
$$;

revoke all on function public.registrar_entrada_estoque_telegram(uuid, bigint, numeric, date, text) from public;
revoke execute on function public.registrar_entrada_estoque_telegram(uuid, bigint, numeric, date, text) from anon, authenticated;
grant execute on function public.registrar_entrada_estoque_telegram(uuid, bigint, numeric, date, text) to service_role;

-- Cobre consumo/ajuste/perda/venda (DAR_BAIXA_ESTOQUE): baixa o saldo e,
-- quando aplicável, lança o financeiro correspondente (despesa de consumo
-- vinculado a lote, ou receita de venda) na MESMA transação.
create or replace function public.registrar_saida_estoque_telegram(
  p_owner_user_id uuid,
  p_item_estoque_id bigint,
  p_quantidade numeric,
  p_tipo text,
  p_lote_id bigint default null,
  p_data date default current_date,
  p_obs text default null,
  p_custo_unitario numeric default null,
  p_valor_total numeric default null,
  p_descricao_financeiro text default null
)
returns table(movimentacao_id bigint, financeiro_id bigint, novo_saldo numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.estoque%rowtype;
  v_mov_id bigint;
  v_fin_id bigint;
  v_novo_saldo numeric;
begin
  perform public.app_assert_owner_write(p_owner_user_id);

  if p_tipo not in ('consumo', 'ajuste', 'perda', 'venda') then
    raise exception 'Tipo de saída de estoque inválido: %', p_tipo using errcode = '22023';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Informe uma quantidade válida.' using errcode = '22003';
  end if;

  select * into v_item from public.estoque where id = p_item_estoque_id and owner_user_id = p_owner_user_id for update;
  if not found then
    raise exception 'Item de estoque não encontrado ou não pertence à sua conta.' using errcode = '42501';
  end if;
  if p_quantidade > coalesce(v_item.quantidade_atual, 0) then
    raise exception 'Estoque insuficiente: saldo atual é %, saída pede %.', v_item.quantidade_atual, p_quantidade using errcode = '22003';
  end if;

  insert into public.movimentacoes_estoque (
    owner_user_id, item_estoque_id, lote_id, tipo, quantidade, custo_unitario, valor_total, data, obs, origem
  ) values (
    p_owner_user_id, p_item_estoque_id, p_lote_id, p_tipo, p_quantidade, p_custo_unitario, p_valor_total,
    coalesce(p_data, current_date), p_obs, 'telegram'
  ) returning id into v_mov_id;

  v_novo_saldo := coalesce(v_item.quantidade_atual, 0) - p_quantidade;
  update public.estoque
     set quantidade_atual = v_novo_saldo,
         quantidade = coalesce(v_item.quantidade, 0) - p_quantidade
   where id = p_item_estoque_id;

  if p_tipo = 'consumo' and p_lote_id is not null then
    insert into public.movimentacoes_financeiras (
      owner_user_id, tipo, categoria, lote_id, valor, data, data_competencia, status, descricao,
      origem_tipo, origem_id, origem
    ) values (
      p_owner_user_id, 'despesa', 'consumo_estoque', p_lote_id, coalesce(p_valor_total, 0),
      coalesce(p_data, current_date), coalesce(p_data, current_date), 'realizado', p_descricao_financeiro,
      'movimentacao_estoque', v_mov_id, 'telegram'
    ) returning id into v_fin_id;
  elsif p_tipo = 'venda' then
    insert into public.movimentacoes_financeiras (
      owner_user_id, tipo, categoria, lote_id, valor, data, data_competencia, status, descricao,
      origem_tipo, origem_id, origem
    ) values (
      p_owner_user_id, 'receita', 'venda_estoque', p_lote_id, coalesce(p_valor_total, 0),
      coalesce(p_data, current_date), coalesce(p_data, current_date), 'realizado', p_descricao_financeiro,
      'movimentacao_estoque', v_mov_id, 'telegram'
    ) returning id into v_fin_id;
  end if;

  return query select v_mov_id, v_fin_id, v_novo_saldo;
end;
$$;

revoke all on function public.registrar_saida_estoque_telegram(uuid, bigint, numeric, text, bigint, date, text, numeric, numeric, text) from public;
revoke execute on function public.registrar_saida_estoque_telegram(uuid, bigint, numeric, text, bigint, date, text, numeric, numeric, text) from anon, authenticated;
grant execute on function public.registrar_saida_estoque_telegram(uuid, bigint, numeric, text, bigint, date, text, numeric, numeric, text) to service_role;
