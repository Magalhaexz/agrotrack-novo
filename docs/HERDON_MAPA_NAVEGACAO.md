# HERDON — Mapa de Navegação

Estrutura oficial do menu lateral (`src/navigation/navConfig.js`), `pageId`s, permissões por módulo e páginas fora do menu com justificativa. Reescrito na Sprint de Reorganização Estratégica da Sidebar (ver [SPRINT_REORGANIZACAO_SIDEBAR_HERDON.md](SPRINT_REORGANIZACAO_SIDEBAR_HERDON.md) para o detalhe da auditoria e dos critérios usados). Substitui a versão anterior (Sprint 18).

Fonte de verdade: `navSections` em `src/navigation/navConfig.js` (o que aparece no menu — desktop e drawer mobile, mesma fonte) + `pageMap` em `src/App.jsx` (todas as páginas roteáveis, incluindo as sem entrada de menu) + `permissoesPorPagina` em `src/auth/perfis.js` (quem pode ver cada uma) + `legacyRouteAliases` em `src/navigation/routes.js` (rotas antigas que continuam funcionando).

## Estrutura atual do menu (7 grupos, 31 itens)

Os grupos seguem o fluxo real de trabalho do produtor: ver o que está acontecendo → operar a fazenda e o rebanho → organizar a rotina → controlar custos → analisar e decidir → administrar a conta e o sistema.

### Início
| pageId | Label | Permissão |
|---|---|---|
| `dashboard` | Painel Geral | `dashboard:ver` |
| `alertas` | Central de Alertas | `dashboard:ver` |

### Rebanho e Campo
| pageId | Label | Permissão |
|---|---|---|
| `pastagens` | Pastos | `pastagens:ver` |
| `lotes` | Lotes e Rebanho | `lotes:ver` |
| `animais` | Animais | `animais:ver` |
| `pesagens` | Pesagens | `pesagens:ver` |
| `suplementacao` | Nutrição e Suplementação | `suplementacao:ver` |
| `sanitario` | Sanidade | `sanitario:ver` |
| `estoque` | Produtos e Insumos | `estoque:ver` |

`estoque` saiu do grupo isolado "Estoque" (que só tinha esse item) — nenhum grupo deve ter apenas 1 item, e Produtos e Insumos é parte do fluxo operacional de campo.

### Rotina
| pageId | Label | Permissão |
|---|---|---|
| `tarefas` | Tarefas | `tarefas:ver` |
| `calendarioOperacional` | Calendário | `sanitario:ver` |
| `rotina` | Rotinas da Equipe | `sanitario:ver` |

Grupo novo — antes esses 3 itens ficavam misturados dentro de "Campo e Rebanho", junto com pesagem/sanidade/estoque, sem separar "executar operação" de "organizar a rotina da equipe".

### Finanças
| pageId | Label | Permissão |
|---|---|---|
| `financeiro` | Visão Financeira | `financeiro:ver` |
| `fluxoCaixa` | Fluxo de Caixa | `financeiro:ver` |
| `custos` | Custos por Lote | `financeiro:ver` |
| `custosCompartilhados` | Rateio de Custos | `financeiro:ver` |

`relatorioFinanceiro` (Relatórios Financeiros) saiu deste grupo — ver seção "Páginas fora do menu".

### Análises e Decisão
| pageId | Label | Permissão |
|---|---|---|
| `resultados` | Resultado dos Lotes | `resultados:ver` |
| `comparativo` | Comparativo de Lotes | `comparativo:ver` |
| `evolucaoRebanho` | Evolução do Rebanho | `evolucao_rebanho:ver` |
| `indicadores` | Indicadores | `indicadores:ver` |
| `cenarios` | Simulador de Decisão | `cenarios:ver` |
| `decisoesFazenda` | Decisões da Fazenda | `dashboard:ver` |
| `relatorios` | Relatórios | `relatorios:ver` |

`comparativo` e `evolucaoRebanho` vieram do antigo grupo "Campo e Rebanho" para cá — são análises, não operação de campo. `relatoriosGerenciais` (Painel Gerencial) saiu deste grupo — ver seção "Páginas fora do menu". `decisoesFazenda` foi mantida (não é órfã redundante): agrupa lotes abaixo da meta, estoque crítico e sanidade próxima por categoria, com ranking de saúde de lote (`SaudeLoteCard`) e o assistente HERDON embutido — conteúdo que a Central de Alertas não replica.

### Gestão
| pageId | Label | Permissão |
|---|---|---|
| `fazendas` | Fazendas | `fazendas:ver` |
| `equipeAcessos` | Equipe e Acessos | `acessos:gerenciar` (só proprietário/admin) |
| `importacao` | Importação | `dados:importar` |

`minhaAssinatura`, `configuracoes`, `sincronizacao` e `perfil` saíram deste grupo — foram para "Conta e Sistema" (abaixo), deprioritizados visualmente da operação administrativa do dia a dia (cadastro de fazenda, equipe, importação de planilha).

### Conta e Sistema
| pageId | Label | Permissão |
|---|---|---|
| `perfil` | Perfil | `perfil:ver` |
| `configuracoes` | Configurações | `configuracoes:ver` |
| `minhaAssinatura` | Planos e Assinatura | `assinatura:gerenciar` (só proprietário/admin) |
| `sincronizacao` | Sincronização | `dashboard:ver` |
| `guiaCriador` | Guia do Criador | (sem restrição) |

Último grupo da sidebar — fica visualmente no rodapé, junto do card do usuário, sem competir com os módulos operacionais do topo. Substitui os grupos "Gestão" (parte) e "Ajuda" (que só tinha 1 item).

`sincronizacao` ficou aqui em vez de virar só uma seção dentro de Configurações (como cogitado inicialmente): a permissão de `configuracoes` (`configuracoes:ver`) não cobre o papel Visualizador, que hoje acessa Sincronização por ter `dashboard:ver` — escondê-la só dentro de Configurações tiraria esse acesso de quem já tem. `ConfiguracoesPage` (aba "Dados e Segurança") ganhou um atalho "Abrir sincronização" para quem chega por ali, sem remover o item da sidebar.

## Permissões por papel (resumo)

- **Proprietário/Admin**: `*` — acesso total, único papel que gerencia Equipe e Assinatura.
- **Gerente**: quase tudo exceto `acessos:gerenciar`/`assinatura:gerenciar` (Sprint 6 — "apenas proprietário/admin gerencia equipe e plano").
- **Operador**: módulos operacionais (lotes, animais, pesagens, sanidade, estoque, tarefas) + visão/decisão (resultados, cenários, indicadores) — **sem** `financeiro:ver`, então `financeiro`/`custos`/`fluxoCaixa`/`custosCompartilhados` ficam ocultos para esse papel mesmo estando no menu.
- **Visualizador**: só leitura (`:ver`) em quase tudo, sem nenhuma permissão de edição/exclusão nem gestão de equipe.

Ver `src/auth/perfis.js` para a matriz completa (`permissoesPorPerfil`). A reorganização desta sprint só reagrupou itens dentro de `navConfig.js` — não tocou em `perfis.js`, então o resultado de quem vê o quê é idêntico a antes (ver testes em `src/navigation/navConfig.test.js`).

## Páginas fora do menu (com justificativa)

| pageId | Página | Por que fica fora | Como acessar |
|---|---|---|---|
| `acompanhamentoPeso` | ~~AcompanhamentoPesoPage~~ | Página apagada — unificada em `pesagens` (aba Nova pesagem/Evolução cobrem tudo que ela fazia). | Rota antiga `/acompanhamento-peso` redireciona automaticamente para `/pesagens` (`legacyRouteAliases`). |
| `relatorioFinanceiro` | RelatorioFinanceiroPage | Já é um card de acesso claro dentro do hub "Relatórios" — ter entrada própria na sidebar E no hub duplicava o caminho para o mesmo relatório. | Rota `/relatorio-financeiro` continua funcionando; card "Relatório Financeiro" em `RelatoriosPage.jsx`. |
| `relatoriosGerenciais` | RelatoriosGerenciaisPage (Painel Gerencial) | Auditoria de código mostrou que duplica quase literalmente `DashboardPremiumPage.jsx` (mesmos helpers de formatação, mesmo `computeIndicadoresEstrategicos`/`calcularProjecaoCenario`) — e `DashboardPremiumPage` já tinha sido excluída da sidebar no Sprint 18 pelo mesmo motivo. | Rota `/relatorios-gerenciais` continua funcionando; sem link de menu (mesmo tratamento de `dashboardPremium`). |
| `funcionarios` | FuncionariosPage | Duplicata intencional de `equipeAcessos` — ponto de entrada único é `equipeAcessos` desde a Sprint 6/13. | Página mantida no `pageMap`, sem link de menu. |
| `dashboardPremium` | DashboardPremiumPage | Rollup de KPIs que hoje já aparecem em outros lugares (Dashboard principal, Painel Gerencial) — achado da Sprint 18. | Sem rota de menu; código mantido. |
| `planejamento` | PlanejamentoPage | Embrulha em abas: Pastagens, Evolução do Rebanho, Indicadores, Cenários, Relatórios Gerenciais — a maioria já tem entrada própria no menu. | Sem rota de menu; código mantido. |
| `relatorioLote`, `relatorioPesagens`, `relatorioPastagens`, `relatorioResumoGeral` | Páginas de relatório | Acessadas via `RelatoriosPage` (menu "Relatórios"), que lista e linka cada uma. | Cards em `RelatoriosPage.jsx`. |
| `termos`, `privacidade`, `cobranca`, `suporte` | Páginas legais/institucionais | Rotas fixas (`src/navigation/routes.js`), acessadas por link direto (rodapé, onboarding). | Link direto. |
| `assinaturaBloqueada` | AssinaturaBloqueadaPage | Tela de estado (bloqueio de conta), não é destino de navegação. | Renderizada condicionalmente pelo gate de assinatura. |

## Rotas antigas (`legacyRouteAliases`)

Rotas de páginas que saíram da sidebar ou foram unificadas em outra, mas que **precisam continuar abrindo algo** (favoritos, links salvos, histórico do navegador) em vez de cair no Dashboard sem explicação.

| Rota antiga | Resolve para | Comportamento |
|---|---|---|
| `/acompanhamento-peso` | `pesagens` | `App.jsx` normaliza a URL para `/pesagens` com `history.replaceState` (não empilha no histórico — Voltar não reabre o alias) e abre a aba "Nova pesagem" (mesmo `navigationIntent` do atalho "Nova pesagem" do Dashboard). |

`relatorioFinanceiro`, `relatoriosGerenciais` e `sincronizacao` **não** precisaram de alias: suas rotas continuam em `pageRouteMap` normalmente (só saíram do menu, a página em si nunca foi removida nem renomeada).

## Barra inferior mobile (`MobileBottomNav`)

Independente de `navSections` — lista fixa e curta, não afetada por mudanças no menu principal (itens em `src/components/mobileBottomNavItems.js`):

1. Início (`dashboard`)
2. Rebanho (`lotes`)
3. Financeiro (`financeiro`)
4. Estoque (`estoque`)
5. Mais → abre um modal com todos os `navSections` (`App.jsx::mobileNavGroups`), mesma fonte e mesmo filtro de permissão do drawer/sidebar desktop

O menu hambúrguer do topo (ícone "Abrir menu") abre um segundo caminho para o mesmo conteúdo: o drawer do próprio `Sidebar.jsx` (evento `agrotrack-open-drawer`), que já é o componente reaproveitado no desktop — não é uma cópia separada.

## Recomendações futuras

- `Relatórios` (grupo Análises e Decisão) e `Painel Gerencial` (fora do menu) têm nomes parecidos o suficiente para confundir um usuário novo que ache a rota antiga — considerar renomear em conjunto com uma sprint de revisão de copy.
- `DashboardPremiumPage`/`PlanejamentoPage`/`RelatoriosGerenciaisPage`/`FuncionariosPage` seguem como código funcional sem link de menu — avaliar em uma sprint futura se algum deles deve ser formalmente removido (não decidido aqui: risco de link/import externo não mapeado).
- A sidebar hoje abre todos os grupos por padrão (nenhum accordion "só o grupo ativo aberto") — o componente já suporta recolher grupos individualmente, mas mudar o comportamento padrão é uma decisão de UX própria, fora do escopo desta sprint (que era reorganizar o conteúdo, não o comportamento de expand/collapse).
