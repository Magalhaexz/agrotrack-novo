-- P1-11-RLS — completa o isolamento por fazenda para tabelas sem coluna
-- fazenda_id/faz_id direta, mas com FK real e confirmada para lotes/estoque.
--
-- Confirmado ao vivo antes de escrever qualquer policy (information_schema +
-- pg_constraint no projeto real, não suposição):
--   pesagens.lote_id                    -> lotes.id            (FK real)
--   movimentacoes_animais.lote_id        -> lotes.id            (FK real, origem)
--   movimentacoes_animais.destino_lote_id -> lotes.id           (FK real, destino)
--   movimentacoes_estoque.item_estoque_id -> estoque.id         (FK real)
--   movimentacoes_estoque.lote_id        -> lotes.id            (FK real, quando presente)
-- Todas as colunas acima são NULLABLE; dados reais hoje não têm nenhuma
-- linha nula (pesagens: 0/23, movimentacoes_animais: 0/2, movimentacoes_estoque:
-- 0/3), mas a policy trata null como "sem fazenda vinculada" (mesma
-- convenção de fallback já usada em app_can_access_fazenda para colunas
-- diretas) em vez de esconder a linha de todo mundo, inclusive do
-- proprietário — evita quebrar acesso legítimo caso um registro legado
-- apareça sem o vínculo.
--
-- NÃO recebem policy nesta migration, por falta de relação comprovável:
--   cenarios.fazenda_id / cenario_eventos.fazenda_id são uuid, SEM foreign
--   key declarada — não é o mesmo fazendas.id (bigint) usado no resto do
--   app. cenarios.lote_id também É bigint (mesmo tipo de lotes.id), mas
--   confirmado via pg_constraint que também NÃO tem FK declarada — ou seja,
--   nada garante que aponta de fato para uma linha real de lotes. Usar
--   qualquer um dos dois seria inventar uma relação não comprovada, que o
--   ticket proíbe explicitamente. Documentado como bloqueio; requer decisão
--   de produto (confirmar a semântica real de fazenda_id/lote_id em
--   cenarios) antes de qualquer policy.
--
--   alertas_resolvidos e alertas_adiados NÃO têm nenhuma foreign key (nem
--   para lotes, nem para estoque, nem qualquer coluna de fazenda) —
--   confirmado via pg_constraint, zero FKs nas duas tabelas. A única pista
--   de contexto é um campo de texto livre (chave/ack_key) usado como
--   heurística pelo motor de alertas no app (não uma referência estruturada
--   no banco). Isolar por fazenda exigiria fazer parsing desse texto dentro
--   de uma RLS policy — frágil e fora do que pode ser comprovado com
--   segurança. O ticket original assumia que essas duas tabelas teriam uma
--   fazenda derivável; a investigação mostrou que não têm. Documentado como
--   bloqueio; recomenda-se um ticket específico para decidir se vale
--   adicionar uma coluna estruturada de fazenda a essas tabelas (fora do
--   escopo deste ticket, que proíbe criar novas colunas sem necessidade
--   comprovada).

-- ============================================================
-- pesagens (via lote_id)
-- ============================================================
drop policy if exists pesagens_select_same_account on public.pesagens;
create policy pesagens_select_same_account on public.pesagens
  for select to authenticated
  using (
    public.app_is_same_account(owner_user_id)
    and (
      lote_id is null
      or exists (select 1 from public.lotes l where l.id = lote_id and public.app_can_access_fazenda(l.faz_id))
    )
  );

drop policy if exists pesagens_insert_same_account on public.pesagens;
create policy pesagens_insert_same_account on public.pesagens
  for insert to authenticated
  with check (
    public.app_is_same_account(owner_user_id)
    and (
      lote_id is null
      or exists (select 1 from public.lotes l where l.id = lote_id and public.app_can_access_fazenda(l.faz_id))
    )
  );

drop policy if exists pesagens_update_same_account on public.pesagens;
create policy pesagens_update_same_account on public.pesagens
  for update to authenticated
  using (
    public.app_is_same_account(owner_user_id)
    and (
      lote_id is null
      or exists (select 1 from public.lotes l where l.id = lote_id and public.app_can_access_fazenda(l.faz_id))
    )
  )
  with check (
    public.app_is_same_account(owner_user_id)
    and (
      lote_id is null
      or exists (select 1 from public.lotes l where l.id = lote_id and public.app_can_access_fazenda(l.faz_id))
    )
  );

drop policy if exists pesagens_delete_same_account on public.pesagens;
create policy pesagens_delete_same_account on public.pesagens
  for delete to authenticated
  using (
    public.app_is_same_account(owner_user_id)
    and (
      lote_id is null
      or exists (select 1 from public.lotes l where l.id = lote_id and public.app_can_access_fazenda(l.faz_id))
    )
  );

-- ============================================================
-- movimentacoes_animais (via lote_id origem + destino_lote_id destino —
-- os dois precisam estar no escopo do membro quando presentes).
-- ============================================================
drop policy if exists movimentacoes_animais_select_same_account on public.movimentacoes_animais;
create policy movimentacoes_animais_select_same_account on public.movimentacoes_animais
  for select to authenticated
  using (
    public.app_is_same_account(owner_user_id)
    and (lote_id is null or exists (select 1 from public.lotes l where l.id = lote_id and public.app_can_access_fazenda(l.faz_id)))
    and (destino_lote_id is null or exists (select 1 from public.lotes l where l.id = destino_lote_id and public.app_can_access_fazenda(l.faz_id)))
  );

drop policy if exists movimentacoes_animais_insert_same_account on public.movimentacoes_animais;
create policy movimentacoes_animais_insert_same_account on public.movimentacoes_animais
  for insert to authenticated
  with check (
    public.app_is_same_account(owner_user_id)
    and (lote_id is null or exists (select 1 from public.lotes l where l.id = lote_id and public.app_can_access_fazenda(l.faz_id)))
    and (destino_lote_id is null or exists (select 1 from public.lotes l where l.id = destino_lote_id and public.app_can_access_fazenda(l.faz_id)))
  );

drop policy if exists movimentacoes_animais_update_same_account on public.movimentacoes_animais;
create policy movimentacoes_animais_update_same_account on public.movimentacoes_animais
  for update to authenticated
  using (
    public.app_is_same_account(owner_user_id)
    and (lote_id is null or exists (select 1 from public.lotes l where l.id = lote_id and public.app_can_access_fazenda(l.faz_id)))
    and (destino_lote_id is null or exists (select 1 from public.lotes l where l.id = destino_lote_id and public.app_can_access_fazenda(l.faz_id)))
  )
  with check (
    public.app_is_same_account(owner_user_id)
    and (lote_id is null or exists (select 1 from public.lotes l where l.id = lote_id and public.app_can_access_fazenda(l.faz_id)))
    and (destino_lote_id is null or exists (select 1 from public.lotes l where l.id = destino_lote_id and public.app_can_access_fazenda(l.faz_id)))
  );

drop policy if exists movimentacoes_animais_delete_same_account on public.movimentacoes_animais;
create policy movimentacoes_animais_delete_same_account on public.movimentacoes_animais
  for delete to authenticated
  using (
    public.app_is_same_account(owner_user_id)
    and (lote_id is null or exists (select 1 from public.lotes l where l.id = lote_id and public.app_can_access_fazenda(l.faz_id)))
    and (destino_lote_id is null or exists (select 1 from public.lotes l where l.id = destino_lote_id and public.app_can_access_fazenda(l.faz_id)))
  );

-- ============================================================
-- movimentacoes_estoque (via item_estoque_id + lote_id quando presente —
-- os dois vínculos reais precisam estar no escopo do membro).
-- ============================================================
drop policy if exists movimentacoes_estoque_select_same_account on public.movimentacoes_estoque;
create policy movimentacoes_estoque_select_same_account on public.movimentacoes_estoque
  for select to authenticated
  using (
    public.app_is_same_account(owner_user_id)
    and (item_estoque_id is null or exists (select 1 from public.estoque e where e.id = item_estoque_id and public.app_can_access_fazenda(e.fazenda_id)))
    and (lote_id is null or exists (select 1 from public.lotes l where l.id = lote_id and public.app_can_access_fazenda(l.faz_id)))
  );

drop policy if exists movimentacoes_estoque_insert_same_account on public.movimentacoes_estoque;
create policy movimentacoes_estoque_insert_same_account on public.movimentacoes_estoque
  for insert to authenticated
  with check (
    public.app_is_same_account(owner_user_id)
    and (item_estoque_id is null or exists (select 1 from public.estoque e where e.id = item_estoque_id and public.app_can_access_fazenda(e.fazenda_id)))
    and (lote_id is null or exists (select 1 from public.lotes l where l.id = lote_id and public.app_can_access_fazenda(l.faz_id)))
  );

drop policy if exists movimentacoes_estoque_update_same_account on public.movimentacoes_estoque;
create policy movimentacoes_estoque_update_same_account on public.movimentacoes_estoque
  for update to authenticated
  using (
    public.app_is_same_account(owner_user_id)
    and (item_estoque_id is null or exists (select 1 from public.estoque e where e.id = item_estoque_id and public.app_can_access_fazenda(e.fazenda_id)))
    and (lote_id is null or exists (select 1 from public.lotes l where l.id = lote_id and public.app_can_access_fazenda(l.faz_id)))
  )
  with check (
    public.app_is_same_account(owner_user_id)
    and (item_estoque_id is null or exists (select 1 from public.estoque e where e.id = item_estoque_id and public.app_can_access_fazenda(e.fazenda_id)))
    and (lote_id is null or exists (select 1 from public.lotes l where l.id = lote_id and public.app_can_access_fazenda(l.faz_id)))
  );

drop policy if exists movimentacoes_estoque_delete_same_account on public.movimentacoes_estoque;
create policy movimentacoes_estoque_delete_same_account on public.movimentacoes_estoque
  for delete to authenticated
  using (
    public.app_is_same_account(owner_user_id)
    and (item_estoque_id is null or exists (select 1 from public.estoque e where e.id = item_estoque_id and public.app_can_access_fazenda(e.fazenda_id)))
    and (lote_id is null or exists (select 1 from public.lotes l where l.id = lote_id and public.app_can_access_fazenda(l.faz_id)))
  );
