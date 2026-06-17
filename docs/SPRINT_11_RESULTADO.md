# SPRINT 11 — Resultado: Migration Supabase + Tela de Fluxo de Caixa

**Data:** 2026-06-16
**Status:** Concluída ✅

---

## Objetivo

Aplicar a migration do Sprint 10 no Supabase de produção e criar uma tela mínima de Fluxo de Caixa com filtros e KPIs, integrando a função pura `calcularFluxoCaixa`.

---

## O que foi feito

### Etapa 1 — Migration aplicada no Supabase de produção

- Projeto HERDON (`ljpiszxicmmuefbiixui`), região us-west-2, status ACTIVE_HEALTHY
- Migration `20260616000000_financial_status_fields.sql` aplicada via MCP
- Campos adicionados: `status`, `data_competencia`, `data_pagamento`
- `data_vencimento` já existia — `IF NOT EXISTS` tratou graciosamente
- 2 índices criados: `idx_mf_status`, `idx_mf_data_competencia`
- Tabela estava vazia → zero impacto em dados legados
- Documentado em `docs/SUPABASE_MIGRATION_SPRINT_11.md`

### Etapa 2 — Validação de compatibilidade retroativa

- Tabela com 0 registros → nenhuma linha legada a tratar
- Backward compat garantida no código: `status NULL` → `'realizado'` (ver `financeiroStatus.js`)
- Todos os novos criadores de movimentação já preenchem `status` e `data_competencia` (Sprint 10)

### Etapa 3 — `src/pages/FluxoCaixaPage.jsx` criada

Tela read-only com:

- **Card de filtros:** lote (select), status (todos/pago/realizado/previsto/cancelado/legado), intervalo de datas por `data_competencia`
- **Card de resumo (7 KPIs):**
  - Total recebido (verde)
  - Total pago (vermelho)
  - Saldo de caixa (verde/vermelho conforme sinal)
  - A receber
  - A pagar
  - Previsto futuro (amarelo)
  - Vencido (vermelho se > 0)
- **Tabela de movimentações** (máx 200 linhas, ordem desc por data_competencia):
  - Colunas: Data comp., Tipo (↑/↓ colorido), Categoria, Descrição, Valor, Status (badge colorido), Vencimento
- Verificação de permissão: `financeiro:ver` → mensagem "Sem permissão" se negado
- Usa: `calcularFluxoCaixa`, `normalizarStatusMovimentacao`, `getDataCompetencia`, `getDataVencimento`, `formatarMoeda`, `formatarData`

### Etapa 4 — Menu e rotas

- `navConfig.js`: `{ id: 'fluxoCaixa', label: 'Fluxo de Caixa', icon: DollarSign }` adicionado à seção `financeiro`
- `perfis.js`: `fluxoCaixa: 'financeiro:ver'` adicionado a `permissoesPorPagina`
- `App.jsx`: import lazy `FluxoCaixaPage` + entrada `fluxoCaixa: FluxoCaixaPage` no `pageMap`

### Etapa 5 — Criadores de movimentação (verificação)

Todos os criadores já foram atualizados na Sprint 10:
- `src/services/movimentacoes.js` — 4 criadores com `status: 'realizado'` + `data_competencia`
- `src/services/custosCompartilhados.js` — rateio com `status: 'realizado'` + `data_competencia`
- `src/pages/CustosPage.jsx` — upsert com `status: 'realizado'` + `data_competencia`
- `src/pages/FinanceiroPage.jsx` — mapeamento `pago → status: 'pago'/'realizado'`

---

## Arquivos criados ou modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/pages/FluxoCaixaPage.jsx` | **Novo** | Tela de fluxo de caixa com filtros e KPIs |
| `src/navigation/navConfig.js` | Alterado | Adicionado item `fluxoCaixa` na seção financeiro |
| `src/auth/perfis.js` | Alterado | Adicionado `fluxoCaixa: 'financeiro:ver'` em `permissoesPorPagina` |
| `src/App.jsx` | Alterado | Import lazy + `fluxoCaixa` no pageMap |
| `docs/SUPABASE_MIGRATION_SPRINT_11.md` | **Novo** | Documentação da migration aplicada |
| `docs/SPRINT_11_RESULTADO.md` | **Novo** | Este arquivo |

---

## Resultado dos gates

```
npm run lint
→ (sem erros)

npm run build
→ ✓ built in 376ms

node --test src/**/*.test.js
→ tests 133 | pass 133 | fail 0
```

---

## O que não foi feito (pendente)

| ID | Descrição |
|----|-----------|
| P-01 | Lançamento manual de movimentação com status `previsto` pela UI |
| P-02 | Marcar `previsto` como `pago` diretamente na tela de fluxo de caixa |
| P-03 | Dashboard com bloco de contas a pagar/receber |
| P-04 | Parcelamento de compras e vendas |
| P-05 | Alertas de vencimento |
