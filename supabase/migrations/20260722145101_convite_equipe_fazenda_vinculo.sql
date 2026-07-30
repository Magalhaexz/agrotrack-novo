-- P1-11 — Vincula convite de equipe ao e-mail, fazenda e perfil autorizado.
--
-- Achado ao investigar o ticket: o trigger de signup real em produção
-- (handle_new_user_profile) NAO consulta a tabela invites — todo novo
-- cadastro sempre vira proprietario de uma conta nova e propria, mesmo
-- quando existe um convite pendente para o mesmo e-mail. Este arquivo
-- corrige isso e adiciona o vinculo por fazenda que o ticket pede.

-- ============================================================
-- 1) Schema: invites.fazenda_id/expires_at, profiles.fazenda_id, e trava
-- contra convite com perfil elevado (proprietario/admin nunca sao concedidos
-- por convite).
-- ============================================================
alter table public.invites
  add column if not exists fazenda_id bigint references public.fazendas (id) on delete set null,
  add column if not exists expires_at timestamptz default (timezone('utc', now()) + interval '14 days');

alter table public.invites
  drop constraint if exists invites_perfil_nao_elevado_check;
alter table public.invites
  add constraint invites_perfil_nao_elevado_check check (lower(perfil) not in ('proprietario', 'admin'));

alter table public.profiles
  add column if not exists fazenda_id bigint references public.fazendas (id) on delete set null;

-- ============================================================
-- 2) Bypass estreito no guard anti-autoescalada (migration
-- 20260717153400_bloqueia_autoescalada_perfil_profiles.sql) — sem isto, a
-- RPC de aceite abaixo (que precisa mudar perfil/owner_user_id do PROPRIO
-- usuario autenticado) sempre falharia com "Voce nao pode alterar seu
-- proprio perfil de acesso.". A flag so existe dentro da transacao da RPC
-- (set_config(..., is_local => true)) — nenhum outro caminho de codigo pode
-- setar essa flag, entao o guard continua valendo para qualquer outra
-- tentativa de auto-escalada.
-- ============================================================
create or replace function public.profiles_bloquear_autoescalada()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('app.bypass_autoescalada_convite', true), '') = 'on' then
    return new;
  end if;

  if auth.uid() = old.id then
    if new.perfil is distinct from old.perfil then
      raise exception 'Você não pode alterar seu próprio perfil de acesso.' using errcode = '42501';
    end if;
    if new.owner_user_id is distinct from old.owner_user_id then
      raise exception 'Você não pode alterar sua própria conta vinculada.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================
-- 3) handle_new_user_profile — reescrito para consultar invites pendentes
-- pelo e-mail autenticado ANTES de assumir "proprietario de conta nova". O
-- branch sem convite fica identico ao de hoje (nenhuma regressao no
-- cadastro self-service). Nunca confia em raw_user_meta_data para
-- perfil/owner_user_id/fazenda_id — só o convite já salvo no banco decide.
-- ============================================================
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  resolved_name text;
  invited_record public.invites%rowtype;
begin
  resolved_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'nome'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'Novo usuário'
  );

  select * into invited_record
    from public.invites
   where lower(email) = lower(new.email)
     and status = 'pendente'
     and (expires_at is null or expires_at > now())
   order by created_at desc
   limit 1;

  if invited_record.id is not null then
    insert into public.profiles (id, email, nome, perfil, owner_user_id, fazenda_id, created_at, updated_at)
    values (new.id, new.email, resolved_name, invited_record.perfil, invited_record.owner_user_id, invited_record.fazenda_id, timezone('utc', now()), timezone('utc', now()))
    on conflict (id) do update set
      email = excluded.email,
      nome = coalesce(nullif(public.profiles.nome, ''), excluded.nome),
      perfil = coalesce(nullif(public.profiles.perfil, ''), excluded.perfil),
      owner_user_id = coalesce(public.profiles.owner_user_id, excluded.owner_user_id),
      fazenda_id = coalesce(public.profiles.fazenda_id, excluded.fazenda_id),
      updated_at = timezone('utc', now());

    update public.invites
       set status = 'aceito', used_by = new.id, used_at = now(), updated_at = now()
     where id = invited_record.id;
  else
    insert into public.profiles (id, email, nome, perfil, owner_user_id, created_at, updated_at)
    values (new.id, new.email, resolved_name, 'admin', new.id, timezone('utc', now()), timezone('utc', now()))
    on conflict (id) do update set
      email = excluded.email,
      nome = coalesce(nullif(public.profiles.nome, ''), excluded.nome),
      perfil = coalesce(nullif(public.profiles.perfil, ''), excluded.perfil),
      owner_user_id = coalesce(public.profiles.owner_user_id, excluded.owner_user_id),
      updated_at = timezone('utc', now());
  end if;

  return new;
exception
  when others then
    raise warning 'HERDON handle_new_user_profile failed for user %, error: %', new.id, sqlerrm;
    return new;
end;
$function$;

-- ============================================================
-- 4) RPC de aceite para usuario JA autenticado (conta existente recebendo
-- convite para outra conta/fazenda). Valida tudo no servidor: convite
-- existe, pendente, nao expirado, e-mail autenticado bate com o do
-- convite. Bloqueia se o usuario atual ja e proprietario de equipe propria
-- (evita deixar uma conta orfa sem nenhum proprietario).
-- ============================================================
create or replace function public.aceitar_convite_equipe(p_invite_id uuid)
returns table(sucesso boolean, owner_user_id uuid, fazenda_id bigint, perfil text, motivo text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    return query select false, null::uuid, null::bigint, null::text, 'nao_autenticado';
    return;
  end if;

  select u.email into v_email from auth.users u where u.id = auth.uid();

  select * into v_invite
    from public.invites
   where id = p_invite_id
   for update;

  if not found then
    return query select false, null::uuid, null::bigint, null::text, 'convite_nao_encontrado';
    return;
  end if;

  if v_invite.status <> 'pendente' then
    return query select false, null::uuid, null::bigint, null::text, 'convite_ja_usado_ou_invalido';
    return;
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    update public.invites set status = 'expirado', updated_at = now() where id = v_invite.id;
    return query select false, null::uuid, null::bigint, null::text, 'convite_expirado';
    return;
  end if;

  if lower(v_email) is distinct from lower(v_invite.email) then
    return query select false, null::uuid, null::bigint, null::text, 'email_nao_corresponde';
    return;
  end if;

  if exists (
    select 1 from public.profiles
     where owner_user_id = auth.uid()
       and id <> auth.uid()
  ) then
    return query select false, null::uuid, null::bigint, null::text, 'possui_equipe_propria';
    return;
  end if;

  perform set_config('app.bypass_autoescalada_convite', 'on', true);

  update public.profiles
     set owner_user_id = v_invite.owner_user_id,
         perfil = v_invite.perfil,
         fazenda_id = v_invite.fazenda_id,
         updated_at = now()
   where id = auth.uid();

  update public.invites
     set status = 'aceito', used_by = auth.uid(), used_at = now(), updated_at = now()
   where id = v_invite.id;

  return query select true, v_invite.owner_user_id, v_invite.fazenda_id, v_invite.perfil, null::text;
end;
$$;

revoke all on function public.aceitar_convite_equipe(uuid) from public;
revoke all on function public.aceitar_convite_equipe(uuid) from anon;
grant execute on function public.aceitar_convite_equipe(uuid) to authenticated;

-- ============================================================
-- 5) RLS por fazenda — só nas tabelas com coluna fazenda_id/faz_id direta
-- do MESMO tipo/referencia de public.fazendas.id (bigint). Checado ao vivo
-- antes de escrever isto: cenarios.fazenda_id e cenario_eventos.fazenda_id
-- sao uuid, sem FK declarada — nao e o mesmo fazendas.id bigint usado no
-- resto do app (provavelmente um id legado de sincronizacao, cloud_id) — por
-- isso ficam de fora, junto com o gap ja conhecido. pastagens tem as DUAS
-- colunas (fazenda_id uuid legado E faz_id bigint) — usa-se faz_id, igual a
-- lotes/lote_pastagens_historico.
--
-- app_current_fazenda_id() é null para todo mundo enquanto nenhum convite
-- definir fazenda_id (coluna nova) — rollout sem efeito imediato em nenhuma
-- conta existente. Tabelas sem coluna direta utilizavel (pesagens,
-- movimentacoes_estoque, movimentacoes_animais, alertas_resolvidos,
-- alertas_adiados, cenarios, cenario_eventos) ficam de fora, de proposito —
-- documentado como pendencia (mitigado hoje só no app por
-- src/domain/escopoFazenda.js para as tabelas com lote_id/item_estoque_id).
-- Tabelas de assinatura/Telegram tambem ficam de fora (fora do escopo deste
-- ticket).
-- ============================================================
create or replace function public.app_current_fazenda_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select p.fazenda_id from public.profiles p where p.id = auth.uid() limit 1
$$;

create or replace function public.app_can_access_fazenda(target_fazenda_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.app_current_fazenda_id() is null
    or target_fazenda_id is null
    or target_fazenda_id = public.app_current_fazenda_id()
$$;

do $$
declare
  table_name text;
  fazenda_column_tables text[] := array[
    'animais', 'custos', 'estoque', 'sanitario', 'tarefas', 'rotinas',
    'funcionarios', 'consumo_suplementacao',
    'movimentacoes_financeiras', 'alertas_tratativas'
  ];
  faz_column_tables text[] := array['lotes', 'lote_pastagens_historico', 'pastagens'];
begin
  foreach table_name in array fazenda_column_tables loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_same_account', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.app_is_same_account(owner_user_id) and public.app_can_access_fazenda(fazenda_id))',
      table_name || '_select_same_account', table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_insert_same_account', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.app_is_same_account(owner_user_id) and public.app_can_access_fazenda(fazenda_id))',
      table_name || '_insert_same_account', table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_update_same_account', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.app_is_same_account(owner_user_id) and public.app_can_access_fazenda(fazenda_id)) with check (public.app_is_same_account(owner_user_id) and public.app_can_access_fazenda(fazenda_id))',
      table_name || '_update_same_account', table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_delete_same_account', table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.app_is_same_account(owner_user_id) and public.app_can_access_fazenda(fazenda_id))',
      table_name || '_delete_same_account', table_name
    );
  end loop;

  foreach table_name in array faz_column_tables loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_same_account', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.app_is_same_account(owner_user_id) and public.app_can_access_fazenda(faz_id))',
      table_name || '_select_same_account', table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_insert_same_account', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.app_is_same_account(owner_user_id) and public.app_can_access_fazenda(faz_id))',
      table_name || '_insert_same_account', table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_update_same_account', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.app_is_same_account(owner_user_id) and public.app_can_access_fazenda(faz_id)) with check (public.app_is_same_account(owner_user_id) and public.app_can_access_fazenda(faz_id))',
      table_name || '_update_same_account', table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_delete_same_account', table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.app_is_same_account(owner_user_id) and public.app_can_access_fazenda(faz_id))',
      table_name || '_delete_same_account', table_name
    );
  end loop;
end $$;

-- fazendas: recorte pelo proprio id (nao ha coluna fazenda_id/faz_id, a
-- linha inteira e a fazenda).
drop policy if exists fazendas_select_same_account on public.fazendas;
create policy fazendas_select_same_account on public.fazendas
  for select to authenticated
  using (public.app_is_same_account(owner_user_id) and public.app_can_access_fazenda(id));

drop policy if exists fazendas_update_same_account on public.fazendas;
create policy fazendas_update_same_account on public.fazendas
  for update to authenticated
  using (public.app_is_same_account(owner_user_id) and public.app_can_access_fazenda(id))
  with check (public.app_is_same_account(owner_user_id) and public.app_can_access_fazenda(id));
