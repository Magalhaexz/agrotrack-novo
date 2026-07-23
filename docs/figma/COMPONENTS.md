# HERDON — Componentes oficiais

Os componentes abaixo formam a base do Conceito A. Reutilizar os componentes aprovados antes de criar variações novas.

| Componente | Finalidade | Variantes/estados | Responsividade e acessibilidade |
|---|---|---|---|
| Button | Ações primárias e secundárias | primary, secondary, neutral, danger; default, hover, focus, pressed, disabled, loading, error, success | Preservar largura no loading; foco visível; alvo mínimo 44 px |
| Icon Button | Ação compacta com ícone | default, hover, focus, pressed, disabled | Sempre fornecer label/tooltip acessível |
| Input | Entrada de texto, número e moeda | default, focus, help, error, success, disabled | Label persistente; ajuda e erro não dependem só de cor |
| Select | Seleção de opção | closed, open, focus, error, disabled | Teclado e foco visível |
| Search | Busca e filtros | empty, filled, loading, no results | Campo pesquisável em mobile |
| Checkbox | Seleção múltipla | unchecked, checked, indeterminate, disabled, focus | Label associado e alvo amplo |
| Switch | Preferência binária | off, on, disabled, focus | Não comunicar estado somente pela cor |
| Badge | Rótulo curto | neutral, success, warning, danger, info | Texto legível em todos os temas |
| Status | Estado operacional | normal, atenção, crítico, concluído, atrasado, erro, sincronizado | Ícone/texto + cor redundante |
| Card | Agrupamento de informação | default, hover, selected, pressed, loading, empty, error | Mobile vira card de uma coluna |
| KPI | Indicador de alto nível | default, loading, unavailable, positive, negative | Números em IBM Plex Mono; indisponível nunca vira zero |
| Table | Dados densos desktop | default, loading, empty, error, selected row | Mobile usa Mobile Card ou rolagem controlada |
| Mobile Card | Dados operacionais no mobile | default, selected, attention, critical | Padding 16 px e toque amplo |
| Modal | Fluxo de confirmação/edição | default, loading, error, success | Overlay, fechar por botão e foco controlado |
| Confirm Modal | Ação sensível | cancel, confirm, loading, error | Consequência clara; sem animação comemorativa |
| Drawer | Menu lateral ou painel secundário | closed, open, loading | Duração Drawer; conteúdo disponível com movimento reduzido |
| Bottom Sheet | Filtros e ações mobile | closed, open, error, empty | Overlay, botão de fechar; gesto é apenas referência |
| Toast | Feedback não bloqueante | success, error, warning, info | Entrada suave; erro mantém Tentar novamente/Ver detalhe |
| Tabs | Navegação dentro da tela | default, active, hover, focus, disabled | Indicador ativo; preserva posição da página |
| Empty State | Ausência de dados | empty, no results, no permission | Mensagem e próxima ação explícitas |
| Skeleton | Carregamento | KPI, lote, tarefas, financeiro, estoque, pesagens, alertas, resultados | Sem shimmer intenso; movimento reduzido usa estático |
| Pagination | Navegação de páginas | default, current, disabled | Teclável e legível |
| Filters | Filtros por contexto | desktop inline, mobile sheet, active, empty | Fazenda permanece visível no mobile |
| Sidebar | Navegação principal | open, collapsed, group open/closed, active, hover | Ícones permanecem ao recolher; tooltip na recolhida |
| Header | Contexto e ações do shell | desktop, mobile, with alerts, with quick actions | Não duplicar contador de alertas e ações |
| Bottom Navigation | Navegação mobile | default, active, more | Uma coluna e áreas de toque amplas |
| User Menu | Conta e sistema | closed, open | Perfil, configurações, assinatura, sincronização e guia |
| Quick Actions | Criação rápida | closed, open, desktop, mobile | Nomes completos; não alterar fluxos funcionais |

## Estados globais

Aplicar quando fizer sentido: loading, empty, error, sem permissão, sem conexão somente quando confirmado pelo fluxo real, atenção, crítico, disabled, sucesso, concluído, atrasado, estornado e dados insuficientes.

## Acessibilidade

- Foco visível em todos os controles interativos.
- Label, valor, ajuda, erro e sucesso no mesmo contexto do campo.
- Texto e ícone acompanham estados coloridos.
- Área mínima de toque: 44 px.
- Modais preservam foco e têm ação de cancelamento explícita.
- Nenhuma informação depende de cor ou animação isoladamente.
- `prefers-reduced-motion` preserva conteúdo, feedback e ações.

## Telas de referência

As referências estão em `screens/`. O mapa completo de uso por tela está em [ROUTES_MAP.md](./ROUTES_MAP.md) e os nodes em [NODES_MAP.md](./NODES_MAP.md).
