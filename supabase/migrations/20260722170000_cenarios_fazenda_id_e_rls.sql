-- P1-13 — Modela referência de fazenda para cenarios/cenario_eventos.
--
-- Decisão de modelagem (confirmada com o usuário antes de aplicar, dado que
-- exigia escolha de produto):
--
-- 1) cenarios.fazenda_id (uuid) NÃO tem FK e não corresponde a fazendas.id
--    (bigint) — confirmado ao vivo (pg_constraint), zero linhas o usam hoje
--    (a única linha real da tabela tem fazenda_id e lote_id nulos). Em vez
--    de reaproveitar ou inventar o significado desse uuid, ele é RENOMEADO
--    (dado preservado, nenhuma linha é descartada) para liberar o nome
--    canônico `fazenda_id` para uma coluna nova, corretamente tipada
--    (bigint, FK real para fazendas.id).
--
-- 2) cenarios.lote_id (bigint, mesmo tipo de lotes.id) também não tem FK
--    declarada e não é usado por nenhuma policy nesta migration — fica como
--    está, fora de escopo (não é necessário para a relação de fazenda que
--    este ticket pede).
--
-- 3) A feature de Cenários (src/domain/projecaoCenario.js,
--    src/domain/simuladorCenarios.js, src/pages/CenariosPage.jsx) não tem
--    NENHUMA dimensão de fazenda hoje — nenhum seletor na tela, nenhuma
--    referência no domínio. O novo fazenda_id fica nullable e começa null
--    para tudo (mesmo padrão de rollout do P1-11): zero efeito prático até
--    uma tela futura popular o campo. Adicionar esse seletor de UI está fora
--    do escopo deste ticket ("não alterar layout") — modelo de banco pronto,
--    população real fica para um ticket futuro dedicado.
--
-- 4) cenario_eventos já tem FK real para cenarios via cenario_id (confirmado
--    no P1-11-RLS) — a fazenda é derivada transitivamente por esse vínculo
--    já existente. Não precisa de nenhuma coluna nova. O `fazenda_id` (uuid)
--    próprio de cenario_eventos continua sem uso/sem FK, não é tocado nem
--    usado por nenhuma policy (tabela com 0 linhas hoje).
--
-- 5) alertas_resolvidos/alertas_adiados NÃO recebem nenhuma mudança nesta
--    migration — confirmado que são tabelas retiradas de uso: o motor de
--    alertas foi unificado (comentário em src/App.jsx, linhas ~575-585) e
--    toda resolução/adiamento de alerta hoje grava exclusivamente em
--    alertas_tratativas (já protegida por fazenda desde o P1-11-RLS).
--    Confirmado via busca no código-fonte que nenhum caminho de escrita
--    ativo chama createOperationalRecord/updateOperationalRecord para essas
--    duas tabelas. São 12 e 4 linhas históricas, sem nenhuma coluna
--    estruturada de fazenda e sem relação segura derivável de `chave`/
--    `ack_key` (texto livre). Decisão confirmada com o usuário: documentar
--    como arquivo morto — permanecem só com o RLS same_account que já têm,
--    sem coluna nova e sem policy nova, para não inventar uma proteção que
--    nada popularia de verdade.

-- ============================================================
-- cenarios
-- ============================================================
alter table public.cenarios rename column fazenda_id to fazenda_id_legado_uuid;

comment on column public.cenarios.fazenda_id_legado_uuid is
  'P1-13: coluna uuid legada, sem FK, sem relação comprovada com fazendas.id — nunca populada (0 linhas). Preservada só para não descartar dado; não usar. Ver fazenda_id (bigint, com FK real).';

alter table public.cenarios
  add column fazenda_id bigint references public.fazendas (id) on delete set null;

drop policy if exists cenarios_select_same_account on public.cenarios;
create policy cenarios_select_same_account on public.cenarios
  for select to authenticated
  using (public.app_is_same_account(owner_user_id) and public.app_can_access_fazenda(fazenda_id));

drop policy if exists cenarios_insert_same_account on public.cenarios;
create policy cenarios_insert_same_account on public.cenarios
  for insert to authenticated
  with check (public.app_is_same_account(owner_user_id) and public.app_can_access_fazenda(fazenda_id));

drop policy if exists cenarios_update_same_account on public.cenarios;
create policy cenarios_update_same_account on public.cenarios
  for update to authenticated
  using (public.app_is_same_account(owner_user_id) and public.app_can_access_fazenda(fazenda_id))
  with check (public.app_is_same_account(owner_user_id) and public.app_can_access_fazenda(fazenda_id));

drop policy if exists cenarios_delete_same_account on public.cenarios;
create policy cenarios_delete_same_account on public.cenarios
  for delete to authenticated
  using (public.app_is_same_account(owner_user_id) and public.app_can_access_fazenda(fazenda_id));

-- ============================================================
-- cenario_eventos — fazenda derivada via cenario_id (FK real já existente).
-- ============================================================
drop policy if exists cenario_eventos_select_same_account on public.cenario_eventos;
create policy cenario_eventos_select_same_account on public.cenario_eventos
  for select to authenticated
  using (
    public.app_is_same_account(owner_user_id)
    and exists (
      select 1 from public.cenarios c
       where c.id = cenario_id and public.app_can_access_fazenda(c.fazenda_id)
    )
  );

drop policy if exists cenario_eventos_insert_same_account on public.cenario_eventos;
create policy cenario_eventos_insert_same_account on public.cenario_eventos
  for insert to authenticated
  with check (
    public.app_is_same_account(owner_user_id)
    and exists (
      select 1 from public.cenarios c
       where c.id = cenario_id and public.app_can_access_fazenda(c.fazenda_id)
    )
  );

drop policy if exists cenario_eventos_update_same_account on public.cenario_eventos;
create policy cenario_eventos_update_same_account on public.cenario_eventos
  for update to authenticated
  using (
    public.app_is_same_account(owner_user_id)
    and exists (
      select 1 from public.cenarios c
       where c.id = cenario_id and public.app_can_access_fazenda(c.fazenda_id)
    )
  )
  with check (
    public.app_is_same_account(owner_user_id)
    and exists (
      select 1 from public.cenarios c
       where c.id = cenario_id and public.app_can_access_fazenda(c.fazenda_id)
    )
  );

drop policy if exists cenario_eventos_delete_same_account on public.cenario_eventos;
create policy cenario_eventos_delete_same_account on public.cenario_eventos
  for delete to authenticated
  using (
    public.app_is_same_account(owner_user_id)
    and exists (
      select 1 from public.cenarios c
       where c.id = cenario_id and public.app_can_access_fazenda(c.fazenda_id)
    )
  );
