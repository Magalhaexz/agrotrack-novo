# Sprint — Reorganização Estratégica da Sidebar do HERDON

Continuação a partir de `4ed4321` (commit que unificou Acompanhamento de Peso em Pesagens). Sprint de arquitetura de navegação e UX — nenhuma regra de negócio de módulo foi alterada.

## Problema anterior

A sidebar tinha 7 grupos / 33 itens, organizados mais pela ordem em que os módulos foram construídos do que pelo fluxo real de trabalho do produtor. Problemas concretos:

1. "Pesagens" e "Acompanhamento de Peso" apareciam como páginas separadas do mesmo fluxo (já corrigido na sprint anterior, `4ed4321`).
2. "Estoque" era um grupo com um único item ("Produtos e Insumos").
3. "Perfil", "Configurações", "Planos e Assinatura" e "Sincronização" ficavam misturados com itens operacionais de gestão (Fazendas, Equipe, Importação).
4. `RelatoriosGerenciaisPage` (Painel Gerencial) duplicava quase literalmente `DashboardPremiumPage` — que já tinha sido tirada do menu no Sprint 18 pelo mesmo motivo, sem que o Painel Gerencial recebesse o mesmo tratamento.
5. "Relatórios Financeiros" tinha entrada própria na sidebar E já era um card de acesso dentro do hub "Relatórios" — dois caminhos para o mesmo relatório.
6. Itens de rotina (Tarefas, Calendário, Rotinas da Equipe) e itens de análise (Comparativo de Lotes, Evolução do Rebanho) ficavam misturados dentro de "Campo e Rebanho", ao lado de pesagem/sanidade/estoque — sem separar "operar" de "organizar a rotina" e de "analisar".

## Estrutura antiga (7 grupos, 33 itens)

```
Painel: Painel Geral, Central de Alertas
Campo e Rebanho: Lotes e Rebanho, Pesagens, Pastos, Nutrição e Suplementação,
  Sanidade, Tarefas, Rotinas da Equipe, Animais, Calendário,
  Comparativo de Lotes, Evolução do Rebanho
Estoque: Produtos e Insumos
Finanças: Visão Financeira, Custos por Lote, Fluxo de Caixa,
  Rateio de Custos, Relatórios Financeiros
Decisão: Simulador de Decisão, Resultado dos Lotes, Decisões da Fazenda,
  Indicadores, Relatórios, Painel Gerencial
Gestão: Fazendas, Equipe e Acessos, Importação, Planos e Assinatura,
  Configurações, Sincronização, Perfil
Ajuda: Guia do Criador
```

## Estrutura nova (7 grupos, 31 itens)

```
Início: Painel Geral, Central de Alertas
Rebanho e Campo: Pastos, Lotes e Rebanho, Animais, Pesagens,
  Nutrição e Suplementação, Sanidade, Produtos e Insumos
Rotina: Tarefas, Calendário, Rotinas da Equipe
Finanças: Visão Financeira, Fluxo de Caixa, Custos por Lote, Rateio de Custos
Análises e Decisão: Resultado dos Lotes, Comparativo de Lotes,
  Evolução do Rebanho, Indicadores, Simulador de Decisão,
  Decisões da Fazenda, Relatórios
Gestão: Fazendas, Equipe e Acessos, Importação
Conta e Sistema: Perfil, Configurações, Planos e Assinatura,
  Sincronização, Guia do Criador
```

Detalhe completo (pageId, permissão, observações) em [HERDON_MAPA_NAVEGACAO.md](HERDON_MAPA_NAVEGACAO.md).

## Critérios usados

- Grupos seguem o fluxo: ver o que está acontecendo → operar a fazenda e o rebanho → organizar a rotina → controlar custos → analisar e decidir → administrar a conta.
- Nenhum grupo com 1 item só (eliminou "Estoque" isolado e "Ajuda" isolado).
- Item redundante em outra página só sai da sidebar depois de comparar conteúdo/código, não só pelo nome parecer duplicado — `RelatoriosGerenciaisPage` foi comparada linha a linha com `DashboardPremiumPage` (mesmos helpers `formatNumber`/`formatCurrency`/`formatPercent`, mesmas chamadas a `computeIndicadoresEstrategicos`/`calcularProjecaoCenario`) antes de decidir tirá-la do menu. `DecisoesFazendaPage`, por outro lado, foi **mantida** depois da mesma comparação — agrupa por categoria (GMD/estoque/sanidade), tem ranking de saúde de lote (`SaudeLoteCard`) e o assistente HERDON embutido, conteúdo que não existe em `AlertasPage`.
- Item que já tem um card de acesso claro em um hub existente (Relatórios) não precisa de entrada própria na sidebar — só duplica o caminho.
- Item deprioritizado (não usado no dia a dia operacional) vai para o último grupo da sidebar ("Conta e Sistema"), não é escondido atrás de outra página, **exceto** quando isso reduziria acesso de algum papel que já o tem hoje (ver decisão sobre Sincronização abaixo).
- Nenhuma rota é removida — só a entrada no menu. Toda página que saiu da sidebar continua com `pageMap`/`pageRouteMap` intactos.

## Itens movidos (mesma página, grupo diferente)

| Item | Grupo antigo | Grupo novo |
|---|---|---|
| Produtos e Insumos | Estoque (isolado) | Rebanho e Campo |
| Tarefas, Calendário, Rotinas da Equipe | Campo e Rebanho | Rotina (novo grupo) |
| Comparativo de Lotes, Evolução do Rebanho | Campo e Rebanho | Análises e Decisão |
| Perfil, Configurações, Planos e Assinatura, Sincronização | Gestão | Conta e Sistema (novo grupo) |
| Guia do Criador | Ajuda (isolado) | Conta e Sistema |

## Itens retirados da sidebar (rota mantida)

| Item | Motivo | Rota |
|---|---|---|
| Relatórios Financeiros (`relatorioFinanceiro`) | Já é um card dentro do hub "Relatórios" (`RelatoriosPage.jsx`) | `/relatorio-financeiro` continua funcionando |
| Painel Gerencial (`relatoriosGerenciais`) | Duplica `DashboardPremiumPage` (evidência de código, não só suposição) — mesmo padrão já aplicado a `DashboardPremiumPage` no Sprint 18 | `/relatorios-gerenciais` continua funcionando |

Nenhuma página foi apagada — só a entrada de menu.

## Aliases de rota criados

`src/navigation/routes.js` ganhou `legacyRouteAliases`:

```js
export const legacyRouteAliases = {
  '/acompanhamento-peso': 'pesagens',
};
```

`getPageFromPathname` agora checa `pageRouteMap` primeiro, depois `legacyRouteAliases`, só então cai em `'dashboard'` — uma rota antiga conhecida nunca mais cai silenciosamente no Dashboard. `App.jsx` normaliza a URL com `history.replaceState` (nunca `pushState`) ao detectar um alias, e define o mesmo `navigationIntent` do atalho "Nova pesagem" do Dashboard — abrindo Pesagens já na aba de cadastro. `replaceState` garante que a rota antiga não fica empilhada no histórico: o botão Voltar não reabre `/acompanhamento-peso` nem entra em loop.

`relatorioFinanceiro`, `relatoriosGerenciais` e `sincronizacao` não precisaram de alias — a rota original nunca mudou de path, só saiu do menu.

## Decisão de produto: Sincronização não foi só para dentro de Configurações

O pedido original sugeria colocar "Sincronização" só como uma seção dentro de "Configurações". Auditoria de permissões (`src/auth/perfis.js`) mostrou que isso seria uma regressão: `configuracoes` exige `configuracoes:ver`, permissão que o papel Visualizador **não tem** — mas Visualizador tem `dashboard:ver`, que é a permissão de `sincronizacao` hoje. Se Sincronização virasse só um link dentro de Configurações, Visualizador perderia acesso a algo que já tinha. Decisão: "Sincronização" continua como item de sidebar (agora no rodapé "Conta e Sistema", não mais misturado com Gestão), e `ConfiguracoesPage.jsx` ganhou um atalho "Abrir sincronização" na aba "Dados e Segurança" para quem chega por ali — sem tirar o acesso de ninguém.

## Duplicações eliminadas

- Grupo "Estoque" com 1 item → absorvido em "Rebanho e Campo".
- Grupo "Ajuda" com 1 item → absorvido em "Conta e Sistema".
- "Relatórios Financeiros" na sidebar + card no hub "Relatórios" → só o card do hub.
- "Painel Gerencial" na sidebar duplicando `DashboardPremiumPage` (já fora do menu) → mesmo tratamento aplicado aos dois.

Não eliminadas (avaliadas e mantidas, com evidência): `DecisoesFazendaPage` (conteúdo exclusivo, ver "Critérios usados"); `Indicadores` (página própria, distinta de Painel Gerencial/Dashboard Premium apesar do nome parecido — não comparada linha a linha nesta sprint por falta de tempo, fica como pendência real abaixo).

## Comportamento desktop

Validado em `localhost:5173`, sessão autenticada (Proprietário), 1366×768:

- Sidebar expandida: 7 grupos, 31 itens, na ordem exata de `navConfig.js`, confirmado via DOM (`.sidebar-item-label`) e via título de seção (`.sidebar-section-title`).
- Sem overflow horizontal (`scrollWidth === clientWidth === 1366`).
- Sem erros no console.
- Navegação por clique funciona (`Pesagens` → URL `/pesagens`).
- Sidebar recolhida: item ativo continua destacado (`.sidebar-item.active`), sem overflow. Tooltip nos ícones já existia (`title={item.label}` em `Sidebar.jsx`, não precisou de mudança).
- Rota antiga `/acompanhamento-peso` acessada direto na barra de endereço: URL normaliza para `/pesagens` (confirmado via `window.location.pathname`), aba "Nova pesagem" abre automaticamente, sem cair no Dashboard.

## Comportamento mobile

Validado em 375×812, mesma sessão:

- Sem overflow horizontal.
- Drawer (ícone de menu no topo, mesmo componente `Sidebar.jsx` do desktop): 31 itens, mesma ordem, mesmos 7 grupos, sem "Acompanhamento de Peso" — confirmado via DOM. Rolável (`scrollHeight > clientHeight`). Tocar um item fecha o drawer e navega.
- Modal "Mais" da barra inferior (`App.jsx::mobileNavGroups`, segunda superfície mobile encontrada na auditoria — **derivada da mesma `navSections`**, não uma lista hardcoded separada): 31 opções, 7 grupos com os títulos exatos da sidebar, sem "Acompanhamento de Peso". Confirma que os dois caminhos mobile (drawer do hambúrguer e modal "Mais") são consistentes entre si e com o desktop por construção, não por sincronização manual.
- Barra inferior fixa (`MobileBottomNav`, agora com os dados extraídos para `src/components/mobileBottomNavItems.js` para ser testável fora de React): Início/Rebanho/Financeiro/Estoque/Mais — 5 itens, curta, sem mudança de conteúdo (fora do escopo desta sprint, já estava correta).

Validado apenas com a sessão Proprietário disponível no ambiente (mesma limitação de sprints anteriores — sem contas de gerente/operador/visualizador para login real). Comportamento por papel foi validado por teste automatizado (`perfilTemPermissao`), não por sessão ao vivo — ver "Pendências reais".

## Testes

`src/navigation/navConfig.test.js` (novo, 16 testes) + `src/navigation/routes.test.js` (3 testes novos, arquivo já existia):

- Nenhum pageId duplicado; nenhum item em mais de um grupo; nenhum grupo vazio; nenhum grupo com 1 item.
- "Pesagens" presente, "Acompanhamento de Peso" ausente (id e label).
- "Produtos e Insumos" fora do grupo isolado "Estoque".
- Hub "Relatórios" presente; os 5 relatórios específicos (`relatorioLote`, `relatorioPesagens`, `relatorioFinanceiro`, `relatorioPastagens`, `relatorioResumoGeral`) com rota registrada.
- "Relatórios Financeiros"/"Painel Gerencial" fora da sidebar, rota preservada.
- Toda página da sidebar tem rota registrada (nenhum item leva a rota inexistente).
- `getNavLabel`/`navLabelMap` consistentes.
- Permissões por papel: proprietário vê itens administrativos; gerente/operador/visualizador não recebem Equipe/Importação/Assinatura; "Planos e Assinatura" restrito ao proprietário.
- Barra inferior mobile: curta, sem duplicado, sem `acompanhamentoPeso`, pageIds válidos.
- Rota antiga `/acompanhamento-peso` resolve para `pesagens`, nunca `dashboard`; aliases não colidem com rota canônica; todo alias resolve para pageId real.

1530/1530 testes no total (1510 antes desta sprint + 20 novos), lint limpo, build ok.

## Riscos

- `navSections`/`secondaryNavItems` continuam sendo a única fonte usada por `Sidebar.jsx` e por `App.jsx::mobileNavGroups` — confirmado por leitura de código, não é uma garantia estrutural (nada impede alguém de criar uma terceira lista hardcoded no futuro). Recomenda-se manter assim.
- `DecisoesFazendaPage`/`Indicadores`/`RelatoriosGerenciaisPage`/`DashboardPremiumPage` têm sobreposição de conceito (todos mostram "indicadores estratégicos" de alguma forma) que não foi resolvida nesta sprint — só reorganizada a sidebar em cima do estado atual do código.
- O teste "nenhum grupo com 1 item" é uma regra rígida (`length > 1`) sem mecanismo de exceção formal — se uma sprint futura precisar de um grupo de 1 item por razão legítima, o teste vai quebrar de propósito, forçando uma decisão explícita (comportamento desejado, não um bug).

## Pendências reais

- Validação visual só com sessão Proprietário — gerente/operador/visualizador não testados ao vivo no navegador (só via teste automatizado de permissão).
- `IndicadoresPage` não foi comparada linha a linha com `RelatoriosGerenciaisPage`/`DashboardPremiumPage` (só as duas últimas foram comparadas entre si) — pendência para uma auditoria futura decidir se há mais duplicação a consolidar.
- A sidebar não implementa "abrir só o grupo do item ativo, recolher os demais" — todos os grupos abrem por padrão, como já era o comportamento antes desta sprint. `Sidebar.jsx` já suporta recolher grupos individualmente (clique no título), então a funcionalidade existe; só o estado inicial "tudo aberto" não mudou, por ser uma decisão de comportamento de UX separada da reorganização de conteúdo pedida nesta sprint.
