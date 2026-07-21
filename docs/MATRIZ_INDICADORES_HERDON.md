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

## 🟢 Rebanho e Lotação — auditado e unificado

> Sprint 2 parte 2/7. Regra aprovada e **implementada** em `src/domain/rebanho.js`.

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

### ✅ Regra oficial implementada

| Campo | Definição |
|---|---|
| **Cabeças do lote** | `lote.qtd`; fallback para `soma(animais[].qtd)` **só** se `lote.qtd` for `null`/`undefined` |
| **Zero** | `qtd = 0` é válido e nunca vira 1 — o padrão `qtd \|\| 1` foi eliminado |
| **Rebanho ativo** | soma de `lote.qtd` dos lotes com status ativo |
| **Status inativos** | `vendido`, `encerrado`, `finalizado`, `inativo`, `cancelado` — fora do rebanho e da UA |
| **Negativo** | normalizado para 0 na leitura; mutações validam saldo antes de gravar |
| **UA do lote** | `UA(peso médio) × cabeças canônicas`, só de lote ativo |
| **Consolidado** | cada lote contado uma vez; lote sem fazenda vai para `SEM_FAZENDA`, separado |
| **Invariante** | `total == soma(porFazenda) + semFazenda` |
| **Código** | `src/domain/rebanho.js` |
| **Testes** | `src/domain/rebanho.test.js` — 31 casos |

### Consumidores migrados

| Módulo | Antes | Agora |
|---|---|---|
| `indicadoresEstrategicos` | UA inline: `animais[]`, `qtd \|\| 1`, sem filtro de status | `uaTotalAtiva` / `uaDoLote` |
| `evolucaoRebanho` | `soma(animais[].qtd \|\| 1)` | `rebanhoAtivo(db)` |
| `planos` (limite/cobrança) | `soma(animais[].qtd \|\| 1)` | `rebanhoAtivo(db)` |

### Comportamento corrigido — medido

| Cenário | Antes | Agora |
|---|---|---|
| Lote finalizado (8 ativas + 20 vendidas) | UA **25,333**, "superlotado" | UA **5,333**, "dentro da capacidade" |
| Venda parcial (`lote.qtd=8`, `animais[]=10`) | 8 ou 10 conforme a tela | **8** em todas |
| **Conta real** (`animais` vazio, rebanho em `lote.qtd`) | **0 cabeças** em Evolução/Painel Gerencial/cobrança | valor correto |

O último é o mais grave: a tabela `animais` está **vazia em produção** — todo o rebanho vive em `lote.qtd`. Quem lia de `animais[]` mostrava zero.

### Validado no navegador

Cenário montado e revertido: lote 14 ativo (20 cab), lotes 9 e 10 encerrados (30 e 50 cab), lote 9 **sem fazenda**.

| Tela | Resultado |
|---|---|
| Painel Geral (Todas as fazendas) | 20 ✅ (exclui as 80 dos encerrados) |
| Painel Geral (fazenda com lote encerrado) | 0 ✅ |
| Pastos | 8,00 UA ✅ (`180 × 20 ÷ 450`) |
| Painel Gerencial | Rebanho 20 · UA 8,00 · "Dentro da capacidade" ✅ |
| Venda parcial (20 → 15) | todas as telas para 15 ✅ |

Dados temporários revertidos: `qtd` voltou a `null` nos três lotes.

### Escrita: validação, atomicidade e concorrência

#### Validação (feito)

`registrarSaidaAnimal` (venda, morte, transferência de saída) agora chama
`validarBaixaRebanho` — fonte única. Antes tinha cópia local da regra.
Cobre: quantidade ≤ 0, saldo insuficiente, resultado negativo, e devolve a
mesma mensagem em todos os fluxos.

#### Atomicidade e concorrência — **assimetria grave entre Telegram e web**

O projeto **já tem** RPCs transacionais no Supabase, e elas são bem construídas:

| RPC | Garantias |
|---|---|
| `registrar_saida_lote` | `app_assert_owner_write` · `SELECT … FOR UPDATE` (lock de linha) · rejeita `qtd ≤ 0` · rejeita `qtd > saldo` · rejeita lote encerrado/vendido · valida e trava o lote de destino · movimentação + baixa + financeiro + entrada no destino **na mesma transação** |
| `ajustar_lotacao_lote` | ajuste de lotação transacional |
| `finalizar_lote` | encerramento transacional |
| `mover_lote_para_pasto` | troca de pasto transacional |

**Só o bot do Telegram usa essas RPCs.** O app web grava por chamadas
sequenciais e valida contra o `db` carregado no navegador. Consequência:

- **Concorrência não protegida no web**: duas abas veem `qtd = 10`, ambas passam
  na validação local e ambas gravam — o banco pode terminar negativo. Pelo
  Telegram, o `FOR UPDATE` impede.
- **Sem atomicidade no web**: se a movimentação grava e o lançamento financeiro
  falha, o estado fica pela metade.

> **Pendência aberta (não resolvida nesta sprint):** migrar o fluxo web de
> venda/morte/transferência para `registrar_saida_lote`, e o ajuste de lotação
> para `ajustar_lotacao_lote`. Não exige RPC nova — as funções já existem,
> testadas e em uso pelo bot. É uma troca do caminho de gravação em
> `services/movimentacoes.js` + `LotesPage`, de risco alto o suficiente para
> merecer sprint própria com validação de campo.

> **Status na Sprint 3:** ✅ **venda e morte/perda migradas.** Ambas gravam por
> `registrar_saida_lote` em `services/saidaLoteTransacional.js`, com o guard de
> `registrarSaidaAnimal` impedindo que reapareça um segundo caminho de escrita
> para esses tipos. **Continuam pendentes:** `transferencia_saida` (envolve o
> lote de destino) e o ajuste de lotação.

## 🟢 Venda e Resultado dos Lotes — auditado e unificado na Sprint 4/7

### Fórmulas oficiais

Fonte única: `src/domain/vendaLote.js` (venda realizada e base de rateio) +
`src/domain/calculos.js::calcularResultadoLote` (resultado econômico).
Base de arroba conforme `docs/DECISAO_CALCULO_ARROBA_HERDON.md`.

| Cálculo | Fórmula oficial | Fonte dos dados |
|---|---|---|
| Peso total vendido | `Σ (qtd × peso_medio)` das movimentações `venda`/`abate` | `movimentacoes_animais` |
| Arrobas vendidas | `peso vivo vendido × rendimento_carcaca ÷ 15` — **sempre carcaça** | `movimentacoes_animais` + `lotes.rendimento_carcaca` |
| Arrobas de peso vivo | `peso vivo ÷ 15` — leitura física, sempre rotulada como tal | idem |
| Preço por arroba | `valor líquido ÷ arrobas de carcaça vendidas`; `null` sem venda | idem |
| Valor bruto | `Σ valor_total` das vendas | `movimentacoes_animais` |
| Deduções | `0` — **não existem campos no fluxo real** (ver pendência) | — |
| Valor líquido | `valor bruto − deduções` (hoje igual ao bruto) | — |
| Custo acumulado | despesas do lote no livro-caixa + custos legados não espelhados | `movimentacoes_financeiras` + `custos` |
| Lucro / prejuízo | `receita total − custo acumulado` | `movimentacoes_financeiras` |
| Margem % | `lucro ÷ receita × 100` (0 quando não há receita) | idem |
| Cabeças base | `remanescente + vendidas` | `lotes.qtd` (canônico) + vendas |
| Arrobas base | `@ carcaça remanescente + @ carcaça vendidas` | idem |
| Margem por cabeça | `lucro ÷ cabeças base` | idem |
| Margem por arroba | `lucro ÷ arrobas base` (mesma base do custo/@) | idem |

Nenhum valor é arredondado na base: arredondamento é só de exibição.

### Divergências medidas

Cenário: 20 cabeças a 300 kg por R$ 60.000 + R$ 12.000 de custeio, rendimento
52%. Venda parcial de 8 cabeças a 450 kg por R$ 43.200; venda total somando
mais 12 cabeças a 460 kg por R$ 66.240.

| # | Divergência | Antes | Depois |
|---|---|---|---|
| 1 | **"Arrobas vendidas" com duas bases** — Relatório de Vendas dividia o peso **vivo** por 15; Painel Gerencial usava **carcaça**. Mesmo rótulo, mesmo período. | 240,00 @ vs 124,80 @ (**+92,3%**) | 124,80 @ nas duas |
| 2 | **Preço médio por @** herdava a base errada no Relatório de Vendas | R$ 180,00 vs R$ 346,15 | R$ 346,15 nas duas |
| 3 | **Venda total zerava o resultado por cabeça e por arroba** — a base era só o rebanho remanescente, que é zero num lote 100% vendido | lucro/@ = **0,00** e lucro/cabeça = **0,00** com lucro real de R$ 37.440 | lucro/@ R$ 118,42 · lucro/cabeça R$ 1.872,00 |
| 4 | **Custo/@ saltava e colapsava** na última venda | R$ 384,62 (parcial) → R$ 0,00 (total) | R$ 230,77 → R$ 227,73 |
| 5 | **Dois "lucro por cabeça"** — `resumoLote` dividia pelo remanescente, `calcularResultadoLote` pela própria contagem de `animais[]` | −2.400,00 vs −2.400,00 no cenário, divergentes quando `lote.qtd ≠ Σ animais.qtd` | fonte única |
| 6 | **Receita/custo dobravam** se um reload ou sync reanexasse a mesma linha | receita × 2 | dedup por impressão digital |

### Comportamento corrigido

- **Base de rateio** passa a ser *remanescente + vendido* — o que o lote
  carregou economicamente. O custo acumulado é do lote inteiro; dividi-lo só
  pelo que sobrou fazia o indicador explodir na última venda e depois zerar.
  A base é contínua e nunca colapsa enquanto o lote tiver substância econômica.
- **Fallback preservado:** sem `lote.qtd` (lote legado, ou registro do lote
  ainda não carregado), a base soma os animais **ativos** do lote — mantendo a
  regra F-02 (animal vendido/morto não infla a contagem).
- **Dedup de lançamentos** usa impressão digital (`id` + lote + tipo +
  categoria + valor + data + qtd + origem), não só `id`. Ids locais gerados por
  `gerarNovoId()` já colidiram com a sequence do banco neste projeto; descartar
  só pelo `id` apagaria lançamentos reais distintos.
- **Nulo não vira zero:** preço por arroba e preço médio por cabeça são `null`
  quando não houve venda — `R$ 0,00/@` leria como "vendeu de graça".
- **Venda parcial** considera somente a quantidade vendida em todos os totais
  de venda; o rebanho remanescente nunca entra neles.
- **Lote encerrado** mantém receita, custo e resultado no histórico, e continua
  fora do rebanho ativo (regra da Sprint 2, revalidada por teste).

### Telas consumidoras

| Tela | Consome | Estado |
|---|---|---|
| Resultado dos lotes | `getResumoLote` → `calcularResultadoLote` | ✅ fonte única |
| Financeiro (por lote) | `calcularReceitaLote` / `calcularCustoLote` | ✅ fonte única |
| Custos por lote | `calcularCustoLote` | ✅ fonte única |
| Relatório de Vendas | fórmula inline própria | ✅ **corrigida** para @ carcaça |
| Painel Gerencial | `indicadoresEstrategicos` | ✅ já usava carcaça |
| Relatórios de lote | `relatorioLote` → `buildRelatorioLote` → `getResumoLote` | ✅ orquestra, não recalcula |
| Telegram | `respostasConsulta` / `resumoConsolidado` → `getResumoLote` | ✅ herda a fonte única |
| Modal de venda | só coleta qtd/peso/valor; não calcula @ nem resultado | ⚠️ ver pendência |

### Testes criados

`src/domain/vendaLote.test.js` — 32 testes cobrindo os 17 cenários pedidos:
venda parcial e total, preço por @, cálculo de arrobas, valor bruto, deduções e
frete, valor líquido, custo acumulado, lucro e prejuízo, margem por cabeça e por
arroba, lote sem custos, lote sem venda, lote encerrado, valores decimais,
prevenção de receita duplicada, e consistência entre Financeiro, Resultados e
Relatórios.

### Pendências registradas (fora do escopo desta sprint)

1. **Deduções não existem no fluxo real.** Não há coluna de frete, comissão ou
   desconto em `movimentacoes_animais` nem em `movimentacoes_financeiras`
   (verificado no schema de produção). Os únicos campos de frete do projeto
   vivem no simulador de cenários, que não alimenta o resultado realizado.
   `valor líquido` é hoje idêntico ao bruto. Criar o fluxo de deduções é um
   novo campo + UI + migration — sprint própria.
2. **O modal de venda não mostra @ nem preço/@** antes de confirmar. O produtor
   digita valor total sem ver quanto isso dá por arroba, que é a unidade em que
   ele negocia.
3. **Venda total não encerra o lote automaticamente** — decisão preservada da
   Sprint 3. Zerar (`qtd = 0`) e encerrar (`status`) seguem sendo ações
   separadas. Automatizar exige decisão de produto.
4. **`simuladorCenarios` com `qtd || 1`** no peso médio projetado — pendência
   herdada da Sprint 2, parte 7/7.

## 🟢 Impacto financeiro de venda e morte/perda — auditado na Sprint 3

Escopo estrito: só os cálculos financeiros que **venda** e **morte/perda** de
lote disparam. Estorno, rateio, DRE e a auditoria financeira geral seguem
pendentes de sprints próprias.

### Cálculos fechados

| Cálculo | Regra oficial | Onde vive | Estado |
|---|---|---|---|
| Receita da venda | `movimentacoes_financeiras` com `tipo: 'receita'`, `categoria: 'venda_animal'`, `valor = p_valor_total`, `status: 'realizado'`, na **mesma transação** da baixa | `registrar_saida_lote` (SQL) | ✅ auditado |
| Vínculo receita ↔ movimentação | `origem_tipo: 'movimentacao_animal'` + `origem_id = movimentacao_id` devolvido pela RPC | idem | ✅ auditado |
| Custo por cabeça da saída | `valor_total ÷ qtd` (0 quando não há valor) | `saidaLoteTransacional.js` → `p_custo_por_cabeca` | ✅ auditado |
| Receita da morte/perda | **não existe** — a RPC só lança financeiro para `venda`/`abate`, e o serviço zera o valor antes de enviar | SQL + `planejarSaidaLoteTransacional` | ✅ auditado |
| Venda com valor 0 | não gera lançamento (`coalesce(p_valor_total,0) > 0`) | SQL | ✅ auditado |
| Saldo do lote após a saída | `lotes.qtd − p_qtd`, sob `SELECT … FOR UPDATE`, nunca negativo | SQL | ✅ auditado |
| Não duplicação do resultado | o estado local adota os **ids devolvidos pela RPC**, então recarregar a página relê as mesmas linhas em vez de somar cópias | `aplicarSaidaLoteNoEstadoLocal` | ✅ auditado |

### Divergência aceita e medida: peso médio da origem

O caminho web antigo recalculava `lotes.p_at` após venda/morte
(`(qtdAtual×pesoAtual − qtdSaída×pesoSaída) ÷ qtdRestante`). A RPC **não toca**
em `p_at` da origem — comportamento já em produção pelo bot do Telegram e
documentado em `acoesLote.js` ("remover à média não muda a média da origem").

**Decisão da Sprint 3:** adotar o comportamento da RPC. A alternativa seria um
`UPDATE` extra em `lotes.p_at` depois da transação, reintroduzindo exatamente a
gravação sequencial que esta sprint removeu — e deixando o saldo certo com o
peso médio errado se ela falhasse.

*Efeito prático:* vender as cabeças mais pesadas não baixa mais a média do lote
no ato; a correção passa a vir da próxima pesagem. Como `p_at` alimenta GMD,
@ e UA, esses indicadores ficam levemente otimistas entre a venda e a pesagem
seguinte em lotes com forte dispersão de peso. Web e Telegram passam a devolver
o mesmo número — antes divergiam.

### Descrição do lançamento

A RPC grava `movimentacoes_financeiras.descricao` a partir de `p_obs`. Quando o
usuário não escreve observação, o serviço envia a frase padrão do fluxo
(`Venda de N animal(is) do lote X`), preservando o extrato legível que o
caminho antigo produzia.

#### Estorno e cancelamento

Busca completa em código, migrations, endpoints, Telegram e componentes:

- **Financeiro:** existe estorno (`FinanceiroPage::estornarLancamento`) — preserva
  o original e cria lançamento espelho. O próprio código registra que **não há
  RPC transacional** nesse fluxo: são duas escritas sequenciais.
- **Rebanho:** **o HERDON não possui atualmente fluxo dedicado de
  estorno/cancelamento para venda, morte, transferência ou ajuste de lotação.**
  Uma baixa equivocada só pode ser compensada com um lançamento manual em
  sentido contrário, sem vínculo de rastreabilidade com a operação original.

  *Risco:* não há trilha que ligue a correção ao erro, e o ajuste manual pode
  ser feito com quantidade diferente da original, sem o sistema perceber.
  *Recomendação (fora do escopo desta sprint):* estorno vinculado por
  `origem_id`, espelhando o padrão já usado no Financeiro, dentro da mesma
  transação da RPC.

### Revisão de consumidores — padrões paralelos

| Ocorrência | Classificação |
|---|---|
| `indicadoresEstrategicos` — UA inline com `qtd \|\| 1`, sem filtro de status | **defeito corrigido** |
| `evolucaoRebanho` — `soma(animais[].qtd \|\| 1)` | **defeito corrigido** |
| `planos` — `soma(animais[].qtd \|\| 1)` em limite/cobrança | **defeito corrigido** |
| `movimentacoes` — cópia local da validação de saldo | **defeito corrigido** |
| `unidadeAnimal`, `calculos`, `calculations` — `reduce` sobre `animais[]` | **uso legítimo**: numerador de média ponderada de **peso**, não contagem |
| `telegram/acoesLote` — `reduce` sobre `animais[]` | **uso legítimo**: peso médio para a RPC |
| `simuladorCenarios:16,20` — `qtd \|\| 1` | **pendência da parte 7/7**: usado para **peso médio projetado**, não para contagem de rebanho |

### Pendências reais

1. Migrar a escrita do web para as RPCs transacionais (acima). Venda e
   morte/perda foram migradas na Sprint 3; **restam `transferencia_saida` e o
   ajuste de lotação** — o maior risco ainda em aberto.
2. Estorno de rebanho não existe — documentado, não implementado (evitando criar processo de negócio novo nesta sprint).
3. `simuladorCenarios` com `qtd || 1` no peso médio — parte 7/7.
4. Transferência entre **fazendas** não tem fluxo na interface web hoje; a RPC cobre transferência entre **lotes**.
