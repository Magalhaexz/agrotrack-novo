-- P1-01 — Pareamento Telegram atômico e idempotente.
--
-- Hoje (api/telegram-webhook.js) o pareamento por código HERDON-XXXXXX é uma
-- sequência de chamadas Supabase independentes: lê o código, valida em JS,
-- grava telegram_connections, envia a mensagem de sucesso e só depois marca
-- used_at (ignorando erro nessa última etapa). Duas requisições concorrentes
-- para o mesmo código podem ambas passar pela validação antes de qualquer
-- uma marcar o código como usado — duas conexões válidas para um código que
-- deveria valer uma única vez. Esta RPC move as etapas 2–5 para dentro de
-- uma única transação, travando a linha do código com `FOR UPDATE`: a
-- segunda requisição concorrente só enxerga o código depois que a primeira
-- já commitou `used_at`, e portanto sempre falha a validação.
--
-- SECURITY DEFINER pelo mesmo motivo de 20260716180853 (RPCs transacionais
-- de lote/pesagem): quem chama é sempre o service-role do webhook
-- (getSupabaseAdminClient), não um usuário autenticado — RLS não entra em
-- jogo. Diferente daquelas RPCs, esta não recebe p_owner_user_id do chamador
-- (não há usuário autenticado no webhook do Telegram) e por isso não usa
-- app_assert_owner_write; a autorização aqui é só "quem pode executar a
-- função" — grant restrito a service_role, seguindo a correção de
-- 20260716181018 (revoke explícito de anon/authenticated, já que o Supabase
-- concede EXECUTE por padrão a esses papéis independente de REVOKE ... FROM
-- PUBLIC).
create or replace function public.parear_telegram_por_codigo(
  p_code text,
  p_chat_id text,
  p_username text default null,
  p_first_name text default null,
  p_last_name text default null
)
returns table(
  sucesso boolean,
  connection_id uuid,
  owner_user_id uuid,
  fazenda_id bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code public.telegram_connection_codes%rowtype;
  v_connection_id uuid;
begin
  select * into v_code
    from public.telegram_connection_codes
   where code = p_code
   for update;

  if not found or v_code.used_at is not null or v_code.expires_at <= now() then
    return query select false, null::uuid, null::uuid, null::bigint;
    return;
  end if;

  insert into public.telegram_connections (
    owner_user_id, user_id, fazenda_id, telegram_chat_id,
    telegram_username, telegram_first_name, telegram_last_name, is_active
  ) values (
    v_code.owner_user_id, v_code.user_id, v_code.fazenda_id, p_chat_id,
    p_username, p_first_name, p_last_name, true
  )
  on conflict (user_id) do update set
    owner_user_id = excluded.owner_user_id,
    fazenda_id = excluded.fazenda_id,
    telegram_chat_id = excluded.telegram_chat_id,
    telegram_username = excluded.telegram_username,
    telegram_first_name = excluded.telegram_first_name,
    telegram_last_name = excluded.telegram_last_name,
    is_active = true
  returning id into v_connection_id;

  update public.telegram_connection_codes
     set used_at = now()
   where id = v_code.id;

  return query select true, v_connection_id, v_code.owner_user_id, v_code.fazenda_id;
end;
$$;

revoke all on function public.parear_telegram_por_codigo(text, text, text, text, text) from public;
revoke execute on function public.parear_telegram_por_codigo(text, text, text, text, text) from anon, authenticated;
grant execute on function public.parear_telegram_por_codigo(text, text, text, text, text) to service_role;
