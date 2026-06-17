# Go-live Controlado — Resultado HERDON

**Sprint 15 · Etapa 10**
**Data:** 2026-06-17
**Responsável:** Herdon / Magalhaexz

---

## Decisão: GO / NO-GO

> **Decisão: GO CONDICIONAL**
>
> O produto está em condição de go-live controlado (beta fechado / acesso restrito).
> Bloqueadores identificados devem ser resolvidos antes de abertura pública.

---

## Resumo dos bloqueadores

| # | Bloqueador | Severidade | Status |
|---|-----------|-----------|--------|
| B1 | `SUPABASE_SERVICE_ROLE_KEY` — verificar se está no Vercel dashboard | **Crítico** | ⚠️ Verificar manualmente |
| B2 | `ASAAS_ENV=sandbox` — trocar para `production` antes de aceitar pagamentos reais | **Crítico** | ⚠️ Fazer na virada para produção |
| B3 | `ASAAS_API_KEY` de produção — confirmar chave correta no Vercel | **Crítico** | ⚠️ Verificar manualmente |
| B4 | Webhook Asaas — URL cadastrada no painel Asaas | **Crítico** | ⚠️ Verificar no painel Asaas |

> **Nenhum dos bloqueadores exige mudança de código.** São todos configurações de variáveis de ambiente e painel externo.

---

## Não-bloqueadores (pós go-live)

| Item | Observação |
|------|-----------|
| Domínio customizado (`app.herdon.com.br`) | Não configurado — usando `agrotrack-novo.vercel.app` |
| Conformidade LGPD — revisão jurídica | Páginas existem; conteúdo não revisado com jurídico |
| Verificação de RLS manual no Supabase dashboard | Necessária mas não bloqueia beta fechado |
| QA visual mobile em dispositivo físico | Pendente; componentes mobile existem no código |
| Telas não revisadas visualmente: Animais, Pesagens, Suplementação | Presentes e funcionais, sem revisão visual |

---

## Gates finais

| Gate | Resultado |
|------|-----------|
| `npm test` | Verificar na Etapa 11 |
| `npm run lint` | Verificar na Etapa 11 |
| `npm run build` | Verificar na Etapa 11 |
| Último deploy Vercel | ✅ `READY` — commit `90490ad` (Sprint 14) |
| Branch main sincronizada com origin | ✅ |

---

## Etapas validadas — Sprint 15

| Etapa | Status | Artefato |
|-------|--------|---------|
| 0 — Estado inicial | ✅ | Branch main, commit `90490ad`, tree limpa |
| 1 — Ambiente local | ✅ | 266 testes ✅, lint ✅, build 347ms ✅ |
| 2 — Golden Path | ✅ | `docs/GOLDEN_PATH_HERDON.md` |
| 3 — QA visual browser | ⚠️ | `docs/QA_VISUAL_HERDON.md` (sem browser) |
| 4 — QA mobile | ⚠️ | `docs/QA_MOBILE_HERDON.md` (sem dispositivo) |
| 5 — Supabase | ✅ | `docs/SUPABASE_GO_LIVE_CHECK.md` |
| 6 — Vercel | ✅ | `docs/VERCEL_GO_LIVE_CHECK.md` |
| 7 — Asaas | ✅ | `docs/ASAAS_PRODUCAO_READINESS.md` |
| 8 — Legal | ✅ | `docs/LEGAL_CHECKLIST_HERDON.md` |
| 9 — Correções bloqueadoras | ✅ | Nenhum bug bloqueador encontrado no código |
| 10 — Resultado go-live | ✅ | Este documento |
| 11 — Gates finais | Pendente | — |
| 12 — Commit | Pendente | — |

---

## Checklist pré-abertura pública

### Infraestrutura (Vercel + Supabase)

- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada no Vercel dashboard (env: production)
- [ ] `SUPABASE_URL` configurada no Vercel dashboard (env: production)
- [ ] `VITE_SUPABASE_URL` configurada no Vercel dashboard (env: production)
- [ ] `VITE_SUPABASE_ANON_KEY` configurada no Vercel dashboard (env: production)
- [ ] RLS ativo em todas as tabelas sensíveis (Supabase dashboard)
- [ ] Migration financeira confirmada aplicada

### Asaas — pagamentos

- [ ] `ASAAS_ENV=production` no Vercel dashboard
- [ ] `ASAAS_API_KEY` de produção no Vercel dashboard
- [ ] `ASAAS_WEBHOOK_TOKEN` no Vercel dashboard == token no painel Asaas
- [ ] Webhook URL cadastrada no Asaas: `https://agrotrack-novo.vercel.app/api/asaas-webhook`
- [ ] Teste de assinatura em sandbox concluído antes da virada

### Legal

- [ ] Termos de Uso — conteúdo revisado com nome HERDON e data atual
- [ ] Política de Privacidade — menciona Supabase como infraestrutura
- [ ] Política de Cobrança — preços e ciclo corretos
- [ ] Canal de suporte ativo (e-mail ou outra forma de contato)

### Domínio e acesso

- [ ] Decidir entre `agrotrack-novo.vercel.app` ou domínio customizado
- [ ] Se domínio customizado: configurar CNAME e SSL no Vercel
- [ ] Testar acesso via URL pública após deploy

---

## Histórico de sprints

| Sprint | Objetivo | Status |
|--------|----------|--------|
| Sprint 1–4 | Fundação: auth, CRUD, UI base, legal pages | ✅ |
| Sprint 5 | Asaas + billing | ✅ |
| Sprint 6–10 | Financeiro, pesagens, alertas, cenários | ✅ |
| Sprint 11–12 | Fluxo de caixa, custos compartilhados | ✅ |
| Sprint 13 | QA visual: títulos, acentos, tokens CSS | ✅ |
| Sprint 14 | Alertas unificados + correções visuais | ✅ |
| Sprint 15 | Go-live controlado — validação e documentação | ✅ (este documento) |
