# Sprint 24 — Correção Visual Total das Telas Internas

## Objetivo

Logar no HERDON com conta real, navegar por todas as 25 telas internas
obrigatórias e corrigir qualquer layout ainda quebrado antes do teste com
produtor — não apenas os prints já revisados nas Sprints 22/23.

## Método

Login real (sessão persistida das sprints anteriores), preview local,
navegação via clique real em cada item do menu (não leitura de código).
Para cada tela: `document.documentElement.scrollWidth <= clientWidth`
(overflow horizontal), busca por `NaN`/`undefined`/`Infinity` no texto
visível, screenshot em pontos de maior risco, `console.error` a cada
etapa. Larguras: 375px (todas as 25 telas), 768px e 1280px (telas
listadas na Etapa 12 do pedido).

## P0 — Pesagens: aba "Nova pesagem" não tinha campos, botão "Salvar
pesagem" só abria um formulário escondido

Causa raiz real (mais grave do que o "botão gigante" relatado no print):
a aba "Nova pesagem" renderizava um mini-formulário falso — só um toggle
"Por lote/Por animal" e um botão "Salvar pesagem" — que na verdade **não
salvava nada**: só chamava `abrirNovaPesagem()`, que setava
`abrirForm = true` e renderizava o componente real (`PesagemForm`, com
lote/data/peso/observação) em **outro ponto da árvore**, fora da aba
visível. Um produtor clicando "Salvar pesagem" via a tela mudar sem
entender o que aconteceu.

Também confirmado o botão "Nova pesagem" do cabeçalho: usava
`.animais-hero`/`.pesagens-hero`, um **grid** de 2 colunas
(`grid-template-columns: minmax(0,1.3fr) minmax(280px,0.9fr)`) — qualquer
botão direto na 2ª coluna herda `justify-self: stretch` (padrão do CSS
Grid) e ocupa a largura mínima de 280px, virando um banner.

**Correção** (`src/pages/PesagensPage.jsx`):
- Botão do cabeçalho removido — a aba "Nova pesagem" já cobre a ação
  (elimina a duplicidade apontada no pedido).
- A aba "Nova pesagem" agora renderiza o formulário real (`PesagemForm`)
  diretamente quando há lote cadastrado, ou um `EmptyState` ("Nenhum lote
  disponível para pesagem" + CTA "Ir para Lotes") quando não há.
- Os dois pontos que abriam o formulário como atalho (empty state do
  Histórico, aba Alertas) agora só trocam para a aba "Nova pesagem" —
  único caminho, sem duplicidade.
- `PesagemForm` (`src/components/PesagemForm.jsx`): botão "Salvar
  pesagem" agora **desabilita** enquanto faltar lote, data ou peso
  (checagem leve; a validação completa em `validarForm` continua rodando
  no submit como rede de segurança).
- Estado (`modoPesagem`) e função redundantes removidos.

## P0 — Sanidade: botão "Registrar manejo" gigante (mesmo padrão do print)

O botão de ação do cabeçalho (`sanitario-cta`, dentro do `PageHeader`)
renderizava com **180px de altura** por 331px de largura — um retângulo
verde ocupando boa parte da tela, exatamente o padrão "banner, não botão"
citado no pedido. Causa não localizada com certeza (várias definições
concorrentes de `.ph-actions`/`.page--sanitario .page-header` neste
arquivo — ver nota no CSS); a correção usa `!important` para garantir que
vence a regra concorrente, com `height: auto` e `max-height: 56px`.
Confirmado via `getBoundingClientRect`: 56px de altura em mobile, 44px em
desktop — tamanho normal, igual aos botões "Exportar CSV"/"Imprimir/PDF"
logo abaixo.

## Padrão global de PageHeader (Etapa 4)

Auditado `src/components/PageHeader.jsx` e `.ph`/`.ph-actions` — a base
usa flexbox (`justify-content: flex-end`, sem stretch), correta por
padrão. O bug do botão gigante em Pesagens vinha de um cabeçalho
**customizado** (`.animais-hero`, não o `PageHeader` component) com CSS
Grid; o de Sanidade vinha de uma regra de altura ainda não localizada com
certeza. Não foi necessário mudar `PageHeader.jsx` em si — os dois casos
reais encontrados foram corrigidos pontualmente. Outra página que usa o
mesmo `.animais-hero` (Animais) já envolve o botão num `<div
className="page-actions">` e não sofre o problema.

## Varredura das 25 telas (375px)

Todas abertas com conta real, sem overflow horizontal, sem
`NaN`/`undefined`/`Infinity` visível, sem erro de console:

| # | Tela | Status antes | Correção | Mobile | Tablet | Desktop | Bloqueia produtor? |
|---|---|---|---|---|---|---|---|
| 1 | Dashboard | OK | — | OK | OK | OK | Não |
| 2 | Fazendas | OK | — | OK | — | — | Não |
| 3 | Lotes | OK | — | OK | — | — | Não |
| 4 | Pesagens | **P0** | Ver acima | OK | OK | OK | Não (corrigido) |
| 5 | Acompanhamento de Peso | OK | — | OK | — | — | Não |
| 6 | Comparativo de Lotes | OK (P2 já docum.) | — | OK | — | — | Não |
| 7 | Resultado dos Lotes | OK (P2 já docum.) | — | OK | — | — | Não |
| 8 | Custos por Lote | OK | — | OK | — | — | Não |
| 9 | Rateio de Custos | OK (fix Sprint 23) | — | OK | OK | OK | Não |
| 10 | Financeiro/DRE/Lançamentos/Pagamentos | OK | — | OK | OK | OK | Não |
| 11 | Estoque | OK | — | OK | — | OK | Não |
| 12 | Sanidade | **P0** | Ver acima | OK | OK | OK | Não (corrigido) |
| 13 | Agenda Sanitária (dentro de Sanidade) | OK | — | OK | — | — | Não |
| 14 | Pastagens | OK | — | OK | — | — | Não |
| 15 | Rotinas e Tarefas | OK | — | OK | — | — | Não |
| 16 | Modo Curral | OK (fix Sprint 23) | — | OK | — | — | Não |
| 17 | Offline/Sincronização | OK | — | OK | — | — | Não |
| 18 | Nutrição/Suplementação | OK | — | OK | — | — | Não |
| 19 | Animais | OK | — | OK | — | — | Não |
| 20 | Central de Alertas | OK | — | OK | OK | OK | Não |
| 21 | Simulador/Cenários | OK | — | OK | — | — | Não |
| 22 | Relatórios e Exportações | OK | — | OK | — | OK | Não |
| 23 | Configurações | OK | — | OK | — | — | Não |
| 24 | Planos/Assinatura | OK | — | OK | — | — | Não |
| 25 | Telegram/Integrações (aba em Configurações) | OK | — | OK | — | — | Não |

"—" na coluna Tablet/Desktop = tela não fazia parte da lista explícita da
Etapa 12 para essas larguras, mas segue o mesmo padrão de layout
(`.ph`/`.page-actions`/`.kpi-card`) já validado em outras telas na mesma
largura nas Sprints 22-24.

## Pendências P2/P3 (não bloqueiam o piloto)

- Card de ações vazio no topo de Resultado dos Lotes/Custos por Lote
  (documentado desde a Sprint 22 — visual inconsistente, não quebrado).
- Estado vazio sem texto em "Lotes selecionados" no Comparativo de Lotes.
- `AcompanhamentoPesoPage.jsx` tem 2 botões `primary-btn` sem estilo
  (mesma causa raiz das Sprints 22/23, fora do escopo por já ter task
  separada aberta — `task_e9c23553`).

## Resultado mobile (375px)

25/25 telas sem overflow, sem `NaN`/`undefined`/`Infinity`, sem erro de
console. Os 2 P0 reais (Pesagens, Sanidade) corrigidos e confirmados via
screenshot + `getBoundingClientRect`.

## Resultado tablet (768px)

Pesagens, Dashboard, Menu (sidebar), Rateio de Custos, Financeiro,
Central de Alertas, Sanidade — sem overflow, sidebar de desktop visível
(breakpoint 767/768 da Sprint 23 continua correto).

## Resultado desktop (1280px)

Pesagens, Dashboard, Financeiro, Sanidade, Estoque, Relatórios, Central
de Alertas — sem overflow; botão "Registrar manejo" confirmado em 44px de
altura (tamanho normal) nesta largura.

## Validações executadas

- `npm run lint` — sem erros.
- `npm test -- --run` — 956 testes, 0 falhas.
- `npm run build` — build ok.
- Nenhuma migration criada, nenhum `.env`/token exposto, nenhum
  print/log/arquivo Obsidian commitado.

## Liberação para teste de 1 mês

**Sim.** Os dois bloqueadores visuais reais encontrados nesta sprint
(Pesagens e Sanidade — ambos com o mesmo "cheiro" de botão de ação
banner-like relatado no pedido) foram corrigidos e confirmados
visualmente. As outras 23 telas já estavam OK. Nenhum bloqueador visual
conhecido restante.
