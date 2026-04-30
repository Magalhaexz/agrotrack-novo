# Sprint 8B — Fix Broken Layout, Quick Actions and Page Polish

## Arquivos alterados no sprint
- `src/pages/DashboardPage.jsx`
- `src/styles/dashboard.css`
- `src/styles/app.css`

## Páginas corrigidas
- Dashboard (ações rápidas)
- Relatórios (painel de filtros mobile)
- Estoque
- Pesagens
- Manejo Sanitário
- Suplementação
- Tarefas

## Correções visuais aplicadas (exatas)

### 1) Quick actions card (Dashboard)
- Em `DashboardPage`, o botão `Registrar consumo` foi trocado de `variant="ghost"` para `variant="outline"` para evitar aparência de desabilitado.
- Em `dashboard.css`, o bloco `.dashboard-action-grid .ui-button` recebeu reforço visual:
  - maior contraste de borda e texto
  - fundo consistente para variantes `outline/secondary/ghost`
  - hover mais claro
  - `opacity: 1` para estado normal
  - opacidade reduzida somente quando realmente `:disabled`
- Ações preservadas e visíveis:
  - `Nova pesagem`
  - `Novo lote`
  - `Registrar manejo`
  - `Registrar consumo`

### 2) Mobile/filter panel
- Em `app.css`, reforço para:
  - `.reports-filter-card`, `.reports-filter-grid`, `.reports-filter-foot`, `.reports-filter-summary-grid`
  - stack em mobile (`<=900px`)
  - largura total para controles e botão de ação
  - remoção de clipping por `overflow` no card de filtro
- Em `<=640px`, ajuste adicional de espaçamento e densidade para evitar corte horizontal/vertical.
- Resultado: `Aplicar filtros` permanece visível e os filtros continuam acessíveis.

### 3) Estoque
- Em `app.css`, compaction de `.page--estoque`:
  - cards mais baixos (`padding`, `gap`, `min-height`)
  - cabeçalho e quantidade com menos espaço vazio
  - barra de progresso e label mais densas
  - linhas de detalhe mais compactas
  - ações `Entrada/Saída` com altura e espaçamento mais enxutos
- Todos os dados e ações foram mantidos.

### 4) Pesagens
- Em `app.css`, compaction de `.page--pesagens`:
  - cards KPI menores (`padding`, `gap`, `font-size`)
  - `Histórico de pesagens` com menos respiro vertical
  - células de tabela e `row-actions` mais compactas
- `Nova pesagem`, tabela e ações preservadas.

### 5) Manejo Sanitário
- Em `app.css`, compaction de `.page--sanitario`:
  - summary cards menores
  - ajuste de espaçamento de cabeçalho do card
  - tabela mais próxima e com linhas mais densas
- `+ Novo Manejo` e ações da tabela preservadas.

### 6) Suplementação e Tarefas
- Suplementação (`.suplementacao-page`):
  - cards e cabeçalhos mais compactos
  - densidade de tabela e chips melhorada
- Tarefas (`.tarefas-page`, `.page--tarefas`):
  - filtros mais compactos
  - colunas/cards do kanban com menor peso visual
  - melhor ritmo geral de espaçamento
- Ações e dados preservados.

## Validação

### Build
- `npm.cmd run build`
- Resultado: sucesso

### Lint
- `npm.cmd run lint`
- Resultado: sucesso com `30 warnings` preexistentes de `react-hooks/exhaustive-deps`, sem novos erros

## Confirmação de preservação
- Nenhuma funcionalidade foi removida.
- Nenhum módulo foi removido.
- Nenhuma tab/subtab foi removida.
- Nenhuma regra de negócio foi alterada.
- Nenhum botão/ação solicitado foi removido.

## Observação de validação manual
- Não executada em navegador nesta sessão.
- Recomenda-se validar visualmente:
  - usabilidade do card de ações rápidas
  - compaction de Estoque/Pesagens/Sanitário/Suplementação/Tarefas
  - ausência de clipping no painel de filtros mobile
