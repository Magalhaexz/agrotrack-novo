# SPRINT 8 — Resultado: Rateio de Custos + Labels de Arroba Carcaça

**Data:** 2026-06-16
**Status:** Concluída ✅

---

## Objetivo

Implementar uma primeira versão funcional de rateio de custos indiretos entre lotes e corrigir dois bugs de cálculo e quatro labels incorretos que confundiam arroba viva com arroba carcaça.

---

## Bugs de cálculo corrigidos

### B-01 — `FinanceiroPage.jsx` calculava `lucroPorArroba` sobre arroba viva ✅

**Problema:** linha 82 usava `resumo.arrobasProduzidas` (arroba viva) como divisor do lucro por arroba. O resultado estava incorreto em ~48% para rendimento carcaça de 52%.

**Correção:**
```js
// antes
lucroPorArroba: resumo.arrobasProduzidas ? lucroTotal / resumo.arrobasProduzidas : 0,
// depois
lucroPorArroba: resumo.arrobasCarcaca ? lucroTotal / resumo.arrobasCarcaca : 0,
```

**Arquivo:** `src/pages/FinanceiroPage.jsx`

---

### B-02 — Fallback de `lucroPorArroba` em `resumoLote.js` usava arroba viva ✅

**Problema:** quando `calcularResultadoLote` não retornava `lucroPorArroba`, o fallback em `getResumoLote` dividia por `arrobasProduzidas` em vez de `arrobasCarcaca`.

**Correção:**
```js
// antes
const lucroPorArroba = toNumber(financeiro?.lucroPorArroba) || safeDivide(lucroTotal, arrobasProduzidas);
// depois
const lucroPorArroba = toNumber(financeiro?.lucroPorArroba) || safeDivide(lucroTotal, arrobasCarcaca);
```

**Arquivo:** `src/domain/resumoLote.js`

---

## Labels corrigidos

| Arquivo | Antes | Depois |
|---------|-------|--------|
| `src/pages/FinanceiroPage.jsx:209` | `Lucro por arroba` | `Lucro/@ carcaça` |
| `src/pages/FinanceiroPage.jsx:338` | `<th>Lucro/@</th>` | `<th>Lucro/@ carcaça</th>` |
| `src/components/ResultadoLoteCard.jsx:48` | `Lucro por @` | `Lucro/@ carcaça` |
| `src/domain/resumoLote.js:26` | `Custo por arroba elevado.` | `Custo/@ carcaça elevado.` |

`ArrobaPreview.jsx` e `VendaLoteModal.jsx` **não foram alterados** — nesses contextos o campo representa explicitamente a arroba viva e os nomes estão corretos.

---

## Rateio de custos compartilhados

### Como funciona

O produtor lança um custo compartilhado (ex: energia elétrica R$ 3.000,00) informando:

1. Descrição
2. Valor total
3. Data
4. Categoria
5. Critério de rateio
6. Lotes participantes

O sistema distribui o valor e gera uma `movimentacao_financeira` de **despesa** para cada lote participante. As movimentações entram automaticamente no `getResumoLote` de cada lote.

### Critérios disponíveis

| Critério | Distribuição | Caso de uso típico |
|----------|-------------|-------------------|
| `cabecas` | Proporcional ao nº de cabeças | Mão de obra, veterinário |
| `peso` | Proporcional ao peso total do lote (cabeças × peso médio) | Ração base, suplemento |
| `igualitario` | Partes iguais | Custo fixo de energia, arrendamento |

### Exemplo

Custo: R$ 3.000,00 · Critério: por cabeças
- Lote A: 100 cab → R$ 1.000,00
- Lote B: 200 cab → R$ 2.000,00

### Rastreabilidade

A descrição da movimentação gerada segue o padrão:
```
Rateio — <descrição do custo> — critério: <critério em PT-BR>
```
Exemplo: `Rateio — Energia elétrica — critério: cabeças`

O campo `origem_tipo` é sempre `'rateio'`.

### Comportamento com zero

Parcelas com `custoRateado = 0` (ex: lote sem cabeças em rateio por cabeças) **não geram movimentações financeiras**.

---

## Arquivos alterados

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/domain/resumoLote.js` | Alterado | Bug B-02 + label insight |
| `src/pages/FinanceiroPage.jsx` | Alterado | Bug B-01 + 2 labels |
| `src/components/ResultadoLoteCard.jsx` | Alterado | 1 label |
| `src/services/custosCompartilhados.js` | **Novo** | Service de rateio |
| `src/pages/CustosCompartilhadosPage.jsx` | **Novo** | Tela de rateio |
| `src/services/custosCompartilhados.test.js` | **Novo** | Testes do service |
| `src/navigation/navConfig.js` | Alterado | Item no menu Financeiro |
| `src/App.jsx` | Alterado | Lazy import + pageMap |
| `src/auth/perfis.js` | Alterado | Permissão da nova página |

---

## Testes criados

**Arquivo:** `src/services/custosCompartilhados.test.js` — 15 testes

| # | Cenário |
|---|---------|
| 1 | Rateio por cabeças proporcional |
| 2 | Rateio por peso proporcional |
| 3 | Rateio igualitário em partes iguais |
| 4 | Valor total zero → rateio zerado, sem movimentações |
| 5 | Lote sem cabeças recebe zero (critério cabeças) |
| 6 | Lote sem peso recebe zero (critério peso) |
| 7 | Soma dos rateios = custo total (cabeças) |
| 8 | Soma dos rateios = custo total (peso) |
| 9 | Soma dos rateios = custo total (igualitário) |
| 10 | Movimentação com campos obrigatórios corretos |
| 11 | IDs das movimentações são únicos e maiores que max existente |
| 12 | Erro quando descrição vazia |
| 13 | Erro quando loteIds vazio |
| 14 | Erro quando critério inválido |
| 15 | Erro quando valor negativo |

---

## Resultado dos gates

```
node --test src/**/*.test.js
→ tests 58 | pass 58 | fail 0

npm run lint
→ (sem erros)

npm run build
→ ✓ built in 1.29s (199 módulos)
```

---

## Pendências

| ID | Descrição |
|----|-----------|
| P-01 | `custoPorArroba` em `resumoLote.js` ainda usa `arrobasProduzidas` — avaliar se deve usar `arrobasCarcaca` também |
| P-02 | UI de rateio não exibe histórico de rateios anteriores — funcionalidade útil para Sprint futura |
| P-03 | Não há validação de duplicidade de rateio (mesmo custo lançado duas vezes no mesmo dia) |
| P-04 | Lint continua com warnings pré-existentes de React Hooks — não introduzidos nesta sprint |
