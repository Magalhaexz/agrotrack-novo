# Polimento Visual e Mobile (Sprint 27)

## Método de auditoria

Sem credenciais de teste, não foi possível abrir o app autenticado em um navegador real. A auditoria foi feita por leitura de código (CSS, JSX) e por verificação empírica via DevTools (`getComputedStyle`) na tela de Login, que é a única tela acessível sem login. Onde a leitura de código não permitia confirmar um comportamento real (cascata CSS complexa), o item foi marcado como "não foi possível confirmar visualmente" em vez de presumido.

## Achado principal: `.action-row` sem `display: flex`

A classe `.action-row` — usada em dezenas de telas (formulários, modais, barras de ação de relatórios, ações de lote) — tinha `gap: 10px` e, em regras específicas, `flex-wrap`/`justify-content`, mas **nunca recebia `display: flex`** em nenhum arquivo CSS do projeto (`src/styles/app.css:10091-10095`, antes da correção). Sem um container flex, essas propriedades não tinham efeito nenhum: os botões ficavam com espaçamento dependente apenas do fluxo padrão do navegador — exatamente o "botões apertados" citado como prioridade da sprint.

Confirmado empiricamente antes e depois da correção (criando um `<div className="action-row">` vazio e lendo `getComputedStyle`):

| | Antes | Depois |
|---|---|---|
| `display` | `block` | `flex` |
| `gap` | `10px` (sem efeito) | `10px` (aplicado) |
| `flex-wrap` | `wrap` (sem efeito) | `wrap` (aplicado) |

**Correção:** adicionado `display: flex; flex-wrap: wrap; align-items: center;` à regra base de `.action-row` (junto com `.page-actions`/`.reports-page-actions`, que já tinham `display: flex` vindo de outra regra — a adição ali é redundante mas inofensiva). Por ser uma classe usada de forma consistente em toda a base de código, essa única correção melhora o espaçamento de botões em **todas** as telas que a usam, sem precisar editar cada tela individualmente.

Outras classes de layout auditadas da mesma forma (e confirmadas corretas, sem necessidade de ajuste): `.page-actions`, `.row-actions`, `.summary-row`, `.summary-list`, `.summary-panel`, `.form-actions`, `.lote-actions`, `.empty-state`/`.empty-box`, `.dashboard-onboarding-banner`/`.dashboard-onboarding-actions`, `.modal-footer.action-row` (sempre usado em conjunto com `.action-row`, nunca isolado).

## Menu: "Relatórios" vs. "Relatórios Gerenciais"

Confirmado o problema apontado na própria sprint: o menu tinha dois itens com nomes quase idênticos — "Relatórios" (hub criado na Sprint 24, seção Gestão) e "Relatórios Gerenciais" (resumo executivo, seção Decisão), e a página deste último ainda exibia o título "Relatórios" internamente (`RelatoriosGerenciaisPage.jsx`), piorando a confusão.

**Correção:** renomeado para **"Painel Gerencial"** — no item de menu (`src/navigation/navConfig.js`) e no título da própria página (`RelatoriosGerenciaisPage.jsx`). O `pageId` (`relatoriosGerenciais`) não mudou, então nenhuma permissão, rota ou módulo de plano precisou ser tocado.

## Estados vazios sem orientação de próxima ação

Auditoria encontrou estados vazios "secos" (só título, sem dizer o que fazer) nas páginas de relatório criadas na Sprint 24/25, e em Animais/Sincronização. Adicionado `subtitle` (e, nos relatórios principais, um botão de ação) em:

| Tela | Antes | Depois |
|---|---|---|
| Relatório do Lote | "Cadastre um lote para gerar este relatório." | + subtítulo + botão "Ir para Lotes" |
| Relatório de Pesagens | "Ainda não há pesagens para este lote." | + subtítulo + botão "Ir para Pesagens" |
| Relatório Financeiro | "Ainda não há lançamentos financeiros no período." | + subtítulo + botão "Ir para Financeiro" |
| Relatório de Pastos | "Cadastre os pastos da fazenda..." | + subtítulo + botão "Ir para Pastos" |
| Animais (grupos/individuais) | só título | + subtítulo explicando o que cadastrar |
| Sincronização | "Nenhum registro salvo neste aparelho ainda." | + subtítulo explicando quando os registros aparecem |

Estados vazios já bons e não alterados: Fazendas, Pastos, Lotes, Pesagens (já melhorados na Sprint 26), Alertas (`AlertList.jsx`, já tinha subtítulo).

## Microcopy (Etapa 7)

Busca por termos técnicos (`payload`, `RPC`, `RLS`, `localStorage`, `queue`, `schema`, `mutation`, `debug`, `webhook`, `endpoint`) em texto visível de `src/pages` e `src/components` (excluindo comentários, logs de console e código de `src/services`/`src/domain`): **nenhuma ocorrência encontrada.** A linguagem já estava limpa desde a Sprint 26 — nenhuma alteração necessária aqui.

## Responsividade — o que já estava bom

A auditoria de código confirmou que o projeto já tinha, de sprints anteriores, uma base sólida de responsividade:

- Nenhuma tabela `<table>` "nua" sem wrapper responsivo (`table-responsive`/`ui-table-wrap`/`mobile-table-cards`) em `src/pages` ou `src/components`.
- O componente `Modal` genérico tem `max-height`, `overflow-y: auto` e larguras em `calc(100vw - 16px)` para telas pequenas — testado de forma segura até telas bem estreitas.
- Os grids de KPI/cards do Dashboard, Relatórios e Pastos já têm fallback para 1-2 colunas em telas pequenas.
- `Sidebar`/`MobileBottomNav` não têm overflow/z-index suspeito; labels longos já usam `text-overflow: ellipsis`.
- `mobile-header-brand` (título da página no cabeçalho mobile) já tem `max-width: 36vw` + ellipsis para nomes longos de fazenda.

## Limitação conhecida: dívida técnica de CSS não resolvida nesta sprint

`src/styles/app.css` tem ~9000 linhas com várias rodadas de patches de sprints anteriores sobre o mesmo cabeçalho (`.header.top-header`, `.farm-selector-wrap`, `.header-tabs-shell`) usando breakpoints próximos mas não idênticos (480px, 560px, 640px, 720px, 760px, 900px, 1024px, 1100px, 1280px). Encontrado pelo menos um caso de regra duplicada e conflitante (`.header-tabs { display: none }` dentro de um `@media (max-width: 900px)` na linha 1370, e `.header-tabs { display: flex }` dentro de outro bloco `@media (max-width: 900px)` na linha 2422 — o segundo vence por ordem de declaração, então as abas do cabeçalho **aparecem** no mobile hoje, mesmo que um comentário antigo diga "Hide tabs on mobile").

**Decisão:** não foi feita uma reescrita do CSS do cabeçalho nesta sprint. O comportamento atual (abas visíveis, com scroll horizontal) não é claramente pior do que escondê-las, e sem poder testar visualmente com login real, uma reescrita "no escuro" desse trecho específico seria mais arriscada do que útil. Fica documentado como pendência para a Sprint 28, idealmente com uma sessão de teste visual real antes de tocar nesse trecho.

## Telas auditadas

| Tela | Resultado |
|---|---|
| Login | ✅ Verificado visualmente em 390px — limpo, sem problemas |
| Dashboard / Hoje na Fazenda | Código revisado; banners e card de checklist já usam flex/grid corretos |
| Guia do Criador | Código revisado; usa `Card`/`report-kpi-grid`, já responsivo |
| Fazendas, Pastos, Lotes, Animais, Pesagens | Código revisado; tabelas com `table-responsive`; estados vazios revisados |
| Importação | Código revisado; já tinha boa estrutura de passos |
| Financeiro, Fluxo de Caixa, Rateio | Código revisado; sem tabela "nua" encontrada |
| Resultado dos Lotes, Simulador | Código revisado; sem achados críticos |
| Alertas | `AlertList.jsx` já tem estado vazio orientado |
| Sincronização | Estado vazio melhorado |
| Relatórios (hub e 5 páginas) | Estados vazios melhorados com ação |
| Suporte, Perfil | Código revisado; sem achados críticos |

## Pendências futuras

- Testar visualmente com conta autenticada real em 390px, 430px, 768px, 1024px (nenhuma sprint até aqui conseguiu fazer isso).
- Consolidar os breakpoints de `src/styles/app.css` em um padrão único (atualmente inconsistente entre 480/560/640/720/760/900/1024/1100/1280px).
- Resolver a duplicidade de regras `.header-tabs` no cabeçalho mobile (ver seção acima) com verificação visual real antes de alterar.
- Considerar dividir `src/styles/app.css` (9000+ linhas) em arquivos menores por área, para reduzir o risco de regras conflitantes futuras.
