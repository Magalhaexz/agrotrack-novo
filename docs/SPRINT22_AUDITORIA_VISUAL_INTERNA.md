# Sprint 22 — Auditoria Visual Interna

## Login testado

Conta real de produção (Supabase), autenticada via formulário de login do
próprio app no preview local (`herdon-dev`, `localhost:5173`). Credenciais
fornecidas pelo usuário durante a sessão (não registradas neste documento,
não commitadas). A conta tinha uma fazenda ("yellowstone") e um lote
("teste", status ENCERRADO) já cadastrados — a maior parte da auditoria
rodou contra dados reais, não só estados vazios.

## Plugins/ferramentas usados

- `frontend-design` (guia de design, consultado para calibrar o que conta
  como "fora do padrão premium").
- `Claude Preview` (`preview_start`, `preview_screenshot`,
  `preview_snapshot`, `preview_eval`, `preview_resize`, `preview_console_logs`)
  — ferramenta principal de inspeção.
- `design-critique` não foi invocado como skill separada; a classificação
  P0/P1/P2 abaixo segue os mesmos critérios (crítico/importante/rápido/futuro)
  aplicados diretamente durante a auditoria.

## Limitação da ferramenta de preview

`preview_screenshot` renderiza corretamente em ~375–700px de largura, mas
em larguras maiores (900–1440px) captura só um recorte no canto superior
esquerdo do viewport, com área preta no resto — **confirmado, via
`getBoundingClientRect`/`getComputedStyle`, que isso é um artefato da
ferramenta de captura, não um bug do app**: em todas as larguras testadas
(768, 900, 960, 1280, 1440) o DOM real preenche 100% da largura
corretamente. Por isso, a validação em larguras "tablet/desktop" nesta
sprint foi feita via inspeção de DOM/CSS computado (`getBoundingClientRect`,
`getComputedStyle`) em vez de screenshot, exceto onde indicado. Também
houve uma interrupção de sessão ("erro no servidor") no meio da auditoria;
o estado foi recuperado com sucesso via `git status`/`git diff` — nenhum
trabalho foi perdido.

## Telas testadas (logado, com dados reais ou estado vazio real da conta)

Dashboard, menu lateral/topbar (mobile drawer + desktop sidebar fixa),
Fazendas, Lotes e Rebanho, Pesagens, Acompanhamento de Peso, Comparativo
de Lotes, Resultado dos Lotes, Custos por Lote, Visão Financeira (DRE/Por
Lote/Lançamentos/Pagamentos), Produtos e Insumos (Estoque), Sanitário/Manejo,
Pastos, Tarefas, Animais, Central de Alertas, Simulador de Decisão,
Relatórios, Configurações (Geral/Notificações/Integrações/Dados e
Segurança), Planos e Assinatura. Agenda Sanitária é uma seção dentro de
Sanidade, não uma rota própria — coberta junto.

Larguras testadas: 375×812 (mobile, screenshot real), 654×1039 e
767×1024 (mobile, screenshot real), 768×1024 e 900×800 e 960×800 e
1280×800/1440×900 (desktop/tablet, via DOM/CSS — screenshot só parcial
pelo motivo acima).

## Problemas encontrados e corrigidos

### P0 — abas sobrepostas em Acompanhamento de Peso (mobile)
As duas abas ("Pesagem individual por lote" / "Histórico de lotes") usam
`.segmented-control` (CSS Grid, 2 colunas fixas) + `.segment` com
`white-space: nowrap` herdado — o rótulo mais longo não cabia na coluna e
vazava visualmente por cima da aba vizinha, tornando ambos os textos
ilegíveis. **Corrigido**: `.segment` agora permite quebra de linha
(`white-space: normal`, `text-align: center`) — `src/styles/app.css`.

### P0 → corrigido em cascata — bottom-nav mobile até 1024px
O breakpoint que troca sidebar de desktop por hambúrguer + bottom-nav
estava em `max-width: 1024px` — cobria tablets e janelas de laptop não
maximizadas, fazendo os dois padrões de navegação coexistirem (top-header
de desktop com abas Geral/Estoque/Alertas **e** bottom-nav mobile ao mesmo
tempo) em larguras que deveriam mostrar só a sidebar. **Corrigido**:
breakpoint reduzido para `max-width: 767px` (abaixo do preset "tablet"
768px) em `src/styles/layout.css`. Confirmado via `getComputedStyle`:
767px → bottom-nav visível, sidebar fora da tela; 768px → bottom-nav
`display:none`, sidebar fixa visível.

### P1 — valores monetários formatados errado em Custos por Lote
`CustosPage.jsx` montava `"R$ " + formatarNumero(valor)` manualmente
(`formatarNumero` só faz `toFixed(2)`, sem separador de milhar), resultando
em `"R$ 10000.00"` em vez de `"R$ 10.000,00"`. **Corrigido**: trocado por
`formatarMoeda()` (já existente em `src/utils/formatters.js`, usa
`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`) nos
3 pontos do arquivo que formatavam valor (KPI "Total lançado", KPI "Maior
categoria", coluna "Valor" da tabela).

### P1 — texto cortado nos cards de KPI em Custos por Lote (mobile)
Consequência direta do bug acima: com o valor formatado corretamente
(mais largo — "R$ 10.000,00" em vez de "R$ 10000.00"), o card de KPI
("label" + "valor" + "sub" em uma única linha flex) não cabia mais em
375px, cortando o texto de apoio ("somando todos os custos") na borda do
card. **Corrigido**: em telas ≤1024px, `.kpi-card` empilha os três blocos
verticalmente (`flex-direction: column`) e o valor usa uma fonte um pouco
menor (`clamp(1.3rem, 6vw, 1.8rem)`) — `src/styles/app.css`. Esse padrão
de card é usado em várias páginas (Resultado dos Lotes, Central de
Alertas, Sanidade); a correção é genérica, não só para Custos.

### P1 — 4ª aba invisível em Pesagens (mobile)
A barra de abas "Nova pesagem / Histórico / Evolução / Alertas" usa
`.segmented-control.tab-bar`; a regra mobile genérica força
`overflow-x:auto` + `white-space:nowrap`, e como o container tem
`display:block` (não flex), o `white-space:nowrap` impedia as abas de
quebrar linha — a 4ª aba ("Alertas") ficava fora da área visível, sem
nenhuma indicação de que dava para arrastar. **Corrigido**: nova regra
`.segmented-control.tab-bar` em telas ≤1024px permite quebra de linha
(`flex-wrap: wrap`) com cada aba ocupando ~50% da largura — as 4 abas
ficam visíveis em grade 2×2, sem precisar de scroll. Mesma correção
resolveu preventivamente o mesmo padrão em Animais (3 abas) e
Suplementação (2 abas), que usam a mesma combinação de classes.

### P1 — 4ª aba cortada em Visão Financeira/DRE (mobile)
Mesma causa raiz, classe diferente: `.tab-buttons.financeiro-tabs` já
tinha `flex-wrap: wrap` definido, mas a regra mobile genérica (que setava
`white-space: nowrap`, com especificidade menor mas ainda efetiva porque a
regra da página não sobrescrevia essa propriedade) impedia a quebra —
"Pagamentos" ficava cortado na borda da tela. **Corrigido**: adicionado
`display: flex; white-space: normal;` explicitamente em
`.financeiro-page .financeiro-tabs` (especificidade maior, vence a regra
genérica). As 4 abas (DRE/Por Lote/Lançamentos/Pagamentos) agora quebram
linha e ficam todas visíveis.

## Problemas pendentes (não corrigidos nesta sprint)

- **P2** — Card vazio no topo de Resultado dos Lotes e Custos por Lote:
  o `.ph-actions`/`.page-header` de algumas páginas de relatório renderiza
  como um card grande e vazio contendo só um botão de ação centralizado
  (ex.: "Limpar filtros" sozinho em uma caixa alta), enquanto o
  título/subtítulo real da página aparece separadamente, sem estilo de
  card, logo acima. Padrão visualmente inconsistente com o restante do
  app; não é um bug funcional (nada quebra, nada some), mas não é premium.
  Requer revisar o componente de cabeçalho compartilhado
  (`PageHeader`/`.ph`) — fora do escopo "só CSS pontual" desta sprint por
  tocar em múltiplas páginas de relatório.
- **P2** — Comparativo de Lotes: seção "Lotes selecionados" não mostra
  nenhum texto de estado vazio (nem chips, nem "nenhum lote selecionado
  ainda") — fica uma área em branco entre o rótulo e o filtro de período.
- **P2** — Pastagens/Rateio de custos (`PastagensPage`, `CustoForm`): campo
  "Fazenda vinculada"/"fazenda_id" não pré-seleciona a fazenda ativa,
  usuário sempre escolhe manualmente mesmo com uma única fazenda cadastrada
  (já registrado como achado da Sprint 21, mantido aqui por afetar UX).
- **P3** — Botão flutuante (FAB) "+" fica visualmente próximo das ações de
  lote no fim da tela de Lotes (Venda parcial/Morte-perda/Saída do lote)
  — não há sobreposição real (confirmado via `getBoundingClientRect`), mas
  a proximidade é visualmente apertada. Melhoria futura de espaçamento.

## Resultado desktop

Sidebar fixa e header de abas funcionam corretamente a partir de 768px
(antes, o corte estava em 1024px e coexistia incorretamente com a
navegação mobile). Nenhum overflow horizontal de página detectado em
768/900/960/1280/1440px nas telas testadas. Cards de KPI mantêm layout em
linha (label/valor/sub lado a lado) acima de 1024px, sem cortes — valores
monetários formatados corretamente em pt-BR em todas as larguras.

## Resultado mobile (375–767px)

Sem overflow horizontal de página em nenhuma tela testada. Duas
sobreposições/cortes de abas corrigidos (Acompanhamento de Peso, Pesagens,
Financeiro). Bottom-nav agora aparece só no intervalo correto (≤767px).
Formulários (Pastos, Pesagens, Custos) com campos legíveis, rótulos
visíveis, sem campo cortado. Nenhum modal maior que a tela foi encontrado
nas telas visitadas (nenhum modal chegou a ser aberto com dados reais
suficientes para render de tabela grande — ver pendência abaixo).

## Não verificado nesta sessão

Tabelas grandes com muitas linhas (a conta de teste tem só 1 lote e 0
lançamentos na maioria das telas) e modais de edição com formulários longos
não foram exercitados com volume de dados real — o layout dos cards/página
foi validado, mas comportamento de tabela com paginação/scroll interno
sob carga real fica como validação recomendada durante o piloto.

## Liberação para teste de 1 mês

**Sim.** Os bugs visuais mais graves encontrados (abas ilegíveis por
sobreposição, navegação duplicada em tablet, valores financeiros com
formatação incorreta, aba de alerta inacessível) foram corrigidos e
validados. Os pendentes são classificados como P2/P3 — não impedem o uso
real, só deixam alguns cantos menos polidos. Recomenda-se observar o
comportamento de tabelas com volume real de dados (lotes, pesagens,
lançamentos) durante a primeira semana do piloto.

## Validações executadas

- `npm run lint` — sem erros.
- `npm test -- --run` — 956 testes, 0 falhas (suíte inalterada nesta sprint,
  nenhum teste novo — mudanças são CSS + troca de formatador).
- `npm run build` — build ok.
- Console do navegador sem erros durante toda a sessão de auditoria.
