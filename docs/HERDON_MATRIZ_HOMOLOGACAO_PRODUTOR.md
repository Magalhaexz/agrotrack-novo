# Matriz de Homologação — Teste com Produtor (Sprints 21-25)

Método: Sprint 21 foi auditoria de código (leitura de fonte + schema real
via MCP Supabase), sem credencial de teste disponível naquela sessão.
Sprint 22 logou de fato na conta real (preview local) e validou
visualmente as telas — coluna "Mobile ok?" atualizada onde verificado
(ver `docs/SPRINT22_AUDITORIA_VISUAL_INTERNA.md` para o detalhe completo
de cada correção visual). "Fazenda 1/2 ok?" reflete se o código lê `db`
já recortado pela fazenda ativa (`src/domain/escopoFazenda.js`, Sprint 21).

**Sprint 23** corrigiu um P0 fora desta matriz (Rateio de Custos —
`CustosCompartilhadosPage.jsx`, não listado abaixo por não ser uma tela
de operação por fazenda) e um bug de breakpoint que deixava a sidebar de
desktop invisível entre 768-900px, afetando **todas** as telas nessa
faixa de largura — não só as listadas aqui. Ver
`docs/SPRINT23_CORRECAO_VISUAL_FINAL.md` para o detalhe completo.

**Sprint 24** logou de fato e navegou pelas 25 telas internas obrigatórias
(não só as desta matriz, que é focada em independência de fazenda) —
detalhe completo e checklist tela a tela em
`docs/SPRINT24_CORRECAO_VISUAL_TOTAL.md`. Resumo:

| Pergunta | Resposta |
|---|---|
| Visual validado? | Sim — 25/25 telas, logado, 375px; subconjunto também em 768px e 1280px |
| Mobile validado? | Sim — sem overflow, sem NaN/undefined/Infinity, sem erro de console em nenhuma das 25 |
| Layout bloqueia produtor? | Não, após as correções desta sprint (ver P0 abaixo) |
| Pendência visual? | Só P2 já documentados (card vazio em Resultado/Custos, estado vazio sem texto no Comparativo, 2 botões sem estilo em Acompanhamento de Peso — task separada) |

P0 encontrados e corrigidos na Sprint 24: botão "Nova pesagem" do
cabeçalho de Pesagens virava banner (grid 2 colunas com `justify-self:
stretch` padrão) e a aba "Nova pesagem" não mostrava campo nenhum, só um
botão que abria o formulário real escondido em outro ponto da página —
corrigido para a aba renderizar o formulário direto. Botão "Registrar
manejo" de Sanidade renderizava com 180px de altura (banner) — corrigido
para altura normal (44-56px).

**Sprint 25** — ver `docs/SPRINT25_AJUSTES_USO_REAL_PRODUTOR.md`:
- **Pesagens corrigido**: o fix da Sprint 24 fazia a aba "Nova pesagem"
  (padrão ao abrir a página) já renderizar o formulário automaticamente —
  ou seja, entrar em Pesagens pelo menu abria o modal na hora. Aba padrão
  trocada para "Histórico"; só pula para "Nova pesagem" com o atalho
  explícito do Dashboard.
- **Custos corrigido**: valores de KPI usavam fonte monoespaçada (DM
  Mono) — trocado para a fonte padrão do app (Inter), escopado à página.
- **Ações rápidas revisadas**: de 6 para 10 botões (Novo pasto, Saída de
  estoque, Resultado por lote, Central de Alertas adicionados).
- **Previsão de duração do estoque alimentar**: implementada e testada
  (`src/domain/previsaoConsumoEstoque.js`, 16 testes) — soma o consumo
  diário esperado por lote (`consumo_suplementacao`, modo `por_cabeca`) e
  calcula dias restantes por produto. Exibida em Estoque e
  Nutrição/Suplementação. Limitação: modo por percentual do peso vivo
  ainda não é somado (documentado).

**Sprint 26** — ver `docs/SPRINT26_CORRECAO_LAYOUT_FINANCEIRO.md`:
- **Custos Operacionais visual corrigido**: `.kpi-grid-3` nunca tinha
  `display: grid` definido — os 3 KPIs empilhavam como banners de largura
  total. Regra base adicionada; markup dos KPIs alinhado ao padrão
  `kpi-card--compact` já usado em Pesagens.
- **Financeiro/DRE visual corrigido**: gráficos "DRE mensal" e
  "Distribuição de despesas" ocupavam 220px fixos mesmo sem dados —
  agora mostram `EmptyState` compacto quando não há lançamentos.
  `ExportActions` ganhou espaçamento próprio (antes ficava colado entre
  abas e cards).
- **Exportação preservada**: nenhuma mudança em CSV/PDF, cálculo ou
  regra de caixa/competência.

**Sprint 27** — auditoria total logado, 35 telas × 3 viewports, navegação
real (ver `docs/SPRINT27_AUDITORIA_TOTAL_APP.md`):
- **Independência entre fazendas revalidada com dado real** (alternando
  fazenda ativa): sem vazamento em Lotes, Custos, Financeiro. PASS.
- **P1 corrigido — botão gigante no mobile:** o botão de ação do
  `PageHeader` virava bloco de ~180px em `≤720px` (Custos, Sanidade,
  Pastos, Animais, Tarefas, Estoque…). Causa: `.ph-actions` vira coluna e
  herdava `flex: 1 1 180px` de `.page-actions > *` (basis vira altura em
  coluna). Uma regra em `app.css` corrigiu todas as páginas de uma vez.
- Sweep sem overflow / NaN / erro de console em nenhuma tela nos 3
  tamanhos. Exportação CSV revalidada (sem NaN/undefined). Nenhum P0.
- Pendências P2/P3 em `docs/HERDON_PENDENCIAS_POS_TESTE_PRODUTOR.md`.
- **Decisão: liberado para teste de produtor por 1 mês.**

| Área | Funcionalidade | Fazenda 1 ok? | Fazenda 2 ok? | Cadastro ok? | Edição ok? | Exclusão/inativação ok? | Importação ok? | Mobile ok? | Exportação ok? | Status | Observação | Prioridade |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Menu lateral/topbar | Navegação | N/A (conta) | N/A | — | — | — | — | **Corrigido (Sprint 22)** | — | Corrigido | Bottom-nav mobile aparecia até 1024px, coexistindo com o header de abas do desktop em telas de tablet/laptop — breakpoint corrigido para 767px | P0 |
| Dashboard | Visão geral | Sim | Sim | — | — | — | — | Sim (Sprint 22) | — | OK | Já tinha `dbDashboard` próprio antes da sprint | — |
| Lotes | CRUD de lote | Sim | Sim | Sim | Sim | Inativação (status) | Sim (via ImportacaoPage) | Sim (Sprint 22) | Sim | OK | Já filtrava por `fazendaSelecionada` antes | — |
| Pesagens | Lançar/editar pesagem | **Corrigido** | **Corrigido** | Sim | Sim | Cancelar registro | Sim | **Corrigido (Sprint 22/23/24/25)** | — | Corrigido | Fazenda (Sprint 21); aba "Alertas" invisível (Sprint 22); botão sem estilo/GMD gigante (Sprint 23); formulário fantasma dentro da aba (Sprint 24); abria modal automaticamente ao entrar pelo menu — aba padrão trocada para Histórico (Sprint 25) | P0/P1 |
| Acompanhamento de Peso | Evolução/GMD | Sim | Sim | — | — | — | — | **Corrigido (Sprint 22)** | — | Corrigido | Abas sobrepostas e ilegíveis no mobile — corrigido (Sprint 22) | P0 |
| Resultado por Lote | Custo/lucro por @ | Sim | Sim | — | — | — | — | Sim (Sprint 22) | Sim | OK | Lê `db.lotes`/`db.custos`, já escopados. Card de ações vazio no topo é P2 visual (ver Sprint 22) | — |
| Comparativo de Lotes | Comparar lotes | **Corrigido** | **Corrigido** | — | — | — | — | Sim (Sprint 22) | — | Corrigido nesta sprint | Não tinha nenhuma menção a fazenda antes | P0 |
| Custos por Lote | Lançar/editar custo | Sim | Sim | Sim | Sim | — | — | **Corrigido (Sprint 22/26/27)** | Sim | Corrigido | Formatação pt-BR (S22). KPIs em banner por `.kpi-grid-3` sem `display:grid` (S26). Botão "+ Novo custo" virava bloco de 180px no mobile (S27) | P1 |
| Financeiro | Contas a pagar/receber | **Corrigido** | **Corrigido** | Sim | Sim | Status pago/pendente | — | **Corrigido (Sprint 22/26)** | Sim | Corrigido | Fazenda: `App.jsx` (Sprint 21). Visual: aba "Pagamentos" cortada no mobile — corrigido (Sprint 22). Gráficos DRE vazios sem EmptyState — corrigido (Sprint 26) | P0/P1 |
| DRE | Relatório financeiro | **Corrigido** | **Corrigido** | — | — | — | — | Sim (Sprint 22) | Sim | Corrigido nesta sprint | Mesma correção do Financeiro (mesma tabela e mesma tela de abas) | P0 |
| Estoque | CRUD de item + movimentação | **Corrigido** | **Corrigido** | Sim (corrigido) | Sim | — | — | **Corrigido (Sprint 22/27)** | Sim | Corrigido | Não filtrava por fazenda **e** novo item não gravava `fazenda_id` — ambos corrigidos (Sprint 21). Botões de ação do header viravam blocos de 180px no mobile (S27) | P0 |
| Sanidade | Aplicação sanitária | **Corrigido** | **Corrigido** | Sim | Sim | — | — | **Corrigido (Sprint 22/27)** | Sim | Corrigido | Só o sub-formulário IATF usava fazenda; lista principal não era escopada fora do Dashboard. Botão "Registrar manejo" virava bloco de 180px no mobile (S27) | P0 |
| Agenda Sanitária | Carência/próxima aplicação | **Corrigido** | **Corrigido** | — | — | — | — | Sim (Sprint 22) | — | Corrigido nesta sprint | Mesma tabela `sanitario` do item acima | P0 |
| Pastagens | CRUD de pasto | **Corrigido** | **Corrigido** | Sim (campo obrigatório) | Sim | — | Sim | Sim (Sprint 22) | — | Corrigido nesta sprint | Formulário já exige fazenda no cadastro — não é P0 de dado ausente, só de recorte na listagem | P0 |
| Rotinas/Tarefas | CRUD de tarefa | **Corrigido** | **Corrigido** | Sim | Sim | Concluir | — | Sim (Sprint 22) | — | Corrigido nesta sprint | `tarefas` só era filtrada no widget do Dashboard, não na página | P0 |
| Central de Alertas | Alertas + tratativas | **Corrigido** | **Corrigido** | — | — | Resolver/ignorar/adiar | — | Sim (Sprint 22) | Sim | Corrigido nesta sprint | `rawAlerts` era gerado do `db` inteiro, sempre — o alerta mais crítico de misturar fazendas | P0 |
| Simulador/Cenários | Cenário de compra/venda | **Corrigido** | **Corrigido** | Sim | — | — | — | Sim (Sprint 22) | — | Corrigido nesta sprint | Nenhuma menção a fazenda antes | P0 |
| Relatórios/Exportações | CSV/PDF (Sprint 19) | **Corrigido (herdado)** | **Corrigido (herdado)** | — | — | — | — | Sim (Sprint 22) | Sim | Corrigido nesta sprint | Exportam a partir do `db` já da página — herdam automaticamente o recorte | P0 |
| Telegram | `/alertas`, relatório diário | **Não corrigido** | **Não corrigido** | — | — | — | — | — | — | Pendente | `montarDbDaConta` no servidor não recorta por fazenda — conta com 2+ fazendas recebe alertas misturados no bot | P1 |
| Importação de planilhas | Fazendas/pastos/lotes/animais/pesagens | N/A (multi-fazenda por natureza) | N/A | Sim | — | Pula duplicados (não exclui) | Sim | Não verificado | — | OK | Já exige coluna `codigo_fazenda`, já deduplica contra o banco, mensagens de erro por linha | — |
| Configurações → Telegram | Vínculo/preferências | N/A (conta) | N/A | Sim | Sim | Desconectar | — | Não verificado | — | OK | Conexão é por usuário, não por fazenda | — |
| Backup (Exportar todos os dados) | Configurações → Dados | N/A (conta) | N/A | — | — | — | — | Não verificado | Sim | OK | Mantido com `db` completo de propósito (ver `FULL_DB_PAGE_KEYS`) | — |

## Legenda

- **Corrigido nesta sprint** / sem sufixo: o recorte por fazenda estava
  ausente ou incompleto e foi corrigido em `src/App.jsx` +
  `src/domain/escopoFazenda.js` (Sprint 21).
- **Corrigido (Sprint 22)**: bug visual/UX (não de fazenda) encontrado e
  corrigido logando na conta real — detalhe em
  `docs/SPRINT22_AUDITORIA_VISUAL_INTERNA.md`.
- **Sim (Sprint 22)**: tela aberta e validada visualmente (mobile) nessa
  sprint, sem problema encontrado.
- **Não verificado**: requer teste manual em navegador/celular com
  credenciais reais — não executado até a Sprint 21; a maioria foi
  verificada na Sprint 22.
- **N/A**: página de conta, deliberadamente fora do recorte por fazenda.
