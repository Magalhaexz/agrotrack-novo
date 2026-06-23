# Segurança HERDON — Visão Geral (Sprint 30, validada ao vivo na Sprint 30.1)

Este documento resume a auditoria de segurança final antes do QA autenticado e da liberação ao criador piloto. Detalhamento por área em documentos específicos (linkados abaixo).

> **Sprint 30.1:** com acesso real ao Supabase (MCP reconectado), a auditoria de RLS foi **revalidada no banco de produção**, não só nos arquivos `.sql` versionados. Isso encontrou duas falhas reais que a Sprint 30 não conseguiu ver (por falta de acesso) — corrigidas nesta sprint. Ver `docs/SUPABASE_PREVIEW_RECONCILIACAO.md` para a reconciliação de migrations que motivou esta revisão.

## Resultado geral

**Postura de segurança: sólida, com duas falhas reais corrigidas nesta sprint.** Não há vulnerabilidade crítica restante conhecida (chave exposta, RLS ausente, endpoint sem autenticação). Foram corrigidas: (a) duas policies de INSERT sem restrição (`cenario_eventos`, `suplementacao`) que permitiam escrita entre contas — a falha mais séria encontrada em todo o projeto até agora — e (b) inconsistência de `forcerowsecurity` em 4 tabelas. Pendências de defesa em profundidade continuam documentadas para decisão humana.

## 1. Supabase / RLS

Todas as 30 tabelas do banco real (não 28 — duas existiam fora do bundle versionado) têm RLS habilitado. Isolamento por conta via `app_is_same_account(owner_user_id)`, função `security definer` com `search_path` fixo. Detalhes completos, validados ao vivo: **[docs/RLS_AUDITORIA_HERDON.md](RLS_AUDITORIA_HERDON.md)**.

**Achado real corrigido (Sprint 30.1):** `cenario_eventos_insert_same_account` e `suplementacao_insert_same_account` tinham `with_check: true` — sem filtro nenhum, anulando a policy correta ao lado. Qualquer usuário autenticado podia inserir uma linha nessas 2 tabelas com o `owner_user_id` de outra conta. Corrigido e confirmado no banco real via migration `20260623220539_fix_insecure_insert_policies`.

**Achado corrigido (Sprint 30, confirmado ao vivo na 30.1):** o script-fonte `docs/supabase-production-rls.sql` recriava policies de UPDATE/DELETE em `auditoria` se re-executado. Confirmado agora diretamente no banco: essas policies **não existem** hoje — o risco era só preventivo (script), nunca foi um problema ativo em produção.

**Achado corrigido (Sprint 30.1):** `forcerowsecurity = false` em 4 tabelas (`cenario_eventos`, `eventos_operacionais`, `lote_pastagens_historico`, `suplementacao`), inconsistente com as outras 26. Corrigido na mesma migration.

## 2. Isolamento entre contas

Confirmado **ao vivo no banco real** (Sprint 30.1, via `pg_policies`) — não só por leitura de código. `owner_user_id` é o padrão único e consistente. RLS impede que uma conta veja ou escreva dados de outra, **exceto pela falha do item 1 acima, agora corrigida**. **Lacuna documentada (não corrigida):** RLS isola por conta, não por papel — um `visualizador` poderia, em teoria, escrever diretamente via API REST do Supabase contornando os botões desabilitados da interface. Ver `docs/RLS_AUDITORIA_HERDON.md`.

## 3. Service role

`SUPABASE_SERVICE_ROLE_KEY` só é lida em `api/_supabaseAdmin.js` (`process.env`, nunca `import.meta.env`/`VITE_*`). Confirmado por busca em todo `src/`: a chave nunca aparece em código que vai para o bundle do navegador. `.env.example` só tem placeholders (`SERVER_ONLY_SERVICE_ROLE_KEY`), nenhuma chave real. Nenhum `.env` real está rastreado pelo git.

## 4. Variáveis de ambiente

Separação clara e respeitada entre `VITE_*` (cliente, público) e variáveis de servidor (nunca prefixadas com `VITE_`). Ver `.env.example` e `docs/ENV_VARS_HERDON.md` (já existente, sem necessidade de reescrita).

**Nota:** `VITE_HERDON_BOOTSTRAP_ADMIN_EMAILS` tem um fallback hardcoded (`magalhaesh617@gmail.com`) em `src/services/userAccess.js` se a variável não for configurada — já documentado em `.env.example` como opcional, com o fallback explicado. Não é uma chave/segredo (é só um e-mail), mas recomenda-se configurar a variável em produção para não depender do fallback de desenvolvimento.

## 5. Endpoints serverless

Todos os 5 endpoints (`asaas-create-customer`, `asaas-create-subscription`, `asaas-webhook`, `cloud-sync`, `cloud-diagnostic`) exigem autenticação (Bearer token do Supabase, ou token de webhook dedicado), rejeitam métodos inesperados, e não vazam erro técnico cru. Detalhes em **[docs/API_ENDPOINTS_HERDON.md](API_ENDPOINTS_HERDON.md)**.

**Achado corrigido:** `cloud-diagnostic.js` devolvia, para qualquer usuário autenticado, a contagem total de linhas de `lotes`/`fazendas` **de toda a plataforma** (não só da própria conta) — usado pelo client `service_role` para testar conectividade, mas a contagem agregada nunca era necessária e o frontend nunca a lia. Corrigido: a contagem agora só é devolvida quando filtrada pela própria conta do usuário.

## 6. Asaas / cobrança

Confirmado (auditoria já feita na Sprint 28, revalidada agora): ambiente sandbox por padrão (`ASAAS_ENV` não definido → `'sandbox'`), nenhuma URL/chave de produção configurada em código ou `.env.example`. Webhook valida token antes de processar. **Cobrança real continua desativada — nenhuma variável de ambiente foi alterada nesta sprint.** Detalhes: `docs/ASAAS_HERDON.md`.

## 7. Permissões por perfil

`src/auth/perfis.js`: proprietário (`*`), gerente, operador e visualizador têm conjuntos de permissões coerentes — visualizador só tem permissões `:ver` (nenhuma de criar/editar/excluir), operador tem permissões operacionais (lotes/animais/pesagens) mas não administrativas (fazendas, funcionários). Módulos recentes (`relatorios`, `pastagens`, `minhaAssinatura`, `importacao`) já têm entrada em `permissoesPorPagina`.

`guiaCriador` e `suporte` **intencionalmente** não têm entrada em `permissoesPorPagina` (decisão da Sprint 26: ausência de permissão = sempre permitido, para que ajuda/suporte nunca fiquem bloqueados por plano ou perfil). Não é uma lacuna, é projeto.

## 8. Logs sensíveis

Busca por `console.log/error/warn/debug` que imprimam token/chave/senha/payload completo: nenhuma ocorrência em `src/` ou `api/`. `api/_asaas.js` loga só presença booleana de variáveis de ambiente, nunca o valor. Logs de `AuthContext.jsx` são protegidos por `import.meta.env.DEV` (não vão para produção).

## 9. Dados de teste

Dados fictícios ("Fazenda Modelo HERDON", "HRD-001" etc.) existem apenas em scripts de geração de planilha E2E (`scripts/gerar-planilha-e2e.mjs`) e documentação de teste — nunca hardcoded em código-fonte, migrações ou schema. **Não há script de seed que insira dados fictícios no banco real.** Sem acesso ao banco de produção nesta sessão, não foi possível confirmar se sobraram registros de teste de QA manuais — ver `docs/CHECKLIST_PRE_PILOTO_HERDON.md` para o item de verificação manual.

## 10. Backup e recuperação

Documentado em **[docs/BACKUP_RECUPERACAO_HERDON.md](BACKUP_RECUPERACAO_HERDON.md)** (novo nesta sprint).

## Resumo do que foi corrigido

| # | Achado | Severidade | Sprint | Correção |
|---|---|---|---|---|
| 1 | INSERT sem restrição em `cenario_eventos`/`suplementacao` — escrita entre contas | **Alta** (falha ativa em produção) | 30.1 | Migration `20260623220539` aplicada no banco real |
| 2 | `forcerowsecurity = false` em 4 tabelas | Baixa | 30.1 | Mesma migration |
| 3 | Script RLS recriava UPDATE/DELETE em `auditoria` se re-executado | Baixa-média (preventivo; confirmado nunca ativo) | 30 / confirmado 30.1 | `docs/supabase-production-rls.sql` corrigido + confirmado no banco real |
| 4 | `cloud-diagnostic.js` expunha contagem agregada entre contas | Baixa | 30 | `api/cloud-diagnostic.js` corrigido + teste |

## Migrations — reconciliação (Sprint 30.1)

O check "Supabase Preview" do GitHub falhava com `Remote migration versions not found in local migrations directory` — 2 arquivos locais tinham conteúdo já aplicado no remoto mas com prefixo de versão diferente, e 1 migration local nunca foi registrada no remoto (aplicada via SQL direto). Reconciliado nesta sprint — detalhes completos em **[docs/SUPABASE_PREVIEW_RECONCILIACAO.md](SUPABASE_PREVIEW_RECONCILIACAO.md)**.

## Pendências para Sprint 31 (exigem decisão/ambiente humano)

- Rodar `supabase migration repair --status applied 20260618000000` com o CLI autenticado (não disponível nesta sessão) — última peça da reconciliação de migrations.
- Avaliar RLS por papel/perfil (defesa em profundidade) — requer mapeamento cuidadoso por tabela e teste em ambiente real antes de aplicar.
- Avaliar os avisos do `get_advisors` (funções `security definer` expostas via RPC para `anon`/`authenticated`, funções de trigger sem `search_path` fixo, proteção contra senha vazada desativada no Auth) — nenhum crítico, mas merecem revisão dedicada.
- Testar manualmente isolamento entre duas contas reais (login como conta A, confirmar que dados da conta B nunca aparecem) — agora ainda mais importante validar visualmente, já que a falha do item 1 era exatamente esse tipo de vazamento.
- Verificar e, se necessário, limpar dados de QA manual remanescentes no banco de produção (ver checklist).
- Testar restauração de um backup do Supabase (nunca testado, só documentado).
