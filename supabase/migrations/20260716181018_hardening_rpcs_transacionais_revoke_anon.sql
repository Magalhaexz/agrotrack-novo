-- Sprint Paridade 1, bloco 4 (ativação) — correção de segurança encontrada ao
-- validar a migration anterior (20260716120000) contra o schema/grants reais
-- depois de aplicada. Não editamos a migration anterior — esta é a migration
-- de avanço com o fix.
--
-- ACHADO: `REVOKE ALL ... FROM PUBLIC` não remove o `EXECUTE` que o Supabase
-- concede por padrão a `anon`/`authenticated`/`service_role` via ALTER
-- DEFAULT PRIVILEGES do schema `public` — é um GRANT separado por role, não
-- uma herança de PUBLIC. Resultado real após aplicar a migration anterior:
-- `anon` (chamador totalmente não autenticado) tinha EXECUTE nas 8 funções
-- novas. Como `app_assert_owner_write` só validava a conta quando
-- `auth.role() = 'authenticated'`, um chamador `anon` caía no ramo "confia
-- no parâmetro" (pensado para o service-role do bot) e podia informar
-- QUALQUER `p_owner_user_id` — uma escrita cross-conta completa, sem login.
-- Já revogado manualmente em produção no momento do achado (REVOKE EXECUTE
-- ... FROM anon, para as 8 funções); esta migration registra o fix e
-- endurece a função em si (defesa em profundidade: só confia no parâmetro
-- quando o chamador é literalmente o service_role; authenticated é
-- validado; qualquer outro papel — anon incluído — é negado explicitamente,
-- em vez do padrão anterior "nega só quando é authenticated e falha a
-- checagem").

revoke execute on function public.app_assert_owner_write(uuid) from anon;
revoke execute on function public.registrar_saida_lote(uuid, bigint, text, numeric, numeric, numeric, numeric, date, text, text, bigint, numeric) from anon;
revoke execute on function public.ajustar_lotacao_lote(uuid, bigint, numeric, text, date) from anon;
revoke execute on function public.finalizar_lote(uuid, bigint, text, date, date, text) from anon;
revoke execute on function public.mover_lote_para_pasto_bot(uuid, bigint, uuid, date, numeric, text, text) from anon;
revoke execute on function public.editar_ultima_pesagem_lote(uuid, bigint, numeric, date, text) from anon;
revoke execute on function public.excluir_ultima_pesagem_lote(uuid, bigint) from anon;
revoke execute on function public.criar_lote_completo(uuid, bigint, text, numeric, text, text, uuid, numeric, date, text, text, text, numeric) from anon;

create or replace function public.app_assert_owner_write(p_owner_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := auth.role();
begin
  if p_owner_user_id is null then
    raise exception 'owner_user_id obrigatório.' using errcode = '22004';
  end if;

  -- service_role (bot do Telegram): sem auth.uid() aqui — confia no
  -- owner_user_id porque a checagem de perfil já aconteceu em JS antes de
  -- chamar a RPC (mesma fronteira de confiança que aplicarWrites já usa).
  if v_role = 'service_role' then
    return;
  end if;

  if v_role = 'authenticated' then
    if not public.app_is_same_account(p_owner_user_id) then
      raise exception 'Não pertence à sua conta.' using errcode = '42501';
    end if;
    if not public.app_current_role_can_write() then
      raise exception 'Sem permissão de escrita.' using errcode = '42501';
    end if;
    return;
  end if;

  -- Qualquer outro papel (anon, ou qualquer coisa inesperada) é negado
  -- explicitamente — nunca cai no ramo de "confiar no parâmetro".
  raise exception 'Não autorizado.' using errcode = '42501';
end;
$$;
