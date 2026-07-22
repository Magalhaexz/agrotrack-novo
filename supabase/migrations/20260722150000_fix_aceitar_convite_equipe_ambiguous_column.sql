-- P1-11-HOTFIX — corrige referencia ambigua em aceitar_convite_equipe.
--
-- RETURNS TABLE(..., owner_user_id uuid, ...) cria uma variavel PL/pgSQL
-- chamada owner_user_id, que colidia com a coluna profiles.owner_user_id no
-- guard "usuario ja tem equipe propria" (where owner_user_id = auth.uid()).
-- Toda chamada que chegava nesse ponto (convite pendente, e-mail correto)
-- falhava com ERROR 42702: column reference "owner_user_id" is ambiguous —
-- o caminho de aceite para usuario ja existente nunca funcionava. Unica
-- mudanca: qualifica a subquery com alias de tabela. Nenhuma outra linha,
-- validacao, guard ou assinatura muda.
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
    select 1 from public.profiles existing_profile
     where existing_profile.owner_user_id = auth.uid()
       and existing_profile.id <> auth.uid()
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
