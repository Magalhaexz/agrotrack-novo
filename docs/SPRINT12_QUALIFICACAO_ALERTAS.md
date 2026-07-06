# Sprint 12 — Qualificação de Alertas por Data, Lote e Ação

## Objetivo

Preencher `dataReferencia`, `loteId`, `loteNome` e padronizar `acaoSugerida`
diretamente na origem dos alertas (`gerarAlertasUnificados`), sempre que a
informação existir de forma real e inequívoca — sem alterar a assinatura
pública da função, sem duplicar regra já existente, sem quebrar Dashboard,
Telegram ou a Central de Alertas (Sprint 11).

## Problema encontrado no Sprint 11

A auditoria daquele sprint confirmou que `dataReferencia` vinha sempre
`null` e nenhum alerta carregava `lote_id` estruturado — os grupos
combinam vários itens (lotes, contas, produtos) numa única `descricao`
textual, então não havia uma data ou lote único e seguro por alerta. A
Central de Alertas cobria isso com uma heurística de texto (casar nome de
lote na descrição) e um mapa de prazo por `tipo`. Este sprint ataca a causa:
qualificar os alertas na origem, quando possível.

## Auditoria antes de editar

**Agrupadores existentes em `alertasUnificados.js`:** `agruparAlertasInteligentes`
(gmd, peso_alvo, estoque, tarefa, sanidade, custo — via `alertasInteligentes.js`),
`agruparFinanceiro`, `agruparRebanho` (sem-pesagem, sem-pasto), `agruparDecisao`
(pronto-venda, custo-alto-arroba), `agruparPastos`, `agruparSaidaLote`,
`agruparEstoqueValidade`, `agruparCarenciaAtiva`, `agruparTarefasHoje`.

| Grupo | Já tinha data? | Já tinha lote? | Decisão |
|---|---|---|---|
| gmd / peso_alvo | Não exposta (calculada em `getResumoLote`, não retornada) | Sim (`entidade.tipo === 'lote'`) | `lote.ultima_pesagem` (campo já existente no registro) vira `dataReferencia`; `entidade` vira `loteId`/`loteNome` |
| tarefa (atrasada) | Sim, `vencimento` já calculado no detector, só não exposto | Não (tarefa não tem lote no `entidade`) | Expõe `vencimento` como `dataReferencia`; resolve `tarefa.lote_id` (campo já existe na tabela) para `loteId`/`loteNome` |
| sanidade (próxima/vencida) | Sim, `proxima` já calculado, só não exposto | Sim, só o nome (`entidade.nome`), sem id real | Expõe `proxima`; adiciona `lote.id` real (já resolvido internamente via `lotesMap`) |
| estoque (baixo por consumo) | Não — é risco por quantidade, não data | Não é vinculado a lote | Mantido `null`/`null` (Etapa 2, "estoque normalmente não tem dataReferencia") |
| custo (trend 30 dias) | Não — é uma tendência, não um vencimento único | Fazenda inteira, não lote | Mantido `null`/`null` (não inventar data para uma média móvel) |
| financeiro (vencido/hoje/7 dias) | Sim, `getDataVencimento(mov)` por lançamento | `movimentacoes_financeiras.lote_id` existe (rateio por lote) | `dataReferencia` = data mais próxima do grupo; `loteId`/`loteNome` só quando o grupo tem 1 lançamento |
| rebanho sem-pesagem | Sim, `lote.ultima_pesagem` (campo já denormalizado, usado por `listarLotesSemPesagemRecente`) | Sim, é o próprio lote | `dataReferencia` = `ultima_pesagem` (`null` quando o lote nunca foi pesado); `loteId`/`loteNome` quando o grupo tem 1 lote |
| rebanho sem-pasto | Não existe campo de data | Sim, é o próprio lote | `loteId`/`loteNome` quando único; `dataReferencia` fica `null` |
| decisão (pronto-venda/custo-alto) | Não — é um estado calculado agora | Sim (`item.lote`) | `loteId`/`loteNome` quando único; `dataReferencia` fica `null` (estado, não vencimento) |
| pastos (capacidade) | Não existe campo de vistoria/avaliação | Não — é o pasto, não o lote | Mantido `null`/`null` |
| saída de lote | Sim, `lote.saida` (campo direto) | Sim, é o próprio lote | `dataReferencia` = `saida`; `loteId`/`loteNome` quando único |
| estoque validade | Sim, `item.data_validade` (campo direto) | Não é vinculado a lote | `dataReferencia` = `data_validade`; `loteId`/`loteNome` sempre `null` |
| carência (ativa/vencendo) | Sim, `item.data_fim_carencia` (campo direto) | Sim, `item.lote_id` | `dataReferencia` = `data_fim_carencia`; `loteId`/`loteNome` quando o bucket tem 1 registro |
| tarefas hoje | Sim, é o próprio `data_vencimento` (= hoje, por definição do grupo) | Sim, `tarefa.lote_id` quando existir | `dataReferencia` = `hoje` (real, não fallback); `loteId`/`loteNome` quando o grupo tem 1 tarefa |

**Ações recomendadas já existentes:** todo `agrupar*` já sempre define
`acaoSugerida` (nenhum estava vazio) — o trabalho aqui foi garantir que os
textos batem com os exemplos do enunciado (carência, manejo, estoque,
financeiro, GMD) e confirmar isso em teste, não reescrever regras.

## Etapa 1 — Contrato interno

`criarAlerta({...})` substitui o antigo `alertaPadrao` (não exportado, uso
interno só): normaliza `dataReferencia` via `toDateKey` (string/Date válida
vira `"YYYY-MM-DD"`, qualquer coisa inválida vira `null` — nunca
`undefined`, nunca `new Date()` como fallback), mantém `loteId`/`loteNome`
como `null` por padrão, e aceita `metadata` opcional (só aparece no objeto
quando informado, para não poluir alertas que não precisam dele).

Helpers auxiliares (todos internos, não exportados):
- `obterLoteId(item)` / `obterLoteNome(item)` — aceitam variações de nome de
  campo (`lote_id`, `loteId`, `id_lote`; `lote_nome`, `loteNome`,
  `nome_lote`, `nome`) para registros que referenciam um lote por chave
  estrangeira (ex.: lançamento financeiro). Nunca inferem lote a partir de
  texto solto da descrição.
- `dataMinima(valores)` — menor data válida entre uma lista; usada para
  resumir a `dataReferencia` de um grupo com vários itens (a data mais
  urgente do grupo é uma informação real, não inventada).
- `loteUnicoDireto` / `loteUnicoFinanceiro` / `loteUnicoDecisao` — só
  atribuem `loteId`/`loteNome` quando a lista tem exatamente 1 item
  (ambíguo com mais de um lote no mesmo grupo — nunca escolhe um
  arbitrariamente).

## Etapa 2/3 — Alertas que passaram a ter `dataReferencia`

`lote-saida-vencida`, `lote-saida-proxima`, `estoque-vencido`,
`estoque-validade-proxima`, `carencia-ativa`, `carencia-vencendo`,
`tarefa-hoje`, mais os grupos vindos de `alertasInteligentes.js`: `gmd`,
`peso_alvo` (via `lote.ultima_pesagem`), `tarefa` atrasada (via
`vencimento`), `sanidade` (via `proxima`), e os 3 tipos financeiros
(`financeiro-vencido`, `financeiro-vence-hoje`, `financeiro-vence-7-dias`).

**Mantidos `null` de propósito** (sem data real disponível):
`estoque` (baixo por consumo), `custo` (tendência de 30 dias),
`sem-pasto`, `pronto-venda`, `custo-alto-arroba`, `pasto-acima-capacidade`,
`pasto-atencao`.

## Alertas que passaram a ter `loteId`/`loteNome`

Todos os grupos acima que são inerentemente ligados a lote, **quando o
grupo tem exatamente 1 item** (ambíguo com mais de um lote no mesmo
alerta — fica `null` de propósito, documentado e testado):
`gmd`, `peso_alvo`, `tarefa` (via `tarefa.lote_id`), `sanidade`,
`sem-pesagem`, `sem-pasto`, `pronto-venda`, `custo-alto-arroba`,
`lote-saida-vencida`, `lote-saida-proxima`, `carencia-ativa`,
`carencia-vencendo`, `tarefa-hoje`, e `financeiro-*` quando o lançamento
tem `lote_id` (rateio de custo por lote).

**Nunca ligados a lote** (correto — não são conceitos de lote):
`estoque-vencido`, `estoque-validade-proxima`, `pasto-acima-capacidade`,
`pasto-atencao`.

## Ações recomendadas padronizadas

Confirmadas por teste (`gerarAlertasUnificados preenche acaoSugerida em
todos os principais tipos de alerta`) — todo alerta gerado tem
`acaoSugerida` não vazia. Textos principais, batendo com os exemplos do
enunciado:

| Origem/tipo | Ação |
|---|---|
| Sanidade / carência | "Não vender ou abater até o fim da carência." / "Confirmar o fim da carência antes de liberar a venda." |
| Manejo sanitário vencido | "Agendar ou confirmar a execução do manejo sanitário." |
| Estoque baixo | "Programar reposição do produto no estoque." |
| Estoque vencido | "Retirar ou descartar o produto vencido do estoque." |
| Financeiro vencido | "Regularizar os pagamentos vencidos." |
| Financeiro próximo | "Confirmar o pagamento hoje para não vencer." / "Planejar o pagamento dentro da semana." |
| GMD baixo | "Revisar suplementação, sanidade e pastagem do lote." |

`src/domain/centralAlertas.js#sugerirAcao` continua existindo como
**fallback**, não como regra principal — só sintetiza um texto genérico por
`origem`/`tipo` quando o alerta não trouxer `acaoSugerida` (alerta
incompleto, legado, ou de teste), evitando duplicar a regra do motor.

## Etapa 5 — Central de Alertas atualizada

`normalizarAlertaCentral` agora prioriza `alerta.loteId`/`alerta.loteNome`/
`alerta.dataReferencia`/`alerta.acaoSugerida` quando o motor único já os
preenche — só cai para a heurística de texto (Sprint 11) quando o alerta
não trouxer lote estruturado. `dataReferencia` inválida (`toDateKey` não
reconhece) nunca quebra a tela: vira `null` e `classificarPrazo` cai para o
fallback por `tipo`/prioridade normalmente (testado explicitamente).
`ordenarAlertasCentral` ganhou um critério de desempate: dentro da mesma
faixa de prazo, alertas com `dataReferencia` real são ordenados pela data
mais antiga primeiro (o mais vencido/mais urgente sobe), antes de cair no
`pesoDecisao`. A Central continua só normalizando/filtrando/ordenando/
resumindo — nenhuma regra de negócio nova foi criada ali.

## Ajuste visual mínimo (`AlertasPage.jsx`/`alertas.css`)

O badge de prazo agora mostra a data real ao lado da categoria quando
`dataReferencia` existe (ex. "Vencido · 01/07/2026"). O nome do lote ganhou
destaque em negrito (`<strong>`). Nenhuma outra mudança de layout — a
tela continua a mesma estrutura do Sprint 11 (cabeçalho, cards de resumo,
filtros, lista de cards decisórios).

## Limitações restantes

- `loteId`/`loteNome` continuam `null` em qualquer grupo com mais de um
  lote — é o comportamento correto (não inventar um vínculo ambíguo), mas
  significa que alertas muito agregados (ex. "5 lotes sem pesagem") não são
  filtráveis por lote individualmente até que o motor único ganhe
  granularidade por item (mudança maior, fora do escopo deste sprint).
- `custo` (tendência financeira de 30 dias) e `estoque` (baixo por
  consumo/mínimo) continuam sem `dataReferencia` — são sinais de estado,
  não de vencimento; inventar uma data aqui seria pior que deixar `null`.
- `movimentacoes_financeiras.lote_id` só existe quando o produtor de fato
  associa o lançamento a um lote (rateio de custo) — a maioria dos
  lançamentos financeiros continua sem lote, então a maior parte dos
  alertas financeiros continuará com `loteId`/`loteNome` nulos mesmo depois
  desta sprint.

## Validação executada

- `npm run lint` — 0 erros
- `npm test -- --run` — **849 testes passando** (16 novos: 9 em
  `alertasUnificados.test.js`, 7 em `centralAlertas.test.js`)
- `npm run build` — ok
- Verificação visual (harness descartável, não commitado): Central de
  Alertas renderizada com dados reais mostrando data ao lado do badge de
  prazo e lote em negrito; um alerta de carência que antes caía em
  "Próximos 30 dias" (fallback por tipo) passou a cair corretamente em
  "Próximos 7 dias" com a data real de fim de carência — confirma que a
  qualificação de dados melhora a precisão da classificação de prazo, não
  só a exibição
- `gerarAlertasUnificados` mantém a mesma assinatura pública
  (`db`, `opcoes`) — confirmado via `git diff`, nenhuma mudança de contrato
- `criarAlerta` não é exportado (uso interno)
- Nenhum alerta duplicado (teste dedicado com ids únicos em fixture com
  vários sinais simultâneos)
- Dashboard e Telegram não foram alterados (não modificados neste sprint —
  continuam importando `gerarAlertasUnificados` sem mudança de assinatura,
  só recebem campos adicionais nos objetos de alerta)
