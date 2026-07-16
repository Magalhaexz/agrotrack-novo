-- Sprint Paridade 1, bloco 4 — RPCs transacionais para operações de lote e
-- pesagem. Hoje o bot do Telegram (`api/_telegramBot.js::aplicarWrites`) e o
-- app web (`src/services/movimentacoes.js`) aplicam venda/morte/transferência/
-- ajuste/pesagem como uma sequência de inserts/updates independentes, sem
-- transação — se o processo morrer no meio, ou uma etapa falhar sozinha, o
-- lote fica com `qtd`/`peso` inconsistente com o histórico. Cada função aqui
-- faz tudo dentro de um único corpo PL/pgSQL (transação implícita): ou tudo
-- é aplicado, ou nada é.
--
-- Todas são SECURITY DEFINER porque o bot do Telegram usa o client de
-- service-role (RLS ignorada) — sem isso, ele não pode chamar uma RPC que
-- dependa de RLS para recusar linhas de outra conta (mesmo motivo documentado
-- no `ponytail:` de `src/domain/telegram/acoesPasto.js:3-12` sobre a RPC
-- `mover_lote_para_pasto`, que é SECURITY INVOKER e por isso o bot não pode
-- chamá-la hoje). Todas recebem `p_owner_user_id uuid` explícito (não
-- dependem de `auth.uid()`) e chamam `app_assert_owner_write` primeiro, que
-- valida esse parâmetro contra a sessão real quando quem chama é um usuário
-- autenticado (`auth.role() = 'authenticated'`) — um usuário não pode forjar
-- o owner_user_id de outra conta. Quando quem chama é o service-role do bot
-- (sem `auth.uid()`), a validação de perfil/permissão já aconteceu em JS
-- antes de chamar a RPC (mesma fronteira de confiança que `aplicarWrites` já
-- usa hoje para escopar por `owner_user_id`).
--
-- Aplicação: este arquivo só cria as funções — nenhum código do bot foi
-- religado para chamá-las nesta migration (isso é feito à parte, em JS, nos
-- módulos `src/domain/telegram/acoes*.js`/`cadastro*.js`). O código que
-- chama `client.rpc(...)` só funciona depois que esta migration for aplicada
-- no ambiente de destino.

-- ── Helper compartilhado por todas as RPCs abaixo ────────────────────────────
create or replace function public.app_assert_owner_write(p_owner_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_owner_user_id is null then
    raise exception 'owner_user_id obrigatório.' using errcode = '22004';
  end if;
  if auth.role() = 'authenticated' then
    if not public.app_is_same_account(p_owner_user_id) then
      raise exception 'Não pertence à sua conta.' using errcode = '42501';
    end if;
    if not public.app_current_role_can_write() then
      raise exception 'Sem permissão de escrita.' using errcode = '42501';
    end if;
  end if;
  -- service_role (bot do Telegram): sem auth.uid() aqui — confia na
  -- checagem de perfil já feita em JS antes de chamar a RPC.
end;
$$;

revoke all on function public.app_assert_owner_write(uuid) from public;
grant execute on function public.app_assert_owner_write(uuid) to authenticated, service_role;

-- ── 1. Venda / morte / abate / descarte / transferência (saída + entre lotes) ─
-- Porta `registrarSaidaAnimal` (src/services/movimentacoes.js:302-470): insere
-- a movimentação, decrementa o lote de origem, lança o financeiro (só
-- venda/abate com valor > 0) e, para transferência, incrementa o destino —
-- tudo atômico.
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
  end if;

  return query select v_mov_id, v_fin_id;
end;
$$;

revoke all on function public.registrar_saida_lote(uuid, bigint, text, numeric, numeric, numeric, numeric, date, text, text, bigint, numeric) from public;
grant execute on function public.registrar_saida_lote(uuid, bigint, text, numeric, numeric, numeric, numeric, date, text, text, bigint, numeric) to authenticated, service_role;

-- ── 2. Ajuste de lotação ──────────────────────────────────────────────────────
-- Porta `buildAjusteLotacaoPatch` (src/pages/lotesLogic.js:192-220) exatamente:
-- mesma validação, mesmo texto de histórico.
create or replace function public.ajustar_lotacao_lote(
  p_owner_user_id uuid,
  p_lote_id bigint,
  p_nova_qtd numeric,
  p_motivo text,
  p_data date default current_date
)
returns table(movimentacao_id bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote public.lotes%rowtype;
  v_delta numeric;
  v_mov_id bigint;
begin
  perform public.app_assert_owner_write(p_owner_user_id);

  select * into v_lote from public.lotes where id = p_lote_id and owner_user_id = p_owner_user_id for update;
  if not found then
    raise exception 'Lote não encontrado ou não pertence à sua conta.' using errcode = '42501';
  end if;
  if v_lote.status in ('encerrado', 'vendido') then
    raise exception 'Esse lote está finalizado e não aceita novas movimentações.' using errcode = '22023';
  end if;
  if p_nova_qtd is null or p_nova_qtd < 0 or p_nova_qtd <> trunc(p_nova_qtd) then
    raise exception 'Informe uma quantidade válida.' using errcode = '22003';
  end if;
  if trim(coalesce(p_motivo, '')) = '' then
    raise exception 'Informe o motivo.' using errcode = '22004';
  end if;
  if p_nova_qtd = coalesce(v_lote.qtd, 0) then
    raise exception 'A nova quantidade é igual à atual — nada para ajustar.' using errcode = '22023';
  end if;

  v_delta := p_nova_qtd - coalesce(v_lote.qtd, 0);

  update public.lotes set qtd = p_nova_qtd where id = p_lote_id;

  insert into public.movimentacoes_animais (owner_user_id, lote_id, tipo, qtd, peso_medio, valor_total, data, obs)
  values (
    p_owner_user_id, p_lote_id, 'ajuste', v_delta, 0, 0, coalesce(p_data, current_date),
    trim(p_motivo) || ' (' || coalesce(v_lote.qtd, 0) || ' → ' || p_nova_qtd || ' cabeças)'
  ) returning id into v_mov_id;

  return query select v_mov_id;
end;
$$;

revoke all on function public.ajustar_lotacao_lote(uuid, bigint, numeric, text, date) from public;
grant execute on function public.ajustar_lotacao_lote(uuid, bigint, numeric, text, date) to authenticated, service_role;

-- ── 3. Finalização de lote ────────────────────────────────────────────────────
-- Já era um único UPDATE (atômico por natureza) — o ganho real aqui é mover a
-- guarda "lote já finalizado" (`loteEstaBloqueado`, hoje só em JS) para dentro
-- do banco, fechando a corrida entre duas finalizações simultâneas.
-- Nota: `motivo_encerramento` não existe como coluna em `lotes` (achado
-- separado, fora do escopo deste RPC — ver pendências do relatório final);
-- o motivo é gravado em `obs`, a única coluna de texto livre real da tabela.
create or replace function public.finalizar_lote(
  p_owner_user_id uuid,
  p_lote_id bigint,
  p_status text,
  p_data_encerramento date,
  p_data_venda date default null,
  p_motivo text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote public.lotes%rowtype;
begin
  perform public.app_assert_owner_write(p_owner_user_id);

  if p_status not in ('encerrado', 'vendido') then
    raise exception 'Status de finalização inválido: %', p_status using errcode = '22023';
  end if;
  if p_data_encerramento is null then
    raise exception 'Informe a data de encerramento.' using errcode = '22004';
  end if;

  select * into v_lote from public.lotes where id = p_lote_id and owner_user_id = p_owner_user_id for update;
  if not found then
    raise exception 'Lote não encontrado ou não pertence à sua conta.' using errcode = '42501';
  end if;
  if v_lote.status in ('encerrado', 'vendido') then
    raise exception 'Esse lote já está finalizado.' using errcode = '22023';
  end if;

  update public.lotes
     set status = p_status,
         data_encerramento = p_data_encerramento,
         data_venda = case when p_status = 'vendido' then coalesce(p_data_venda, p_data_encerramento) else null end,
         obs = case when trim(coalesce(p_motivo, '')) <> '' then trim(p_motivo) else v_lote.obs end
   where id = p_lote_id;
end;
$$;

revoke all on function public.finalizar_lote(uuid, bigint, text, date, date, text) from public;
grant execute on function public.finalizar_lote(uuid, bigint, text, date, date, text) to authenticated, service_role;

-- ── 4. Troca / retirada de pasto (gêmea SECURITY DEFINER de mover_lote_para_pasto) ─
-- `mover_lote_para_pasto` (20260619113446_lote_pastagens_historico.sql) é
-- SECURITY INVOKER e exige destino não-nulo — por isso o bot nunca pôde
-- chamá-la (ver ponytail em acoesPasto.js) e a "retirada de pasto" precisa de
-- uma função à parte no app. Esta função unifica os dois casos (destino
-- opcional) e adiciona a checagem de lote bloqueado, que a original não tem.
create or replace function public.mover_lote_para_pasto_bot(
  p_owner_user_id uuid,
  p_lote_id bigint,
  p_pastagem_destino_id uuid default null,
  p_data date default current_date,
  p_quantidade_cabecas numeric default null,
  p_motivo text default null,
  p_observacoes text default null
)
returns public.lote_pastagens_historico
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote public.lotes%rowtype;
  v_destino public.pastagens%rowtype;
  v_origem_id uuid;
  v_historico public.lote_pastagens_historico%rowtype;
begin
  perform public.app_assert_owner_write(p_owner_user_id);

  if p_quantidade_cabecas is not null and p_quantidade_cabecas <= 0 then
    raise exception 'A quantidade de cabeças deve ser maior que zero.' using errcode = '22003';
  end if;

  select * into v_lote from public.lotes where id = p_lote_id and owner_user_id = p_owner_user_id for update;
  if not found then
    raise exception 'Lote não encontrado ou não pertence à sua conta.' using errcode = '42501';
  end if;
  if v_lote.status in ('encerrado', 'vendido') then
    raise exception 'Esse lote está finalizado e não aceita novas movimentações.' using errcode = '22023';
  end if;
  if v_lote.faz_id is null then
    raise exception 'O lote não está vinculado a uma fazenda.' using errcode = '22004';
  end if;

  if p_pastagem_destino_id is not null then
    select * into v_destino from public.pastagens where id = p_pastagem_destino_id and owner_user_id = p_owner_user_id;
    if not found then
      raise exception 'Pasto de destino não encontrado ou não pertence à sua conta.' using errcode = '42501';
    end if;
    if v_destino.faz_id is distinct from v_lote.faz_id then
      raise exception 'O pasto de destino pertence a outra fazenda.' using errcode = '22023';
    end if;
  end if;

  v_origem_id := v_lote.pastagem_id;

  if v_origem_id is not null and v_origem_id = p_pastagem_destino_id and coalesce(trim(p_motivo), '') = '' then
    raise exception 'O destino é igual ao pasto atual. Informe um motivo para confirmar a movimentação.' using errcode = '22023';
  end if;

  insert into public.lote_pastagens_historico (
    owner_user_id, lote_id, faz_id, pastagem_origem_id, pastagem_destino_id,
    data_movimentacao, quantidade_cabecas, motivo, observacoes
  ) values (
    p_owner_user_id, v_lote.id, v_lote.faz_id, v_origem_id, p_pastagem_destino_id,
    coalesce(p_data, current_date), p_quantidade_cabecas, p_motivo, p_observacoes
  ) returning * into v_historico;

  update public.lotes set pastagem_id = p_pastagem_destino_id where id = v_lote.id;

  return v_historico;
end;
$$;

revoke all on function public.mover_lote_para_pasto_bot(uuid, bigint, uuid, date, numeric, text, text) from public;
grant execute on function public.mover_lote_para_pasto_bot(uuid, bigint, uuid, date, numeric, text, text) to authenticated, service_role;

-- ── 5. Editar a última pesagem de um lote ────────────────────────────────────
-- Porta `recalcularPesoAtualLote` (src/domain/pesagensLote.js:52-60): depois
-- de editar, relê a pesagem de lote mais recente e recalcula `p_at`/
-- `ultima_pesagem` a partir dela — nunca deixa o lote com peso desatualizado
-- em relação ao próprio histórico que acabou de mudar.
create or replace function public.editar_ultima_pesagem_lote(
  p_owner_user_id uuid,
  p_pesagem_id bigint,
  p_novo_peso numeric,
  p_nova_data date default null,
  p_nova_observacao text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pesagem public.pesagens%rowtype;
  v_ultimo_peso numeric;
  v_ultima_data date;
begin
  perform public.app_assert_owner_write(p_owner_user_id);

  if p_novo_peso is null or p_novo_peso <= 0 then
    raise exception 'Informe um peso válido em kg.' using errcode = '22003';
  end if;

  select * into v_pesagem from public.pesagens where id = p_pesagem_id and owner_user_id = p_owner_user_id for update;
  if not found then
    raise exception 'Pesagem não encontrada ou não pertence à sua conta.' using errcode = '42501';
  end if;

  update public.pesagens
     set peso_medio = p_novo_peso,
         data = coalesce(p_nova_data, data),
         observacao = coalesce(p_nova_observacao, observacao)
   where id = p_pesagem_id;

  if v_pesagem.lote_id is not null then
    select peso_medio, data into v_ultimo_peso, v_ultima_data
      from public.pesagens
     where lote_id = v_pesagem.lote_id and owner_user_id = p_owner_user_id and tipo = 'lote'
     order by data desc, id desc
     limit 1;

    update public.lotes
       set p_at = coalesce(v_ultimo_peso, p_at),
           ultima_pesagem = v_ultima_data
     where id = v_pesagem.lote_id and owner_user_id = p_owner_user_id;
  end if;
end;
$$;

revoke all on function public.editar_ultima_pesagem_lote(uuid, bigint, numeric, date, text) from public;
grant execute on function public.editar_ultima_pesagem_lote(uuid, bigint, numeric, date, text) to authenticated, service_role;

-- ── 6. Excluir a última pesagem de um lote ───────────────────────────────────
-- Mesma recomputação acima, mais o fallback pela média ponderada de `animais`
-- quando não sobra nenhuma pesagem de lote (porta `pesoFallbackDosAnimais`,
-- pesagensLote.js:35-41).
create or replace function public.excluir_ultima_pesagem_lote(
  p_owner_user_id uuid,
  p_pesagem_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pesagem public.pesagens%rowtype;
  v_ultimo_peso numeric;
  v_ultima_data date;
  v_fallback numeric;
begin
  perform public.app_assert_owner_write(p_owner_user_id);

  select * into v_pesagem from public.pesagens where id = p_pesagem_id and owner_user_id = p_owner_user_id for update;
  if not found then
    raise exception 'Pesagem não encontrada ou não pertence à sua conta.' using errcode = '42501';
  end if;

  delete from public.pesagens where id = p_pesagem_id;

  if v_pesagem.lote_id is not null then
    select peso_medio, data into v_ultimo_peso, v_ultima_data
      from public.pesagens
     where lote_id = v_pesagem.lote_id and owner_user_id = p_owner_user_id and tipo = 'lote'
     order by data desc, id desc
     limit 1;

    if v_ultimo_peso is null then
      select sum(p_at * qtd) / nullif(sum(qtd), 0) into v_fallback
        from public.animais
       where lote_id = v_pesagem.lote_id and owner_user_id = p_owner_user_id;
    end if;

    update public.lotes
       set p_at = coalesce(v_ultimo_peso, v_fallback, p_at),
           ultima_pesagem = v_ultima_data
     where id = v_pesagem.lote_id and owner_user_id = p_owner_user_id;
  end if;
end;
$$;

revoke all on function public.excluir_ultima_pesagem_lote(uuid, bigint) from public;
grant execute on function public.excluir_ultima_pesagem_lote(uuid, bigint) to authenticated, service_role;

-- ── 7. Cadastro completo de lote (lote + grupo em `animais` + pesagem inicial + pasto) ─
-- Fecha o gap documentado em docs/TELEGRAM_PARIDADE_COMPLETA_APP.md ("Lote
-- criado via bot não replica os 2 side-effects automáticos do app"): porta
-- `buildGrupoAnimaisAutoPatch`/`buildPesagemInicialPatch`
-- (src/pages/lotesLogic.js:137-182) para dentro da mesma transação do
-- INSERT do lote, em vez de inserts JS separados e sem garantia de conjunto.
create or replace function public.criar_lote_completo(
  p_owner_user_id uuid,
  p_faz_id bigint,
  p_nome text,
  p_qtd numeric,
  p_sexo text,
  p_raca text default null,
  p_pastagem_id uuid default null,
  p_peso_inicial numeric default null,
  p_data_entrada date default null,
  p_origem text default null,
  p_observacao text default null,
  p_categoria_animal text default null,
  p_rendimento_carcaca numeric default 52
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote_id bigint;
  v_data_entrada date := coalesce(p_data_entrada, current_date);
  v_peso numeric := coalesce(p_peso_inicial, 0);
begin
  perform public.app_assert_owner_write(p_owner_user_id);

  if trim(coalesce(p_nome, '')) = '' then
    raise exception 'Informe o nome do lote.' using errcode = '22004';
  end if;
  if p_qtd is null or p_qtd <= 0 then
    raise exception 'Informe uma quantidade válida.' using errcode = '22003';
  end if;
  if p_faz_id is null then
    raise exception 'Informe a fazenda do lote.' using errcode = '22004';
  end if;

  perform 1 from public.fazendas where id = p_faz_id and owner_user_id = p_owner_user_id;
  if not found then
    raise exception 'Fazenda não encontrada ou não pertence à sua conta.' using errcode = '42501';
  end if;

  if p_pastagem_id is not null then
    perform 1 from public.pastagens where id = p_pastagem_id and owner_user_id = p_owner_user_id and faz_id = p_faz_id;
    if not found then
      raise exception 'Pasto não encontrado ou pertence a outra fazenda.' using errcode = '42501';
    end if;
  end if;

  insert into public.lotes (
    owner_user_id, nome, faz_id, pastagem_id, entrada, status, sistema,
    categoria_animal, raca, sexo, qtd, p_ini, p_at, rendimento_carcaca, obs
  ) values (
    p_owner_user_id, trim(p_nome), p_faz_id, p_pastagem_id, v_data_entrada, 'ativo',
    case when p_pastagem_id is not null then 'pasto' else 'confinamento' end,
    coalesce(p_categoria_animal, ''), coalesce(p_raca, ''), p_sexo, p_qtd, v_peso, v_peso,
    coalesce(p_rendimento_carcaca, 52), p_observacao
  ) returning id into v_lote_id;

  if p_qtd > 0 then
    insert into public.animais (
      owner_user_id, fazenda_id, lote_id, identificacao, nome, tipo_registro,
      categoria, raca, qtd, p_ini, p_at, data_referencia, status, rendimento_carcaca,
      observacao, origem
    ) values (
      p_owner_user_id, p_faz_id, v_lote_id, trim(p_nome), trim(p_nome), 'grupo',
      coalesce(p_categoria_animal, ''), coalesce(p_raca, ''), p_qtd, v_peso, v_peso,
      v_data_entrada, 'ativo', coalesce(p_rendimento_carcaca, 52),
      'Criado automaticamente a partir do cadastro do lote.', p_origem
    );
  end if;

  if coalesce(p_peso_inicial, 0) > 0 then
    insert into public.pesagens (owner_user_id, lote_id, data, peso_medio, tipo, origem, observacao)
    values (
      p_owner_user_id, v_lote_id, v_data_entrada, p_peso_inicial, 'lote', 'telegram',
      'Peso de entrada do lote (registrado automaticamente no cadastro).'
    );
  end if;

  if p_pastagem_id is not null then
    insert into public.lote_pastagens_historico (
      owner_user_id, lote_id, faz_id, pastagem_origem_id, pastagem_destino_id,
      data_movimentacao, quantidade_cabecas, motivo, observacoes
    ) values (
      p_owner_user_id, v_lote_id, p_faz_id, null, p_pastagem_id,
      v_data_entrada, p_qtd, 'Cadastro inicial do lote', null
    );
  end if;

  return v_lote_id;
end;
$$;

revoke all on function public.criar_lote_completo(uuid, bigint, text, numeric, text, text, uuid, numeric, date, text, text, text, numeric) from public;
grant execute on function public.criar_lote_completo(uuid, bigint, text, numeric, text, text, uuid, numeric, date, text, text, text, numeric) to authenticated, service_role;
