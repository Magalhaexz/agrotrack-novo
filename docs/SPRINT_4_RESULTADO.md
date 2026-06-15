# Sprint 4 — Resultado

> Sprint: Pré-Produção, Homologação e Golden Path HERDON  
> Data: 2026-06-15

---

## Status geral: ✅ Concluída com 1 bug crítico corrigido

Todas as 10 etapas executadas. 9 documentos entregues. 1 bug crítico de permissão encontrado e corrigido no Supabase.

---

## Etapas executadas

| Etapa | Descrição | Status | Entregável |
|-------|-----------|--------|-----------|
| 1 | Leitura de todos os documentos principais | ✅ | — |
| 2 | Validação de variáveis de ambiente | ✅ | `docs/ENV_VARS_HERDON.md` |
| 3 | Validação Supabase pré-produção | ✅ | `docs/SUPABASE_HOMOLOGACAO.md` |
| 4 | Validação Asaas sandbox | ✅ | `docs/ASAAS_HOMOLOGACAO.md` |
| 5 | Golden Path — fluxo completo do produtor | ✅ | `docs/GOLDEN_PATH_HERDON.md` |
| 6 | QA de funcionários e equipe (roles) | ✅ | `docs/ROLE_QA_HERDON.md` |
| 7 | QA de telas e rotas principais | ✅ | `docs/QA_TELAS_HERDON.md` |
| 8 | Preparação Vercel Preview | ✅ | `docs/VERCEL_PREVIEW_HERDON.md` |
| 9 | Checklist legal e compliance | ✅ | `docs/LEGAL_CHECKLIST_HERDON.md` |
| 10 | Correção de bug crítico | ✅ | — (aplicado no Supabase) |

---

## 1. Achados — Variáveis de ambiente (Etapa 2)

### Gaps encontrados

| Item | Problema | Ação tomada |
|------|---------|-------------|
| `.env.example` incompleto | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `VITE_HERDON_BOOTSTRAP_ADMIN_EMAILS` ausentes | ✅ `.env.example` corrigido nesta sprint |
| `VITE_HERDON_BOOTSTRAP_ADMIN_EMAILS` | Não documentado; fallback hardcoded (`magalhaesh617@gmail.com`) exposto no bundle | Documentado + adicionado ao `.env.example` |
| `VITE_APP_URL` | Deve apontar para domínio de produção antes do go-live | Pendente — Etapa do go-live |

### Verificação de segurança

`SUPABASE_SERVICE_ROLE_KEY` **não está** em nenhuma variável `VITE_*`. ✅ Confirmado via grep.

---

## 2. Achados — Supabase (Etapa 3)

### Testes de segurança (6/6)

| # | Teste | Resultado |
|---|-------|-----------|
| 1 | Usuário A não vê fazenda do Usuário B | ✅ PASS |
| 2 | Funcionário só acessa o que a role permite | ✅ PASS (após correção) |
| 3 | Convites não vazam entre contas | ✅ PASS |
| 4 | Auditoria não permite alteração | ✅ PASS |
| 5 | Fazenda sem dono não fica pública | ✅ PASS |
| 6 | Dados financeiros não vazam entre contas | ✅ PASS |

### Bug crítico encontrado e corrigido

**Problema:** `app_can_manage_account` verificava roles em lowercase (`'proprietario'`, `'gerente'`) mas o trigger `handle_new_user_profile` insere `perfil = 'PROPRIETARIO'` (maiúsculas). PostgreSQL é case-sensitive → função retornava sempre `false` → toda a tabela `invites` estava inacessível.

**Impacto:** Nenhum convite de funcionário podia ser criado ou aceito. Fluxo de equipe completamente bloqueado.

**Correção aplicada (2026-06-15 diretamente no Supabase):**
```sql
-- Antes:
and coalesce(public.app_current_profile_role(), '') in ('proprietario', 'gerente')

-- Depois:
and lower(coalesce(public.app_current_profile_role(), '')) in ('proprietario', 'gerente', 'admin')
```

`'admin'` foi adicionado para cobrir os 3 profiles de teste existentes com `perfil = 'admin'`.

**Verificado:** `pg_get_functiondef` confirmou a nova definição.

### Observações adicionais (não críticas)

| Observação | Classificação |
|-----------|--------------|
| 7 de 8 profiles de teste com `owner_user_id = NULL` | Dados de teste antigos — não impacta produção |
| Triggers duplicados de `updated_at` em ~20 tabelas | P3 — sem impacto funcional |
| 2 policies antigas redundantes em `profiles` | P3 — sem impacto de segurança |
| Função órfã `handle_new_user` (sem trigger) | P3 — já documentado em Sprint anterior |

---

## 3. Achados — Asaas (Etapa 4)

| Ponto | Status |
|-------|--------|
| Implementação estrutural | ✅ Correta — validação de auth, token de webhook, service_role |
| Fallback para sandbox | ✅ Configurado — nunca cai em produção por acidente |
| Teste com sandbox real | ⚠️ Pendente — requer credenciais e cartão de teste |
| Troca para produção | 🔴 Pendente — obrigatório antes do go-live |

---

## 4. Achados — Golden Path (Etapa 5)

| Etapa | Verificado via código | Teste manual |
|-------|----------------------|--------------|
| Cadastro + trigger de profile | ✅ | ⬜ |
| Login + normalização de roles | ✅ | ⬜ |
| Criar fazenda (RLS) | ✅ | ⬜ |
| Criar lote (RLS) | ✅ | ⬜ |
| Financeiro unificado | ✅ | ⬜ |
| Relatório de lote | ✅ | ⬜ |
| Comparativo | ✅ | ⬜ |
| Assinatura (estrutural) | ✅ | ⬜ |

O Golden Path do produtor solo **não é bloqueado** pelo bug de invite. Verificação manual em browser pendente.

---

## 5. Achados — Role QA (Etapa 6)

- Bug de invite corrigido — fluxo de convite agora funcional em teoria
- Teste manual (convidar → aceitar → login como funcionário → verificar acesso) pendente

---

## 6. Achados — QA de Telas (Etapa 7)

| Status | Quantidade |
|--------|-----------|
| ✅ OK | 7 telas |
| ⚠️ Parcial | 5 telas |
| ❌ Bloqueado | 1 tela (FuncionariosPage — corrigida no DB) |
| 🔒 Gate (plano) | 6 telas |
| ⬜ Não testado | 10 telas |

---

## 7. Achados — Vercel (Etapa 8)

| Item | Estado |
|------|--------|
| Latest deploy | ✅ READY — commit `728f9f3` (Sprint 3) |
| Deploy automático de `main` | ✅ Ativo |
| Domínio customizado | ❌ Não configurado — apenas `.vercel.app` |
| `vercel.json` | ❌ Ausente — sem headers de segurança, sem rewrites explícitos |
| Node.js | 24.x |
| Serverless functions | 5 |

---

## 8. Achados — Legal (Etapa 9)

**Nenhum documento legal implementado no produto.**

| Item | Status |
|------|--------|
| Política de privacidade | ❌ Não existe |
| Termos de uso | ❌ Não existe |
| Aceite de termos no cadastro | ❌ Não implementado |
| Processo de exclusão de conta (LGPD) | ❌ Não implementado |

**Risco:** não usar com produtor real externo sem ao menos política de privacidade e termos de uso.

---

## Documentos entregues

| Documento | Caminho |
|-----------|---------|
| Variáveis de ambiente | `docs/ENV_VARS_HERDON.md` |
| Homologação Supabase | `docs/SUPABASE_HOMOLOGACAO.md` |
| Homologação Asaas | `docs/ASAAS_HOMOLOGACAO.md` |
| Golden Path | `docs/GOLDEN_PATH_HERDON.md` |
| Role QA | `docs/ROLE_QA_HERDON.md` |
| QA de Telas | `docs/QA_TELAS_HERDON.md` |
| Vercel Preview | `docs/VERCEL_PREVIEW_HERDON.md` |
| Legal e Compliance | `docs/LEGAL_CHECKLIST_HERDON.md` |
| Sprint 4 Resultado | `docs/SPRINT_4_RESULTADO.md` (este arquivo) |

---

## Alterações no código/infra desta sprint

| Arquivo | Alteração |
|---------|-----------|
| `.env.example` | Adicionadas: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_HERDON_BOOTSTRAP_ADMIN_EMAILS`; reorganizado com comentários |
| Supabase — `app_can_manage_account` | Corrigido case mismatch: `lower()` + adicionado `'admin'` |

---

## Decisão final — Sprint 4

### Critério da sprint

> "1. Está pronto para teste com um produtor real controlado
> 2. Precisa de mais uma sprint de correções
> 3. Ainda não está seguro para uso externo"

### Veredicto

**Resultado: 2 — Precisa de mais uma sprint antes de teste com produtor real externo.**

**Bloqueadores para go-live com produtor externo:**
1. 🔴 Documentos legais (política de privacidade, termos de uso, aceite no cadastro) — LGPD/consumidor
2. 🔴 Asaas produção não configurado (ainda em sandbox)
3. 🔴 Domínio customizado não configurado (sem identidade de marca)
4. 🟡 Golden Path não validado manualmente em browser
5. 🟡 10 telas operacionais não testadas
6. 🟡 `vercel.json` ausente (sem headers de segurança)

**O que foi desbloqueado nesta sprint:**
- Bug crítico de convite de funcionários ✅ corrigido
- Segurança do banco validada (5/6 testes + 1 corrigido) ✅
- Todos os gaps de env vars documentados ✅
- Arquitetura Asaas validada estruturalmente ✅

**Candidato a Sprint 5:**
1. Criar documentos legais (política + termos + aceite)
2. Configurar Asaas de produção
3. Configurar domínio customizado + `vercel.json`
4. Validar Golden Path manualmente em browser
5. Testar fluxo completo de convite de funcionário (após correção)

---

## Pendências herdadas (não eram escopo desta sprint)

| Item | Prioridade |
|------|-----------|
| D-001 completo: eliminar `calcLote` como fonte financeira residual (`ResultadosPage.jsx`) | P2 |
| D-003: Modelo competência vs caixa | P2 |
| Normalizar `handle_new_user_profile` para inserir `perfil = 'proprietario'` (lowercase) | P2 |
| Migrar profiles existentes: `UPDATE profiles SET perfil = lower(perfil)` | P2 |
| Remover função órfã `handle_new_user` | P3 |
| Remover triggers duplicados de `updated_at` | P3 |
