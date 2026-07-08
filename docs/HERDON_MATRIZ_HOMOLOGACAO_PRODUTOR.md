# Matriz de Homologação — Teste com Produtor (Sprints 21-22)

Método: Sprint 21 foi auditoria de código (leitura de fonte + schema real
via MCP Supabase), sem credencial de teste disponível naquela sessão.
Sprint 22 logou de fato na conta real (preview local) e validou
visualmente as telas — coluna "Mobile ok?" atualizada onde verificado
(ver `docs/SPRINT22_AUDITORIA_VISUAL_INTERNA.md` para o detalhe completo
de cada correção visual). "Fazenda 1/2 ok?" reflete se o código lê `db`
já recortado pela fazenda ativa (`src/domain/escopoFazenda.js`, Sprint 21).

| Área | Funcionalidade | Fazenda 1 ok? | Fazenda 2 ok? | Cadastro ok? | Edição ok? | Exclusão/inativação ok? | Importação ok? | Mobile ok? | Exportação ok? | Status | Observação | Prioridade |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Menu lateral/topbar | Navegação | N/A (conta) | N/A | — | — | — | — | **Corrigido (Sprint 22)** | — | Corrigido | Bottom-nav mobile aparecia até 1024px, coexistindo com o header de abas do desktop em telas de tablet/laptop — breakpoint corrigido para 767px | P0 |
| Dashboard | Visão geral | Sim | Sim | — | — | — | — | Sim (Sprint 22) | — | OK | Já tinha `dbDashboard` próprio antes da sprint | — |
| Lotes | CRUD de lote | Sim | Sim | Sim | Sim | Inativação (status) | Sim (via ImportacaoPage) | Sim (Sprint 22) | Sim | OK | Já filtrava por `fazendaSelecionada` antes | — |
| Pesagens | Lançar/editar pesagem | **Corrigido** | **Corrigido** | Sim | Sim | Cancelar registro | Sim | **Corrigido (Sprint 22)** | — | Corrigido | Fazenda: recorte central em `App.jsx` (Sprint 21). Visual: 4ª aba "Alertas" ficava invisível sem indicação de scroll — corrigido (Sprint 22) | P0/P1 |
| Acompanhamento de Peso | Evolução/GMD | Sim | Sim | — | — | — | — | **Corrigido (Sprint 22)** | — | Corrigido | Abas sobrepostas e ilegíveis no mobile — corrigido (Sprint 22) | P0 |
| Resultado por Lote | Custo/lucro por @ | Sim | Sim | — | — | — | — | Sim (Sprint 22) | Sim | OK | Lê `db.lotes`/`db.custos`, já escopados. Card de ações vazio no topo é P2 visual (ver Sprint 22) | — |
| Comparativo de Lotes | Comparar lotes | **Corrigido** | **Corrigido** | — | — | — | — | Sim (Sprint 22) | — | Corrigido nesta sprint | Não tinha nenhuma menção a fazenda antes | P0 |
| Custos por Lote | Lançar/editar custo | Sim | Sim | Sim | Sim | — | — | **Corrigido (Sprint 22)** | Sim | Corrigido | Valores monetários sem formatação pt-BR (`formatarNumero` em vez de `formatarMoeda`) causavam corte de texto no card mobile — corrigido (Sprint 22) | P1 |
| Financeiro | Contas a pagar/receber | **Corrigido** | **Corrigido** | Sim | Sim | Status pago/pendente | — | **Corrigido (Sprint 22)** | Sim | Corrigido | Fazenda: `App.jsx` (Sprint 21). Visual: aba "Pagamentos" cortada no mobile — corrigido (Sprint 22) | P0/P1 |
| DRE | Relatório financeiro | **Corrigido** | **Corrigido** | — | — | — | — | Sim (Sprint 22) | Sim | Corrigido nesta sprint | Mesma correção do Financeiro (mesma tabela e mesma tela de abas) | P0 |
| Estoque | CRUD de item + movimentação | **Corrigido** | **Corrigido** | Sim (corrigido) | Sim | — | — | Sim (Sprint 22) | Sim | Corrigido nesta sprint | Não filtrava por fazenda **e** novo item não gravava `fazenda_id` — ambos corrigidos (Sprint 21) | P0 |
| Sanidade | Aplicação sanitária | **Corrigido** | **Corrigido** | Sim | Sim | — | — | Sim (Sprint 22) | Sim | Corrigido nesta sprint | Só o sub-formulário IATF usava fazenda; lista principal não era escopada fora do Dashboard | P0 |
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
