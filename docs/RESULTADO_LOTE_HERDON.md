# Resultado do Lote — `lotes.qtd` × `animais` (Sprint 35)

## O problema (encontrado na Sprint 34, resolvido aqui)

O campo "Cabeças" do cadastro de lote (`lotes.qtd`) é só um número
informativo — **nenhum** cálculo de Resultado dos Lotes, Custo por
Arroba, Decisão de Venda ou Manejo/Sanidade usa esse campo. Todos eles
usam exclusivamente a tabela `animais` filtrada por `lote_id`
(`calcLote()` em `src/utils/calculations.js`, `calcularResultadoLote()`
em `src/domain/calculos.js`). Um lote cadastrado só com "Cabeças: 20" e
sem nenhum registro em `animais` mostrava "Dados insuficientes" em tudo,
mesmo com pesagens e despesas reais lançadas — confirmado e reproduzido
na Sprint 34.

## Diagnóstico (Etapa 1)

| Pergunta | Resposta |
|---|---|
| Onde `lotes.qtd` é usado | Ocupação de pastos (`ocupacaoPastos.js`), rateio de custos compartilhados (`CustosCompartilhadosPage.jsx`), estimativa de consumo de suplemento (`lotesLogic.js`, `SuplementacaoConsumoModal.jsx`), geração de linhas de pesagem individual (`PesagemForm.jsx`, `AcompanhamentoPesoPage.jsx`) — todos usos de **estimativa operacional**, nenhum de resultado financeiro/zootécnico |
| Onde `animais` é usado | `calcLote()` (GMD, peso médio, arrobas produzidas) e `calcularResultadoLote()` (cabeças, peso atual, arrobas de carcaça, lucro/cabeça, lucro/@) — única fonte para tudo que `getResumoLote()`/`decisaoVenda.js`/`manejoResultado.js` calculam |
| Por que "dados insuficientes" | `temDadosSuficientes()` em `decisaoVenda.js` exige `qtdCabecas > 0`, que vem de `animais`, não de `lotes.qtd` |
| Cadastro deveria criar grupo automaticamente? | Sim — todos os campos necessários (`qtd`, `p_ini`, `p_at`, `faz_id`, `categoria_animal`, `raca`, `entrada`) já existem no formulário de lote, sem pedir nada novo ao produtor |
| Resultado deveria usar fallback em `lotes.qtd`? | Avaliado e descartado — exigiria reescrever `calcLote`/`calcularResultadoLote` para dois caminhos de cálculo (com/sem `animais`), sem conseguir calcular GMD real (não há histórico de peso por "dias" sem um registro de animal), e criaria risco de inconsistência se o produtor cadastrar `animais` manualmente com total diferente de `lotes.qtd` |

## Solução adotada — Opção A (criar grupo automaticamente)

Ao cadastrar um **lote novo** com `qtd > 0`, o HERDON cria automaticamente
um registro de "grupo de animais" em `animais`, vinculado ao lote,
usando os dados que o produtor já preencheu no próprio formulário do
lote — nenhum campo novo, nenhum cadastro duplicado.

```
src/pages/lotesLogic.js → buildGrupoAnimaisAutoPatch(lote)
src/pages/LotesPage.jsx → handleNovoLote() chama essa função após criar o lote
```

Campos do grupo automático:

| Campo do grupo | Vem de |
|---|---|
| `tipo_registro` | sempre `'grupo'` |
| `fazenda_id`, `lote_id` | do lote recém-criado |
| `identificacao`, `nome` | nome do lote |
| `categoria`, `raca` | `categoria_animal`/`raca` do lote |
| `qtd`, `p_ini`, `p_at` | `qtd`/`p_ini`/`p_at` do lote |
| `data_referencia` | `entrada` do lote (ou hoje, se vazio) |
| `status` | `'ativo'` |
| `observacao` | "Criado automaticamente a partir do cadastro do lote." |
| `metadata.criado_automaticamente` | `true` (para distinguir de grupos cadastrados manualmente) |

**Não roda em edição de lote** (só na criação) — evita duplicar grupos a
cada vez que o lote é editado.

## Bug relacionado, encontrado e corrigido no caminho

Ao implementar a criação automática, descobri que `createOperationalRecord('animais', ...)`
também **descartava silenciosamente** `fazenda_id`, `categoria`, `raca`,
`sexo`, `origem`, `data_referencia`, `data_nascimento`, `observacao`,
`rendimento_carcaca`, `preco_arroba` e `dias` — o mesmo padrão de bug do
Achado 1b da Sprint 34, agora na tabela `animais`. Corrigido em
`buildOperationalCreatePayload` (`src/services/operationalPersistence.js`),
incluindo todos os campos reais da tabela que o formulário de animal já
envia. Também foi necessário um `toNullableInteger()` para a coluna
`dias` (inteira), reaproveitando o helper já criado na Sprint 34 para o
mesmo problema em `lotes.dias_estimados`/`dias_engorda`.

## Mensagens de "dados insuficientes" — agora dizem o que falta

Antes: sempre a mesma frase genérica ("Ainda faltam dados de pesagem ou
financeiro para uma decisão segura."), mesmo quando só faltava UM dado.

Agora, `classificarDecisaoVenda()` (`src/domain/decisaoVenda.js`) lista
exatamente o que falta, em ordem de prioridade (cabeças → peso → arrobas
→ custo):

```
Ainda falta o custo total do lote (lance uma despesa vinculada a ele)
para calcular o custo por arroba e a decisão de venda deste lote.
```

Quando falta mais de um dado, a frase lista todos:

```
Ainda faltam a quantidade de cabeças (cadastre o grupo de animais do
lote), o peso médio atual (registre uma pesagem) e o custo total do
lote (lance uma despesa vinculada a ele) para calcular o custo por
arroba e a decisão de venda deste lote.
```

Nova função exportada: `listarCamposFaltantesDecisaoVenda(dados)`.

## Confirmado ao vivo (conta QA, Sprint 35)

Reproduzido o problema original (lote sem grupo → "Dados insuficientes"
em tudo) e confirmada a correção: depois de criar um lote novo com
"Cabeças" preenchida, sem cadastrar nada manualmente em Animais,
Resultado dos Lotes mostrou cabeças, peso, custo/@ e status de decisão
corretos automaticamente.

## Limitações

- Só funciona para lotes **criados depois desta sprint**. Lotes já
  existentes sem grupo em `animais` continuam precisando de cadastro
  manual (ou edição do lote não recalcula isso retroativamente — só a
  criação).
- O grupo automático não tem `sexo`/`origem`/raça detalhada — quem
  precisar dessas informações pode editar o grupo depois em Animais.
- Se o produtor cadastrar manualmente outro grupo separado para o mesmo
  lote, os dois passam a ser somados — comportamento idêntico ao que já
  acontecia entre múltiplos grupos manuais.
