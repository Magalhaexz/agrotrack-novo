# Sprint 7M.1 — Global Mobile Responsiveness Pass

## Objetivo
Executar um passe global de responsividade mobile/narrow-width no HERDON para reduzir overflow horizontal, melhorar wrapping e manter ações, filtros, tabelas e shell principal utilizáveis sem alterar lógica, módulos, tabs ou subtabs.

## Arquivos alterados
- `src/styles/app.css`
- `src/styles/ui.css`
- `src/styles/dashboard.css`

## Páginas auditadas
- Dashboard
- Lotes
- Animais
- Pesagens
- Sanitário
- Suplementação
- Estoque
- Financeiro
- Funcionários
- Configurações
- Relatórios

## Ajustes responsivos aplicados

### Shell / Header / Sidebar
- Consolidação de `min-width: 0` e `max-width: 100%` em regiões críticas da shell para evitar estouro lateral.
- Rebalanceamento do `top-header` em até `900px` para empilhar seletor de fazenda, tabs e ações sem clipping.
- Melhor distribuição de `top-header-actions` em `768px` e `640px`, mantendo chip de nuvem, notificações e perfil acessíveis e tocáveis.
- Ajuste do drawer/sidebar mobile com largura máxima mais segura (`90vw` / `92vw`) e padding interno mais estável.
- Proteção de wrapping para textos longos de fazenda, usuário e itens da navegação.

### Filtros / Barras de ação / Painéis secundários
- Padronização de `page-actions`, `filters-wrap`, `filters-bar`, `filter-row`, `rebanho-filters`, `calendar-toolbar` e áreas de relatórios para melhor wrap em telas estreitas.
- Stack responsivo de grids secundários como `config-grid` e `reports-layout`.
- Redução de gaps e padding em cards e barras de filtros no mobile para ganhar densidade sem sacrificar leitura.
- Garantia de botões full-width em breakpoints estreitos para preservar tap targets e evitar barras quebradas.

### Tabelas / Cards / Conteúdo rolável
- Reforço de `overscroll-behavior-x: contain` e `scrollbar-gutter: stable` em containers de tabela.
- Ajuste de `min-width` das tabelas compartilhadas (`dashboard-table`, `data-table`, `history-table`, `herdon-table`) para degradar melhor em telas pequenas.
- Compactação de padding horizontal das células em mobile para reduzir corte visual.
- Refinos extras no Dashboard em `640px`: toolbar empilhada, ações em coluna única e linhas de tabela/card com menor padding.

### Modais e superfícies compactas
- `ui-modal` limitado a larguras seguras de viewport.
- `ui-modal-head`, `ui-modal-body` e `ui-modal-foot` com `min-width: 0`, wrap e alinhamento adaptativo.
- Bordas e largura de `ui-table-wrap` e tabelas dentro de modais ajustadas para narrow-width.

## Resultado esperado por área
- Header continua usável em mobile, sem clipping de controles importantes.
- Filtros e drawers deixam de empurrar conteúdo para overflow horizontal.
- Tabelas continuam funcionais com scroll horizontal controlado e melhor densidade.
- Cards e painéis secundários empilham com mais estabilidade em mobile.
- Sidebar/drawer mantém comportamento estável e sem cortes laterais.

## Validação

### Build
`npm.cmd run build`

Resultado: sucesso.

### Lint
`npm.cmd run lint`

Resultado: sucesso com `30 warnings` preexistentes de `react-hooks/exhaustive-deps`, sem novos erros.

## Confirmações
- Nenhuma funcionalidade foi removida.
- Nenhum módulo foi removido.
- Nenhuma tab ou subtab foi removida.
- Nenhuma regra de negócio foi alterada.
- Nenhuma ação importante foi escondida permanentemente.
- Todos os textos voltados ao usuário foram preservados em português.

## Validação manual
Não executada em navegador nesta sessão. Recomendada checagem visual em desktop, tablet e mobile para confirmar:
- ausência de overflow horizontal
- header utilizável
- filtros acessíveis
- tabelas legíveis
- ações principais ainda visíveis
