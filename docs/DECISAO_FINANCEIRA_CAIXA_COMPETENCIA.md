# Decisão Financeira — Caixa vs Competência HERDON

**Data:** 2026-06-16
**Status:** Decisão tomada ✅ — implementação parcial pendente

---

## Diagnóstico do modelo atual

### Como o HERDON funciona hoje

O HERDON usa um modelo de **data única de lançamento**, mais próximo de caixa mas sem rigor de caixa puro:

- `movimentacoes_financeiras` tem apenas o campo `data` (data do registro)
- `getResumoLote` soma **todas as movimentações do lote sem filtro de data ou status**
- Não existe campo `status`, `data_competencia`, `data_pagamento` ou `pago` no modelo de dados
- Uma venda lançada antes de receber o pagamento entra no resultado como se fosse realizada
- Um custo parcelado lançado de uma vez contamina o resultado do mês errado

### Campos existentes

| Campo | Tabela | Observação |
|-------|--------|-----------|
| `data` | `movimentacoes_financeiras`, `custos` | Data única — usado como "data do evento" |
| `data_vencimento` | `movimentacoes_financeiras` | Existe em algumas entradas manuais; não usado em `getResumoLote` |
| `status` | **Não existe** | Ausente do modelo |
| `data_competencia` | **Não existe** | Ausente do modelo |
| `data_pagamento` | **Não existe** | Ausente do modelo |

---

## Decisão adotada

### Modelo: Competência com status opcional

**`getResumoLote` representa resultado econômico/competência do lote.**

Regras:
1. Uma movimentação entra no resultado do lote quando `status` é `'realizado'` **ou** quando `status` está ausente (compatibilidade com dados legados).
2. Uma movimentação com `status = 'previsto'` representa custo/receita esperado — visível em projeções, não no resultado realizado.
3. Uma movimentação com `status = 'pago'` indica que foi liquidada financeiramente — usada no fluxo de caixa.
4. Uma movimentação com `status = 'cancelado'` não entra em nenhum cálculo.

### Separação de responsabilidades

| Consulta | Filtro | Finalidade |
|---------|--------|-----------|
| `getResumoLote` | `status IN ('realizado', null)` | Resultado econômico do lote |
| Fluxo de caixa | `status = 'pago'` | Dinheiro que realmente entrou/saiu |
| Projeção | `status = 'previsto'` | O que está planejado mas não aconteceu |

### Campos a adicionar (gradualmente, sem quebrar sistema atual)

```sql
ALTER TABLE movimentacoes_financeiras
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'realizado'
    CHECK (status IN ('previsto', 'realizado', 'pago', 'cancelado')),
  ADD COLUMN IF NOT EXISTS data_competencia DATE,
  ADD COLUMN IF NOT EXISTS data_pagamento DATE;
```

> **Nota:** Esta migration ainda não foi aplicada. Os campos são opcionais e backward-compatible. O sistema atual funciona corretamente sem eles — movimentações sem `status` são tratadas como `'realizado'`.

---

## Definição dos termos

| Termo | Definição |
|-------|-----------|
| **Data de competência** | Data em que o fato gerador ocorreu (ex: dia em que o animal foi comprado, dia em que o insumo foi consumido) |
| **Data de vencimento** | Data em que o pagamento deve ocorrer |
| **Data de pagamento** | Data em que o pagamento foi efetivamente realizado |
| **Realizado** | O fato econômico ocorreu (animal saiu, insumo foi usado, serviço foi prestado) |
| **Previsto** | Custo ou receita planejada que ainda não ocorreu |
| **Pago** | O fluxo financeiro (dinheiro) foi liquidado |

---

## Impacto na projeção de cenários

Cenários (Sprint 9) operam sobre **valores projetados**, não sobre movimentações financeiras.

A projeção calcula:
- Receita esperada com base em peso projetado × preço de arroba escolhido
- Custo esperado = custo de aquisição + custo diário × dias
- Resultado projetado = receita esperada − custo esperado

Isso é **independente** do modelo caixa/competência porque usa inputs hipotéticos, não movimentações reais. A comparação com o lote base usa `getResumoLote` (resultado acumulado realizado).

---

## Casos críticos para pecuária

| Situação | Problema atual | Solução futura |
|----------|---------------|----------------|
| Compra parcelada (3×) | Lançada uma vez como custo total na data da compra | Lançar 3 movimentações com `data_competencia` + `data_pagamento` diferentes |
| Venda a prazo (30/60/90d) | Registrada como receita na data da venda | Receita com `status='realizado'`, pagamento com `status='pago'` quando liquidado |
| Custo de arrendamento anual | Lançado em janeiro, distorce o mês | Lançar por competência mensal (R$ total / 12) |

---

## Pendências de implementação

| ID | Descrição | Prioridade |
|----|-----------|-----------|
| D-003a | Aplicar migration com campos `status`, `data_competencia`, `data_pagamento` | Alta |
| D-003b | Atualizar `getResumoLote` para filtrar `status IN ('realizado', null)` | Alta |
| D-003c | Criar relatório de fluxo de caixa filtrado por `status = 'pago'` | Média |
| D-003d | UI para lançar movimentações com status e datas separadas | Média |
| D-003e | Migrar dados legados: `status = 'realizado'` por padrão | Baixa |

---

## O que NÃO mudar agora

- `getResumoLote` continua funcionando como está — backward-compatible
- Projeções de cenário não dependem de movimentações financeiras reais
- Nenhuma migration aplicada antes de Sprint 10+
- Nenhuma tela nova de fluxo de caixa nesta sprint
