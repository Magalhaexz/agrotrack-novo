# Hoje na Fazenda — Módulo HERDON

Sprint 22. Transforma o Painel Geral na tela de abertura do criador: o que
precisa de atenção agora, em linguagem simples, com atalhos para agir.

## Onde fica

Topo do Painel Geral (`src/pages/DashboardPage.jsx`, aba "Geral"), substituindo
o antigo bloco "Visão geral" (3 chips soltos sem ação). A lógica de
agregação é pura e testável em `src/domain/hojeNaFazenda.js`.

## Prioridades do dia

Lista de frases em linguagem simples, cada uma clicável (leva direto para a
tela relacionada). Só aparece o que tem pelo menos 1 ocorrência — sem itens,
mostra "Tudo certo por aqui — nenhuma prioridade pendente hoje."

| Prioridade | Critério | Fonte do dado | Rota |
|---|---|---|---|
| Contas vencidas | Despesa não paga/cancelada com vencimento no passado | `db.movimentacoes_financeiras` | `financeiro` |
| Lotes sem pesagem | Lote ativo nunca pesado ou pesado há mais de 30 dias | `db.lotes` (`ultima_pesagem`) | `pesagens` |
| Contas próximas do vencimento | Despesa não paga/cancelada vencendo em até 3 dias | `db.movimentacoes_financeiras` | `financeiro` |
| Lotes sem pasto definido | Lote ativo com `pastagem_id` vazio | `db.lotes` | `lotes` |
| Lotes com GMD abaixo da meta | Lote ativo com `gmd_meta` configurado e GMD real (via `getResumoLote`) abaixo da meta — só conta se já houver dado real de peso | `db.lotes` + `getResumoLote` | `lotes` |
| Itens com estoque baixo | Item com quantidade atual ≤ quantidade mínima | `db.estoque` | `estoque` |
| Alertas críticos | Alertas de nível `critical` gerados por `buildAlerts()` que **não** sejam de pesagem, financeiro ou estoque (esses já têm linha própria, para não contar a mesma coisa duas vezes) | `alerts` (prop, já calculado em `App.jsx`) | aba "Alertas" do próprio Dashboard |

Frases sempre concordam em número (singular/plural): "1 lote precisa de
pesagem" / "2 lotes precisam de pesagem".

### Bug corrigido: alertas críticos nunca apareciam

`buildAlerts()` (`src/utils/alerts.js`) gera cada alerta com os campos
`nivel` (`critical`/`warning`/`info`) e `mensagem`. `DashboardPage.jsx` lia
`alert.prioridade` e `alert.descricao` — campos que não existem nesses
objetos. Resultado: `prioridade` sempre caía no fallback `'media'`, então
nenhum alerta era classificado como crítico, em nenhuma situação. O card
"Alertas importantes" e a aba "Alertas" sempre mostravam contagens erradas
(crítico = 0 sempre). Corrigido mapeando `nivel → prioridade`
(`critical→alta`, `warning→media`, `info→baixa`) e lendo `alert.mensagem`
para a descrição, com fallback para os nomes antigos por segurança.

## Ações rápidas

Seção própria, grid de botões, sempre navegando para a tela correspondente
(sem modal embutido no Dashboard):

| Ação | Rota |
|---|---|
| Nova fazenda | `fazendas` |
| Novo pasto | `pastagens` |
| Novo lote | `lotes` |
| Registrar pesagem | `pesagens` (com intenção `{ action: 'novo' }`) |
| Lançar custo/receita | `financeiro` |
| Importar dados | `importacao` |
| Mover lote de pasto | `lotes` — a movimentação em si fica na aba "Pasto" do detalhe do lote (Sprint 21); abrir direto o modal exigiria selecionar o lote primeiro, então a ação leva para a lista |
| Ver alertas | troca para a aba "Alertas" do próprio Dashboard (não é uma rota separada) |

Todas as rotas usadas já existem no registro de páginas de `App.jsx` —
nenhuma rota nova foi criada.

## Resumo operacional (KPIs principais)

7 cards, cada um com label, valor e subtítulo — **sem variação percentual
fabricada** (ver "Bug corrigido" abaixo):

Fazendas · Pastos · Lotes ativos · Cabeças ativas · Peso médio · Alertas
críticos · Resultado financeiro.

"Fazendas" é sempre o total da conta. "Pastos", assim como "Lotes ativos" e
"Cabeças ativas", é escopado pela fazenda ativa quando há uma selecionada
(mesmo comportamento que `lotes`/`animais` já tinham via `dbDashboard` em
`App.jsx` — `pastagens` não era escopado e foi corrigido nesta sprint, ver
abaixo).

### Bug corrigido: variação percentual inventada

Os 4 KPIs originais (`Cabeças ativas`, `Lotes ativos`, `Resultado
financeiro`, `Pagamentos pendentes`) mostravam uma "variação" calculada como
`getVariation(valor, valor * 0.92)` — ou seja, um número **inventado**,
sempre ~8-15% positivo, sem relação com nenhum dado histórico real. Removido
por completo. Os cards agora mostram um subtítulo informativo e honesto (ex.:
"Rebanho em lotes ativos") em vez de uma tendência falsa.

### Bug corrigido: pastagens não escopadas pela fazenda ativa

`dbDashboard` (em `App.jsx`) já filtra `lotes`/`animais`/`pesagens`/etc. pela
fazenda selecionada, mas não filtrava `pastagens`. Como a Sprint 22 cruza
pastos com lotes para o bloco "Pastos em uso", isso geraria contagem errada
em contas com mais de uma fazenda (pasto de outra fazenda contado como "sem
lote"). Corrigido filtrando `db.pastagens` por `fazendaSelecionada` dentro do
próprio `DashboardPage.jsx`, com fallback para todos os pastos quando não há
fazenda selecionada (mesmo padrão de fallback do `dbDashboard`).

## Pastos em uso

Bloco simples, sem cálculo de UA por animal:

- Pastos cadastrados
- Pastos com lote ativo
- Pastos sem lote
- Lotes sem pasto definido

**Indício de excesso** (não é cálculo de lotação): quando o pasto tem
`capacidade_suporte_ua_ha` cadastrada, compara a contagem de cabeças
(`lote.qtd`) dos lotes ativos vinculados com a capacidade do pasto em UA
(`area_ha × capacidade_suporte_ua_ha`). Se as cabeças excedem esse número, o
pasto aparece numa lista de aviso. É uma aproximação deliberada — cabeças não
é a mesma unidade que UA — usada apenas como sinal simples, não como
substituto do cálculo de UA por animal que já existe em `domain/unidadeAnimal.js`
e é usado em `PastagensPage`.

## Estados vazios

Dois estados distintos, cada um com sua mensagem e botões:

**Conta sem nenhuma fazenda cadastrada** (conta nova):
> Comece cadastrando sua fazenda ou importando seus dados.

Botões: Cadastrar fazenda · Importar dados · Ver guia do criador piloto
(leva para a página de Suporte — não existe ainda uma página dedicada de
guia dentro do app; o PDF do guia vive em `docs/Guia-do-Criador-Piloto-HERDON.pdf`,
fora do app).

**Conta com fazenda mas sem lote ativo:**
> Você ainda não tem lotes ativos.

Botões: Criar primeiro lote · Importar dados.

## Linguagem revisada (Etapa 8)

"Pastagem" trocado por "Pasto" em todos os textos visíveis ao usuário que
ainda usavam o termo antigo: cabeçalho e visão geral do detalhe do lote
(`LoteDetailsPanel.jsx`, `LoteOverviewTab.jsx`), opção de fallback do select
de pasto (`LoteForm.jsx`) e toasts/empty states/labels da página de Pastos
(`PastagensPage.jsx`). Nomes internos de variável/função (`areaTotalPastagem`,
`salvarPastagem`, etc.) e a tabela `pastagens` no banco não foram alterados —
só texto visível na tela.

`FinanceiroPage` ("Movimentações Financeiras") e `ResultadosPage` ("Resultado
dos Lotes") já tinham subtítulos claros explicando receitas/despesas e
resultado financeiro/operacional — não precisaram de ajuste. `CenariosPage`
("Simulador de Decisão") já explica "compra, manutenção ou venda de lote" no
subtítulo.

## Limitações e pendências futuras

- Modo offline para o Dashboard.
- Notificações push / lembretes automáticos.
- Agenda de manejo.
- Mapa da fazenda.
- Ocupação por UA real (por animal) em vez do indício simples por cabeças.
- Recomendação automática por IA.
- "Movimentações recentes de pasto" e "registros importados recentemente"
  não entraram como itens de prioridade nesta sprint — exigiriam uma consulta
  assíncrona adicional ao histórico de movimentação de pasto (Sprint 21,
  tabela `lote_pastagens_historico`, hoje consultada só por lote dentro do
  detalhe do lote, não agregada para todo o Dashboard) ou rastreamento de
  "importado recentemente" que ainda não existe nos dados.
