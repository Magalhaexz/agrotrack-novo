# Segurança HERDON — Visão Geral (Sprint 30)

Este documento resume a auditoria de segurança final antes do QA autenticado e da liberação ao criador piloto. Detalhamento por área em documentos específicos (linkados abaixo).

## Resultado geral

**Postura de segurança: sólida.** Não foi encontrada nenhuma vulnerabilidade crítica (chave exposta, RLS ausente, endpoint sem autenticação). Foram encontradas e corrigidas duas lacunas reais de menor severidade, e documentadas pendências de defesa em profundidade que exigem decisão/teste humano antes de serem implementadas.

## 1. Supabase / RLS

Todas as 28 tabelas do schema têm RLS habilitado e forçado (`enable` + `force row level security`). Isolamento por conta via `app_is_same_account(owner_user_id)`, função `security definer` com `search_path` fixo (sem risco de *search path hijacking*). Detalhes completos, tabela por tabela: **[docs/RLS_AUDITORIA_HERDON.md](RLS_AUDITORIA_HERDON.md)**.

**Achado corrigido:** o script-fonte `docs/supabase-production-rls.sql` recriava policies de UPDATE/DELETE em `auditoria` (trilha de auditoria deveria ser só leitura/inserção — corrigido manualmente na Sprint 2, mas o script não tinha sido atualizado). Corrigido nesta sprint para nunca mais regredir isso se o script for re-executado. **Ação humana necessária:** confirmar no painel do Supabase que essas policies não existem hoje no banco vivo.

## 2. Isolamento entre contas

Confirmado por leitura de código (não testado em banco real — sem acesso). `owner_user_id` é o padrão único e consistente em todas as tabelas operacionais. RLS impede que uma conta veja ou escreva dados de outra. **Lacuna documentada (não corrigida):** RLS isola por conta, não por papel — um `visualizador` poderia, em teoria, escrever diretamente via API REST do Supabase contornando os botões desabilitados da interface (a interface já bloqueia isso corretamente; é uma lacuna de defesa em profundidade no banco, não uma falha ativa). Ver `docs/RLS_AUDITORIA_HERDON.md`.

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

## Resumo do que foi corrigido nesta sprint

| # | Achado | Severidade | Correção |
|---|---|---|---|
| 1 | Script RLS recriava UPDATE/DELETE em `auditoria` se re-executado | Baixa-média (regressão preventiva) | `docs/supabase-production-rls.sql` corrigido |
| 2 | `cloud-diagnostic.js` expunha contagem agregada entre contas | Baixa (não é PII, mas é vazamento de dado agregado da plataforma) | `api/cloud-diagnostic.js` corrigido + teste |

## Pendências para Sprint 31 (exigem decisão/ambiente humano)

- Confirmar no banco vivo que as policies de `auditoria` estão corretas (item 1 acima).
- Avaliar RLS por papel/perfil (defesa em profundidade) — requer mapeamento cuidadoso por tabela e teste em ambiente real antes de aplicar.
- Testar manualmente isolamento entre duas contas reais (login como conta A, confirmar que dados da conta B nunca aparecem).
- Verificar e, se necessário, limpar dados de QA manual remanescentes no banco de produção (ver checklist).
- Testar restauração de um backup do Supabase (nunca testado, só documentado).
