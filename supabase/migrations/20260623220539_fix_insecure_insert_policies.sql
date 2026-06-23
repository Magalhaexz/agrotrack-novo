-- Sprint 30.1 — corrige policies de INSERT sem restrição em cenario_eventos e
-- suplementacao. Ambas tinham uma policy "_same_account" com with_check(true),
-- ou seja, sem filtro nenhum — como policies permissivas são combinadas com OR,
-- isso anulava a policy "_own" correta ao lado e permitia que qualquer usuário
-- autenticado inserisse uma linha com o owner_user_id de outra conta.
-- Idempotente: seguro para rodar mais de uma vez. Não apaga nem altera dados
-- existentes — só corrige a regra de quem pode inserir uma linha nova.
--
-- Aplicada diretamente no Supabase real nesta sprint (apply_migration); este
-- arquivo é a reconciliação do histórico local com a versão remota.

drop policy if exists cenario_eventos_insert_same_account on public.cenario_eventos;
create policy cenario_eventos_insert_same_account on public.cenario_eventos
  for insert to authenticated
  with check (public.app_is_same_account(owner_user_id));

drop policy if exists suplementacao_insert_same_account on public.suplementacao;
create policy suplementacao_insert_same_account on public.suplementacao
  for insert to authenticated
  with check (public.app_is_same_account(owner_user_id));

-- Consistência de force row level security: estas 4 tabelas tinham
-- forcerowsecurity = false, diferente das demais 26 tabelas do schema, que já
-- usam force. Não afeta conexões normais do app (sempre usam o papel
-- "authenticated", que já respeita RLS independente do force); o force só
-- importa para o papel "owner" da tabela, que o app nunca usa diretamente.
-- Ainda assim, padroniza para o mesmo nível de proteção das demais tabelas.
alter table public.cenario_eventos force row level security;
alter table public.eventos_operacionais force row level security;
alter table public.lote_pastagens_historico force row level security;
alter table public.suplementacao force row level security;
