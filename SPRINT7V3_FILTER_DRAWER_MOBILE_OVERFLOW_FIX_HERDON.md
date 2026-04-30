# Sprint 7V.3 — Filter Panel / Drawer / Mobile Overflow Fix

## Objetivo
Corrigir overflow horizontal, clipping e reflow ruim em painéis de filtro, áreas flutuantes compactas e conteúdo modal em larguras estreitas/mobile, sem remover filtros nem alterar lógica.

## Arquivos alterados
- `src/styles/app.css`
- `src/styles/ui.css`
- `src/styles/relatorios.css`
- `src/styles/tarefas.css`

## Painéis, drawers e áreas corrigidas
- Painel `Filtro mestre` de `Relatórios`
- Rodapé de ação do filtro com `Aplicar filtros`
- Blocos-resumo internos do filtro de `Relatórios`
- Barras de filtro compartilhadas como `filters-wrap`, `filters-bar` e `page-actions`
- Blocos `rebanho-filters` e `calendar-toolbar`
- Painel de filtros de `Tarefas`
- Conteúdo de modais com grids de formulário e rodapé de ações
- Áreas de formulário/modal usadas por páginas como `Suplementação`, `Estoque`, `Lotes` e `Calendário`

## Correções responsivas aplicadas

### Compartilhadas
- Adição de `min-width: 0` em grids e filhos críticos para evitar expansão indevida
- Garantia de `max-width: 100%` em `table-responsive` e campos `ui-input`
- Stack automático de `form-grid.two` e `form-grid.three` em larguras menores
- Wrap consistente para `page-actions`, `filters-wrap` e `filters-bar`
- Labels de filtros com distribuição flexível e quebra segura
- Ajustes para impedir overflow horizontal em cards e painéis compactos

### Modais / overlays
- `ui-modal` limitado a `calc(100vw - 24px)` para evitar clipping lateral
- `ui-modal-head` com wrap seguro
- `ui-modal-body` e `ui-modal-foot` com `min-width: 0`
- Melhor contenção de conteúdo interno em narrow width
- Rodapé de modal preservando visibilidade dos botões

### Relatórios
- `reports-filter-card` com contenção de overflow
- `reports-filter-grid` e `reports-filter-summary-grid` com `min-width: 0`
- `reports-filter-foot` empilhando corretamente em largura estreita
- Botão `Aplicar filtros` ficando visível e utilizável em mobile
- Cards-resumo de filtro com quebra segura de texto

### Tarefas
- `tarefas-filters` com filhos protegidos contra overflow
- `task-form-grid` preparado para largura estreita sem clipping

## Build e lint
- `npm.cmd run build`: concluído com sucesso
- `npm.cmd run lint`: concluído sem erros
- Estado atual do lint: `30 warnings` já existentes de `react-hooks/exhaustive-deps` no projeto

## Confirmação funcional
- Nenhuma funcionalidade foi removida
- Nenhum filtro foi removido
- Nenhum módulo, aba ou subtaba foi removido
- Nenhuma regra de negócio foi alterada
- Os controles continuam acessíveis no código

## Observação sobre validação manual
- A validação manual em viewport estreita/mobile não foi executada em navegador nesta sessão
- A proteção responsiva foi aplicada em camadas compartilhadas para cobrir os principais padrões de filtro/painel/modal do app
