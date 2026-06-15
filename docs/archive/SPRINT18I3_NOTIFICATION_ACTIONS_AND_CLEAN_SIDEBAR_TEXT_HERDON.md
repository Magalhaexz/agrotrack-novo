# SPRINT18I3_NOTIFICATION_ACTIONS_AND_CLEAN_SIDEBAR_TEXT_HERDON

## Sidebar subtitles removed
- Removi os subtítulos descritivos dos grupos de navegação em `src/navigation/navConfig.js` (remoção dos campos `description`).
- A renderização da sidebar em `src/components/Sidebar.jsx` também foi simplificada para exibir apenas o título do grupo (sem `small` de descrição).

## Sidebar group titles preserved
- Mantive o agrupamento do SPRINT18G, sem mover itens.
- Títulos finais:
  - Cadastros
  - Nutrição / Suplementação
  - Estoque
  - Financeiro
  - Operação
  - Análises e Relatórios
  - Configurações

## Text labels fixed
- Ajustei acentuação e rótulos visíveis em navegação/sidebar:
  - Funcionários
  - Nutrição / Suplementação
  - Operação
  - Sanitário
  - Calendário
  - Análises e Relatórios
  - Relatórios
  - Configurações
- Também corrigi rótulos de acessibilidade na sidebar (navegação/usuário).

## Stable alert key generation
- Em `src/App.jsx`, o filtro e persistência usam a mesma chave estável:
  - prioridade: `alert.ackKey`
  - fallback: `alert.id`
  - fallback derivado: `type|route|title|date`
- `rawAlerts` já é normalizado com `ackKey` estável para render, resolver e adiar.

## Resolver persistence and filtering
- `Resolver` chama persistência compatível em `alertas_resolvidos` (`createOperationalRecord`).
- Atualiza `db.alertas_resolvidos` imediatamente no estado local.
- O alerta sai da lista ativa imediatamente pelo filtro de `alerts`.
- Mensagem preservada: `Notificação resolvida.`

## Adiar persistence and filtering
- `Adiar` persiste em `alertas_adiados` com `{ chave, ate }`.
- Atualiza `db.alertas_adiados` imediatamente no estado local.
- Opções seguras no menu: `Amanhã`, `3 dias`, `7 dias`.
- Filtro corrigido para reaparecer somente após expirar:
  - oculta quando `ate >= hoje`
  - reapresenta quando `ate < hoje`
- Mensagem preservada: `Lembrete adiado.`

## Abrir navigation behavior
- `Abrir` chama `onAlertNavigate` e fecha o dropdown.
- Em `App.jsx`, quando há `route`, navega; quando não há, mostra:
  - `Não há destino configurado para este alerta.`

## CSS/clickability fixes
- Mantive os botões de ação como botões reais e explícitos com `type="button"` em `AppHeader` para evitar submit/propagação indevida.
- Preservei o estilo premium dark HERDON sem redesign amplo.

## Intentionally not changed
- Não alterei Supabase schema, RLS, auth, sync core, cloud diagnostic flow.
- Não alterei agrupamento de navegação (apenas limpeza visual dos títulos e textos).
- Não alterei dashboard, relatórios, financeiro ou cálculos de negócio.

## Testing results
- `git grep -n -E "BASE DA OPERAÇÃO|DIETAS, SUPLEMENTOS|PLANEJAMENTO ALIMENTAR|descrição|subtitle|description" -- src/components/Sidebar.jsx src/navigation/navConfig.js`
  - sem ocorrências.
- `git grep -n -E "NUTRICAO|SUPLEMENTACAO|OPERACAO|FUNCIONARIOS" -- src/components/Sidebar.jsx src/navigation/navConfig.js`
  - sem ocorrências.
- `git grep -n -E "Ã§|Ã£|Ã¡|Ã©|Ãª|Ã³|Ã­|Ãº|Ãµ|Â|�" -- src ":(exclude)src/assets/*"`
  - 1 ocorrência remanescente fora do escopo deste sprint em `src/styles/tokens.css` (comentário), não relacionada à sidebar/notificações.
- `git grep -n -E "^(<<<<<<<|=======|>>>>>>>)" -- .`
  - sem conflitos.
- `npm run build`
  - sucesso.
- `npm run lint`
  - sucesso sem erros (apenas warnings preexistentes de `react-hooks/exhaustive-deps`).

## Manual verification checklist
- Sidebar mostra apenas títulos de grupos, sem subtítulos explicativos.
- No dropdown de notificações:
  - Resolver: remove imediatamente e persiste.
  - Adiar: remove imediatamente e oculta até a data de adiamento.
  - Abrir: navega para `route` ou mostra mensagem segura quando ausente.
- Observação: validação manual de clique/refresh depende de execução interativa no browser.
