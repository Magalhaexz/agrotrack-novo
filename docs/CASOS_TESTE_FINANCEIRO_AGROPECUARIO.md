# Casos de Teste Financeiro Agropecuário — HERDON Sprint 6

> Cenários baseados em referências dos PDFs agropecuários analisados. Para uso em testes manuais e testes automatizados.

---

## CT-01 — Compra, manejo e venda total de lote

**Cenário:** Lote de 100 novilhos cruzados Angus×Nelore, entrada em confinamento, venda total após 100 dias.

**Dados de entrada:**
- Qtd animais: 100 cabeças
- Peso médio entrada: 360 kg
- Peso médio saída: 500 kg
- Preço compra: R$ 200/@ viva (= R$ 200 × 24 arrobas = R$ 4.800/cabeça)
- Preço venda: R$ 320/@ carcaça (rendimento 54%)
- Custo de alimentação: R$ 45.000 total (100 dias × R$ 4,50/cab/dia)
- Custo sanidade: R$ 5.000
- Frete entrada: R$ 3.000
- Frete saída: R$ 3.000
- Dias do ciclo: 100

**Cálculos esperados:**

```
Custo de compra:
  Peso médio entrada = 360 kg → 24 @ vivas/cab
  Custo compra = 100 × R$ 4.800 = R$ 480.000

Custo total:
  R$ 480.000 (compra) + R$ 45.000 (alim) + R$ 5.000 (sanidade)
  + R$ 3.000 (frete entrada) + R$ 3.000 (frete saída)
  = R$ 536.000

Arrobas produzidas (ganho):
  Ganho = (500 − 360) × 100 = 14.000 kg
  Arrobas produzidas = 14.000 / 15 = 933,3 @

Arrobas carcaça para venda:
  Peso carcaça = 500 × 54% = 270 kg
  @ carcaça/cab = 270 / 15 = 18 @
  Total @carcaça = 100 × 18 = 1.800 @

Receita total:
  1.800 @ × R$ 320 = R$ 576.000

Lucro = R$ 576.000 − R$ 536.000 = R$ 40.000
Margem % = 40.000 / 576.000 × 100 = 6,9%
Custo/@ produzida = 536.000 / 933,3 = R$ 574,3/@
Lucro/cabeça = 40.000 / 100 = R$ 400/cab
Lucro/@ carcaça = 40.000 / 1.800 = R$ 22,2/@
GMD = (500 − 360) / 100 = 1,4 kg/dia
```

**Função HERDON que deve reproduzir:** `getResumoLote`

**Status atual:** Não testado com dados específicos. F-02 pode distorcer se todos os 100 animais estão ativos.

---

## CT-02 — Venda parcial de animais

**Cenário:** Lote com 100 animais. Na metade do ciclo (50 dias), 30 animais são vendidos. Os 70 restantes continuam.

**Dados de entrada:**
- Qtd entrada: 100 × 360 kg
- Dia 50: venda de 30 animais × 430 kg médio × 54% rendimento × R$ 310/@carcaça
- Dias totais lote: 100 dias para os 70 remanescentes

**Cálculos esperados:**

```
Venda parcial (dia 50):
  @carcaça vendida = 30 × 430 × 0,54 / 15 = 30 × 15,48 = 464,4 @
  Receita parcial = 464,4 × R$ 310 = R$ 143.964

Ao final (dia 100), 70 animais restantes:
  GMD = 1,4 kg/dia → peso saída = 360 + 1,4 × 100 = 500 kg
  @carcaça = 70 × 500 × 0,54 / 15 = 1.260 @
  Receita final = 1.260 × R$ 320 = R$ 403.200

Receita total = R$ 143.964 + R$ 403.200 = R$ 547.164
```

**O que o HERDON deve fazer:**
- Receita deve somar as duas vendas corretamente
- `qtdCabecas` deve ser 70 (ativos) ao final, não 100
- `pesoMedioAtual` deve ser de 70 animais, não 100
- GMD deve ser calculado corretamente para os 70 ativos

**Furo coberto:** F-02 (animais inativos)

**Status atual:** Verificar se venda parcial reduz qtd em `animais[]` ou apenas cria movimento.

---

## CT-03 — Mortalidade durante o ciclo

**Cenário:** Lote com 100 animais. 3 morrem no dia 30. Os 97 restantes completam o ciclo.

**Dados de entrada:**
- Qtd entrada: 100 × 350 kg
- Dia 30: 3 mortes (peso ~380 kg cada)
- Ciclo total: 90 dias
- Peso saída dos 97: 470 kg

**Cálculos esperados:**

```
Taxa de mortalidade = 3 / 100 × 100 = 3%

Arrobas produzidas (apenas animais que completaram o ciclo):
  Ganho = (470 − 350) × 97 = 11.640 kg
  Arrobas produzidas = 11.640 / 15 = 776 @

Custo total inclui todos os custos, inclusive os 3 animais que morreram.
Custo por @produzida = Custo Total / 776 (custo fica maior por causa das mortes)

qtdCabecas final = 97 (apenas ativos)
```

**Furo coberto:** F-02 (status filter), F-03 (dias)

**Status atual:** Verificar se mortes marcam status 'morte' em `animais[]`.

---

## CT-04 — Custo de suplemento consumido e vinculado ao lote

**Cenário:** Lote de 80 novilhos × 400 kg médio. Suplemento a 0,3% do peso vivo. Preço R$ 1,50/kg. Ciclo 60 dias.

**Cálculos esperados:**

```
Consumo/cab/dia = 400 × 0,3% = 1,2 kg
Consumo total/dia = 80 × 1,2 = 96 kg
Consumo total = 96 × 60 = 5.760 kg
Custo total suplemento = 5.760 × R$ 1,50 = R$ 8.640
Custo suplemento/cab = R$ 8.640 / 80 = R$ 108/cab
Custo suplemento/cab/dia = R$ 108 / 60 = R$ 1,80/cab/dia
```

**Função HERDON:** `calculateDailyConsumptionKg` em `calcHelpers.js:89-101` + `calculateConsumptionCost`

**Status atual:** Funções presentes e corretas. Verificar se custo de suplemento é lançado corretamente em `movimentacoes_financeiras` ao debitar do estoque.

---

## CT-05 — Cálculo de arroba produzida e custo/@

**Dados de entrada:**
- Lote: 50 bois zebuínos
- Peso entrada: 300 kg/cabeça
- Peso saída: 450 kg/cabeça
- Custo total: R$ 120.000
- Rendimento carcaça: 52%

**Cálculos esperados:**

```
Ganho total = (450 − 300) × 50 = 7.500 kg
Arrobas produzidas = 7.500 / 15 = 500 @

Custo/@ produzida = 120.000 / 500 = R$ 240/@

Arrobas carcaça totais (para venda):
  450 × 52% = 234 kg carcaça
  234 / 15 = 15,6 @ carcaça/cab
  Total = 50 × 15,6 = 780 @carcaça

Arroba viva = 450 / 15 = 30 @/cab
Total @ viva = 50 × 30 = 1.500 @
```

**Divergência identificada (F-04):** O HERDON calcula `lucroPorArroba` sobre as 1.500 @ vivas, mas o correto seria sobre as 780 @ carcaça.

**Função HERDON:** `calcularIndicadoresArroba`, `calcularArrobasProduzidas`, `calcularCustoPorArroba`

**Status atual:** Arrobas produzidas ✅. Custo/@ produzida ✅. Lucro/@ usa viva em vez de carcaça ⚠️ (F-04).

---

## CT-06 — Cálculo de margem bruta

**Dados de entrada:**
- Receita total: R$ 250.000
- Custo de compra dos animais: R$ 150.000
- Custo de alimentação: R$ 35.000
- Custo de sanidade: R$ 8.000
- Frete e outros: R$ 5.000

**Cálculos esperados:**

```
Custo Total = 150.000 + 35.000 + 8.000 + 5.000 = R$ 198.000
Lucro = 250.000 − 198.000 = R$ 52.000
Margem Bruta (%) = 52.000 / 250.000 × 100 = 20,8%
Razão B/C = 250.000 / 198.000 = 1,26
```

**Função HERDON:** `calcularResultadoLote` + `getResumoLote`

**Status atual:** ✅ Correto para custo, receita e margem%. RBC não calculado (F-13).

---

## CT-07 — Resultado líquido com frete e comissão descontados

**Dados de entrada:**
- Receita bruta de venda: R$ 200.000
- Frete de saída: R$ 5.000
- Comissão 2%: R$ 4.000
- Custo total de produção: R$ 155.000

**Cálculos esperados:**

```
Se frete/comissão lançados como despesa:
  Custo Total = 155.000 + 5.000 + 4.000 = R$ 164.000
  Receita = R$ 200.000
  Lucro = R$ 36.000

Se frete/comissão NÃO lançados:
  Custo Total = R$ 155.000
  Lucro = R$ 45.000 (errado por R$ 9.000)
```

**Furo coberto:** F-06

**Status atual:** Depende do lançamento manual pelo usuário. Sistema não valida se frete/comissão foi lançado.

---

## CT-08 — GMD com múltiplas pesagens

**Dados de entrada:**
- Lote: 60 animais, entrada 01/01 com 350 kg
- Pesagem 01/03 (60 dias): 434 kg
- Pesagem 01/06 (150 dias): 515 kg

**Cálculos esperados:**

```
GMD período 1 (60 dias): (434 − 350) / 60 = 1,4 kg/dia = 1.400 g/dia
GMD período 2 (90 dias): (515 − 434) / 90 = 0,9 kg/dia = 900 g/dia
GMD total (150 dias): (515 − 350) / 150 = 1,1 kg/dia = 1.100 g/dia
```

**Furo coberto:** F-03

**Status atual:** `calcularGMD` em `indicadores.js` tem a fórmula correta, mas `calcLote` usa `item.dias` fixo em vez de calcular dinamicamente.

---

## CT-09 — Lote com custos indiretos rateados

**Dados de entrada:**
- Fazenda com 2 lotes: Lote A (80 cab) e Lote B (120 cab)
- Custo de mão de obra mensal: R$ 6.000
- Rateio por cabeça: A = 80/(80+120) = 40%; B = 60%

**Cálculos esperados:**

```
Custo MO alocado ao Lote A = 6.000 × 40% = R$ 2.400
Custo MO alocado ao Lote B = 6.000 × 60% = R$ 3.600
```

**Furo coberto:** F-08

**Status atual:** Rateio não implementado. Usuário deve lançar manualmente.

---

## CT-10 — Ponto de Equilíbrio e Razão B/C

**Dados de entrada:**
- Custo total do ciclo: R$ 180.000
- Preço de venda: R$ 280/@ carcaça
- Arrobas carcaça disponíveis: 700 @

**Cálculos esperados:**

```
Ponto de Equilíbrio (@) = 180.000 / 280 = 642,9 @
(precisam vender ao menos 643@ para cobrir custos)

Receita total esperada = 700 × 280 = R$ 196.000
Lucro esperado = 196.000 − 180.000 = R$ 16.000
Razão B/C = 196.000 / 180.000 = 1,09
Margem = 16.000 / 196.000 × 100 = 8,2%
```

**Furo coberto:** F-13

**Status atual:** Ponto de equilíbrio e RBC não calculados no HERDON.

---

## Status dos casos de teste

| Caso | Área testada | Furo coberto | Resultado esperado | Automatizado? |
|------|-------------|-------------|-------------------|---------------|
| CT-01 | Resultado financeiro completo | — | ✅ Deve funcionar | ❌ Não |
| CT-02 | Venda parcial | F-02 | ⚠️ Depende de status filter | ❌ Não |
| CT-03 | Mortalidade | F-02 | ⚠️ Depende de status filter | ❌ Não |
| CT-04 | Custo de suplemento | — | ✅ Deve funcionar | ❌ Não |
| CT-05 | Arroba produzida e custo/@ | F-04 | ⚠️ Lucro/@ diverge | ❌ Não |
| CT-06 | Margem bruta | — | ✅ Deve funcionar | ❌ Não |
| CT-07 | Receita líquida (frete/comissão) | F-06 | ⚠️ Depende de lançamento | ❌ Não |
| CT-08 | GMD com múltiplas pesagens | F-03 | ⚠️ GMD fixo | ❌ Não |
| CT-09 | Rateio de custos indiretos | F-08 | ❌ Não implementado | ❌ Não |
| CT-10 | Ponto de equilíbrio e RBC | F-13 | ❌ Não implementado | ❌ Não |
