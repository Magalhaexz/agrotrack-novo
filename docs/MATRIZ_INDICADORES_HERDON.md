# Matriz de Indicadores do HERDON

Fonte da verdade de cada número exibido no app. Um indicador só entra aqui
depois de ter **fonte única de código** e **testes de caso-limite**.

Regra geral: `null` significa "sem dado suficiente para calcular" e a interface
deve exibir `—`. **Nunca** converter `null` em `0` — zero é uma afirmação
("o lote não ganhou peso"), ausência de dado não é.

Status: 🟢 auditado e unificado · 🟡 auditado, pendente de unificação · ⚪ não auditado

---

## 🟢 GMD — Ganho Médio Diário

| Campo | Definição |
|---|---|
| **Fórmula oficial** | `GMD = (peso final − peso base) ÷ dias` |
| **Semântica** | GMD **de vida**: da entrada do lote até a última pesagem |
| **Base** | `lote.entrada` + `lote.p_ini`. Sem eles, cai para a 1ª pesagem |
| **Fim** | Última pesagem de **lote** (pesagem individual de animal não entra) |
| **Fonte de dados** | Tabela `pesagens` (registro autoritativo de peso) |
| **Código** | `src/domain/gmd.js` — `calcularGmdLote` / `gmdDoLote` / `gmdMedioDosLotes` |
| **Arredondamento** | Nenhum no domínio; a UI formata (2 casas em Lotes, 3 em Pesagens) |
| **Escopo de fazenda** | Herda o filtro de fazenda ativa do `db` recebido pela tela |
| **Telas que usam** | Lotes · Pesagens (KPI e aba Evolução) · Comparativo · Relatório do Lote · Alertas (GMD abaixo da meta) · Saúde do Lote · Assistente HERDON |
| **Testes** | `src/domain/gmd.test.js` — 22 casos |

### Casos-limite (comportamento definido e testado)

| Situação | Resultado | Motivo |
|---|---|---|
| Nenhuma pesagem | `null` | `sem_pesagem` |
| 1 pesagem **com** data de entrada | calcula (entrada → pesagem) | — |
| 1 pesagem **sem** data de entrada | `null` | `pesagem_unica_sem_entrada` |
| Intervalo de 0 dias (mesma data) | `null` | `intervalo_zero` |
| Peso menor que o anterior | **GMD negativo** | perda real (seca/doença) — nunca truncar em 0 |
| Pesagem anterior à entrada do lote | ignorada | dado inconsistente |
| Todas as pesagens antes da entrada | `null` | `pesagens_anteriores_a_entrada` |
| Pesagem de animal individual | ignorada no GMD do lote | granularidade diferente |
| Pesagem de outro lote | ignorada | isolamento por lote |
| `peso_medio` nulo/não numérico | descartada | — |
| Vira mês / ano / bissexto | correto | usa data civil, sem erro de fuso |
| GMD médio do rebanho | média dos lotes **com** dado; lotes sem dado ficam fora | contá-los como 0 puxaria o indicador para baixo |

### Histórico

Antes da Sprint 2 existiam **5 implementações independentes**. Para um lote com
ganho forte seguido de estagnação elas devolviam **1,404 e 0,167 kg/dia — 8,4x
de diferença**, o que inverte a decisão de vender ou segurar o lote.

Também havia um bug concreto: `LotesPage` usava `Math.max(1, dias)` e, com duas
pesagens no mesmo dia, exibia **10 kg/dia** (dividia o ganho por um dia que não
existiu). Hoje esse caso devolve `null`.

Implementações removidas/redirecionadas:
- `LotesPage.jsx::calculateGmd30` — janela de 30 dias com o rótulo "GMD" → removida
- `pesagensLote.js::calculateAverageGmdByLote` → removida
- `PesagensPage.jsx::resumoEvolucaoLote` → usa `calcularGmdLote`
- `calculations.js::calcGmd` → só fallback quando o lote não tem pesagem, e
  segue exclusivo para `gmdMacho`/`gmdFemea` (pesagem de lote não separa sexo)
- `relatorios.js` → mantém "variação entre pesagens consecutivas", que é outra
  métrica legítima; **não** deve ser rotulada como "GMD"

> Se no futuro for preciso um "GMD dos últimos 30 dias", ele é bem-vindo — mas
> como função e rótulo próprios (`gmd30`, "GMD 30d"), nunca reusando o nome
> "GMD", que agora significa GMD de vida.

---

## ⚪ Pendentes de auditoria

Domínios que a Sprint 2 ainda não cobriu:

| Domínio | Itens principais |
|---|---|
| Rebanho e lotação | qtd por lote, entradas/saídas, transferências, lotação e taxa de ocupação do pasto, animais órfãos, dupla contagem no consolidado |
| Financeiro | receitas/despesas, fluxo de caixa, custo por lote/cabeça/arroba, rateio, DRE, estornos, parcelas, consolidação multi-fazenda |
| Venda e resultado | peso de venda, arrobas, descontos/comissões/frete, resultado líquido, margem, lote finalizado x indicadores atuais |
| Estoque e consumo | entradas/saídas/ajustes, custo médio, dias de estoque, baixa automática, estoque negativo |
| Indicadores e dashboards | consistência Painel × Resultados × Comparativos × Relatórios × Telegram × exportações |
| Simulador e decisões | preço da arroba, peso projetado, GMD usado, custos futuros, cenários — e separação clara entre dado real e projeção |

---

## 🟡 Rebanho e Lotação — auditado, **pendente de decisão**

> Auditoria da Sprint 2 parte 2. Divergências **documentadas, não corrigidas** —
> a mudança altera números exibidos e precisa de aprovação de produto.

### Fontes concorrentes de "quantidade de animais"

| # | Fonte | Onde é usada |
|---|---|---|
| A | `lote.qtd` (campo agregado) | Lotes, Pastos, Financeiro, Custos, Comparativo, Relatório Resumo Geral |
| B | `soma(animais[].qtd)` | `calculos.js`, `unidadeAnimal` (sem `lotes`), Telegram |
| C | `soma(animais[].qtd \|\| 1)` | `indicadoresEstrategicos`, `simuladorCenarios`, `planos`, `evolucaoRebanho` |
| D | derivado de `movimentacoes_animais` | `evolucaoRebanho.estoque_final` |

A fonte **A** já é tratada como canônica no código (`calculations.js`, `calcularUaPorLote`):
é ela que vendas, mortes, transferências e ajuste de lotação atualizam.
**`animais[].qtd` não é sincronizado por esses eventos** — comentário explícito
em `calculations.js:151`.

O `|| 1` da fonte **C** faz um registro com `qtd = 0` contar como **1 cabeça**.

### Divergências medidas

**Cenário 1 — venda parcial** (lote de 10, vendeu 2 ⇒ `lote.qtd = 8`, `animais[].qtd = 10`):

| Valor | Consumidores |
|---|---|
| **8** | Financeiro, Custos por Lote, Comparativo, Pastos, Relatório Resumo Geral |
| **10** | Evolução do Rebanho, Painel Gerencial |

**Cenário 2 — lote finalizado** (lote ativo com 8 cab + lote vendido com 20 cab):

| Cálculo | UA | Correto? |
|---|---|---|
| esperado (só lote ativo) | 5,333 | — |
| `unidadeAnimal.calcularUaTotalFazenda(animais, lotes)` | 5,333 | ✅ filtra `status === 'ativo'` |
| `ocupacaoPastos.cabecasEstimadas` | 8 cab | ✅ |
| **`computeIndicadoresEstrategicos.uaTotalFazenda`** | **25,333** | ❌ **4,75x inflado** |

### Causa raiz

`indicadoresEstrategicos.js:77-96` **reimplementa o cálculo de UA inline** em vez
de usar o módulo `unidadeAnimal`, e nessa cópia:

1. usa `animais[]` (defasado) em vez de `lote.qtd` (canônico);
2. usa `animal?.qtd || 1` — registro com `qtd = 0` vira 1 cabeça;
3. **não filtra por status do lote** — lote vendido/encerrado segue somando UA.

### Impacto no negócio

A taxa de lotação é o que dispara "superlotado" e a sugestão de **arrendar pasto**.
Com capacidade de 20 UA, o cenário 2 mostra 25,3 (superlotado) quando a realidade
é 5,3 — **73% de capacidade livre**. O produtor é levado a arrendar área ou vender
animais sem necessidade.

### Regra recomendada

> **Quantidade oficial de cabeças de um lote = `lote.qtd`**, com fallback para
> `soma(animais[].qtd)` só quando `lote.qtd == null` (lote legado).
> **Rebanho ativo da fazenda = soma de `lote.qtd` dos lotes com `status === 'ativo'`.**
> Nunca `|| 1`: `qtd = 0` significa zero.

Implementação: `indicadoresEstrategicos` passa a usar `unidadeAnimal.calcularUaPorLote`
/`calcularUaTotalFazenda(animais, lotes)`, que já implementam essa regra corretamente.
Não é criar regra nova — é parar de contornar a que já existe.

### Impacto da mudança

- Indicadores, Painel Gerencial e Evolução passam a exibir números **menores**
  (os corretos) onde havia lote finalizado ou venda registrada.
- Alertas de superlotação deixam de disparar falsamente.
- Nenhuma tela que já usa `lote.qtd` muda.

### Ainda não verificado neste ciclo

Transferência entre fazendas · dupla contagem em "Todas as fazendas" ·
estorno/cancelamento de movimentação · quantidade negativa ·
entrada e saída de pasto no mesmo dia · pasto inativo · animal sem lote.
