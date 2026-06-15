---
title: Estado Atual
tags: [meta, estado, operacional]
atualizado: 2026-06-15 (Sprint 4)
tipo: estado
aliases: [Estado Atual do Projeto]
---

# Estado Atual — Herdon / Agrotrack

> Snapshot operacional. Atualizar a cada sessão relevante.

## Produto

| Área | Status | Observação |
|------|--------|------------|
| [[Herdon]] (produto geral) | 🟡 Pré-lançamento | Em fase de QA pré-beta; billing Asaas integrado |
| [[Cálculo de Lote]] | 🟢 Unificado | PR #111 mergeado — `getResumoLote` é a fonte única de financeiro realizado |
| [[Gestão Financeira]] | 🟢 Unificado | DRE funciona; financeiro unificado em `getResumoLote` |
| [[Pesagem]] | 🟢 Funcional | GMD calculado; forms endurecidos |
| [[Estoque]] | 🟡 Parcial | Dois caminhos de saída ainda coexistem |
| [[Supabase]] (auth/dados) | 🟢 Conectado | Perfis, roles, RLS funcionando |
| [[Stack React Vite]] (build) | 🟢 Build passa | React 19 + Vite 8; lint ✅; build ✅ |
| Asaas Billing | 🟢 Integrado | Sandbox OK; checkout e assinatura implementados |
| Funcionários / Roles | 🟢 Implementado | `userAccess.js` com controle por role |

## Branches e PRs em aberto

| PR | Branch | Resumo | Impacto |
|----|--------|--------|---------|
| ~~#111~~ | ~~`claude/loving-sagan-5xhwzr`~~ | ✅ MERGEADO em 2026-06-15 | — |
| #78 | `codex/generate-technical-analysis-report-template` | Animal identity utils + Pesagem form | Médio |
| #40 | `codex/fix-missing-public.fazendas-table-in-supabase-muwwf3` | Visual refactor sidebar + diagnósticos | Médio |
| #10, #9, #8 | `codex/analyze-error-in-fazendacard.*` | Conflitos FazendaCard | Baixo (legado) |

Total de branches: 30 (maioria `codex/*` — branches de agente automático)

## Qualidade / CI

| Gate | Status |
|------|--------|
| `npm run build` | ✅ PASS (pós-merge PR #111) |
| `npm run lint` | ✅ PASS (corrigido na Sprint 2 — era plugin Obsidian no ignore) |
| Segurança Supabase RLS | ✅ PASS (5 vulns Sprint 2; bug invite Sprint 4 corrigido) |
| Financeiro unificado | ✅ PASS (PR #111 mergeado — `getResumoLote` é fonte única) |
| Consumers de campos removidos de `calcLote` | ✅ Zero matches em `src/` |
| Formatação de valores infinitos | ✅ Protegido (`formatNumber` / `formatCurrency`) |
| `app_can_manage_account` case bug | ✅ CORRIGIDO (Sprint 4 — invite flow desbloqueado) |

## Última sessão registrada

- **Data:** 2026-06-15
- **O que foi feito:** Sprint 4 completa — homologação pré-produção, 9 documentos entregues, bug crítico de invite (case mismatch em `app_can_manage_account`) encontrado e corrigido diretamente no Supabase, `.env.example` atualizado
- **Entregáveis:** `docs/ENV_VARS_HERDON.md`, `docs/SUPABASE_HOMOLOGACAO.md`, `docs/ASAAS_HOMOLOGACAO.md`, `docs/GOLDEN_PATH_HERDON.md`, `docs/ROLE_QA_HERDON.md`, `docs/QA_TELAS_HERDON.md`, `docs/VERCEL_PREVIEW_HERDON.md`, `docs/LEGAL_CHECKLIST_HERDON.md`, `docs/SPRINT_4_RESULTADO.md`
- **Bug corrigido:** `app_can_manage_account` — `lower()` + alias `'admin'` adicionados
- **Veredicto Sprint 4:** Precisa de mais uma sprint (Sprint 5) antes de teste com produtor externo
- **Nota:** `[[30-Diario/2026-06-15]]`

## Próximos passos sugeridos (Sprint 5)

> Não são comprometimentos — são candidatos para a próxima sessão.

1. 🔴 Criar documentos legais (política de privacidade + termos de uso + aceite no cadastro) — bloqueador para go-live
2. 🔴 Configurar Asaas de produção (trocar vars, criar webhook real, criar planos no painel)
3. 🔴 Configurar domínio customizado na Vercel + criar `vercel.json` com headers de segurança
4. 🟡 Validar Golden Path manualmente em browser (fazer login → criar fazenda → lote → financeiro → relatório)
5. 🟡 Testar fluxo de convite de funcionário (após correção do bug de invite)
6. 🟡 Normalizar `handle_new_user_profile` para `perfil = 'proprietario'` (lowercase) + migrar dados existentes
7. 🟡 Completar D-001: eliminar `calcLote` como fonte financeira residual (`ResultadosPage.jsx`)
8. 🔵 Remover função órfã `handle_new_user` do banco (P3)
9. 🔵 Remover triggers duplicados de `updated_at` (P3)

## Decisões pendentes

Ver `[[Decisões em Aberto]]` para detalhes de cada uma.

- D-001: Fonte única de verdade para cálculo financeiro — **parcialmente resolvido** (PR #111 unificou em `getResumoLote`; `ResultadosPage.jsx` ainda usa `calcLote` para produtivo)
- D-002: Estratégia de lint — **resolvido** (`.obsidian/**` excluído do ESLint)
- D-003: Modelo de movimentação — competência vs caixa
