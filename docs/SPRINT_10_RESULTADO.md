# SPRINT 10 — Resultado: Modelo Financeiro por Competência/Status

**Data:** 2026-06-16
**Status:** Concluída ✅

---

## Objetivo

Implementar a primeira versão do modelo financeiro por competência/status, sem quebrar o sistema atual. Diferenciar claramente resultado econômico do lote (competência) de fluxo de caixa (liquidação).

---

## O que mudou

### Novos campos em `movimentacoes_financeiras`

Adicionados via migration SQL (opcional, backward-compatible):

| Campo | Tipo | Valores aceitos |
|-------|------|-----------------|
| `status` | TEXT nullable | `previsto`, `realizado`, `pago`, `cancelado`, `null` (legado) |
| `data_competencia` | DATE nullable | Data do fato gerador econômico |
| `data_vencimento` | DATE nullable | Data de vencimento do pagamento |
| `data_pagamento` | DATE nullable | Data de liquidação |

### Regras de compatibilidade retroativa

- `status NULL` → tratado como `'realizado'` (legado funciona igual a antes)
- `data_competencia NULL` → fallback para `data`
- `data_vencimento NULL` → fallback para `data`
- Nenhum dado existente foi apagado ou alterado

### Resultado econômico do lote (`getResumoLote`)

- `calcularCustoLote` e `calcularReceitaLote` agora filtram por `deveEntrarNoResultadoLote`
- **Entra:** `realizado`, `pago`, legado sem status
- **Não entra:** `previsto`, `cancelado`

### Fluxo de caixa (`calcularFluxoCaixa`)

- Nova função pura em `src/domain/fluxoCaixa.js`
- **Entra:** `pago`, legado com `pago:true`, legado sem status e sem `pago`
- **Contas a receber/pagar:** `realizado` não pago
- **Não entra:** `previsto`, `cancelado`
- Detecta vencidos por `data_vencimento < hoje`

---

## Arquivos criados ou modificados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `supabase/migrations/20260616000000_financial_status_fields.sql` | **Novo** | Migration SQL para campos opcionais |
| `src/domain/financeiroStatus.js` | **Novo** | 9 helpers puros de status financeiro |
| `src/domain/financeiroStatus.test.js` | **Novo** | 39 testes dos helpers |
| `src/domain/fluxoCaixa.js` | **Novo** | Função pura `calcularFluxoCaixa` |
| `src/domain/fluxoCaixa.test.js` | **Novo** | 13 testes do fluxo de caixa |
| `src/domain/calculos.js` | Alterado | Filtro `deveEntrarNoResultadoLote` em custos e receitas |
| `src/domain/calculos.test.js` | Alterado | +8 testes de status (Sprint 10) |
| `src/services/movimentacoes.js` | Alterado | `status: 'realizado'` + `data_competencia` em todos os criadores |
| `src/services/custosCompartilhados.js` | Alterado | `status: 'realizado'` + `data_competencia` no rateio |
| `src/pages/CustosPage.jsx` | Alterado | `status: 'realizado'` + `data_competencia` em `upsertMovimentacaoFinanceiraDeCusto` |
| `src/pages/FinanceiroPage.jsx` | Alterado | `status: 'pago'/'realizado'` mapeado de `pago` bool + `data_competencia` |
| `docs/FLUXO_CAIXA_HERDON.md` | **Novo** | Documentação completa do modelo |
| `docs/DECISAO_FINANCEIRA_CAIXA_COMPETENCIA.md` | Referência | Criado na Sprint 9 |

---

## Testes

| Arquivo | Novos testes | Total |
|---------|-------------|-------|
| `financeiroStatus.test.js` | 39 | 39 |
| `fluxoCaixa.test.js` | 13 | 13 |
| `calculos.test.js` | +8 | 21 |
| **Total acumulado** | — | **133/133** |

---

## Resultado dos gates

```
node --test src/**/*.test.js
→ tests 133 | pass 133 | fail 0

npm run lint
→ (sem erros)

npm run build
→ ✓ built in 348ms (200 módulos)
```

---

## O que não foi feito (pendente)

| ID | Descrição |
|----|-----------|
| P-01 | Aplicar migration no Supabase de produção (não executada automaticamente) |
| P-02 | Tela de Fluxo de Caixa com filtros na UI |
| P-03 | Lançamento de movimentação com status explícito pelo usuário |
| P-04 | Parcelamento de compras e vendas |
| P-05 | Dashboard com bloco de contas a pagar/receber e vencidos |
