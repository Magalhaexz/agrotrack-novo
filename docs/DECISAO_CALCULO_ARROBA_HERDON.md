# Decisão — Cálculo Oficial de Arroba no HERDON

Contrato oficial para todo cálculo de arroba, custo por arroba e lucro por arroba no produto. Motivado pela Sprint 13 (auditoria 360°), que encontrou pelo menos 3-4 definições de "arroba" e 8 arquivos calculando custo/lucro por arroba com bases diferentes — o risco mais crítico do produto, por ser o número central de decisão de venda.

Fonte única de verdade da implementação: [`src/domain/arroba.js`](../src/domain/arroba.js).

## As três arrobas

### 1. Arroba de peso vivo
```
pesoKg / 15
```
**Uso:** referência zootécnica, evolução de peso, leitura física do animal/lote. **Nunca** usar para decisão econômica (venda, custo, lucro) — só para acompanhamento de crescimento.

Implementação: `calcularArrobasPesoVivo(pesoKg)`.

### 2. Arroba de carcaça
```
(pesoKg * rendimentoCarcaca) / 15
```
**Uso:** venda, receita, custo por arroba comercial, lucro por arroba, decisão econômica. **Esta é a base de toda decisão econômica do HERDON.**

Implementação: `calcularArrobasCarcaca(pesoKg, rendimentoCarcaca)`.

### 3. Arroba de ganho (carcaça)
```
((pesoFinalKg - pesoInicialKg) * rendimentoCarcaca) / 15
```
**Uso:** ganho no ciclo, eficiência de engorda, análise de confinamento/cenário. Mede produção no período, não o estoque total do lote.

Implementação: `calcularArrobasGanho(pesoInicialKg, pesoFinalKg, rendimentoCarcaca)`.

> Nota de compatibilidade: `src/domain/indicadores.js` já tinha `calcularArrobasProduzidas(pesoInicial, pesoFinal, qtdCabecas)` — uma arroba de ganho **sem** rendimento de carcaça (peso vivo puro). Essa função **não foi removida** (é usada por `utils/calculations.js`/`calcLote`, explicitamente documentada ali como projeção zootécnica, não financeira oficial) e continua existindo para esse uso específico. `calcularArrobasGanho` (nova, com rendimento) é a versão para leitura econômica; as duas coexistem porque respondem perguntas diferentes ("quanto o lote ganhou fisicamente" vs. "quanto isso vale em arroba de carcaça").

## Custo e lucro por arroba

**Regra inegociável: custo/@ e lucro/@ de um mesmo lote/relatório usam sempre a MESMA base — arroba de carcaça.** Antes desta sprint, `resumoLote.js` calculava `custoPorArroba` com base em arroba de ganho (`arrobasProduzidas`, sem rendimento) e `lucroPorArroba` com base em arroba de carcaça (`arrobasCarcaca`) — os dois apareciam lado a lado na mesma tela como se fossem comparáveis, e não eram.

```
custoPorArroba = custoTotal / arrobasCarcaca
lucroPorArroba = lucroTotal / arrobasCarcaca
precoVendaPorArroba = receitaTotal / arrobasCarcaca
```

Implementações: `calcularCustoPorArrobaCarcaca`, `calcularLucroPorArrobaCarcaca`, `calcularPrecoVendaPorArrobaCarcaca` — todas em `arroba.js`, todas dividindo pelo mesmo `calcularArrobasCarcaca(pesoKg, rendimentoCarcaca)` internamente, garantindo que os três números nunca divirjam de base entre si.

## Normalização de rendimento de carcaça

`lote.rendimento_carcaca` é armazenado como percentual (ex.: `52`), mas o projeto já tinha alguns pontos aceitando fração (`0.52`). `normalizarRendimentoCarcaca(valor)`:
- aceita `52` **ou** `0.52` — mesmo resultado (`0.52` como fração);
- valores ausentes, zero, negativos ou não numéricos caem no padrão de mercado: **52%** (zebuínos/Nelore, já era o default do projeto antes desta sprint);
- resultado sempre limitado a `[0.01, 1]` — nunca gera divisão fora de escala por um rendimento absurdo (ex.: `500`).

## Onde cada arroba deve aparecer na UI

- Telas de **decisão econômica** (Resultado de Lote, Financeiro, Simulador de Cenários, Central de Alertas, relatórios) → sempre **arroba de carcaça**, com label explícito: **"Custo/@ carcaça"**, **"Lucro/@ carcaça"**, **"Ponto de equilíbrio da @ carcaça"**.
- Telas **técnicas/zootécnicas** (Comparativo de lotes, indicadores de ganho) podem mostrar peso vivo, mas com label explícito: **"Arrobas/cabeça (peso vivo)"**.
- **Proibido**: label genérico "arroba"/"custo/@"/"lucro/@" sem dizer a base — mesmo quando o número está correto, o label ambíguo já é o problema (o usuário não consegue auditar/comparar entre telas).

## Exceção documentada: venda no peso vivo (`VendaLoteModal.jsx`)

O modal de registrar saída/venda calcula o valor da transação em **arroba viva** (`arrobaViva = peso_medio / 15`), não em carcaça — decisão de negócio existente (venda negociada "no vivo" é uma modalidade real de comércio de gado), já rotulada corretamente na UI ("@ viva" / "Preço por @" ao lado do campo de peso vivo, com o preview de carcaça mostrado separadamente via `ArrobaPreview`). **Não alterado nesta sprint** — não é o mesmo tipo de ambiguidade encontrado no restante do produto (aqui a base já é explícita e é uma escolha de fluxo, não um bug de consolidação).

## Funções consolidadas (`src/domain/arroba.js`)

| Função | Contrato |
|---|---|
| `normalizarRendimentoCarcaca(valor)` | Aceita `52` ou `0.52`; default 52%; nunca quebra |
| `calcularArrobasPesoVivo(pesoKg)` | `pesoKg / 15` |
| `calcularArrobasCarcaca(pesoKg, rendimentoCarcaca)` | `(pesoKg * rendimento) / 15` |
| `calcularArrobasGanho(pesoInicialKg, pesoFinalKg, rendimentoCarcaca)` | `((pesoFinalKg - pesoInicialKg) * rendimento) / 15` |
| `calcularCustoPorArrobaCarcaca(custoTotal, pesoKg, rendimentoCarcaca)` | `custoTotal / arrobasCarcaca` |
| `calcularLucroPorArrobaCarcaca(lucroTotal, pesoKg, rendimentoCarcaca)` | `lucroTotal / arrobasCarcaca` |
| `calcularPrecoVendaPorArrobaCarcaca(receitaTotal, pesoKg, rendimentoCarcaca)` | `receitaTotal / arrobasCarcaca` |

Todas usam `safeDivide` (`calcHelpers.js`, já existente) internamente — nunca retornam `NaN`/`Infinity`, sempre `0` com divisor zero/ausente. `calcularIndicadoresArroba` (função original, usada por `ArrobaPreview`/`useArroba`/`VendaLoteModal`) foi **mantida sem alteração** — continua válida para o fluxo de preview em tempo real de formulário.

Detalhe de quem foi migrado para usar essas funções e o resultado dos testes: ver [SPRINT14_CONSOLIDACAO_ARROBA.md](SPRINT14_CONSOLIDACAO_ARROBA.md).
