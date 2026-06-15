# SPRINT18I_VISUAL_POLISH_AND_REAL_NOTIFICATIONS_HERDON

## Malformed text fixed
- Corrigi textos quebrados/encoding nas áreas de notificações e shell:
  - `src/components/AppHeader.jsx`
  - `src/App.jsx`
  - `src/pages/AcompanhamentoPesoPage.jsx`
- Ajustes aplicados em termos visíveis como: `sanitários`, `Atenção`, `Crítico`, `Amanhã`, `Configurações`, `Não há destino configurado para este alerta.`, além de outros trechos com mojibake.

## Notification resolve behavior
- `Resolver` agora usa chave estável e persiste em `alertas_resolvidos` via `createOperationalRecord`.
- A notificação sai imediatamente da lista ativa porque o estado local é atualizado em `setDb` e o filtro de `alerts` já aplica `alertas_resolvidos`.
- Feedback preservado em português: `Notificação resolvida.`

## Notification postpone behavior
- `Adiar` agora é funcional sem prompt textual:
  - `Amanhã`
  - `3 dias`
  - `7 dias`
- O adiamento persiste em `alertas_adiados` com `{ chave, ate }`.
- A notificação some da lista até a data de adiamento.
- Feedback preservado: `Lembrete adiado.`

## Alert identity/persistence strategy
- Implementei chave estável em `src/App.jsx`:
  - prioridade: `ackKey` -> `id` -> derivada (`type|route|title|date`)
- `rawAlerts` passa a receber `ackKey` estável antes da ordenação/filtro final.
- O mesmo `ackKey` é usado por:
  - resolução (`alertas_resolvidos`)
  - adiamento (`alertas_adiados`)
  - renderização do item no dropdown

## Notification panel layout fixes
- Polimento no painel em `src/styles/app.css`:
  - largura mais legível e responsiva
  - sem clipping horizontal
  - lista com `max-height` e scroll vertical limpo
  - linha de ações com wrap/alinhamento estável
  - menu compacto de adiar (`notif-snooze-menu`) com boa clicabilidade
- Mantive painel global no AppHeader e sem mudanças de arquitetura.

## Pesagens/sidebar visual fixes
- `src/pages/AcompanhamentoPesoPage.jsx`:
  - normalização visual e textual
  - uso de layout compacto (`page--pesagens`, `kpi-grid-3--compact`, `kpi-card--compact`) para evitar “barras esticadas” e melhorar leitura.
- `src/styles/app.css`:
  - ajustes leves de espaçamento/legibilidade em sidebar (`sidebar-section`, `sidebar-group-copy`, `sidebar-group-description`) sem alterar grupos/estrutura SPRINT18G.

## Intentionally not changed
- Não alterei arquitetura de navegação do SPRINT18G.
- Não alterei estrutura de Relatórios do SPRINT18H/H1.
- Não alterei schema Supabase, RLS, auth, sync core, estratégia cloud-first, cálculos de negócio, pagamentos, IATF ou exportações.

## Testing results
- `git grep -n "Ã" -- src/App.jsx src/components/AppHeader.jsx src/components/Sidebar.jsx src/styles/app.css src/styles/dashboard.css`
  - sem ocorrências.
- `git grep -n "Â" -- src/App.jsx src/components/AppHeader.jsx src/components/Sidebar.jsx src/styles/app.css src/styles/dashboard.css`
  - sem ocorrências.
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`
  - sem conflitos.
- `npm run build`
  - sucesso.
- `npm run lint`
  - sucesso sem erros (apenas warnings preexistentes de `react-hooks/exhaustive-deps`).
