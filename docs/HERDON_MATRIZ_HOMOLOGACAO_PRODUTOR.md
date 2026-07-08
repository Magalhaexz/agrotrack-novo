# Matriz de Homologação — Teste com Produtor (Sprint 21)

Método: auditoria de código (leitura de fonte + schema real via MCP
Supabase), não clique-a-clique em navegador — sem credencial de teste
disponível nesta sessão (mesma limitação já registrada nas Sprints 19/20).
"Fazenda 1/2 ok?" reflete se o código lê `db` já recortado pela fazenda
ativa (`src/domain/escopoFazenda.js`) depois do fix desta sprint.

| Área | Funcionalidade | Fazenda 1 ok? | Fazenda 2 ok? | Cadastro ok? | Edição ok? | Exclusão/inativação ok? | Importação ok? | Mobile ok? | Exportação ok? | Status | Observação | Prioridade |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dashboard | Visão geral | Sim | Sim | — | — | — | — | Não verificado | — | OK | Já tinha `dbDashboard` próprio antes da sprint | — |
| Lotes | CRUD de lote | Sim | Sim | Sim | Sim | Inativação (status) | Sim (via ImportacaoPage) | Não verificado | Sim | OK | Já filtrava por `fazendaSelecionada` antes | — |
| Pesagens | Lançar/editar pesagem | **Corrigido** | **Corrigido** | Sim | Sim | Cancelar registro | Sim | Não verificado | — | Corrigido nesta sprint | Página não recebia fazenda nenhuma; corrigido via recorte central em `App.jsx` | P0 |
| Acompanhamento de Peso | Evolução/GMD | Sim | Sim | — | — | — | — | Não verificado | — | OK | Já filtrava por fazenda antes | — |
| Resultado por Lote | Custo/lucro por @ | Sim | Sim | — | — | — | — | Não verificado | Sim | OK | Lê `db.lotes`/`db.custos`, já escopados | — |
| Comparativo de Lotes | Comparar lotes | **Corrigido** | **Corrigido** | — | — | — | — | Não verificado | — | Corrigido nesta sprint | Não tinha nenhuma menção a fazenda antes | P0 |
| Financeiro | Contas a pagar/receber | **Corrigido** | **Corrigido** | Sim | Sim | Status pago/pendente | — | Não verificado | Sim | Corrigido nesta sprint | `movimentacoes_financeiras` não era filtrada por fazenda | P0 |
| DRE | Relatório financeiro | **Corrigido** | **Corrigido** | — | — | — | — | Não verificado | Sim | Corrigido nesta sprint | Mesma correção do Financeiro (mesma tabela) | P0 |
| Estoque | CRUD de item + movimentação | **Corrigido** | **Corrigido** | Sim (corrigido) | Sim | — | — | Não verificado | Sim | Corrigido nesta sprint | Não filtrava por fazenda **e** novo item não gravava `fazenda_id` — ambos corrigidos | P0 |
| Sanidade | Aplicação sanitária | **Corrigido** | **Corrigido** | Sim | Sim | — | — | Não verificado | Sim | Corrigido nesta sprint | Só o sub-formulário IATF usava fazenda; lista principal não era escopada fora do Dashboard | P0 |
| Agenda Sanitária | Carência/próxima aplicação | **Corrigido** | **Corrigido** | — | — | — | — | Não verificado | — | Corrigido nesta sprint | Mesma tabela `sanitario` do item acima | P0 |
| Pastagens | CRUD de pasto | **Corrigido** | **Corrigido** | Sim (campo obrigatório) | Sim | — | Sim | Não verificado | — | Corrigido nesta sprint | Formulário já exige fazenda no cadastro — não é P0 de dado ausente, só de recorte na listagem | P0 |
| Rotinas/Tarefas | CRUD de tarefa | **Corrigido** | **Corrigido** | Sim | Sim | Concluir | — | Não verificado | — | Corrigido nesta sprint | `tarefas` só era filtrada no widget do Dashboard, não na página | P0 |
| Central de Alertas | Alertas + tratativas | **Corrigido** | **Corrigido** | — | — | Resolver/ignorar/adiar | — | Não verificado | Sim | Corrigido nesta sprint | `rawAlerts` era gerado do `db` inteiro, sempre — o alerta mais crítico de misturar fazendas | P0 |
| Simulador/Cenários | Cenário de compra/venda | **Corrigido** | **Corrigido** | Sim | — | — | — | Não verificado | — | Corrigido nesta sprint | Nenhuma menção a fazenda antes | P0 |
| Relatórios/Exportações | CSV/PDF (Sprint 19) | **Corrigido (herdado)** | **Corrigido (herdado)** | — | — | — | — | Não verificado | Sim | Corrigido nesta sprint | Exportam a partir do `db` já da página — herdam automaticamente o recorte | P0 |
| Telegram | `/alertas`, relatório diário | **Não corrigido** | **Não corrigido** | — | — | — | — | — | — | Pendente | `montarDbDaConta` no servidor não recorta por fazenda — conta com 2+ fazendas recebe alertas misturados no bot | P1 |
| Importação de planilhas | Fazendas/pastos/lotes/animais/pesagens | N/A (multi-fazenda por natureza) | N/A | Sim | — | Pula duplicados (não exclui) | Sim | Não verificado | — | OK | Já exige coluna `codigo_fazenda`, já deduplica contra o banco, mensagens de erro por linha | — |
| Configurações → Telegram | Vínculo/preferências | N/A (conta) | N/A | Sim | Sim | Desconectar | — | Não verificado | — | OK | Conexão é por usuário, não por fazenda | — |
| Backup (Exportar todos os dados) | Configurações → Dados | N/A (conta) | N/A | — | — | — | — | Não verificado | Sim | OK | Mantido com `db` completo de propósito (ver `FULL_DB_PAGE_KEYS`) | — |

## Legenda

- **Corrigido nesta sprint**: o recorte por fazenda estava ausente ou
  incompleto e foi corrigido em `src/App.jsx` +
  `src/domain/escopoFazenda.js` (Sprint 21).
- **Não verificado**: requer teste manual em navegador/celular com
  credenciais reais — não executado nesta sessão.
- **N/A**: página de conta, deliberadamente fora do recorte por fazenda.
