# Fluxo de Caixa HERDON

**Data:** 2026-06-16
**Status:** Modelo mínimo implementado ✅

---

## Diferença: Resultado Econômico vs Fluxo de Caixa

| Dimensão | Resultado Econômico (`getResumoLote`) | Fluxo de Caixa (`calcularFluxoCaixa`) |
|----------|--------------------------------------|---------------------------------------|
| **Pergunta** | O lote foi lucrativo? | Quanto dinheiro entrou/saiu? |
| **Base** | Fato gerador econômico (competência) | Liquidação financeira (pagamento) |
| **`status = 'realizado'`** | ✅ Entra | ❌ Não entra (não pago ainda) |
| **`status = 'pago'`** | ✅ Entra | ✅ Entra |
| **`status = 'previsto'`** | ❌ Não entra | ❌ Não entra (vai para `previstoFuturo`) |
| **`status = 'cancelado'`** | ❌ Não entra | ❌ Não entra |
| **Legado (sem status, sem `pago`)** | ✅ Entra como realizado | ✅ Entra (backward compat) |
| **Legado com `pago: true`** | ✅ Entra | ✅ Entra |

---

## Status disponíveis em `movimentacoes_financeiras`

| Status | Significado | Resultado Lote | Fluxo Caixa |
|--------|-------------|---------------|-------------|
| `previsto` | Previsto mas não ocorreu | ❌ | ❌ (previstoFuturo) |
| `realizado` | Fato econômico ocorreu, não pago | ✅ | ❌ (contasAReceber/APagar) |
| `pago` | Dinheiro liquidado | ✅ | ✅ |
| `cancelado` | Cancelado | ❌ | ❌ |
| `null` / ausente | Legado | ✅ | ✅ |

---

## Compatibilidade retroativa

Dados legados (movimentações sem campo `status`) são tratados como `'realizado'` pelo helper `normalizarStatusMovimentacao`.

Para o fluxo de caixa, legado sem `status` e sem campo `pago` é tratado como caixa (backward compat). Isso preserva o comportamento anterior onde todos os lançamentos apareciam no resultado.

---

## Campos da movimentação financeira (Sprint 10+)

```js
{
  // Core (sempre presente)
  id, tipo, categoria, lote_id, valor, data, descricao,

  // Status financeiro (novo, opcional)
  status,           // 'previsto' | 'realizado' | 'pago' | 'cancelado' | null (legado)
  data_competencia, // data do fato gerador econômico; fallback: data
  data_vencimento,  // data de vencimento do pagamento; fallback: data
  data_pagamento,   // data em que foi liquidado; null se não pago

  // Rastreabilidade
  origem_tipo, origem_id,

  // Legado (PagamentoDiário / CustosPage)
  pago, observacao, metodo_pagamento, origem,
}
```

---

## Output de `calcularFluxoCaixa(movimentacoes, opcoes)`

```js
{
  totalRecebido,  // receitas pagas ou legado
  totalPago,      // despesas pagas ou legado
  saldoCaixa,     // totalRecebido - totalPago
  contasAReceber, // receitas realizadas mas não pagas
  contasAPagar,   // despesas realizadas mas não pagas
  previstoFuturo, // soma de todas as movimentações 'previsto'
  vencido,        // a receber ou a pagar com data_vencimento < hoje
}
```

Opções:
- `hoje`: string YYYY-MM-DD para cálculo de vencimento (padrão: hoje)
- `loteId`: filtrar por lote específico

---

## Fontes de dados

- `src/domain/fluxoCaixa.js` — função pura `calcularFluxoCaixa`
- `src/domain/financeiroStatus.js` — helpers de status
- `src/domain/calculos.js` — `calcularCustoLote` e `calcularReceitaLote` (resultado econômico)
- `supabase/migrations/20260616000000_financial_status_fields.sql` — migration dos novos campos

---

## O que ainda está pendente

| ID | Descrição |
|----|-----------|
| P-01 | Aplicar migration no Supabase de produção e staging |
| P-02 | Tela de Fluxo de Caixa com filtros por período e lote |
| P-03 | Lançamento de movimentação com status explícito na UI |
| P-04 | Suporte a parcelamento (múltiplas `data_vencimento` e `data_pagamento`) |
| P-05 | Dashboard: bloco de contas a pagar/receber e vencidos |
