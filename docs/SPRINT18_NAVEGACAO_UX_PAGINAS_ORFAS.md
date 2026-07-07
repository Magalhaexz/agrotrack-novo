# Sprint 18 — Navegação, UX e Páginas Órfãs

Auditoria de navegação/rotas, correção de páginas órfãs de alto valor, estados vazios, consistência visual e atalhos — sem alterar regra de negócio. Ver também [HERDON_MAPA_NAVEGACAO.md](HERDON_MAPA_NAVEGACAO.md) (estrutura de menu/permissões).

## Contexto (Sprints 13-17)

A Sprint 13 (`docs/FASE0_NAVEGACAO_SIDEBAR_HERDON.md`, `HERDON_AUDITORIA_TECNICA.md`) já tinha identificado 7 páginas órfãs e a duplicação `funcionarios`×`equipeAcessos`. As Sprints 14-17 fortaleceram cálculo, integridade de dados e banco sem tocar navegação — esta sprint fecha esse gap específico.

## Etapa 0 — Pré-checks

| Check | Resultado |
|---|---|
| `npm run lint` | limpo |
| `npm test -- --run` | **922/922** |
| `npm run build` | ok |
| `git status --short` | árvore com apenas arquivos do vault Obsidian não versionados (fora de escopo) |

## Etapa 1-2 — Auditoria de navegação e matriz de páginas

**46 páginas** em `src/pages`, **46 registradas em `pageMap`** (`src/App.jsx`). `navSections` (`src/navigation/navConfig.js`) tinha **30 páginas** com entrada de menu antes desta sprint. `permissoesPorPagina` (`src/auth/perfis.js`) já cobria as 46 — nenhuma página roda sem permissão configurada.

### Páginas órfãs encontradas (no pageMap + com permissão, sem entrada de menu)

| Página | pageId | Linhas | Motivo de estar órfã | Decisão |
|---|---|---|---|---|
| `EvolucaoRebanhoPage` | `evolucaoRebanho` | 153 | Esquecida na criação do navConfig atual | **Adicionada ao menu** (grupo Campo e Rebanho) |
| `ComparativoPage` | `comparativo` | 226 | Idem | **Adicionada ao menu** (grupo Campo e Rebanho) |
| `AcompanhamentoPesoPage` | `acompanhamentoPeso` | 717 | Idem — nenhuma outra página linkava para ela | **Adicionada ao menu** (grupo Campo e Rebanho) |
| `RotinaPage` | `rotina` | 465 | Só o **resultado** (eventos de rotina) aparecia no Calendário; faltava o ponto de entrada de CRUD | **Adicionada ao menu** (grupo Campo e Rebanho) |
| `CustosPage` | `custos` | 405+ | Idem — página madura, espelha lançamento em `movimentacoes_financeiras` automaticamente | **Adicionada ao menu** (grupo Finanças) |
| `DashboardPremiumPage` | `dashboardPremium` | 129 | Rollup de KPIs que já existem em outros lugares | **Não adicionada** — ver Etapa 9 (duplicação) |
| `PlanejamentoPage` | `planejamento` | 92 | Abas que envolvem Pastagens/Evolução/Indicadores/Cenários/Relatórios Gerenciais, todos já acessíveis individualmente após esta sprint | **Não adicionada** — ver Etapa 9 (duplicação) |
| `FuncionariosPage` | `funcionarios` | 170 | Duplicata intencional de `equipeAcessos`, já documentada na Sprint 13 | **Mantida oculta** (sem mudança) |

`IndicadoresPage` (`indicadores`) também está órfã do menu principal, mas é consumida como aba dentro de `PlanejamentoPage` — como `PlanejamentoPage` não entrou no menu (redundante, ver acima), `IndicadoresPage` segue sem entrada própria. Registrado como pendência (ver Limitações).

### Páginas que não estavam órfãs (falso positivo inicial)

`relatorioLote`, `relatorioPesagens`, `relatorioPastagens`, `relatorioResumoGeral`, `relatorioFinanceiro` não têm entrada própria no menu, mas **não são órfãs** — são sub-relatórios acessados a partir da página "Relatórios" (`RelatoriosPage`, já no menu), que lista e linka para cada um. Confirmado via grep: `RelatoriosPage.jsx` referencia os 5 `pageId`s diretamente.

## Etapa 3-4 — Correção das órfãs de alto valor

Critério aplicado: só entrou no menu página madura (CRUD completo, sem placeholder "em breve"), sem overlap com página já existente. As 5 páginas adicionadas (ver tabela acima) foram inseridas nos grupos já existentes de `navConfig.js` (sem reestruturar os 7 grupos existentes — já razoavelmente coerentes; reagrupar tudo seria risco desnecessário para o ganho, e a regra da sprint pede mudanças pequenas e incrementais):

- **Campo e Rebanho**: `acompanhamentoPeso`, `rotina`, `comparativo`, `evolucaoRebanho`.
- **Finanças**: `custos`.

Dois ícones novos precisaram ser adicionados ao shim local `src/lucide-react.js` (o projeto não usa o pacote `lucide-react` real, reimplementa os ícones usados via SVG mínimo) — `GitCompare` (Comparativo) e `LineChart` (Evolução do Rebanho); `Weight`/`Repeat`/`DollarSign` já existiam no shim e foram reaproveitados para os demais.

## Etapa 5 — Permissões

Nenhuma permissão nova foi necessária — `permissoesPorPagina` já tinha entrada para as 5 páginas antes desta sprint (`comparativo:ver`, `sanitario:ver` para rotina, `animais:ver` para acompanhamentoPeso, `financeiro:ver` para custos, `evolucao_rebanho:ver`), todas já presentes nas listas de `permissoesPorPerfil` com o escopo correto por papel (ex.: `operador` não tem `financeiro:ver`, então `custos` continua invisível para esse papel mesmo agora aparecendo no menu — comportamento herdado, confirmado no código, não alterado). `navSections` já é filtrado por `hasPermission` em `App.jsx` (linha ~883), então a adição ao menu é puramente aditiva e já respeita os papéis existentes. Nenhum teste de permissão quebrou (922/922 mantidos).

## Etapa 6 — Estados vazios

Auditoria das 8 páginas prioritárias listadas na sprint. A maioria **já tinha** estado vazio completo (título + explicação + ação), fruto de trabalho de sprints anteriores:

| Página | Estado antes | Ação |
|---|---|---|
| Lotes | Já bom (`EmptyState` com título/subtítulo/botão) | Nenhuma |
| Estoque | Já bom | Nenhuma |
| Sanidade | Já bom | Nenhuma |
| Central de Alertas | Já bom (com ícone/tom) | Nenhuma |
| Financeiro | Já bom (vazio contextual por seção) | Nenhuma |
| Simulador (Cenários) | Bom (falta só botão de ação, não crítico) | Nenhuma |
| Evolução do Rebanho | Já bom | Nenhuma |
| **Dashboard** — widget "Itens em estoque" | Fraco: só `<p>Nenhum item no estoque.</p>`, sem explicação | **Corrigido**: `"Nenhum item de estoque cadastrado." + "Cadastre insumos para controlar consumo, validade e reposição."` |

## Etapa 7 — Mobile e responsividade

Validado ao vivo (dev server, viewport 375×812): tela de Login sem overflow horizontal (`scrollWidth === innerWidth === 375`), sem erro de console. **Limitação:** sem credencial de teste disponível nesta sessão (mesma limitação documentada em todas as sprints anteriores desde a 13), então Dashboard/Central de Alertas/Lotes/Sanidade/Estoque/Financeiro/Simulador não puderam ser exercitados ao vivo no navegador em mobile.

Auditoria estática do CSS como compensação:
- `.main, .page-wrapper, .page-shell { overflow-x: hidden }` + `max-width: 100%` em `html/body/#root/.app` (já existente, "Sprint 6.5G — responsive polish") cobre a maioria dos containers.
- `.history-table`/`.data-table`/`.dashboard-table`/`.ui-table-wrap` já ganham `overflow-x: auto` em `@media (max-width: 992px)` — nenhuma tabela encontrada sem essa proteção.
- O menu mobile usa `MobileBottomNav` (componente separado, 5 itens fixos: Início/Rebanho/Financeiro/Estoque/Mais), **não** afetado pelas 5 páginas adicionadas a `navSections` — a barra inferior continua com os mesmos 5 atalhos; o botão "Mais" abre o menu completo (drawer), que já era rolável antes desta sprint.

Nenhum problema de overflow foi encontrado na auditoria estática; nenhuma alteração de CSS de layout foi necessária.

## Etapa 8 — Consistência visual

Encontrado: `AcompanhamentoPesoPage` e `CustosPage` — as duas páginas órfãs mais antigas — usavam um padrão de cabeçalho manual (`<div className="page-header page-topbar"><h1>...</h1><p>...</p></div>`) diferente do componente `PageHeader` usado por **28 das 30 páginas restantes**. Como são exatamente as páginas que passam a aparecer no menu pela primeira vez nesta sprint, corrigido para usar `PageHeader` (mesmo título/subtítulo/ação, sem mudança de conteúdo):

- `AcompanhamentoPesoPage.jsx` — trocado para `<PageHeader title="Acompanhamento de Peso" subtitle="..." />`.
- `CustosPage.jsx` — trocado para `<PageHeader title="Custos Operacionais" subtitle="..." actions={<button>+ Novo custo</button>} />`.

**Não corrigido (documentado, fora do escopo de "ajuste pontual"):** `src/styles/app.css` (8000+ linhas) redefine `.history-table`/`.data-table` em pelo menos 4 blocos diferentes (linhas ~1087, ~5500, ~6884, ~8164) — sinal de acúmulo de CSS ao longo de várias sprints sem consolidação. Funciona corretamente (confirmado nesta auditoria), mas é dívida de manutenção — registrado como pendência, não uma mudança segura de fazer sem teste visual completo de todas as telas.

## Etapa 9 — Duplicações de páginas/módulos

| Duplicação | Situação | Ação |
|---|---|---|
| `funcionarios` × `equipeAcessos` | Já documentada (Sprint 13/16): `equipeAcessos` é o ponto de entrada oficial; `FuncionariosPage` segue registrada em `pageMap` mas sem link de menu | **Mantida como está** — já era a decisão aprovada, nada mudou |
| `DashboardPremiumPage` × `PlanejamentoPage` (achado novo desta sprint) | `DashboardPremiumPage` mostra um resumo de KPIs estratégicos (rebanho, UA, margem, melhor cenário); a aba "Visão Geral" de `PlanejamentoPage` mostra **os mesmos** KPIs quase idênticos. `PlanejamentoPage` ainda embrulha `PastagensPage`/`EvolucaoRebanhoPage`/`IndicadoresPage`/`CenariosPage`/`RelatoriosGerenciaisPage` em abas — 3 dessas 5 já têm entrada própria no menu (Pastos, Cenários, Painel Gerencial), e 1 (Evolução do Rebanho) ganhou entrada própria nesta sprint | **Não adicionadas ao menu** — adicionar as duas criaria 2 novos itens que só reapresentam conteúdo já acessível por outros caminhos, mais confusão que clareza. Mantidas registradas (não removido código), depreciadas por omissão do menu. `IndicadoresPage` fica como pendência (ver Limitações) |
| Relatórios (`RelatoriosPage` vs `RelatoriosGerenciaisPage`) | Duas páginas de relatório distintas, ambas no menu (grupo Decisão), nomes parecidos (`Relatórios` vs `Painel Gerencial`) | **Documentado, não alterado** — conteúdo é de fato diferente (uma lista sub-relatórios detalhados, outra é um painel executivo); risco de confundir por nome, mas trocar nome de página já em uso é uma mudança de rotulagem que merece validação de UX antes, fora do orçamento desta sprint |
| Financeiro × DRE | Investigado: não há página separada de "DRE" — o cálculo (`computeDRE()`) vive dentro de `FinanceiroPage.jsx`. Não é duplicação de página | Nenhuma ação necessária |
| Alertas legados × Central | Já documentada extensivamente na Sprint 16 (`SPRINT16_CENTRAL_ALERTAS_UNICA.md`) — painel legado do header/Dashboard mantido, não migrado | Nenhuma ação nesta sprint (fora do escopo — só navegação/UX, não lógica de alertas) |

## Etapa 10 — Atalhos estratégicos

Auditados os atalhos sugeridos pela sprint — a maioria **já existia**:

| Atalho sugerido | Situação encontrada | Ação |
|---|---|---|
| Dashboard → Cadastrar lote | Já existe (`"Cadastrar lote"` no card "Primeiros passos", + "Novo lote" em Ações Rápidas) | Nenhuma |
| Dashboard → Lançar pesagem | Já existe ("Nova pesagem" em Ações Rápidas) | Nenhuma |
| Dashboard → Lançar sanidade | Já existe ("Novo manejo/sanidade" em Ações Rápidas) | Nenhuma |
| Estoque → Cadastrar item | Já existe (botão no `EmptyState` e no cabeçalho da página) | Nenhuma |
| Sanidade → Ver Agenda Sanitária | Não é um atalho de navegação — a Agenda Sanitária já é uma seção **dentro** da própria página Sanidade (Sprint 10), não uma página separada | Nenhuma (não havia destino para linkar) |
| Central de Alertas → abrir página relacionada | Já existe — cada card de alerta tem botão "Abrir" que navega para `alerta.pageId` quando presente | Nenhuma |
| **Dashboard → Central de Alertas** | A aba legada já tinha esse atalho (Sprint 16), mas a seção nova "Prioridades de hoje" (o widget principal, não a aba legada) não tinha | **Adicionado**: botão "Ver Central de Alertas" ao lado do badge de críticos na seção "Prioridades de hoje" |

## Testes (Etapa 12)

Não existem testes dedicados em `src/navigation` ou cobrindo diretamente o menu (`navConfig.js` é dados estáticos, sem lógica a testar). `src/auth` tem teste de permissões (`perfis.test.js` — parte da suíte geral, já cobre `permissoesPorPagina`/matriz de perfis, sem necessidade de novo teste já que nenhuma permissão foi criada ou alterada). `centralAlertas.test.js` rodado isoladamente sem regressão.

Suíte completa: **922/922**, sem nenhum teste novo necessário (mudança é de navegação/apresentação, não de lógica de domínio).

## Validação visual (Etapa 13)

Login validado ao vivo (desktop + mobile 375px): sem erro de console, sem overflow. Demais páginas autenticadas não puderam ser exercitadas ao vivo — sem credencial de teste nesta sessão (limitação idêntica às Sprints 13-17). Garantia desta sprint: build limpo, lint limpo, 922 testes, auditoria de código de todos os consumidores de `navConfig`/`permissoesPorPagina`, e confirmação de que `MobileBottomNav` (barra inferior mobile) não é afetada pelas novas entradas de menu.

## Validação final (Etapa 14)

| Check | Resultado |
|---|---|
| `npm run lint` | limpo |
| `npm test -- --run` | 922/922 |
| `npm run build` | ok — Dashboard/Central de Alertas/Lotes/Sanidade-Estoque/Financeiro/Simulador/Telegram todos compilam (nenhum módulo tocado gera erro de build) |
| Permissões | preservadas — nenhuma alterada, 5 páginas passam a aparecer no menu só para os papéis que já tinham a permissão correspondente |
| `.env` | não alterado |
| Tokens | nenhum exposto |
| Arquivos fora de escopo | não commitados (vault Obsidian, docs antigos untracked seguem intocados) |

## Limitações restantes

- `IndicadoresPage` (`indicadores`) segue sem entrada própria no menu — é madura e tem permissão configurada, mas não foi incluída nesta leva porque só apareceu no raio-x depois de decidir não adicionar `PlanejamentoPage` (que a embrulhava). Fica como candidata para a próxima revisão de navegação, com uma leitura mais aprofundada do conteúdo antes de decidir o grupo/label.
- `DashboardPremiumPage`/`PlanejamentoPage` seguem no código, registradas, sem entrada de menu — decisão de manter/depreciar formalmente/remover fica para quando houver decisão de produto sobre qual das duas visões estratégicas (se alguma) deve ser a oficial.
- CSS com regras de tabela duplicadas em `app.css` não foi consolidado — documentado como dívida, não uma tarefa desta sprint.
- Validação visual completa (além do Login) depende de credencial de teste — mesma limitação de todas as sprints anteriores.
- Nomeação "Relatórios" vs "Painel Gerencial" pode confundir usuários novos — não renomeado, precisa de decisão de UX antes.
