-- Bug bash (permissoes): a migration anterior (20260713193754) so gateou as
-- policies "_same_account" (app_is_same_account). As policies legadas
-- "_own" (owner_user_id = auth.uid()) ficaram de fora porque usam outro
-- texto de qual/with_check -- e sao TRUE pra qualquer usuario autenticado
-- que grave um registro com owner_user_id = seu proprio auth.uid(),
-- independente de perfil. Reproduzido: um membro convidado como
-- "visualizador" conseguia inserir em `lotes` via essa policy, contornando
-- o gate de escrita inteiro.
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
      and cmd in ('INSERT', 'UPDATE', 'DELETE')
      and (
        qual = '(owner_user_id = auth.uid())'
        or with_check = '(owner_user_id = auth.uid())'
      )
  loop
    if pol.cmd = 'INSERT' then
      execute format(
        'alter policy %I on public.%I with check (owner_user_id = auth.uid() and app_current_role_can_write());',
        pol.policyname, pol.tablename
      );
    elsif pol.cmd = 'DELETE' then
      execute format(
        'alter policy %I on public.%I using (owner_user_id = auth.uid() and app_current_role_can_write());',
        pol.policyname, pol.tablename
      );
    elsif pol.cmd = 'UPDATE' then
      execute format(
        'alter policy %I on public.%I using (owner_user_id = auth.uid() and app_current_role_can_write()) with check (owner_user_id = auth.uid() and app_current_role_can_write());',
        pol.policyname, pol.tablename
      );
    end if;
  end loop;
end $$;
