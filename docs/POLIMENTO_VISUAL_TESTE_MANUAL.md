# Teste manual — Polimento Visual e Mobile (Sprint 27)

## Limitação honesta

Como em todas as sprints anteriores, não tenho credenciais de uma conta autenticada do HERDON (login via Supabase Auth). A grande maioria das telas listadas na sprint (Dashboard, Guia do Criador, Pastos, Lotes, Pesagens, Financeiro, Sincronização, Relatórios, Suporte, Perfil) **não pôde ser testada visualmente com dados reais**.

## O que foi de fato verificado visualmente

1. **Tela de Login**, em 390×844px (`preview_resize` + `preview_screenshot`): layout limpo, botões de largura total, espaçamento adequado, nenhum texto cortado. Sem problemas.
2. **`.action-row` antes e depois da correção**, via `getComputedStyle` no DevTools (sem precisar de login): confirmado que a classe não tinha `display: flex` antes da correção desta sprint, e confirmado que passou a ter depois — ver `docs/POLIMENTO_VISUAL_HERDON.md`.
3. Mesma verificação para `.page-actions`, `.row-actions`, `.summary-row`, `.summary-list`, `.form-actions`, `.lote-actions` — todas já corretas, sem necessidade de ajuste.
4. `npm run dev` sobe normalmente (porta 5173); console do navegador sem erros na tela de Login.

## O que foi verificado apenas por leitura de código (não visualmente)

- Estrutura de tabelas responsivas (`table-responsive`, `ui-table-wrap`) em Pastos, Lotes, Animais, Pesagens, Financeiro, Relatórios.
- `Modal.jsx` genérico: `max-height`, `overflow-y: auto`, largura `calc(100vw - 16px)` em telas pequenas.
- Grids de KPI do Dashboard, Pastos e Relatórios: todos têm fallback de colunas para mobile já implementado em sprints anteriores.
- Ausência de termos técnicos (payload, RPC, RLS, localStorage, queue, schema, mutation, debug) em texto visível.

## Gates automatizados

1. `npm test` — 510 testes, 0 falhas (nenhum teste novo nesta sprint: não houve alteração de lógica de domínio, apenas CSS e texto/estrutura de JSX).
2. `npm run lint` — 0 erros.
3. `npm run build` — build de produção concluído com sucesso; todos os chunks de página compilaram sem erro de import, confirmando que a adição da prop `onNavigate` em `RelatorioLotePage`, `RelatorioPesagensPage`, `RelatorioFinanceiroPage` e `RelatorioPastagensPage` não quebrou nada.

## Roteiro para quando houver uma conta de teste

### Desktop
1. Abrir Dashboard e confirmar espaçamento dos botões nos banners de onboarding e no card "Primeiros passos".
2. Navegar por todas as seções do menu lateral, incluindo o item renomeado **Painel Gerencial** (antes "Relatórios Gerenciais") e confirmar que não há mais confusão com o hub **Relatórios**.
3. Abrir Guia do Criador, Relatórios (5 páginas), Sincronização, Pastos, Lotes — confirmar espaçamento de botões em cada barra de ações.
4. Testar os 4 novos estados vazios com ação (Relatório do Lote, Pesagens, Financeiro, Pastos) — clicar no botão de cada um e confirmar que navega para a tela certa.

### Mobile/responsivo (390px, 430px, 768px)
1. Menu lateral (abrir/fechar, rolar se necessário).
2. Dashboard — banners de onboarding e card "Primeiros passos" devem empilhar verticalmente.
3. Hoje na Fazenda — cards de pasto/alerta.
4. Guia do Criador — cards de seção.
5. Pastos — tabela com coluna "Lotação" (rolagem horizontal esperada).
6. Lotes — cards de lote.
7. Pesagens — abas e formulário.
8. Importação — passos do assistente.
9. Sincronização — lista de registros e botões de ação.
10. Relatórios — os 5 cards do hub e cada página de relatório.

## Resultado

Sem acesso a uma conta de teste, esta sprint se apoiou em auditoria de código profunda e em uma correção verificada empiricamente (`.action-row`) que tem efeito amplo e seguro em toda a aplicação, mais um conjunto de ajustes de texto/menu de baixo risco. A verificação visual completa com dados reais continua pendente — ver `docs/POLIMENTO_VISUAL_HERDON.md`, seção "Pendências futuras".
