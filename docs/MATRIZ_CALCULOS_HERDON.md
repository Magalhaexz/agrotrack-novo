# Matriz de Cálculos — PDFs vs HERDON

> Sprint 6 — 2026-06-16. Comparação entre as regras dos PDFs de referência e a implementação atual do HERDON.

---

## Legenda

- ✅ Implementado e correto
- ⚠️ Implementado mas com divergência ou risco
- ❌ Não implementado
- 🔵 Parcial ou indiretamente atendido

---

## Tabela principal

| # | Regra (PDF de referência) | Fonte PDF | Fórmula | HERDON já calcula? | Arquivo / Função | Está correto? | Divergência | Risco | Ação |
|---|--------------------------|-----------|---------|-------------------|------------------|--------------|-------------|-------|------|
| 1 | GMD em g/dia | BR-CORTE, CONTROLPEC | `(PF−PI)/dias × 1000` | ✅ Sim | `indicadores.js:10` — `calcularGMD` | ✅ Fórmula correta | `calcLote` usa campo `item.dias` fixo | P1 — GMD desatualizado | Ver F-03 |
| 2 | GMD em kg/dia | SENAR 232 | `(PF−PI)/dias` | ✅ Sim | `calculations.js:131-141` — `calcGmd` | ⚠️ Campo dias fixo | Mesmo problema | P1 | Ver F-03 |
| 3 | Arroba viva | SENAR, CONTROLPEC | `Peso / 15` | ✅ Sim | `arroba.js:42` | ✅ Correto | — | — | — |
| 4 | Arroba carcaça | SENAR, COT104 | `Peso × Rend% / 15` | ✅ Sim | `arroba.js:43-44` | ✅ Correto | — | — | — |
| 5 | Arrobas produzidas | COT104, TCC | `(PF−PI) × Qtd / 15` | ✅ Sim | `calculations.js:143-144` | ⚠️ Lógica duplicada | Duplicação com `indicadores.js:22` | P2 | Ver F-07 |
| 6 | Rendimento de carcaça | BR-CORTE, SENAR | `Peso × Rend% / 100` | ✅ Sim | `indicadores.js:71` | ✅ Correto | Padrão 52% OK | — | — |
| 7 | Custo total do lote | COT104, TCC | `Σ despesas lote` | ✅ Sim | `calculos.js:19` | ✅ Correto | Mas `calcLote` usa fonte diferente | P0 | Ver F-01 |
| 8 | Custo de compra dos animais | COT104, TCC | `Qtd × Preço/cab` | ✅ Sim | `calculos.js:40-42` `categoria='compra_animal'` | ✅ Correto | `lote.investimento` pode duplicar | P2 | Ver F-05 |
| 9 | Custo de estoque (alimentos) | TCC, SENAR | `Qtd × Preço_kg` | 🔵 Parcial | `calculos.js:43-45` `categoria='compra_estoque'` | ⚠️ Entra no custo, mas vínculo por lote depende de lançamento manual | P2 | Documentar |
| 10 | Receita total | COT104, TCC | `Σ receitas lote` | ✅ Sim | `calculos.js:76-103` | ⚠️ Inclui bruta sem deduzir frete/comissão | P2 | Ver F-06 |
| 11 | Receita por arroba | TCC | `Receita / @ carcaça vendida` | ⚠️ Parcial | `calculos.js:128-132` | ⚠️ Usa @ viva | P2 | Ver F-04 |
| 12 | Lucro / Prejuízo | COT104, TCC | `Receita − Custo` | ✅ Sim | `calculos.js:117` | ✅ Correto | — | — | — |
| 13 | Margem % | TCC, CONTROLPEC | `Lucro / Receita × 100` | ✅ Sim | `calculos.js:133` | ✅ Correto | — | — | — |
| 14 | Custo por cabeça | TCC, CONTROLPEC | `Custo Total / Qtd Cab` | ✅ Sim | `resumoLote.js:52` | ⚠️ Qtd pode incluir inativos | P1 | Ver F-02 |
| 15 | Custo por arroba | COT104, TCC | `Custo Total / @ produzidas` | ✅ Sim | `resumoLote.js:53` | ✅ Usa financeiro correto | — | — | — |
| 16 | Lucro por cabeça | TCC | `Lucro / Qtd Cab` | ✅ Sim | `calculos.js:130` | ⚠️ Qtd pode incluir inativos | P1 | Ver F-02 |
| 17 | Lucro por arroba | TCC | `Lucro / @ carcaça` | ⚠️ Parcial | `calculos.js:131-132` | ⚠️ Usa @ viva | P2 | Ver F-04 |
| 18 | Taxa de mortalidade | CONTROLPEC | `(Mortes / Qtd Entrada) × 100` | ✅ Sim | `indicadores.js:31-35` | ✅ Correto | — | — | — |
| 19 | Evolução do rebanho | CONTROLPEC | `EI + Entradas − Saídas` | ✅ Sim | `evolucaoRebanho.js:31-97` | ✅ Correto | Usa `isAtivo()` | — | — |
| 20 | Taxa de desfrute | CONTROLPEC | `(Vendas−Compras+Variação)/EI × 100` | ✅ Sim | `indicadoresEstrategicos.js:145` | ✅ Correto | — | — | — |
| 21 | UA — Unidade Animal | CONTROLPEC | `Peso / 450` | ✅ Sim | `unidadeAnimal.js` | ✅ Correto | — | — | — |
| 22 | Taxa de lotação | CONTROLPEC | `UA Total / Área ha` | ✅ Sim | `indicadoresEstrategicos.js:113` | ✅ Correto | — | — | — |
| 23 | Peso médio atual | SENAR, CONTROLPEC | `Σ (Peso × Qtd) / Σ Qtd` | ⚠️ Parcial | `calculos.js:122-127` | ⚠️ Inclui animais inativos | P1 | Ver F-02 |
| 24 | Custo por cabeça/dia | TCC, COT104 | `Custo / (Qtd × Dias)` | ✅ Sim | `indicadores.js:59-63` | ✅ Correto | — | — | — |
| 25 | Estoque de insumos | SENAR | `Saldo = Entrada − Saída` | 🔵 Parcial | (módulo de estoque existente) | ⚠️ Vínculo ao lote depende de lançamento | P2 | Documentar |
| 26 | Dias de estoque | SENAR | `Saldo / Consumo/Dia` | ✅ Sim | `calculations.js:170` | ✅ Correto | Baseado em % PV | — | — |
| 27 | CMS — Consumo Matéria Seca | BR-CORTE, SENAR | `CMS = −0,6273 + 0,06453×PC^0.75 + ...` | ❌ Não | — | ❌ Não implementado | — | P3 — Backlog |
| 28 | CT = COP + CK (Custo Total completo) | COT104 | `CT = DES + DEP + CADM + CK` | ❌ Parcial | Só `DES` implementado | ❌ Sem DEP, CADM, CK | P3 | Backlog |
| 29 | Depreciação | COT104 | `(Valor−Residual) / Vida Útil` | ❌ Não | — | ❌ Não implementado | P3 | Backlog |
| 30 | Custo de oportunidade | COT104, TCC | `Capital × Taxa × Período` | ❌ Não | — | ❌ Não implementado | P3 | Backlog |
| 31 | Pró-labore / CADM | COT104, CONTROLPEC | `Valor mensal × meses do ciclo` | ❌ Não | — | ❌ Não implementado | P3 | Backlog |
| 32 | Rateio de custos indiretos | TCC | `Custo × (Parte/Total)` | ❌ Não | — | ❌ Não implementado | P2 | Ver F-08 |
| 33 | Razão Benefício/Custo | TCC | `Receita / Custo Total` | ❌ Não | — | ❌ Não calculado | P3 | Backlog |
| 34 | Ponto de Equilíbrio | TCC | `Custo Total / Preço/@` | ❌ Não | — | ❌ Não calculado | P3 | Backlog |
| 35 | @/ha/ano | CONTROLPEC | `@ Produzidas / ha / (Dias/365)` | ❌ Não | Arrobas vendidas/ha calculado mas não @/ha/ano por lote | P3 | Backlog |
| 36 | Projeção de receita | (sistema) | `@Carcaça × Preço/@` | ✅ Sim | `calculations.js:165-166` | ✅ Correto (é estimativa) | Alertado como não-oficial | — | — |
| 37 | Simulação de cenários | (sistema) | Projeção de estoque+receita+custo | ✅ Sim | `simuladorCenarios.js` | ✅ Correto como estimativa | — | — | — |

---

## Resumo de status

| Status | Qtd | % |
|--------|-----|---|
| ✅ Implementado e correto | 20 | 54% |
| ⚠️ Implementado com divergência | 10 | 27% |
| ❌ Não implementado | 7 | 19% |

---

## Itens críticos para correção imediata (P0/P1)

1. **F-01** — Unificar fonte de custo nos alertas para usar `calcularCustoLote`
2. **F-02** — Filtrar animais inativos em `calcularResultadoLote` e `calcLote`
3. **F-03** — Calcular `dias` dinamicamente em `calcGmd`
