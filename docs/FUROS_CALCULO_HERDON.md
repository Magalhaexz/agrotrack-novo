# Furos de Cálculo no HERDON — Sprint 6 / Sprint 7

> Analisado em 2026-06-16. Baseado na comparação entre os PDFs de referência agropecuária e os arquivos de cálculo do HERDON.

---

## Legenda de prioridade

- **P0** — Quebra o resultado financeiro. Pode exibir lucro/prejuízo errado ao produtor.
- **P1** — Distorce decisão do produtor. Indicadores relevantes com lógica incorreta.
- **P2** — Inconsistência importante. Não quebra imediatamente, mas pode induzir erro.
- **P3** — Melhoria futura. Não implementado, mas sem impacto imediato crítico.

---

## F-01 — P0: Duas fontes de custo independentes podem exibir valores diferentes

**Arquivo:** `src/utils/calculations.js:117-120` e `src/domain/calculos.js:19-67`

**Descrição:**

O sistema tem duas fontes de custo paralelas:
1. `calcLote()` soma a tabela legada `custos[]` para gerar `totalCustos`
2. `calcularCustoLote()` soma `movimentacoes_financeiras[]` (tipo='despesa') + deduplication dos custos legados

O alerta "Margem projetada negativa" (`computeAlerts`) usa `calcLote.totalCustos` (de `custos[]`).  
O resultado financeiro exibido no dashboard do lote usa `getResumoLote.custoTotal` (de `movimentacoes_financeiras`).

Se um custo existe apenas em `movimentacoes_financeiras` e não em `custos[]`, os dois valores diferem.  
O produtor pode ver um dashboard sem alerta enquanto o lote está no prejuízo — ou receber um alerta falso.

**Evidência:**
```js
// calculations.js:120 — custo legado
const totalCustos = custosDoLote.reduce((sum, item) => sum + toNumber(item.val), 0);

// calculos.js:36 — custo financeiro correto
const despesasLote = movimentosFinanceiros.filter(
  (mov) => mov.tipo === 'despesa' && pertenceAoLote(mov, loteId)
);
```

**Risco:** Alerta de margem pode estar desatualizado em relação ao resultado real exibido.

**Ação:** Consolidar `computeAlerts` para usar `calcularResultadoLote` como fonte de custo.

---

## F-02 — P1: Animais vendidos/mortos incluídos no cálculo de cabeças e peso médio

**Arquivo:** `src/domain/calculos.js:119-127` e `src/utils/calculations.js:116-156`

**Descrição:**

`calcularResultadoLote` filtra animais apenas por `lote_id`, sem filtrar por `status`:

```js
// calculos.js:119-121
const animaisLote = animais.filter((item) => pertenceAoLote(item, loteId));
const qtdCabecas = animaisLote.reduce((acc, item) => acc + toNonNegativeNumber(item.qtd), 0);
const pesoMedioAtual = ...baseado em animaisLote...
```

Igualmente `calcLote` em `calculations.js:116`:
```js
const animaisDoLote = animais.filter((item) => toNumber(item.lote_id) === toNumber(loteId));
```

Por contraste, `computeEvolucaoRebanho` e `calculateUaLayer` usam `isAtivo(animal)` corretamente:
```js
// evolucaoRebanho.js:39
estoqueAtual = animais.reduce((sum, animal) => sum + (isAtivo(animal) ? toNonNegativeNumber(animal?.qtd || 1) : 0), 0);
```

**Impacto:**
- `qtdCabecas` inflado → `lucroPorCabeca` subestimado
- `pesoMedioAtual` distorcido → `arrobasTotaisVivas` errado → `lucroPorArroba` errado
- `arrobasProduzidas` em `calcLote` pode incluir ganho de animais já saídos

**Ação:** Adicionar filtro de status em `calcularResultadoLote` e `calcLote`, usando a mesma função `isAtivo` de `evolucaoRebanho.js`.

---

## F-03 — P1: GMD usa campo `item.dias` fixo, não calculado dinamicamente ✅ Corrigido Sprint 7

**Arquivo:** `src/utils/calculations.js` (função `calcLote`, função interna `calcGmd`)

**Descrição:**

O GMD em `calcLote` era calculado com `item.dias` de cada registro do animal:

```js
const days = Math.max(toNumber(item.dias), 1); // item.dias é fixo → bug
```

Se `item.dias` foi definido na criação do registro e não é atualizado a cada pesagem, o GMD fica congelado. À medida que o lote avança, o GMD calculado pelo app diverge do GMD real.

**Correção (Sprint 7):**
- Adicionado `calcularDiasNoLote(dataEntrada, dataReferencia)` em `calcHelpers.js`
- `calcLote` recebe parâmetro opcional `referenceDate` (padrão: hoje) para facilitar testes determinísticos
- `calcGmd` usa `item.data_entrada || lote.entrada` + `calcularDiasNoLote()` para calcular dias reais
- A variável `dias` (média ponderada de tempo no lote) também é calculada dinamicamente
- Fallback para `item.dias` quando nenhuma data está disponível (graceful degradation)

```js
const dataEntrada = item.data_entrada || lote.entrada;
const days = dataEntrada
  ? Math.max(calcularDiasNoLote(dataEntrada, referenceDate), 1)
  : Math.max(toNumber(item.dias), 1);
```

**Testes:** 6 casos em `src/utils/calculations.test.js` e 6 em `src/domain/calcHelpers.test.js`

---

## F-04 — P2: `lucroPorArroba` calculado sobre arroba viva, não carcaça ✅ Corrigido Sprint 7

**Arquivo:** `src/domain/calculos.js` (função `calcularResultadoLote`)

**Descrição:**

O mercado brasileiro de carne bovina comercializa o boi gordo por **arroba de carcaça** (rendimento × peso / 15). Calcular lucro/@ sobre arrobas vivas subestimava o valor por arroba — pois @ carcaça = @ viva × rendimento (ex: 52%), logo havia ~48% mais arrobas no denominador → lucro/@ ~48% menor do que o correto.

**Correção (Sprint 7):**
- `calcularResultadoLote` agora busca `lote.rendimento_carcaca` de `db.lotes` (padrão 52% — zebuínos/Nelore)
- Calcula `arrobasCarcaca = qtdCabecas × pesoMedioAtual × rendimento / 15`
- `lucroPorArroba = lucroTotal / arrobasCarcaca` — padrão de mercado
- Campo `arrobaViva` mantido no retorno para backward compatibility e exibição informativa

```js
const rendimentoCarcaca = toNumber(lote?.rendimento_carcaca || 52) / 100;
const arrobasCarcaca = safeDivide(qtdCabecas * pesoMedioAtual * rendimentoCarcaca, 15);
const lucroPorArroba = safeDivide(lucroTotal, arrobasCarcaca);
```

**Resolvido Sprint 8:** Labels corrigidos em `FinanceiroPage.jsx` (×2), `ResultadoLoteCard.jsx` e `resumoLote.js`. Bug de cálculo adicional corrigido: `FinanceiroPage.jsx` usava `arrobasProduzidas` em vez de `arrobasCarcaca` como divisor do `lucroPorArroba`; fallback em `resumoLote.js` também corrigido.

**Testes:** 5 casos em `src/domain/calculos.test.js`

---

## F-05 — P2: `margemProjetada` em `calcLote` pode duplicar custo de compra dos animais

**Arquivo:** `src/utils/calculations.js:164-166`

**Descrição:**

```js
const investimento = toNumber(lote.investimento || 0);
const receitaProjetada = arrobasCarcaca * precoArroba;
const margemProjetada = receitaProjetada - (totalCustos + investimento);
```

Se `lote.investimento` representa o custo de compra dos animais e esse valor também foi lançado como `movimentacoes_financeiras` com `categoria = 'compra_animal'`, e se esse custo migrou para `custos[]`, há risco de dupla contagem na margem projetada.

**Ação:** Verificar se `lote.investimento` é um campo legado que representa apenas o custo de compra. Se já está em `movimentacoes_financeiras`, remover do cálculo de `margemProjetada` ou deixar apenas como campo informativo.

---

## F-06 — P2: Receita líquida não desconta frete, comissão e impostos sobre venda

**Arquivo:** `src/domain/calculos.js:76-103`

**Descrição:**

A receita é calculada somando todos os movimentos do tipo 'receita' sem qualquer dedução:

```js
const receitasLote = movimentosFinanceiros.filter(
  (mov) => mov.tipo === 'receita' && pertenceAoLote(mov, loteId)
);
```

Na pecuária, a receita real de uma venda de animais costuma ter deduções: frete de saída, comissão do corretor (2–5%), taxa do frigorífico. Se esses valores não são lançados separadamente como `despesa`, o sistema trata a receita bruta como receita líquida.

**Ação:** Documentar no glossário a diferença entre receita bruta e receita líquida. Garantir que frete e comissão sejam lançados como `despesa` no lote.

---

## F-07 — P2: Duplicação de lógica de arrobas produzidas (duas implementações) ✅ Corrigido Sprint 7

**Arquivo:** `src/utils/calculations.js` (função `calcLote`)

**Descrição:**

Havia duas implementações independentes de `arrobasProduzidas` que podiam divergir se uma fosse alterada sem a outra.

**Correção (Sprint 7):**
- `calcLote` agora importa e usa `calcularArrobasProduzidas` de `indicadores.js` por grupo de animais:

```js
import { calcularArrobasProduzidas } from '../domain/indicadores.js';
// ...
const arrobasProduzidas = animaisDoLote.reduce(
  (sum, item) => sum + calcularArrobasProduzidas(toNumber(item.p_ini), toNumber(item.p_at), toNonNegativeNumber(item.qtd)),
  0
);
```

- A abordagem por grupo (em vez de médias globais) mantém precisão quando animais têm pesos iniciais diferentes.

**Testes:** 2 casos em `src/utils/calculations.test.js`

---

## F-08 — P2: Rateio de custos indiretos entre lotes não implementado ✅ Funções criadas Sprint 7

**Arquivo:** `src/domain/rateio.js` (novo)

**Descrição:**

Segundo COT104 (Embrapa) e TCC (UFG), custos como mão de obra, manutenção, energia e arrendamento são comuns à fazenda e devem ser rateados proporcionalmente entre os lotes ativos. Sem rateio, o produtor precisa calcular e lançar manualmente em cada lote.

**Implementação Sprint 7 — funções puras (não integradas à UI):**

```js
// Proporcional ao número de cabeças — ex: mão de obra por animal
ratearPorCabecas(custoTotal, [{ lote_id, qtdCabecas }])

// Proporcional ao peso vivo total — ex: ração base por biomassa
ratearPorPeso(custoTotal, [{ lote_id, pesoTotal }])

// Partes iguais — ex: custo fixo de energia dividido por lotes ativos
ratearIgualitario(custoTotal, quantidadeLotes)
```

**Pendência de integração:** As funções estão disponíveis para uso interno mas não há tela ou fluxo para que o produtor aplique o rateio automaticamente. Integração futura requer: (1) tela de lançamento de custo compartilhado, (2) seleção do critério de rateio, (3) criação automática das movimentações em cada lote.

**Testes:** 11 casos em `src/domain/rateio.test.js`

---

## F-09 — P3: Custo de oportunidade do capital não calculado

**Arquivo:** (ausente no sistema)

**Descrição:**

A estrutura correta de custo total (COT104/Embrapa) é: `CT = COP + CK`.  
`CK` é o custo de oportunidade sobre o capital investido (valor dos animais + insumos × taxa de juros alternativa × período).

Sem CK, o produtor que compara a pecuária com outra aplicação financeira não tem o cálculo completo.

**Ação P3:** Campo opcional de taxa de oportunidade % ao ano por lote. Calcular e exibir o CK.

---

## F-10 — P3: Depreciação de benfeitorias e equipamentos não calculada

**Arquivo:** (ausente no sistema)

**Descrição:**

Depreciação de instalações (currais, silos, cochos), maquinário e reprodutores pertence ao `COP = DES + DEP + CADM`. Sem ela, o custo real é subestimado.

**Ação P3:** Módulo de patrimônio com vida útil e valor residual para calcular depreciação por ciclo.

---

## F-11 — P3: Pró-labore / custo de administração não modelado

**Arquivo:** (ausente no sistema)

**Descrição:**

`CADM` é a remuneração do produtor como administrador da fazenda. Sem esse custo, fazendas gerenciadas pelo próprio dono aparecem com custo subestimado vs fazendas com gerente contratado.

---

## F-12 — P3: @/ha/ano não calculado no resultado do lote

**Arquivo:** (ausente no resultado do lote)

**Descrição:**

`@/ha/ano = Arrobas Produzidas / Área (ha) / (Dias do Ciclo / 365)` é o principal indicador de produtividade de terra. Não aparece no resultado do lote.

---

## F-13 — P3: Razão Benefício/Custo e Ponto de Equilíbrio não exibidos

**Arquivo:** (ausente no sistema)

**Descrição:**

```
RBC = Receita Total / Custo Total
Ponto Equilíbrio (@) = Custo Total / Preço por @
```

São indicadores básicos de análise econômica ausentes no HERDON.

---

## Resumo executivo

| ID | Prioridade | Área Afetada | Status |
|----|-----------|--------------|--------|
| F-01 | P0 | Alertas vs Dashboard — fontes de custo inconsistentes | ✅ Corrigido Sprint 6 |
| F-02 | P1 | Cabeças e peso médio — animais inativos incluídos | ✅ Corrigido Sprint 6 |
| F-03 | P1 | GMD — campo `dias` fixo, não dinâmico | ✅ Corrigido Sprint 7 |
| F-04 | P2 | Lucro/@ — arroba viva em vez de carcaça | ✅ Corrigido Sprint 7 |
| F-05 | P2 | Margem projetada — possível dupla contagem de investimento | Aberto |
| F-06 | P2 | Receita — frete/comissão não obrigatoriamente deduzidos | Aberto |
| F-07 | P2 | Arrobas produzidas — lógica duplicada | ✅ Corrigido Sprint 7 |
| F-08 | P2 | Rateio de custos indiretos — não implementado | ✅ Funções criadas Sprint 7 (sem UI) |
| F-09 | P3 | Custo de oportunidade — não calculado | Backlog |
| F-10 | P3 | Depreciação — não calculada | Backlog |
| F-11 | P3 | Pró-labore / CADM — não modelado | Backlog |
| F-12 | P3 | @/ha/ano — não calculado | Backlog |
| F-13 | P3 | RBC e Ponto de Equilíbrio — não calculados | Backlog |
