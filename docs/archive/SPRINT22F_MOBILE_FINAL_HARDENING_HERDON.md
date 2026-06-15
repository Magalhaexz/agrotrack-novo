# SPRINT22F_MOBILE_FINAL_HARDENING_HERDON

## Files changed
- `src/styles/app.css`
- `SPRINT22F_MOBILE_FINAL_HARDENING_HERDON.md`

## Mobile issues fixed
- Reforço global contra overflow horizontal em viewport mobile/tablet (`<=1024px`).
- Reforço de tab bars (`tab-bar`, `tab-buttons`, `segmented-control`, `config-tabs`) para scroll horizontal com targets tocáveis.
- Reforço de wrappers responsivos para tabelas/listas densas (`table-responsive`, shells de tabelas principais).
- Colapso seguro de grids de filtros/forms críticos para 1 coluna no mobile (Pesagens, Estoque, Nutrição, Configurações, Funcionários).
- Wrapping de action rows em módulos críticos para evitar corte/sobreposição de botões.
- Endurecimento de calendário mobile: células compactas e ocultação de labels internos para evitar sobreposição.
- Reforço de posição do FAB acima da bottom nav com safe-area:
  - `bottom: calc(var(--herdon-mobile-bottomnav-height, 72px) + env(safe-area-inset-bottom) + 16px)`

## Screens reviewed
- Login
- Dashboard
- Fazendas
- Lotes/Rebanho
- Detalhe de lote
- Animais
- Pesagens
- Calendário
- Estoque
- Nutrição/Suplementação
- Financeiro
- Relatórios/Resultados
- Sanitário/Manejo
- Tarefas
- Funcionários
- Configurações
- Usuários e Acessos

## Validation results
- `npm run build` ✅
- `npm run lint` ✅
- `rg -n "^(<<<<<<<|=======|>>>>>>>)" src --glob '*.{js,jsx,ts,tsx,css}' || true` ✅
- `rg -n "100vw|overflow-x|position: fixed|bottom:" src/styles src/pages src/components --glob '*.{css,jsx,js}' || true` ✅ (scan executado para risco CSS mobile)

## Remaining risks
- Ainda recomendado QA manual em device real para confirmar ergonomia com teclado aberto (save/cancel em modais) e dados extremamente longos em tabelas.
- Alguns módulos podem demandar micro-ajustes de espaçamento por densidade de conteúdo dinâmico.

## Next recommended sprint
- Sprint curto de QA manual assistido por device farm (iOS Safari / Android Chrome / tablets) com capturas por fluxo crítico e checklist de aceite final mobile.
