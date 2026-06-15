# Checklist Pré-Produção — HERDON

> Gerado em 2026-06-15. Executar antes do lançamento público.  
> Status: `[ ]` pendente · `[→]` em andamento · `[✓]` concluído

---

## 1. Segurança Supabase

| # | Item | Verificação | Status |
|---|------|------------|--------|
| 1.1 | RLS habilitado em todas as tabelas | `SELECT schemaname, tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=false` → zero rows | `[✓]` Sprint 2 |
| 1.2 | Zero policies com `role = {public}` em tabelas operacionais | Ver `docs/SECURITY_FIXES_HERDON.md` | `[✓]` Sprint 2 |
| 1.3 | Audit trail imutável (`auditoria`) | Policies de UPDATE e DELETE removidas | `[✓]` Sprint 2 |
| 1.4 | Convites isolados por conta (`invites`) | Policy `qual: true` removida | `[✓]` Sprint 2 |
| 1.5 | Equipe da conta com acesso a `cenario_eventos` e `suplementacao` | Policies `_same_account` adicionadas | `[✓]` Sprint 2 |
| 1.6 | `fazendas` sem registros com `owner_user_id IS NULL` | Verificado: 0 registros null | `[✓]` Sprint 2 |
| 1.7 | Acesso anônimo desabilitado no Supabase | Dashboard → Auth → Settings → Disable anonymous sign-ins | `[ ]` Verificar |
| 1.8 | `service_role` key não exposta no frontend | Grep: `SUPABASE_SERVICE_ROLE_KEY` não pode estar em `VITE_*` | `[ ]` Verificar |
| 1.9 | RLS testado manualmente com usuário de conta diferente | Login como usuário B e tentar acessar dados de A → deve falhar | `[ ]` Testar |

---

## 2. Variáveis de ambiente

| # | Variável | Onde | Status |
|---|---------|------|--------|
| 2.1 | `VITE_SUPABASE_URL` | Vercel env | `[ ]` Confirmar produção |
| 2.2 | `VITE_SUPABASE_ANON_KEY` | Vercel env | `[ ]` Confirmar produção |
| 2.3 | `VITE_APP_URL` | Vercel env | `[ ]` Deve ser o domínio de produção (não localhost) |
| 2.4 | `VITE_CHECKOUT_URL` | Vercel env | `[ ]` URL da página de checkout em produção |
| 2.5 | `ASAAS_API_BASE_URL` | Vercel env (servidor) | `[ ]` Trocar para produção: `https://api.asaas.com/v3` |
| 2.6 | `ASAAS_API_KEY` | Vercel env (servidor) | `[ ]` Usar chave de produção (não sandbox) |
| 2.7 | `ASAAS_WEBHOOK_TOKEN` | Vercel env (servidor) | `[ ]` Token configurado no painel Asaas |
| 2.8 | `SUPABASE_URL` | Vercel env (servidor) | `[ ]` URL da API do projeto Supabase |
| 2.9 | `SUPABASE_SERVICE_ROLE_KEY` | Vercel env (servidor) | `[ ]` Chave de serviço (nunca expor no cliente) |
| 2.10 | `.env` removido do repositório | Git history check | `[✓]` Removido no PR #111 |

---

## 3. Asaas — Sandbox → Produção

| # | Item | Detalhe | Status |
|---|------|---------|--------|
| 3.1 | Ambiente trocado para produção | `ASAAS_API_BASE_URL=https://api.asaas.com/v3` | `[ ]` |
| 3.2 | API key de produção configurada | Painel Asaas → Conta → Chaves API | `[ ]` |
| 3.3 | Webhook configurado em produção | URL: `https://<domínio>/api/asaas-webhook` | `[ ]` |
| 3.4 | Planos criados no Asaas de produção | fundador, essencial, pro, premium | `[ ]` |
| 3.5 | IDs dos planos atualizados no código | `src/services/subscriptions.js` (ou equivalente) | `[ ]` Verificar |
| 3.6 | Teste de cobrança real com cartão de teste | Asaas tem ambiente de homologação separado | `[ ]` |

---

## 4. Autenticação e perfis

| # | Item | Verificação | Status |
|---|------|------------|--------|
| 4.1 | Trigger `on_auth_user_created` funcional | Criar conta nova → `user_profiles` deve ter novo registro | `[ ]` Testar |
| 4.2 | Perfil padrão `proprietario` criado no registro | `SELECT role FROM user_profiles WHERE user_id = '<novo_id>'` → `proprietario` | `[ ]` Testar |
| 4.3 | Função órfã `handle_new_user` removida | `SELECT proname FROM pg_proc WHERE proname = 'handle_new_user'` → zero rows (opcional) | `[ ]` P3 |
| 4.4 | Login por email funcional | Testar fluxo completo em produção | `[ ]` |
| 4.5 | Login Google funcional (se habilitado) | Testar OAuth callback | `[ ]` |
| 4.6 | Recuperação de senha funcional | Testar fluxo "Esqueci minha senha" | `[ ]` |
| 4.7 | Email de confirmação configurado | Supabase → Auth → Email Templates | `[ ]` |
| 4.8 | Domínio de produção nos allowed redirect URLs | Supabase → Auth → URL Configuration | `[ ]` |

---

## 5. RLS — Perfis e permissões por role

| # | Item | Verificação | Status |
|---|------|------------|--------|
| 5.1 | `proprietario` pode CRUD em todas as tabelas da conta | Testar manualmente | `[ ]` |
| 5.2 | `gerente` pode CRUD mas não pode deletar fazenda/conta | Testar manualmente | `[ ]` |
| 5.3 | `operador` pode criar/editar mas não pode gerenciar equipe | Testar manualmente | `[ ]` |
| 5.4 | `visualizador` pode apenas ler | Testar manualmente | `[ ]` |
| 5.5 | Membro de conta A não vê dados de conta B | Testar com dois usuários distintos | `[ ]` |
| 5.6 | Convites funcionam corretamente | Convidar membro → aceitar convite → verificar acesso | `[ ]` |

---

## 6. Planos e assinatura

| # | Item | Verificação | Status |
|---|------|------------|--------|
| 6.1 | Planos disponíveis (fundador, essencial, pro, premium) | Acessar `/checkout` | `[ ]` |
| 6.2 | Checkout com cartão funcionando | Testar com cartão real em produção | `[ ]` |
| 6.3 | Webhook de confirmação de pagamento | Asaas dispara → `user_profiles.subscription_status` atualizado | `[ ]` |
| 6.4 | Trial period funcionando (se configurado) | Criar conta → verificar estado de trial | `[ ]` |
| 6.5 | Bloqueio após trial expirado (se configurado) | Verificar acesso após expiração | `[ ]` |
| 6.6 | Página `/minha-assinatura` mostra status correto | Status, plano, próxima cobrança | `[ ]` |

---

## 7. Build e deploy

| # | Item | Verificação | Status |
|---|------|------------|--------|
| 7.1 | `npm run build` passa sem erros | Zero erros, zero warnings críticos | `[✓]` Pós-merge |
| 7.2 | `npm run lint` passa | Zero erros | `[✓]` Pós-merge |
| 7.3 | Build da Vercel disparado automaticamente | Commit em main → deploy automático | `[ ]` Verificar |
| 7.4 | Deploy em produção sem erro de runtime | Vercel → Deployments → checar logs | `[ ]` |
| 7.5 | CORS configurado corretamente | API functions aceitam requests do domínio de produção | `[ ]` |
| 7.6 | Headers de segurança configurados | `vercel.json` ou middleware com CSP, HSTS, X-Frame-Options | `[ ]` |

---

## 8. Domínio e TLS

| # | Item | Verificação | Status |
|---|------|------------|--------|
| 8.1 | Domínio de produção configurado na Vercel | Vercel → Settings → Domains | `[ ]` |
| 8.2 | Certificado TLS (HTTPS) válido | Navegador mostra cadeado, sem warnings | `[ ]` |
| 8.3 | Redirect HTTP → HTTPS funcionando | Acessar `http://` → deve redirecionar para `https://` | `[ ]` |
| 8.4 | Redirect `www` → apex (ou vice-versa) | Consistente com a preferência | `[ ]` |
| 8.5 | DNS propagado | `dig` ou `nslookup` | `[ ]` |

---

## 9. Legal e compliance

| # | Item | Verificação | Status |
|---|------|------------|--------|
| 9.1 | Política de privacidade publicada | URL acessível, em português, cobrindo dados coletados | `[ ]` |
| 9.2 | Termos de uso publicados | URL acessível, em português | `[ ]` |
| 9.3 | Links para política e termos no footer ou cadastro | Usuário vê antes de criar conta | `[ ]` |
| 9.4 | LGPD — dados coletados documentados | Quais dados, por quanto tempo, quem tem acesso | `[ ]` |
| 9.5 | Processo de exclusão de conta documentado | Usuário pode solicitar deleção de dados | `[ ]` |

---

## 10. Monitoramento e logs

| # | Item | Verificação | Status |
|---|------|------------|--------|
| 10.1 | Supabase logs habilitados | Dashboard → Logs — auth, database, edge functions | `[ ]` |
| 10.2 | Vercel Analytics ou alternativa configurada | Monitorar latência e erros | `[ ]` |
| 10.3 | Alertas de erro configurados | Sentry, Bugsnag, ou similar com notificação por email | `[ ]` |
| 10.4 | Processo de backup do banco documentado | Supabase faz backups diários no plano Pro | `[ ]` |
| 10.5 | Runbook de incidente mínimo | O que fazer se o app cair em produção | `[ ]` |

---

## 11. Qualidade — testes manuais finais (golden path)

| # | Fluxo | Detalhe | Status |
|---|-------|---------|--------|
| 11.1 | Cadastro de nova conta | Email → confirmação → login | `[ ]` |
| 11.2 | Criar fazenda | Formulário → cloud sync → aparece no dashboard | `[ ]` |
| 11.3 | Criar lote | Com animais → GMD calculado → aparecer em Lotes | `[ ]` |
| 11.4 | Registrar pesagem em lote | Peso registrado → GMD atualizado | `[ ]` |
| 11.5 | Registrar venda (movimentação financeira) | Venda → aparece em Financeiro → getResumoLote reflete | `[ ]` |
| 11.6 | Relatórios de lote | RelatorioLote.jsx mostra receita/margem corretas | `[ ]` |
| 11.7 | Comparativo de lotes | ComparativoPage mostra dados de múltiplos lotes | `[ ]` |
| 11.8 | Estoque — entrada e saída | Movimentação de estoque funciona end-to-end | `[ ]` |
| 11.9 | Convite de funcionário | Convidar → aceitar → login como funcionário → acesso correto | `[ ]` |
| 11.10 | Assinatura | Checkout → pagamento → plano ativo → acesso liberado | `[ ]` |

---

## Ordem de execução recomendada

1. **Ambiente:** Seções 2 (env vars) e 7 (build/deploy)
2. **Segurança:** Seções 1 (RLS) e 4 (auth) e 5 (permissões)
3. **Billing:** Seção 3 (Asaas) e 6 (planos)
4. **Domínio:** Seção 8
5. **Legal:** Seção 9
6. **Monitoramento:** Seção 10
7. **Testes:** Seção 11 (golden path completo)

---

## Critério de go/no-go

**Go:** Seções 1-8 completas + seção 11 (golden path sem bloqueadores críticos)  
**No-go:** Qualquer item das seções 1-3 pendente, ou falha nos fluxos 11.1-11.5
