# HERDON — Mapa de rotas e arquivos

Rotas conferidas em `src/navigation/routes.js`, páginas em `src/App.jsx` e imports CSS em `src/`.

Componentes globais atuais de todas as telas: `src/styles/tokens.css`, `src/styles/app.css`, `src/styles/ui.css` e `src/styles/layout.css`.

| Tela | Rota atual | Arquivo React | CSS atual | Componentes principais | Regras preservadas |
|---|---|---|---|---|---|
| Login | `/` antes da sessão / fluxo de auth | `src/pages/LoginPage.jsx` | `login.css` + globais | Login, campos, OAuth, recuperação | Supabase Auth, cadastro, Google e recuperação |
| Painel Geral | `/` | `src/pages/DashboardPage.jsx` | `dashboard.css` | Shell, KPI, Hoje na Fazenda, alertas | Alertas unificados, permissões e dados da fazenda |
| Central de Alertas | `/alertas` | `src/pages/AlertasPage.jsx` | `alertas.css` | Filtros, alertas, tratativas | Resolver/ignorar/adiar e rotas dos alertas |
| Lotes | `/lotes` | `src/pages/LotesPage.jsx` | `rebanho.css` | Lote Card, filtros, ações, modais | Pesagem, venda, morte/perda, pasto e permissões |
| Animais | `/animais` | `src/pages/AnimaisPage.jsx` | globais | Table/Card, filtros | Movimentações, pesagens e escopo da fazenda |
| Pesagens | `/pesagens` | `src/pages/PesagensPage.jsx` | globais | KPI, histórico, modal | GMD e pesos não podem ser recalculados na UI |
| Pastos | `/pastagens` | `src/pages/PastagensPage.jsx` | globais | Pasto Card, status, filtros | Capacidade, UA e lotação canônicas |
| Sanidade | `/sanitario` | `src/pages/SanitarioPage.jsx` | globais | Status, filtros, manejo modal | Protocolos e baixa de estoque |
| Nutrição | `/suplementacao` | `src/pages/SuplementacaoPage.jsx` | globais | Card, estoque, consumo | Custo médio, saldo e consumo |
| Estoque | `/estoque` | `src/pages/EstoquePage.jsx` | globais | KPI, Table/Card, entrada/saída | RPCs transacionais e saldo |
| Financeiro | `/financeiro` | `src/pages/FinanceiroPage.jsx` | `pagamentos.css` | Tabs, KPI, lançamento modal | DRE, status, receita, custo e permissões |
| Resultados | `/resultados` | `src/pages/ResultadosPage.jsx` | `relatorios.css` | Resultado Card, filtros | Receita − custo, margem e realizado/projeção |
| Decisões | `/decisoes-fazenda` | `src/pages/DecisoesFazendaPage.jsx` | `decisoes.css`, `rebanho.css` | Recomendação, confiança, dados faltantes | GMD indisponível não vira zero |
| Agenda / Tarefas | `/tarefas` | `src/pages/TarefasPage.jsx` | `tarefas.css` | Task Card, filtros, modal | Recorrência, Telegram e responsáveis |
| Agenda / Calendário | `/calendario-operacional` | `src/pages/CalendarioOperacionalPage.jsx` | globais | Calendário, filtros | Datas e recorrência |
| Agenda / Rotinas | `/rotina` | `src/pages/RotinaPage.jsx` | globais | Rotina Card, modal | Recorrência e permissões |
| Indicadores | `/indicadores` | `src/pages/IndicadoresPage.jsx` | globais | KPI, tabelas, filtros | Regras financeiras oficiais e status |
| Relatórios | `/relatorios` | `src/pages/RelatoriosPage.jsx` | globais | Cards, filtros, exportação | Conteúdo e formatos de relatório |
| Relatório de lote | `/relatorio-lote` | `src/pages/RelatorioLotePage.jsx` | globais | Preview, exportação | Dados do lote sem nova fórmula |
| Relatório de pesagens | `/relatorio-pesagens` | `src/pages/RelatorioPesagensPage.jsx` | globais | Histórico, exportação | Pesagens e GMD oficiais |
| Relatório financeiro | `/relatorio-financeiro` | `src/pages/RelatorioFinanceiroPage.jsx` | globais | DRE, fluxo, exportação | Status e regras financeiras |
| Fazendas | `/fazendas` | `src/pages/FazendasPage.jsx` | globais | Fazenda Card, formulário | Conta, fazenda e escopo de acesso |
| Funcionários | `/funcionarios` | `src/pages/FuncionariosPage.jsx` | globais | Table/Card, formulário | Funcionário operacional sem login |
| Equipe e Acessos | `/equipe-acessos` | `src/pages/EquipePage.jsx` | `equipe.css` | Membros, convites, perfil | Convite vincula fazenda/perfil; sem autoelevação |
| Importação | `/importacao` | `src/pages/ImportacaoPage.jsx` | globais | Upload, revisão, confirmação | Validação, duplicidade e fazenda |
| Perfil | `/perfil` | `src/pages/PerfilPage.jsx` | `perfil.css` | Perfil, preferências, avatar | Conta, senha, tema e fazenda padrão |
| Configurações | `/configuracoes` | `src/pages/ConfiguracoesPage.jsx` | `configuracoes.css` | Tabs, Telegram, backup, perigo | Exportar/importar, apagar e integração |
| Assinatura | `/minha-assinatura` | `src/pages/MinhaAssinaturaPage.jsx` | `subscription.css`, `planoUso.css` | Plano, uso, checkout | Limites, status e faturamento |
| Sincronização | `/sincronizacao` | `src/pages/SincronizacaoPage.jsx` | globais | Status, fila, retry | Pendente, erro, sincronizado e sessão |
| Guia do Criador | `/guia-criador` | `src/pages/GuiaCriadorPage.jsx` | globais | Busca, artigos, empty | Busca e conteúdo oficial |

Rotas preservadas adicionais: `/fluxo-caixa`, `/custos`, `/custos-compartilhados`, `/comparativo`, `/evolucao-rebanho`, `/cenarios`, `/relatorios-gerenciais`, `/relatorio-pastagens`, `/relatorio-resumo-geral`, `/planejamento`, `/termos-de-uso`, `/politica-de-privacidade`, `/politica-de-cobranca`, `/suporte`. Aliases legados preservados: `/acompanhamento-peso` e `/dashboard-premium`.
