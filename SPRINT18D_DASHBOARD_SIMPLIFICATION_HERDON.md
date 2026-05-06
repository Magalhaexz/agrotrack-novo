# SPRINT18D_DASHBOARD_SIMPLIFICATION_HERDON

## O que foi removido/demovido no Dashboard
- Removidos da aba principal (`geral`) os blocos que estavam poluindo a leitura diária:
  - strip executivo com chips extras
  - alertas prioritários na home
  - lembretes reprodutivos na home
  - ações rápidas na home
  - estoque crítico na home
  - card financeiro estendido com múltiplas métricas secundárias
- Mantidos os dados e funcionalidades existentes, sem exclusão de contratos/datasets.

## Estrutura final do Dashboard
- Faixa principal de KPIs enxuta:
  - Cabeças ativas
  - Lotes ativos
  - Resultado financeiro
  - Pagamentos pendentes
- Quadro de tarefas como bloco central de ação:
  - criação de tarefa
  - colunas `Pendentes`, `Feitas`, `Vencidas`
  - ação `Marcar feita`
- Linha secundária compacta:
  - `Resumo financeiro` (vencidos, hoje, próximos, total pendente, total pago)
  - `Resumo do rebanho` (cabeças, lotes, peso médio, resultado do mês)

## Como tarefas, cabeças ativas, lucro e financeiro foram priorizados
- `Quadro de tarefas` permanece como seção principal e acionável.
- `Cabeças ativas` e `Lotes ativos` ficam na primeira linha de leitura (KPIs).
- `Resultado financeiro` fica em destaque no topo.
- `Financeiro/pagamentos` aparece em KPI e também no card de resumo com vencidos/hoje/próximos/pendente/pago.

## Reuso do comportamento de tarefas/notificações do SPRINT18C
- Mantida a lógica de board por status:
  - concluída/feita não aparece como pendente
  - vencidas seguem coluna específica por data
- Mantidos handlers e persistência de tarefas:
  - `criarTarefaDashboard`
  - `marcarComoFeita`
  - `createOperationalRecord` / `updateOperationalRecord`
- A aba de alertas foi preservada com mapeamento seguro (`alertasFormatados`) sem ruído extra na home.

## O que foi intencionalmente não alterado
- Navegação/agrupamento do SPRINT18G.
- AppHeader e controles de nuvem.
- Supabase schema, RLS, auth, sync core, cálculos de negócio.
- Persistência de pagamentos, IATF, exportações de relatórios, permissões.
- Páginas fora do escopo do Dashboard.

## Arquivos alterados
- `src/pages/DashboardPage.jsx`

## Validação
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`
  - sem conflitos encontrados.
- `npm run build`
  - concluído com sucesso.
- `npm run lint`
  - concluído sem erros (apenas warnings preexistentes de `react-hooks/exhaustive-deps` em múltiplas páginas).
