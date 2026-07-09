# Sprint 27 — Auditoria Total do App (logado, navegação real)

**Data:** 2026-07-09
**Método:** app rodando local (`herdon-dev`, Vite), logado na conta real
(proprietário, `herdonapp@gmail.com`), navegação e inspeção via DOM/CSS
(`getBoundingClientRect`, `getComputedStyle`, `scrollWidth`), console
capturado e screenshots. **Não** foi só leitura de código.

## Objetivo

Varredura completa do app antes de liberar para teste de produtor por 1
mês: layout, responsividade, fluxos, independência entre fazendas,
formulários, estados vazios, exportações. Corrigir todo P0/P1.

## Etapa 0 — Pré-checks (estado inicial)

- `npm run lint`: limpo.
- `npm test -- --run`: **972 testes, 0 falhas** (19 suítes).
- `npm run build`: OK.
- Árvore git: só arquivos fora de escopo (vault Obsidian, docs soltos, o
  PDF da apresentação já commitado). Nenhum arquivo de app modificado.

## Estado dos dados de teste

A conta tinha **2 fazendas** (`yellowstone` id 633, `Olhos D´água` id
634), 3 lotes, 2 custos, 1 tarefa, 1 cenário — e **vazio** em pesagens,
estoque, sanitário, pastagens, financeiro, suplementação e animais.

Decisão consciente: **não** criei um dataset completo de homologação
gravando na Supabase de produção (risco de poluir a base real e deixar
lixo — ver achado do lote órfão abaixo). A auditoria visual dos estados
vazios é, por si, valiosa (vários bugs históricos eram justamente de
estado vazio), e Custos/Financeiro já tinham dado real suficiente
(R$ 10.000 em `yellowstone`) para validar os layouts financeiros com
conteúdo. Fluxos de escrita foram exercitados de forma **não-destrutiva**
(abrir formulário, validar, cancelar) para não gravar registros de teste.

## Etapa 2 — Auditoria visual (35 telas × 3 viewports)

Varredura automatizada navegando por todas as telas do menu, medindo
overflow horizontal, erros de console e tokens `NaN`/`Infinity`/
`undefined` no texto renderizado.

| Viewport | Telas | Overflow | Erro console | NaN/undef |
|---|---|---|---|---|
| Desktop 1280px | 35 | 0 | 0 | 0 |
| Tablet 768px | 23 (amostra) | 0 | 0 | 0 |
| Mobile 375px | 35 | 0 | 0 | 0 |

Falsos negativos investigados e descartados: "Importação sem `<h1>`" (era
lazy-load lento — a página **tem** `<h1>`).

**Lacuna do método detectada e corrigida:** a varredura media overflow,
console e NaN, mas **não** media altura de botão. Foi por aí que passou o
único P1 real desta sprint (abaixo). Refiz a varredura mobile checando
altura de botão > 60px.

## Etapa 3/6/7/8 — Fluxos, Pesagens, Ações Rápidas, Formulários

- **Pesagens** (área historicamente frágil): entra em "Histórico" (não
  abre formulário sozinho), "Nova pesagem" abre form com 8 campos
  rotulados, "Salvar pesagem" **desabilitado** sem campos, **Cancelar**
  volta para Histórico e fecha o form. Todos os P0 históricos confirmados
  resolvidos (Sprints 25/26).
- **Ações Rápidas do Dashboard** (10 botões): todas roteiam para a tela
  correta e abrem o modal certo com título e altura adequados (Nova
  pesagem, Novo manejo/sanidade, Nova tarefa, Novo custo → modal;
  "Saída de estoque" e "Resultado por lote" → navegam para a página, sem
  modal, por design). Nenhum fluxo quebrado.
- **Formulários** (Estoque, Custo, Pasto, Nutrição, Pesagem, Sanidade,
  Tarefa): abrem com campos rotulados, caixa visível (padrão
  `.ui-input-shell`), botão salvar depois dos campos, fechar/cancelar
  funcional. Screenshot do form de Estoque confirmou renderização
  correta. (Um falso alarme de "input invisível" foi investigado e
  descartado — o input transparente é intencional; a caixa visível é o
  `.ui-input-shell` que o envolve.)
- **Financeiro** — as 4 abas (DRE, Por Lote, Lançamentos, Pagamentos)
  renderizam sem overflow, sem NaN, sem erro.

## Etapa 4 — Independência entre fazendas (P0)

Testado alternando a fazenda ativa e lendo o conteúdo real de cada tela:

| Tela | `yellowstone` (633) | `Olhos D´água` (634) | Vazamento? |
|---|---|---|---|
| Lotes | só "teste" | só "lote com tifton" | Não |
| Custos | R$ 10.000, 1 lançamento | R$ 0, empty state | Não |
| Financeiro | escopo próprio | escopo próprio | Não |

**Resultado: PASS.** Nenhum dado cruza entre fazendas. O scoping
(`src/domain/escopoFazenda.js`) filtra corretamente: lotes por
`faz_id` estrito; demais tabelas por `loteIds` da fazenda ou por
`fazenda_id` (com fallback legado para registros sem `fazenda_id`, que
aparecem em todas — comportamento intencional e documentado no arquivo).

Observação (não é vazamento): a **"visão Todas as fazendas"** existe na
função de domínio (`filtrarDbPorFazenda(db, null)` devolve tudo) mas **não
está exposta** no seletor de fazenda do header — só dá para escolher uma
fazenda específica. Documentado em pendências (não é bug de vazamento; é
feature não exposta).

## Etapa 5 — Layouts financeiros (confirmação)

Custos Operacionais e Financeiro/DRE — corrigidos na Sprint 26 — foram
**revalidados com dado real** (screenshots desktop e mobile):

- Custos: 3 KPIs em grid proporcional; "Aquisição" em tamanho normal (não
  gigante); botão "+ Novo custo" alinhado; tabela legível.
- Financeiro/DRE: KPIs proporcionais; gráficos vazios mostram EmptyState;
  ExportActions com espaçamento. As 4 abas OK.

## Etapa 11 — Exportações

CSV de "Resultado dos Lotes" interceptado e verificado: cabeçalho e linha
bem-formados, inclui coluna Fazenda, **zero `NaN`/`undefined`** no
conteúdo; linhas com dado insuficiente degradam para "Dados insuficientes"
(sem quebrar). Botões CSV/Excel/Imprimir presentes e habilitados quando há
dado.

## Etapa 12 — Telegram

Não é testável neste ambiente (exige o cliente Telegram real + token do
bot em produção, indisponíveis nesta sessão). A camada de comandos é
coberta por testes unitários (`src/domain/telegramComandos.test.js`) e foi
validada em produção nas Sprints 20 e no hotfix de 401. Sem alteração
nesta sprint.

## Etapa 13 — Correção aplicada (o único P1 real)

### P1 — Botão de ação do cabeçalho virava bloco de ~180px no mobile

**Sintoma:** em `≤720px`, o botão de ação do `PageHeader` ("+ Novo custo",
"Registrar manejo", "Novo pasto", "Cadastrar grupo", "Nova tarefa", "Novo
item"…) renderizava como um bloco verde de ~180px de altura, ocupando a
tela toda — exatamente o "botão gigante/desproporcional" que a sprint
pedia para caçar. No desktop o mesmo botão é compacto e alinhado à
direita.

**Causa raiz:** `.ph-actions` (container das ações do `PageHeader`) vira
`flex-direction: column` em `@media (max-width: 720px)`
(`app.css`). O elemento **também** carrega a classe `.page-actions`, e a
regra genérica `.page-actions > * { flex: 1 1 180px; }` (em
`@media max-width: 900px`, mais abaixo no arquivo → vence no cascade por
ordem de origem) aplica-se ao botão. Num flex **row** esse `flex-basis:
180px` vira largura (correto — é a intenção da regra, dar largura mínima
às ações em toolbars). Mas num flex **column** vira **altura** → botão de
180px.

**Correção** (`src/styles/app.css`, dentro do `@media max-width: 720px`
onde `.ph-actions` vira coluna):

```css
.ph-actions > *,
.ph-actions.page-actions > * {
  flex: 0 0 auto;
}
```

Especificidade dupla (`.ph-actions.page-actions`) para vencer a regra
genérica independentemente da ordem no arquivo. A altura volta ao natural
(min 44px) e a largura segue full por causa do `align-items: stretch` já
presente.

**Correção de raiz, não de sintoma:** uma única regra no CSS
compartilhado corrigiu o botão em **todas** as páginas baseadas em
`PageHeader` de uma vez (Custos, Sanidade, Pastos, Animais, Tarefas,
Estoque, …), em vez de remendar página a página.

**Validação (altura do botão de ação):**

| Página | Mobile 375 (antes) | Mobile 375 (depois) | Tablet 768 | Desktop 1280 |
|---|---|---|---|---|
| Custos | 180px | 44px | 44px | 44px (compacto, top-right) |
| Sanidade | 180px | 44px | 44px | — |
| Pastos | 180px | 44px | 44px | — |
| Animais / Tarefas / Estoque | 180px | 44px | — | — |

Re-varredura mobile de todas as telas caçando botões > 60px: só sobraram
falsos positivos legítimos (células de dia do Calendário 39×74px; cards de
modo "Pesagem individual por lote / Histórico de lotes" em Acompanhamento
de Peso — confirmados por screenshot como seletor de modo intencional).
Financeiro (container `.lote-actions`, row) nunca foi afetado.

## Etapa 15 — Validação final

- `npm run lint`: limpo.
- `npm test -- --run`: **972 testes, 0 falhas**.
- `npm run build`: OK.

Mudança é **só CSS** (uma regra em `@media max-width: 720px`), escopada ao
mobile, sem tocar em JS, cálculo, exportação, banco ou regra de negócio.

## Problemas encontrados × corrigidos

| # | Prioridade | Achado | Status |
|---|---|---|---|
| 1 | **P1** | Botão de ação do cabeçalho vira bloco de ~180px no mobile (todas as páginas `PageHeader`) | **Corrigido** |
| 2 | P2/P3 | "Todas as fazendas" existe no domínio mas não exposta no seletor | Documentado (pendências) |
| 3 | P3 | Lote órfão id 9 "recria" sem `faz_id` (dado morto, invisível na UI) | Documentado (não apagar dado real sem certeza) |
| 4 | P3 | Empty state de Pastos sem CTA inline (CTA existe no header) | Documentado |

Nenhum P0 encontrado. Nenhuma tela branca, nenhum fluxo essencial
quebrado, nenhuma mistura de dados entre fazendas, nenhum NaN/Infinity/
undefined, nenhum erro de console.

## Decisão final

**Liberado para teste de produtor por 1 mês.** O app está estável e
navegável nos três tamanhos de tela, com independência entre fazendas
garantida, formulários e exportações funcionais, e o único P1 encontrado
(botão gigante no mobile) corrigido e validado. As pendências restantes
são P2/P3 (ver `docs/HERDON_PENDENCIAS_POS_TESTE_PRODUTOR.md`) e não
bloqueiam o uso real.
