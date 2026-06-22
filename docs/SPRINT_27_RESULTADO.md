# Sprint 27 — Resultado

## Funcionalidade entregue

**Ajustes Mobile e Polimento Visual Final**

Auditoria de código nas telas principais, correção de um bug de layout com efeito amplo (`.action-row` sem `display: flex`), desambiguação do menu ("Painel Gerencial" vs. "Relatórios") e estados vazios mais orientados em 6 telas. Sem funcionalidade nova, sem alteração de banco, planos ou cobrança.

---

## 1. Telas revisadas

Login (única testável visualmente, sem credenciais), Dashboard/Hoje na Fazenda, Guia do Criador, Fazendas, Pastos, Lotes e Rebanho, Animais, Pesagens, Importação, Financeiro, Fluxo de Caixa, Rateio, Resultado dos Lotes, Simulador, Alertas, Sincronização, Relatórios (hub + 5 páginas), Suporte, Perfil — todas revisadas por leitura de código; ver detalhamento por tela em [docs/POLIMENTO_VISUAL_HERDON.md](POLIMENTO_VISUAL_HERDON.md).

## 2. Problemas mobile corrigidos

**Achado principal:** a classe `.action-row` — usada em formulários, modais e barras de ação de relatórios em toda a aplicação — tinha `gap`/`flex-wrap` definidos em CSS mas **sem `display: flex`**, então essas propriedades não tinham efeito nenhum. Botões ficavam com espaçamento dependente só do fluxo padrão do navegador (a causa provável do "botões apertados" citado na sprint). Confirmado empiricamente via `getComputedStyle` antes e depois da correção. Corrigido em `src/styles/app.css` — uma única correção que melhora o espaçamento de botões em todas as telas que usam essa classe, sem precisar editar cada tela individualmente.

Auditoria de código não encontrou tabelas sem wrapper responsivo, modais sem proteção de altura/largura mobile, ou grids de KPI sem fallback de colunas — esses pontos já tinham sido endereçados em sprints anteriores (ver lista completa em `docs/POLIMENTO_VISUAL_HERDON.md`).

## 3. Ajustes de menu e linguagem

- Menu: "Relatórios Gerenciais" renomeado para **"Painel Gerencial"** (e o título da própria página atualizado de "Relatórios" para "Painel Gerencial"), para não confundir com o hub "Relatórios" (Sprint 24). `pageId` não mudou — nenhuma permissão ou rota foi tocada.
- Linguagem/microcopy: busca por termos técnicos (`payload`, `RPC`, `RLS`, `localStorage`, `queue`, `schema`, `mutation`, `debug`) em texto visível: **zero ocorrências** — já estava limpo desde a Sprint 26, nenhuma alteração necessária.

## Estados vazios melhorados

| Tela | Mudança |
|---|---|
| Relatório do Lote | Subtítulo + botão "Ir para Lotes" |
| Relatório de Pesagens | Subtítulo + botão "Ir para Pesagens" |
| Relatório Financeiro | Subtítulo + botão "Ir para Financeiro" |
| Relatório de Pastos | Subtítulo + botão "Ir para Pastos" |
| Animais (grupos/individuais) | Subtítulo explicando o que cadastrar |
| Sincronização | Subtítulo explicando quando os registros aparecem |

---

## Arquivos novos

| Arquivo | Descrição |
|---|---|
| `docs/POLIMENTO_VISUAL_HERDON.md` | Auditoria completa, achados e correções |
| `docs/POLIMENTO_VISUAL_TESTE_MANUAL.md` | Roteiro de teste manual (com limitação de autenticação documentada) |
| `docs/SPRINT_27_RESULTADO.md` | Este documento |

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `src/styles/app.css` | `.action-row`/`.page-actions`/`.reports-page-actions` ganharam `display: flex; flex-wrap: wrap; align-items: center;` |
| `src/navigation/navConfig.js` | "Relatórios Gerenciais" → "Painel Gerencial" |
| `src/pages/RelatoriosGerenciaisPage.jsx` | Título da página atualizado para "Painel Gerencial" |
| `src/pages/RelatorioLotePage.jsx`, `RelatorioPesagensPage.jsx`, `RelatorioFinanceiroPage.jsx`, `RelatorioPastagensPage.jsx` | Estados vazios com subtítulo e botão de ação (`onNavigate`) |
| `src/pages/AnimaisPage.jsx`, `SincronizacaoPage.jsx` | Subtítulo adicionado a estados vazios |
| `docs/UI_UX_HERDON.md` | Atualizado com a correção do `.action-row`, renomeação do menu e nota sobre breakpoints inconsistentes |
| `docs/BETA_PILOTO_READY_HERDON.md` | Addendum Sprint 27 |

---

## Decisões técnicas

### Por que não reescrever o CSS do cabeçalho

A auditoria encontrou regras conflitantes para `.header-tabs` em dois blocos `@media (max-width: 900px)` diferentes (uma escondendo, outra mostrando as abas — a mais recente no arquivo vence, então hoje as abas aparecem no mobile). Decidi **não** reescrever esse trecho às escuras: sem poder testar visualmente com login real, o risco de uma "correção" piorar o que já funciona é maior que o benefício. Documentado como pendência para a Sprint 28, com recomendação de fazer a verificação visual real antes de tocar nesse código.

### `.action-row` corrigido na regra base, não em cada tela

Em vez de adicionar `style={{ display: 'flex' }}` inline em cada uso de `.action-row` (dezenas de ocorrências), a correção foi feita uma vez na definição CSS da classe — efeito imediato em toda a aplicação, menor risco de inconsistência futura.

## Limitações conhecidas

- Não foi possível testar visualmente nenhuma tela autenticada (Dashboard, Pastos, Lotes, etc.) — só a tela de Login, que não exige login.
- A dívida técnica de CSS (breakpoints inconsistentes, `app.css` com 9k+ linhas) não foi resolvida, apenas documentada.

## Pendências para Sprint 28

- Verificação visual real (mobile e desktop) com uma conta autenticada — pendência recorrente desde a Sprint 22, ainda não resolvida por falta de credenciais de teste.
- Consolidar breakpoints de `src/styles/app.css` em um padrão único.
- Resolver a duplicidade de regras `.header-tabs` no cabeçalho mobile, com verificação visual antes de alterar.
- Considerar dividir `app.css` em arquivos menores por área.

## Teste manual

Não foi possível testar com conta autenticada real (sem credenciais de teste disponíveis). Documentado honestamente em `docs/POLIMENTO_VISUAL_TESTE_MANUAL.md`, incluindo o que pôde ser verificado de fato (tela de Login em 390px, e o comportamento de `.action-row` via DevTools) e o roteiro completo para quando houver acesso.

## Testes automatizados

Nenhum teste novo ou alterado nesta sprint — não houve alteração de lógica de domínio, apenas CSS e ajustes de texto/estrutura em JSX (incluindo adicionar a prop `onNavigate`, já fornecida pelo `App.jsx` a todas as páginas, em 4 páginas de relatório). A suíte existente foi usada para garantir que nada quebrou.

## Resultado dos gates

| Gate | Resultado |
|---|---|
| `npm test` | 510 testes, 0 falhas (inalterado) |
| `npm run lint` | 0 erros |
| `npm run build` | Build de produção concluído com sucesso |
