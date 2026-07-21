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
