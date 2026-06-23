# Checklist Pré-Piloto (Sprint 30, atualizado na Sprint 30.1)

Itens objetivos para confirmar antes de liberar o acesso ao criador piloto. `[x]` = confirmado (Sprint 30 por auditoria de código; Sprint 30.1 com acesso real ao Supabase) · `[ ]` = exige ação/verificação humana.

## CI/GitHub

- [x] Divergência de migrations (causa do erro "Remote migration versions not found in local migrations directory") reconciliada (Sprint 30.1).
- [ ] Confirmar que o check "Supabase Preview" do GitHub passa após "Re-run checks" (não pude disparar isso eu mesmo).

## Infraestrutura e deploy

- [ ] Deploy mais recente (`d3575b3` em diante, incluindo o commit desta sprint) publicado em produção na Vercel.
- [ ] Variáveis de ambiente de produção configuradas na Vercel (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_*`, `VITE_*`) — conferir contra `.env.example` e `docs/ENV_VARS_HERDON.md`.
- [x] Nenhuma chave/segredo real commitada no repositório (auditado nesta sprint — ver `docs/SEGURANCA_HERDON.md`).

## Segurança e RLS

- [x] RLS revisado e **validado ao vivo** — todas as 30 tabelas reais com RLS habilitado (Sprint 30.1, consulta direta a `pg_class`/`pg_policies`; ver `docs/RLS_AUDITORIA_HERDON.md`).
- [x] Falha real de INSERT sem restrição em `cenario_eventos`/`suplementacao` corrigida e confirmada no banco real (Sprint 30.1, migration `20260623220539`).
- [x] `forcerowsecurity` padronizado nas 4 tabelas que estavam divergentes (Sprint 30.1).
- [x] Confirmado no banco real (não só no script): `auditoria` não tem policies de UPDATE/DELETE (Sprint 30.1).
- [ ] Testar manualmente com duas contas reais: login como conta A, confirmar que nenhum dado da conta B aparece em nenhuma tela.
- [ ] Rodar `supabase migration repair --status applied 20260618000000` com CLI autenticado (pendência da reconciliação de migrations, ver `docs/SUPABASE_PREVIEW_RECONCILIACAO.md`).
- [ ] Avaliar avisos do `get_advisors` do Supabase (funções RPC expostas, search_path de triggers, proteção de senha vazada) — nenhum crítico, mas pendente de revisão dedicada.
- [x] Service role nunca aparece em código frontend (auditado).

## Asaas / cobrança

- [x] `ASAAS_ENV` continua `sandbox` (não alterado nesta sprint nem em nenhuma anterior).
- [x] Cobrança real desativada — nenhuma URL/chave de produção configurada.
- [ ] Confirmar nas variáveis de ambiente da Vercel (produção) que `ASAAS_ENV` está de fato como esperado para o estágio atual do piloto (sandbox, a menos que humanamente decidido o contrário).

## Conta piloto e acesso

- [ ] Conta piloto criada e definida (e-mail do criador real).
- [ ] Acesso `internal_test` concedido via `supabase/sql/grant_pilot_access.sql` (script já existe e é seguro — requer execução manual com o UUID do piloto).
- [x] Confirmado que contas `internal_test` nunca são bloqueadas pelo fluxo de assinatura (ver `docs/ASSINATURAS_HERDON.md`, Sprint 28).

## Orientação e suporte

- [x] Guia do Criador disponível dentro do app (Sprint 26).
- [x] Página de Suporte disponível no menu, com e-mail e mensagem de feedback sugerida (Sprint 26).
- [ ] Confirmar visualmente, com a conta piloto, que o Guia e o Suporte abrem corretamente.

## Dados e limpeza

- [ ] Verificar no banco de produção se restam registros de QA manual (contas de teste, fazendas/lotes fictícios usados em testes anteriores) e limpar se encontrados — **não apagar nada sem confirmar antes que não é dado de um cliente real.**
- [x] Confirmado por busca em código: nenhum dado fictício é inserido automaticamente em produção (scripts de teste E2E geram só arquivos locais, nunca tocam o banco real).

## Backup

- [x] Documentação de backup/recuperação criada (`docs/BACKUP_RECUPERACAO_HERDON.md`).
- [ ] Confirmar que o plano Supabase em uso tem backups diários automáticos ativos.
- [ ] Testar ao menos uma vez um restore de backup em ambiente de teste (nunca feito).

## QA visual e funcional

- [ ] QA visual autenticado executado (Dashboard, Pastos, Lotes, Pesagens, Financeiro, Relatórios, Sincronização, Guia do Criador, Planos/Assinatura) — pendência recorrente desde a Sprint 22, nenhuma sprint conseguiu fazer isso por falta de credenciais de teste.
- [ ] Importação de dados testada com uma planilha real (ou a planilha de teste E2E).
- [ ] Modo offline testado (registrar algo sem internet, confirmar sincronização ao reconectar).
- [ ] Relatórios testados (gerar PDF e resumo WhatsApp de pelo menos um relatório).
- [ ] Mobile testado em dispositivo real (não apenas DevTools) — confirmar que a correção do menu "Mais opções" (Sprint 29) funciona em Safari iOS real, não só medido via simulação de CSS.

## Resumo

A maioria dos itens de **código/configuração** já foi auditada e confirmada nesta sprint. A maioria dos itens **pendentes** depende de acesso a produção, banco real, ou um dispositivo/conta de teste — nenhum deles pôde ser executado nesta sessão por falta de credenciais (mesma limitação documentada em todas as sprints desde a 22). Recomenda-se que uma pessoa com acesso ao Supabase/Vercel percorra esta lista marcando os itens `[ ]` antes de liberar o piloto.
