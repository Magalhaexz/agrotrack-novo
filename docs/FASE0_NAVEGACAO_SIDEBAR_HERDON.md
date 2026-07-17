# Fase 0 — Diagnóstico de Navegação, Rotas, Sidebar e Subabas — HERDON

> Sprint complementar à `docs/AUDITORIA_COMPLETA_HERDON.md`, focada exclusivamente em navegação. Data: 2026-07-05.
> **Nenhum código foi alterado.** Este documento é só diagnóstico, para aprovação antes de qualquer reorganização da sidebar.
> Método: leitura direta de `src/App.jsx`, `src/navigation/navConfig.js`, `src/navigation/routes.js`, `src/auth/perfis.js`, `src/components/Sidebar.jsx`, `src/components/MobileBottomNav.jsx`, `src/components/AppHeader.jsx` e grep de todo `src/` por chamadas de navegação (`onNavigate('...')`) para confirmar quais páginas têm ponto de entrada real na UI.

---

## 1. Como a navegação funciona hoje (contexto necessário antes das listas)

O HERDON **não é roteado por URL para a maioria das telas**. Existe um único estado `currentPage`/`pageKey` em `src/App.jsx` que seleciona um componente num objeto `pageMap` (linha 185). Só 5 "páginas" têm URL própria (`src/navigation/routes.js`): `dashboard` (`/`), `minhaAssinatura`, `termos`, `privacidade`, `cobranca`, `suporte`. Todas as outras ~36 telas são trocadas só por estado interno (`onNavigate('id')`), sem mudar a URL do navegador — ou seja, não há deep-link nem F5 preservando a tela em 90% dos casos.

Existem **3 camadas de navegação independentes**, não só a sidebar:
1. **Sidebar** (`Sidebar.jsx` + `navConfig.js`) — a navegação principal, por seções.
2. **Barra de abas global no cabeçalho** (`AppHeader.jsx:369-382`) — `['geral', 'estoque', 'alertas']`, fixa, aparece acima do conteúdo de página independente da sidebar (`tabAtiva`/`onTabChange`, estado em `App.jsx`). Não reorganizar a sidebar sem lembrar que essa barra existe em paralelo.
3. **Bottom nav mobile** (`MobileBottomNav.jsx`) — 4 atalhos fixos + "Mais": Início, Rebanho(`lotes`), Financeiro, Estoque, Mais.

---

## 2. Lista completa das rotas atuais (URL real)

De `src/navigation/routes.js` (`pageRouteMap`) — só isto tem URL de verdade:

| pageId | URL |
|---|---|
| `dashboard` | `/` |
| `minhaAssinatura` | `/minha-assinatura` |
| `termos` | `/termos-de-uso` |
| `privacidade` | `/politica-de-privacidade` |
| `cobranca` | `/politica-de-cobranca` |
| `suporte` | `/suporte` |

Todo o resto (36 telas) não tem URL — é só um `pageId` de estado em memória.

## 2b. Lista completa dos `pageId` (páginas de verdade renderizáveis)

De `src/App.jsx` — `pageMap` (autenticado, linha 185) + `publicPageMap` (público, linha ~100) + `LoginPage` (fallback sem sessão):

**Autenticadas (`pageMap`, 36 ids):** `dashboard`, `decisoesFazenda`, `fazendas`, `lotes`, `calendarioOperacional`, `comparativo`, `funcionarios`, `rotina`, `tarefas`, `perfil`, `minhaAssinatura`, `configuracoes`, `equipeAcessos`, `animais`, `suplementacao`, `sanitario`, `estoque`, `pesagens`, `acompanhamentoPeso`, `custos`, `fluxoCaixa`, `custosCompartilhados`, `resultados`, `financeiro`, `pastagens`, `evolucaoRebanho`, `indicadores`, `cenarios`, `dashboardPremium`, `relatoriosGerenciais`, `relatorios`, `relatorioLote`, `relatorioPesagens`, `relatorioFinanceiro`, `relatorioPastagens`, `relatorioResumoGeral`, `guiaCriador`, `planejamento`, `importacao`, `sincronizacao`, `modoCurral`.

**Públicas (`publicPageMap`, renderizadas ANTES da sidebar/shell autenticado):** `termos`, `privacidade`, `cobranca`, `suporte`.

**Sem sessão:** `LoginPage` (fallback fixo, não é um pageId).

Todo `pageId` autenticado tem uma entrada de permissão em `permissoesPorPagina` (`src/auth/perfis.js:148-193`), com 3 exceções que **não** exigem permissão: `sincronizacao` e `modoCurral` usam `dashboard:ver` (qualquer usuário logado), e `suporte`/`termos`/`privacidade`/`cobranca` não têm entrada (são públicas, fora do gate de permissão).

---

## 3. Itens e grupos atuais da sidebar (`src/navigation/navConfig.js`)

A sidebar tem **6 seções** (`navSections`), 30 itens no total (menos que os 36 `pageId` existentes — ver §6 sobre os 7 órfãos):

| Grupo (`id` / título) | Itens (`id` → rótulo) |
|---|---|
| `inicio` (sem título) | `dashboard` → Painel Geral |
| `operacao` → **Operação** | `modoCurral` → Modo Curral · `fazendas` → Fazendas · `pastagens` → Pastos · `lotes` → Lotes e Rebanho · `animais` → Animais · `pesagens` → Pesagens · `estoque` → Estoque · `suplementacao` → Suplementação · `sanitario` → Sanidade · `tarefas` → Tarefas · `calendarioOperacional` → Calendário |
| `financeiro` → **Financeiro** | `financeiro` → Movimentações Financeiras · `fluxoCaixa` → Fluxo de Caixa · `custosCompartilhados` → Rateio de Custos |
| `decisao` → **Decisão** | `decisoesFazenda` → Decisões da Fazenda · `resultados` → Resultado dos Lotes · `cenarios` → Simulador de Decisão · `indicadores` → Indicadores · `relatoriosGerenciais` → Painel Gerencial |
| `gestao` → **Gestão** | `relatorios` → Relatórios · `funcionarios` → Equipe · `minhaAssinatura` → Planos e Assinatura · `equipeAcessos` → Equipe e Acessos · `importacao` → Importação · `sincronizacao` → Sincronização · `configuracoes` → Configurações · `perfil` → Perfil |
| `ajuda` → **Ajuda** | `guiaCriador` → Guia do Criador · `suporte` → Suporte |

`secondaryNavItems` (linha 100 de `navConfig.js`) está **vazio** — não há um segundo nível de navegação usado hoje.

A sidebar filtra itens por permissão em tempo real (`Sidebar.jsx:44-47`): item só aparece se `permissoesPorPagina[item.id]` for `null`/vazio ou o usuário tiver a permissão. Isso já funciona hoje e continuará funcionando com qualquer reorganização, desde que os `id` não mudem.

**Achado:** `perfil` está listado em `navConfig.js` na seção Gestão, mas **não aparece na sidebar visual** pela rota normal — na prática o usuário chega em "Meu Perfil" pelo dropdown do avatar (`Sidebar.jsx:272-284`, chama `onNavigate('perfil')` direto), não pela lista de itens da seção Gestão. Ter `perfil` duplicado em `navConfig.js` e no dropdown não causa bug, mas é redundância a observar.

---

## 4. Subabas existentes por tela

Telas com abas internas (estado local `useState`, não são `pageId` diferentes):

| Tela | Estado | Abas |
|---|---|---|
| `LotesPage` (Lotes e Rebanho) | `activeTab` | `visao_geral` (Visão Geral) · `animais` · `pesagens` · `financeiro` · `sanitario` · `nutricao` · `pastagens` · `historico` · `retiradas` — 9 abas, componentes em `src/components/lotes/Lote*Tab.jsx` |
| `FinanceiroPage` (Movimentações Financeiras) | `tab` | `dre` (DRE) · `lote` (Por Lote) · `lanc` (Lançamentos) · `pag` (**Pagamentos Diários** — já existe hoje) |
| `ConfiguracoesPage` | `tab` | `geral` (Geral) · `notificacoes` (Notificações) · `dados` (Dados e Segurança) |
| `AnimaisPage` | `abaAtiva` | `grupos` · `individuais` · `movimentacoes` |
| `AcompanhamentoPesoPage` | `abaAtiva` | `pesagem_lote` · `historico_lote` |
| `PesagensPage` | `abaAtiva` | `nova` · `historico` · `evolucao` · `alertas` |
| `SuplementacaoPage` | `aba` | `produtos` · `consumo` · `dietas` · `planejamento` · `historico` |
| `ImportacaoPage` | `abaAtiva` | `fazendas` (+ outras abas de entidade, não totalmente mapeadas nesta varredura) |
| `PlanejamentoPage` | `aba` | `visaoGeral` (+ outras, não mapeadas) |

**Achado relevante para a proposta:** `FinanceiroPage` **já tem** uma aba "Pagamentos Diários" (`tab='pag'`) e uma aba "DRE" (`tab='dre'`). A nova organização proposta (§8) pede "Pagamentos", "Recebimentos" e "DRE" como itens de sidebar separados — isso não é uma feature nova, é elevar abas que já existem dentro de `FinanceiroPage` para navegação de primeiro nível (ou linkar direto nelas via `navigationIntent`, mecanismo que já existe no app — ver `src/App.jsx` `navigateWithPermission`).

---

## 5. Componentes responsáveis por navegação/layout

| Componente | Responsabilidade |
|---|---|
| `src/navigation/navConfig.js` | Fonte única da estrutura da sidebar (`navSections`) e do rótulo de cada `pageId` (`getNavLabel`) |
| `src/navigation/routes.js` | Mapeamento `pageId` ↔ URL real (só 6 páginas) |
| `src/components/Sidebar.jsx` | Renderiza `navSections`, filtra por permissão, controla colapso desktop/drawer mobile, dropdown do usuário (Meu Perfil/Configurações/Sair) |
| `src/components/MobileBottomNav.jsx` | Bottom nav fixo mobile (Início/Rebanho/Financeiro/Estoque/Mais) |
| `src/components/AppHeader.jsx` | Cabeçalho: seletor de fazenda, **barra de abas globais** (`geral`/`estoque`/`alertas`, linha 369-382), indicador de conexão/sincronização |
| `src/components/RotaProtegida.jsx` | Gate de permissão/plano por página (bloqueia render se faltar permissão ou módulo do plano) |
| `src/auth/perfis.js` (`permissoesPorPagina`) | Mapa `pageId` → permissão exigida — é o que a Sidebar consulta para decidir o que mostrar |
| `src/App.jsx` (`pageMap`, `publicPageMap`) | Registro de qual componente React cada `pageId` renderiza |
| Não existe breadcrumb | Não há componente de breadcrumb no projeto — a única indicação de "onde estou" é o item ativo destacado na sidebar (`aria-current`) e o título no `mobile-topbar-caption` (`getNavLabel(currentPage)`) |

---

## 6. Onde está o item "Suporte" (para ocultar depois)

- **Sidebar:** `src/navigation/navConfig.js`, seção `ajuda`, item `{ id: 'suporte', label: 'Suporte', icon: LifeBuoy }` (linha 95).
- **Renderização:** `suporte` está em `publicPageMap` (`src/App.jsx`, linha ~103) — **não** está em `pageMap`. Isso significa que clicar em "Suporte" na sidebar (que chama `onNavigate('suporte')`) faz o app cair no bloco `if (Object.prototype.hasOwnProperty.call(publicPageMap, currentPage))` (linha 936) **antes** de chegar no shell autenticado com Sidebar — ou seja, **a página de Suporte hoje já é renderizada fora da sidebar/header**, como uma página pública "solta". Não há botão de "voltar ao app" garantido dentro dela nesta varredura.
- **Conclusão prática:** remover `suporte` de `navConfig.js` no futuro é uma mudança **segura e isolada** — a rota `/suporte` e a renderização via `publicPageMap` continuam funcionando por acesso direto de URL, exatamente como pedido ("a rota não deve ser apagada"). Não há nenhum outro lugar do código que dependa do item estar na sidebar.

---

## 7. Onde estão as rotas relacionadas às áreas pedidas

| Área pedida | `pageId` / arquivo(s) |
|---|---|
| **Rebanho** | `lotes` → `LotesPage.jsx` (+ subaba `animais` dentro dele) · `animais` → `AnimaisPage.jsx` (página separada, própria) · `evolucaoRebanho` → `EvolucaoRebanhoPage.jsx` (**órfã**, ver §8) |
| **Pesagens** | `pesagens` → `PesagensPage.jsx` · `acompanhamentoPeso` → `AcompanhamentoPesoPage.jsx` (**órfã**, ver §8) |
| **Pastagens** | `pastagens` → `PastagensPage.jsx` |
| **Nutrição** | `suplementacao` → `SuplementacaoPage.jsx` (rótulo na sidebar hoje é "Suplementação", não "Nutrição") |
| **Sanidade** | `sanitario` → `SanitarioPage.jsx` |
| **Estoque** | `estoque` → `EstoquePage.jsx` (página única, sem subabas separadas de "Movimentações"/"Estoque crítico"/"Consumo diário" hoje) |
| **Financeiro** | `financeiro` → `FinanceiroPage.jsx` (abas `dre`/`lote`/`lanc`/`pag`) · `fluxoCaixa` → `FluxoCaixaPage.jsx` · `custos` → `CustosPage.jsx` (**órfã**, ver §8) |
| **Rateio** | `custosCompartilhados` → `CustosCompartilhadosPage.jsx` (já existe na sidebar hoje, rótulo "Rateio de Custos") |
| **DRE** | Não é `pageId` próprio — é a aba `dre` dentro de `FinanceiroPage.jsx` |
| **Simulador** | `cenarios` → `CenariosPage.jsx` |
| **Decisões** | `decisoesFazenda` → `DecisoesFazendaPage.jsx` |
| **Relatórios** | `relatorios` → `RelatoriosPage.jsx` (hub) → drill-down para `relatorioLote`/`relatorioPesagens`/`relatorioFinanceiro`/`relatorioPastagens`/`relatorioResumoGeral` · `relatoriosGerenciais` → `RelatoriosGerenciaisPage.jsx` (página separada, hoje em Decisão) |
| **Gestão** | `fazendas` (hoje em Operação, não em Gestão) · `funcionarios` → `FuncionariosPage.jsx` · `equipeAcessos` → `EquipePage.jsx` · `importacao` → `ImportacaoPage.jsx` · `minhaAssinatura` → `MinhaAssinaturaPage.jsx` · `configuracoes` → `ConfiguracoesPage.jsx` · `sincronizacao` → `SincronizacaoPage.jsx` |
| **Ajuda** | `guiaCriador` → `GuiaCriadorPage.jsx` · `suporte` → `SuportePage.jsx` (ver §6) |

---

## 8. Achados a resolver ANTES de reorganizar a sidebar

### 8.1 Sete páginas sem ponto de entrada visível (não estão na sidebar nem foram encontradas em `onNavigate('id')` em nenhum `.jsx`)

| `pageId` | Componente | O que é |
|---|---|---|
| `comparativo` | `ComparativoPage.jsx` | Comparação entre lotes (tem CSS e componente dedicados: `src/styles/comparativo.css`, `src/components/comparativo/TabelaComparativa.jsx`) |
| `rotina` | `RotinaPage.jsx` | Rotinas/tarefas recorrentes |
| `acompanhamentoPeso` | `AcompanhamentoPesoPage.jsx` | Acompanhamento de peso (parece sobrepor com a aba "evolução" de `PesagensPage`) |
| `custos` | `CustosPage.jsx` | Página de custos separada de `FinanceiroPage`/`CustosCompartilhadosPage` |
| `evolucaoRebanho` | `EvolucaoRebanhoPage.jsx` | Evolução do rebanho ao longo do tempo |
| `dashboardPremium` | `DashboardPremiumPage.jsx` | Dashboard alternativo para plano premium |
| `planejamento` | `PlanejamentoPage.jsx` | Planejamento (aba `visaoGeral` + outras) |

Todos os 7 têm entrada em `permissoesPorPagina` e estão registrados em `pageMap`, e a maioria também aparece na lista de módulos por plano (`src/services/subscriptions.js`) — ou seja, **não parecem código morto por engano**, parecem telas construídas e nunca conectadas a um link visível, ou conectadas por um mecanismo que esta varredura não alcançou (ex.: link dentro de um card/`ResultadoLoteCard`/`KpiCard` com `pageId` calculado dinamicamente, não capturado pelo grep literal usado). **Antes de reorganizar a sidebar, vale confirmar manualmente no app (clicando) se alguma dessas 7 é acessível por algum botão "Ver mais"/"Comparar"/card clicável** — se nenhuma for, são 7 candidatas a "não incluir na nova sidebar de propósito" ou a remover em sprint futura (decisão de produto, fora do escopo desta Fase 0).

### 8.2 Duplicação aparente: "Equipe" existe como duas páginas diferentes

- `funcionarios` (rótulo "Equipe") → `FuncionariosPage.jsx`
- `equipeAcessos` (rótulo "Equipe e Acessos") → `EquipePage.jsx`

A proposta de nova sidebar (§9) pede um único item "Equipe" em Gestão. Hoje são **duas páginas com componentes diferentes** — reorganizar a sidebar sem decidir qual sobrevive (ou como as duas se relacionam) só move a confusão de lugar, não resolve.

### 8.3 Barra de abas global do cabeçalho não faz parte da sidebar

`AppHeader.jsx` renderiza `['geral', 'estoque', 'alertas']` como abas fixas no topo, independentes da sidebar e sempre visíveis. A proposta de nova sidebar inclui "Alertas" como item do grupo Painel — hoje "Alertas" já existe, mas como **aba do cabeçalho**, não como página de sidebar. Decidir se a nova "Alertas" da sidebar substitui essa aba do cabeçalho, convive com ela, ou aponta para o mesmo lugar evita ter duas navegações concorrentes para a mesma informação.

### 8.4 Itens do proposto sem página/local correspondente hoje

| Item da proposta (§9) | Existe hoje? |
|---|---|
| Alertas (grupo Painel) | Não como página — só como aba do cabeçalho (§8.3) e dentro de `DecisoesFazendaPage` |
| Assistente HERDON | É um **modal** (`src/components/assistente/`), não uma página — clicar num item de sidebar que abre modal é um padrão de interação diferente dos outros itens (que trocam de tela) |
| Movimentações / Estoque crítico / Consumo diário (grupo Estoque) | Não existem como views separadas — `EstoquePage.jsx` é uma página única hoje, sem essas subabas |
| Recebimentos / Despesas (grupo Finanças) | Não existem separados de "Lançamentos" (`tab='lanc'` já mistura receita e despesa com filtro por tipo) |
| Integrações (grupo Gestão) | Não existe nenhuma página, aba ou conceito de "Integrações" no código hoje — seria item novo, não reorganização |

### 8.5 Itens da sidebar atual que a proposta não menciona (não pode "sumir" sem decisão)

- `calendarioOperacional` (Calendário) — hoje em Operação; a proposta não lista onde entra em "Campo e Rebanho"
- `sincronizacao` (Sincronização) — hoje em Gestão; não mencionado na proposta
- `relatoriosGerenciais` (Painel Gerencial) — hoje em Decisão, separado de "Relatórios"; a proposta só lista "Relatórios" uma vez em Decisão
- `perfil` — não está em nenhuma seção da proposta (hoje já é acessado só pelo avatar, então isso é esperado, mas vale confirmar)

---

## 9. Proposta de nova organização da sidebar (apresentada para aprovação — **não implementada**)

Estrutura pedida, anotada com o `pageId`/situação real de cada item:

**Painel**
- Painel Geral → `dashboard` ✅ existe
- Alertas → ⚠️ não existe como página; hoje é aba do cabeçalho + conteúdo de `decisoesFazenda` (§8.3)
- Assistente HERDON (se mantido) → ⚠️ é modal, não página (§8.4)

**Campo e Rebanho**
- Lotes/Rebanho → `lotes` ✅
- Pesagens → `pesagens` ✅ (+ `acompanhamentoPeso` órfã, considerar unificar)
- Modo Curral → `modoCurral` ✅
- Pastagens → `pastagens` ✅
- Nutrição/Suplementação → `suplementacao` ✅ (renomear rótulo)
- Sanidade → `sanitario` ✅
- Tarefas → `tarefas` ✅
- *(não pedido explicitamente, mas hoje existe e precisa de destino: `calendarioOperacional`, `rotina`, `animais`, `evolucaoRebanho`)*

**Estoque**
- Produtos/Insumos → `estoque` ✅ (renomear rótulo)
- Movimentações → ⚠️ não existe separado (§8.4)
- Estoque crítico → ⚠️ não existe separado (§8.4)
- Consumo diário → ⚠️ não existe separado; mais próximo é a aba `consumo` de `SuplementacaoPage` (área diferente)

**Finanças**
- Resumo → mapear para `financeiro` (aba `dre` ou visão geral nova)
- Pagamentos → aba `pag` de `FinanceiroPage` já existe (§4) — elevar para link direto
- Recebimentos → ⚠️ não existe separado de Lançamentos (§8.4)
- Despesas → ⚠️ não existe separado de Lançamentos (§8.4)
- Rateio → `custosCompartilhados` ✅ já existe na sidebar hoje
- DRE → aba `dre` de `FinanceiroPage` já existe (§4) — elevar para link direto
- Relatórios financeiros → `relatorioFinanceiro` ✅ (hoje só via drill-down de `relatorios`)

**Decisão**
- Simulador de Decisão → `cenarios` ✅
- Resultado dos Lotes → `resultados` ✅
- Decisões da Fazenda → `decisoesFazenda` ✅
- Indicadores → `indicadores` ✅
- Relatórios → `relatorios` ✅ (hoje em Gestão, moveria para cá)

**Gestão**
- Fazendas → `fazendas` ✅ (hoje em Operação, moveria para cá)
- Equipe → ⚠️ hoje são 2 páginas (`funcionarios` + `equipeAcessos`), precisa decisão (§8.2)
- Importação → `importacao` ✅
- Planos e Assinatura → `minhaAssinatura` ✅
- Configurações → `configuracoes` ✅
- Integrações → ⚠️ não existe (§8.4)

**Ajuda**
- Guia do Criador → `guiaCriador` ✅
- (Suporte permanece como rota, oculto da sidebar em fase posterior — §6, já confirmado seguro)

---

## 10. Riscos da reorganização

1. **Mover `pageId` entre seções do `navConfig.js` é de baixíssimo risco** — a Sidebar só lê `navSections`, e `pageMap`/`permissoesPorPagina`/`routes.js` são indexados por `pageId`, não pela posição na sidebar. Reagrupar itens existentes (ex.: mover `fazendas` de Operação para Gestão) não quebra nada por si só.
2. **Risco real está nos itens que não existem ainda** (§8.4: Alertas, Estoque crítico, Movimentações, Consumo diário, Recebimentos, Despesas, Integrações, Assistente como item de sidebar) — criar esses itens exige decidir, para cada um: nova página, nova aba dentro de página existente, ou link direto (`navigationIntent`) para uma aba que já existe. Isso é implementação, não reorganização, e deve ser decidido item a item antes da Fase 1 de execução.
3. **As 7 páginas órfãs (§8.1)** podem gerar links quebrados de percepção se a nova sidebar assumir que "toda página tem um dono" — recomendo confirmar manualmente (clicando no app) antes de decidir incluí-las ou não na nova estrutura.
4. **Duplicação Equipe/Equipe e Acessos (§8.2)** precisa resolução de produto antes de virar um único item "Equipe" — do contrário a reorganização visual esconde, mas não resolve, a duplicação.
5. **Barra de abas do cabeçalho (§8.3)** é uma segunda navegação paralela à sidebar — mudar só a sidebar sem revisar essa barra pode deixar "Alertas" em dois lugares com comportamentos diferentes.
6. **Nenhuma URL será afetada** pela reorganização da sidebar em si, porque 34 das 36 páginas autenticadas já não têm URL hoje (§2/§2b) — não há risco de quebrar links externos/compartilhados para essas telas (eles não existem).

---

## 11. Arquivos que serão tocados na próxima fase (quando a reorganização for aprovada e implementada)

- `src/navigation/navConfig.js` — único arquivo estrutural da sidebar (reordenar/reagrupar `navSections`, ajustar rótulos como "Suplementação"→"Nutrição", remover item `suporte` quando for a hora)
- `src/components/Sidebar.jsx` — só se a estrutura visual mudar (ex.: novo nível de agrupamento); não precisa mudar só para reordenar itens existentes
- `src/components/AppHeader.jsx` — se a decisão for consolidar "Alertas" (hoje aba do cabeçalho) com o novo item de sidebar
- **Novos arquivos, só se os itens do §8.4 forem implementados**: possíveis novas páginas ou abas dentro de `EstoquePage.jsx`/`FinanceiroPage.jsx`, e novo mapeamento em `src/App.jsx` (`pageMap`) + `src/auth/perfis.js` (`permissoesPorPagina`) para qualquer `pageId` novo
- Nenhuma migration/RLS/Supabase é afetada por esta fase (navegação é 100% frontend)

**Próximo passo recomendado:** aprovar esta Fase 0, decidir os pontos em aberto do §8 (em especial 8.1 e 8.2, que são decisões de produto, não de arquitetura), e só então abrir uma Fase 1 de implementação restrita a `navConfig.js`.
