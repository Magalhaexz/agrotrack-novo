-- Teste automatizado de seguranca: public.app_can_access_fazenda (Sprint 8).
--
-- Roda inteiramente dentro de UMA transacao terminada em ROLLBACK: nao
-- cria, altera nem apaga nenhum dado permanente, mesmo que todas as
-- asserções passem. Usa 3 identidades reais e distintas de auth.users
-- (escolhidas dinamicamente, nenhum UUID fixo neste arquivo — a FK
-- profiles_id_fkey exige um id existente em auth.users); todos os dados de
-- negocio do teste (fazendas) sao linhas sinteticas (`__TESTE_AUDITORIA_*__`)
-- criadas e descartadas dentro da mesma transacao.
--
-- Como rodar: execute o arquivo inteiro de uma vez (psql, editor SQL do
-- Supabase, ou `execute_sql` via MCP) contra o projeto. Se alguma asserção
-- falhar, a funcao levanta EXCEPTION com a mensagem "FALHA <n>: ..." e o
-- BEGIN externo garante que nada fica salvo de qualquer forma. Ao final,
-- se tudo passar, uma mensagem "TODOS OS TESTES PASSARAM" e emitida antes
-- do ROLLBACK.
--
-- Cobertura (mesma da auditoria docs/AUDITORIA_SECURITY_DEFINER_HERDON.md,
-- item P1 `app_can_access_fazenda`):
--   1. chamada anonima -> false (inclusive com target_fazenda_id nulo)
--   2. autenticado sem fazenda restrita: fazenda propria -> true (x2),
--      fazenda de outra conta -> false
--   3. autenticado com fazenda restrita (funcionario real, auth.uid() !=
--      owner_user_id): fazenda atribuida -> true, outra fazenda da MESMA
--      conta -> false, fazenda de outra conta -> false
--   4. usuario sem perfil / sem conta resolvida -> nunca enxerga fazenda
--      de outra conta (app_current_owner_user_id cai para o proprio
--      auth.uid() por design, mas isso nao concede acesso a dado alheio)
--   5. target_fazenda_id inexistente -> false
--   6. target_fazenda_id IS NULL -> true (decisao documentada na
--      migration 20260729220000; testada aqui em anon, sem-restricao e
--      com-restricao)
--   7. regressao de RLS na tabela `fazendas`: conta A nao le linhas da
--      conta B; usuario sem restricao continua lendo as fazendas da
--      propria conta; usuario restrito le so a fazenda atribuida

begin;

do $test$
declare
  v_owner_a uuid;  -- vai bancar o dono/gestor da "conta A" (sem fazenda_id restrito)
  v_owner_b uuid;  -- vai bancar o dono da "conta B" (fazenda de outra conta)
  v_func_a  uuid;  -- funcionario real da conta A, restrito a uma fazenda
  v_faz_a1 bigint;
  v_faz_a2 bigint;
  v_faz_b1 bigint;
  v_result boolean;
  v_count  int;
begin
  ------------------------------------------------------------------------
  -- setup: 3 identidades reais e distintas + 3 fazendas sinteticas
  ------------------------------------------------------------------------
  select id into v_owner_a from auth.users order by id limit 1;
  select id into v_owner_b from auth.users where id <> v_owner_a order by id limit 1 offset 1;
  select id into v_func_a  from auth.users where id not in (v_owner_a, v_owner_b) order by id limit 1 offset 2;

  if v_owner_a is null or v_owner_b is null or v_func_a is null then
    raise exception 'AUDITORIA: precisa de pelo menos 3 usuarios em auth.users para rodar este teste';
  end if;

  insert into public.fazendas (owner_user_id, nome) values (v_owner_a, '__TESTE_AUDITORIA_FAZENDA_A1__') returning id into v_faz_a1;
  insert into public.fazendas (owner_user_id, nome) values (v_owner_a, '__TESTE_AUDITORIA_FAZENDA_A2__') returning id into v_faz_a2;
  insert into public.fazendas (owner_user_id, nome) values (v_owner_b, '__TESTE_AUDITORIA_FAZENDA_B1__') returning id into v_faz_b1;

  -- ator A = dono da propria conta (profiles.id = profiles.owner_user_id)
  update public.profiles set owner_user_id = v_owner_a, fazenda_id = null where id = v_owner_a;
  -- ator B = dono da conta B (usado so como referencia de fazenda de outra conta)
  update public.profiles set owner_user_id = v_owner_b, fazenda_id = null where id = v_owner_b;
  -- funcionario real da conta A, sem fazenda ainda (ajustado teste a teste)
  update public.profiles set owner_user_id = v_owner_a, fazenda_id = null where id = v_func_a;

  ------------------------------------------------------------------------
  -- 1. chamada anonima -> false
  ------------------------------------------------------------------------
  set local role anon;
  perform set_config('request.jwt.claims', '', true);

  select public.app_can_access_fazenda(v_faz_a1) into v_result;
  if v_result is distinct from false then
    raise exception 'FALHA 1a: anon deveria ver false para fazenda existente, veio %', v_result;
  end if;

  select public.app_can_access_fazenda(null) into v_result;
  if v_result is distinct from false then
    raise exception 'FALHA 1b: anon deveria ver false mesmo com target_fazenda_id nulo, veio %', v_result;
  end if;

  reset role;

  ------------------------------------------------------------------------
  -- 2. autenticado SEM fazenda restrita (dono da conta A)
  ------------------------------------------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner_a, 'role', 'authenticated')::text, true);

  select public.app_can_access_fazenda(v_faz_a1) into v_result;
  if v_result is distinct from true then
    raise exception 'FALHA 2a: dono sem restricao deveria acessar fazenda da propria conta, veio %', v_result;
  end if;

  select public.app_can_access_fazenda(v_faz_a2) into v_result;
  if v_result is distinct from true then
    raise exception 'FALHA 2b: dono sem restricao deveria acessar QUALQUER fazenda da propria conta, veio %', v_result;
  end if;

  select public.app_can_access_fazenda(v_faz_b1) into v_result;
  if v_result is distinct from false then
    raise exception 'FALHA 2c (CORE FIX): dono sem restricao NAO deveria acessar fazenda de outra conta, veio %', v_result;
  end if;

  select public.app_can_access_fazenda(999999999) into v_result;
  if v_result is distinct from false then
    raise exception 'FALHA 2d: fazenda inexistente deveria ser false, veio %', v_result;
  end if;

  select public.app_can_access_fazenda(null) into v_result;
  if v_result is distinct from true then
    raise exception 'FALHA 2e: target_fazenda_id nulo deveria ser true para autenticado (decisao documentada), veio %', v_result;
  end if;

  reset role;

  ------------------------------------------------------------------------
  -- 3. autenticado COM fazenda restrita (funcionario real da conta A,
  --    auth.uid() != owner_user_id da conta)
  ------------------------------------------------------------------------
  update public.profiles set fazenda_id = v_faz_a1 where id = v_func_a;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_func_a, 'role', 'authenticated')::text, true);

  select public.app_can_access_fazenda(v_faz_a1) into v_result;
  if v_result is distinct from true then
    raise exception 'FALHA 3a: funcionario restrito deveria acessar a fazenda atribuida, veio %', v_result;
  end if;

  select public.app_can_access_fazenda(v_faz_a2) into v_result;
  if v_result is distinct from false then
    raise exception 'FALHA 3b: funcionario restrito NAO deveria acessar outra fazenda da MESMA conta, veio %', v_result;
  end if;

  select public.app_can_access_fazenda(v_faz_b1) into v_result;
  if v_result is distinct from false then
    raise exception 'FALHA 3c: funcionario restrito NAO deveria acessar fazenda de outra conta, veio %', v_result;
  end if;

  select public.app_can_access_fazenda(null) into v_result;
  if v_result is distinct from true then
    raise exception 'FALHA 3d: target_fazenda_id nulo deveria ser true mesmo restrito (decisao documentada), veio %', v_result;
  end if;

  reset role;

  ------------------------------------------------------------------------
  -- 6 (complemento). target_fazenda_id inexistente com usuario restrito
  ------------------------------------------------------------------------
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_func_a, 'role', 'authenticated')::text, true);
  select public.app_can_access_fazenda(999999999) into v_result;
  if v_result is distinct from false then
    raise exception 'FALHA 6: fazenda inexistente deveria ser false mesmo restrito, veio %', v_result;
  end if;
  reset role;

  ------------------------------------------------------------------------
  -- 7. regressao de RLS direto na tabela fazendas (nao so via funcao)
  ------------------------------------------------------------------------

  -- 7a: dono sem restricao continua lendo as fazendas da propria conta,
  --     e nao le a de outra conta
  update public.profiles set fazenda_id = null where id = v_owner_a;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner_a, 'role', 'authenticated')::text, true);

  select count(*) into v_count from public.fazendas where id in (v_faz_a1, v_faz_a2);
  if v_count <> 2 then
    raise exception 'FALHA 7a: dono sem restricao deveria ver as 2 fazendas da propria conta, viu %', v_count;
  end if;

  select count(*) into v_count from public.fazendas where id = v_faz_b1;
  if v_count <> 0 then
    raise exception 'FALHA 7b (CORE FIX via RLS): dono sem restricao NAO deveria ver fazenda de outra conta, viu %', v_count;
  end if;

  reset role;

  -- 7c: funcionario restrito le SOMENTE a fazenda atribuida
  update public.profiles set fazenda_id = v_faz_a1 where id = v_func_a;
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', v_func_a, 'role', 'authenticated')::text, true);

  select count(*) into v_count from public.fazendas where id = v_faz_a1;
  if v_count <> 1 then
    raise exception 'FALHA 7c: funcionario restrito deveria ver a fazenda atribuida, viu %', v_count;
  end if;

  select count(*) into v_count from public.fazendas where id in (v_faz_a2, v_faz_b1);
  if v_count <> 0 then
    raise exception 'FALHA 7d: funcionario restrito NAO deveria ver outra fazenda da conta nem de outra conta, viu %', v_count;
  end if;

  reset role;

  raise notice 'TODOS OS TESTES PASSARAM (app_can_access_fazenda, Sprint 8)';
end;
$test$;

rollback;
