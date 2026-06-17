# SPRINT 9 — Resultado: Projeção de Cenários e Modelo Financeiro

**Data:** 2026-06-16
**Status:** Concluída ✅

---

## Objetivo

Criar funcionalidade de projeção de cenários para que o produtor possa responder: "Vale a pena comprar este lote?" — com cálculo puro de margem, break-even, ROI e viabilidade. Paralelamente, documentar a decisão sobre o modelo financeiro caixa vs competência.

---

## Diagnóstico financeiro — Etapa 1

O HERDON opera com **modelo de data única de lançamento** — mais próximo de caixa do que de competência, mas sem rigor de caixa puro:

- `movimentacoes_financeiras` tem apenas campo `data`
- `getResumoLote` soma todas as movimentações do lote sem filtro de data ou status
- Não existem campos `status`, `data_competencia` ou `data_pagamento` no modelo de dados

**Decisão adotada:** competência com status opcional.
- `getResumoLote` considera `status IN ('realizado', null)` — backward-compatible
- Implementação dos campos é gradual (Sprint 10+)
- Projeção de cenários é independente do modelo financeiro — usa inputs hipotéticos

Documentação completa: `docs/DECISAO_FINANCEIRA_CAIXA_COMPETENCIA.md`

---

## Função pura `calcularCenarioPecuaria`

### Arquivo: `src/domain/projecaoCenario.js`

Função sem dependência de `db` para projeção de decisão de compra de lote.

**Input:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `cabecas` | number | Número de cabeças |
| `pesoInicialKg` | number | Peso médio inicial em kg |
| `precoCompraArroba` | number | R$ por @ na compra (arroba viva) |
| `rendimentoCarcaca` | number | % de rendimento (default 52) |
| `diasConfinamento` | number | Dias planejados no lote |
| `gmdKgDia` | number | GMD esperado em kg/dia/cabeça |
| `custoDiarioCabeca` | number | Custo diário por cabeça (ração + saúde + gestão) |
| `precoVendaArroba` | number | R$ por @ carcaça na venda |
| `custoFrete` | number | Custo fixo de frete (opcional) |
| `outrosCustos` | number | Outros custos fixos (opcional) |

**Output:**

| Campo | Descrição |
|-------|-----------|
| `arrobasCarcacaCompra` | @ carcaça no ato da compra |
| `arrobasCarcacaVenda` | @ carcaça esperada na venda |
| `pesoFinalKg` | Peso médio esperado na saída |
| `custoCompra` | Total gasto na compra |
| `custoDiario` | Total do custo diário no período |
| `custoTotal` | Soma de todos os custos |
| `receitaProjetada` | Receita da venda projetada |
| `margemBruta` | Receita − custo total |
| `lucroPorArroba` | Margem / arrobas totais na venda |
| `lucroPorCabeca` | Margem / cabeças |
| `roiPct` | (Margem / custo) × 100 |
| `breakEvenArroba` | Preço mínimo de venda para margem = 0 |
| `viavel` | `true` se margem ≥ 0 |

### Fórmulas-chave

```
pesoFinalKg = pesoInicialKg + gmdKgDia × diasConfinamento
arrobasCarcaça = peso × (rendimento/100) / 15
custoCompra = arrobasCarcacaCompra × precoCompraArroba × cabecas
custoDiario = custoDiarioCabeca × dias × cabecas
receitaProjetada = arrobasCarcacaVenda × precoVendaArroba × cabecas
breakEvenArroba = custoTotal / (arrobasCarcacaVenda × cabecas)
```

---

## Testes

**Arquivo:** `src/domain/projecaoCenario.test.js` — 15 testes, todos passando

| # | Cenário |
|---|---------|
| 1 | Peso final correto com GMD |
| 2 | Arrobas carcaça na compra |
| 3 | Arrobas carcaça na venda |
| 4 | Custo de compra correto |
| 5 | Custo diário correto |
| 6 | Custo total soma compra + diário + frete + outros |
| 7 | Receita projetada = arrobas × preço × cabeças |
| 8 | Margem = receita − custo |
| 9 | Cenário lucrativo → viavel = true |
| 10 | Cenário com prejuízo → viavel = false |
| 11 | ROI = (margem / custo) × 100 |
| 12 | Break-even: preço venda = break-even → margem ≈ 0 |
| 13 | Zero cabeças → custo e receita zero |
| 14 | Zero dias → sem custo diário |
| 15 | Lucro por cabeça = margem / cabeças |

---

## Melhorias em CenariosPage.jsx

Adicionado Card "Decisão: vale a pena comprar este lote?" com:
- 10 inputs: cabeças, peso inicial, preço compra/@, rendimento carcaça, dias, GMD, custo diário/cabeça, preço venda/@, frete, outros custos
- 13 métricas em tempo real: peso final, @compra, @venda, custo compra, custo diário, custo total, receita, margem, lucro/@, lucro/cab, ROI, break-even, viável (SIM/NÃO com cor)

A seção macro de cenários estratégicos da fazenda (`calcularProjecaoCenario`) foi mantida intacta.

---

## navConfig

Adicionado `cenarios` na seção "Análises e Resultados" do menu lateral. O item já existia em `perfis.js` (`cenarios:ver`) e em `App.jsx` (lazy import + pageMap) desde antes — apenas o menu estava faltando.

---

## Arquivos alterados ou criados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/domain/projecaoCenario.js` | **Novo** | Função pura `calcularCenarioPecuaria` |
| `src/domain/projecaoCenario.test.js` | **Novo** | 15 testes |
| `src/pages/CenariosPage.jsx` | Alterado | Card de decisão de compra de lote |
| `src/navigation/navConfig.js` | Alterado | Item Cenários no menu |
| `docs/DECISAO_FINANCEIRA_CAIXA_COMPETENCIA.md` | **Novo** | Decisão caixa vs competência |

---

## Resultado dos gates

```
node --test src/**/*.test.js
→ tests 73 | pass 73 | fail 0

npm run lint
→ (sem erros)

npm run build
→ ✓ built in 354ms (200 módulos)
```

---

## Pendências

| ID | Descrição |
|----|-----------|
| P-01 | Aplicar migration com `status`, `data_competencia`, `data_pagamento` (Sprint 10+) |
| P-02 | Filtrar `getResumoLote` por `status IN ('realizado', null)` quando migration rodar |
| P-03 | Histórico de simulações de decisão salvos no db (cenários nomeados) |
