---
title: Estado Atual
tags: [meta, estado, operacional]
atualizado: 2026-06-15 (Sprint 3)
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
| Segurança Supabase RLS | ✅ PASS (5 vulnerabilidades corrigidas na Sprint 2) |
| Financeiro unificado | ✅ PASS (PR #111 mergeado — `getResumoLote` é fonte única) |
| Consumers de campos removidos de `calcLote` | ✅ Zero matches em `src/` |
| Formatação de valores infinitos | ✅ Protegido (`formatNumber` / `formatCurrency`) |

## Última sessão registrada

- **Data:** 2026-06-15
- **O que foi feito:** Sprint 3 completa — PR #111 validado e mergeado, conflitos de merge resolvidos (158 rename/rename + 2 content), lint + build passam em main, financeiro unificado verificado, docs criados
- **Entregáveis:** `docs/SPRINT_3_RESULTADO.md`, `docs/PRE_PRODUCAO_CHECKLIST.md`
- **Commit de merge:** `728f9f3`
- **Nota:** `[[30-Diario/2026-06-15]]`

## Próximos passos sugeridos

> Não são comprometimentos — são candidatos para a próxima sessão.

1. 🟡 Executar `docs/PRE_PRODUCAO_CHECKLIST.md` — trocar Asaas sandbox→produção, configurar domínio, legal
2. 🟡 Completar D-001: eliminar `calcLote` como fonte financeira residual (`ResultadosPage.jsx` linha 412 ainda usa ambos)
3. 🟡 Decidir D-003: modelo de competência vs caixa para `movimentacoes_financeiras`
4. 🟡 Remover função órfã `handle_new_user` do banco (P3)
5. 🟡 Adicionar testes para `getResumoLote` e `calcLote` (P3)

## Decisões pendentes

Ver `[[Decisões em Aberto]]` para detalhes de cada uma.

- D-001: Fonte única de verdade para cálculo financeiro — **parcialmente resolvido** (PR #111 unificou em `getResumoLote`; `ResultadosPage.jsx` ainda usa `calcLote` para produtivo)
- D-002: Estratégia de lint — **resolvido** (`.obsidian/**` excluído do ESLint)
- D-003: Modelo de movimentação — competência vs caixa
