# SPRINT18K_LAYOUT_POLISH_AND_DASHBOARD_ALERTS_FIX_HERDON

## Páginas polidas
- `Dashboard` (aba de alertas): ações funcionais de alerta com persistência via fluxo já existente.
- `Estoque`: ajustes de proporção, espaçamento e hierarquia visual dos blocos de ação e cards.
- `Financeiro`: refinamento de hierarquia entre cabeçalho, CTA e tabs.
- `Sanitário / IATF`: melhoria de legibilidade no bloco de formulário e tabela, com foco em alinhamento e espaçamento.
- `Tarefas`: alinhamento e respiro de board, cards e linha de ações.

## Correções exatas de layout por página

### Estoque
- Ajustado espaçamento do header e bloco de ações (`.page--estoque .rebanho-header`, `.lote-actions`).
- Melhorada proporção dos cards (`.estoque-card`) e da grade (`.lote-cards-grid`).
- Ações de card (`Entrada`/`Saída`) ficaram mais proporcionais e legíveis (`.estoque-card-actions`, `.btn-entrada`, `.btn-saida`).

### Financeiro
- Refinado alinhamento do cabeçalho e subtítulo (`.financeiro-header`, `.financeiro-subtitle`).
- Tabs receberam shell visual com borda/fundo e melhor espaçamento (`.financeiro-tabs`).
- Botões de tab com altura e padding consistentes (`.financeiro-tab-btn`).

### Sanitário / IATF
- Formulário ganhou espaçamento mais estável em desktop/tablet/mobile (`.page--sanitario .form-grid.two` + media queries).
- Tabela com ajuste de área de leitura e ações compactas (`.sanitario-table-shell .table-responsive`, `.row-actions--tight`).

### Tarefas
- Board com espaçamento mais equilibrado (`.tarefas-page .kanban-board`).
- Cards e linha de ações com melhor alinhamento/click area (`.kanban-card`, `.kanban-card-actions`).

## Como as ações de alerta do Dashboard ficaram funcionais
- `DashboardPage` agora recebe e usa:
  - `onResolveAlert`
  - `onSnoozeAlert`
  - `onAlertNavigate`
- Cada alerta na aba `alertas` passou a exibir três botões reais:
  - `Resolver`
  - `Adiar`
  - `Abrir`
- `App.jsx` passou a injetar no `ActivePage` os mesmos handlers globais já usados no AppHeader:
  - `onResolveAlert={marcarAlertaComoFeito}`
  - `onSnoozeAlert={adiarAlerta}`
  - `onAlertNavigate` com fallback seguro:
    - se houver rota válida, navega
    - se não houver, mostra: `Não há destino configurado para este alerta.`
- Com isso, o Dashboard reutiliza a mesma estratégia estável já existente de identidade/persistência de alertas (resolvidos + adiados) aplicada no nível do app.

## O que foi intencionalmente não alterado
- Não houve alteração de schema Supabase, RLS, auth, sync core, cloud diagnostic, cálculos de negócio, persistência de pagamentos, estratégia IATF, export de relatórios, nem agrupamento de navegação.
- Não houve redesign amplo da IA de navegação nem da estrutura de relatórios.
- Não houve mudança de contratos de dados das páginas operacionais.

## Arquivos alterados
- `src/App.jsx`
- `src/pages/DashboardPage.jsx`
- `src/styles/dashboard.css`
- `src/styles/app.css`

## Testes e validação
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`
  - sem conflitos encontrados (comando retorna código 1 quando não encontra matches).
- `npm run build`
  - concluído com sucesso.
- `npm run lint`
  - concluído com sucesso, sem erros; warnings preexistentes de `react-hooks/exhaustive-deps` em múltiplos arquivos.

## Verificação manual solicitada
- Fluxo manual ainda precisa ser validado em UI para confirmação visual e comportamental final:
  - Estoque visual e funcional
  - Financeiro header/tabs
  - IATF alinhamento e prévia
  - Sanitário tabela/ações
  - Tarefas cards/ações
  - Dashboard alertas: Resolver/Adiar/Abrir com persistência após refresh
