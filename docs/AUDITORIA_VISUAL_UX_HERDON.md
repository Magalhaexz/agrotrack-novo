# Auditoria Visual, UX e Utilidade — HERDON

**Data:** 2026-06-26
**Status:** Auditoria concluída. **Bloco 1 (quebras críticas C1/C2/C3), Bloco 2 (bug de cadastro/login A1), Bloco 3 (badges/status A3, estados vazios A4, textos B1) e correção de profile ausente para usuários Google/e-mail corrigidos e validados em 2026-06-26** — ver seções 7, 8, 9 e 10. Bloco 4 ainda não executado.
**Método:** (1) leitura de código de todas as páginas e componentes compartilhados via agentes de pesquisa especializados; (2) sessão real no app (login criado via fluxo de cadastro próprio do HERDON, conta `herdonapp+auditoria@gmail.com`) com captura de tela e medição de DOM em 1920×1080, 1366×768 e 390×844.

---

## 1. Telas revisadas

**Operação:** Modo Curral, Fazendas, Pastos, Lotes e Rebanho, Animais, Pesagens, Acompanhamento de Peso, Estoque, Suplementação, Sanidade, Tarefas.

**Financeiro/Decisão:** Movimentações Financeiras, Fluxo de Caixa, Rateio de Custos, Custos, Resultado dos Lotes, Simulador de Decisão (Cenários), Indicadores, Painel Gerencial, Relatórios (hub + Lote/Pesagens/Financeiro/Pastagens/Resumo Geral), Comparativo.

**Gestão/Conta:** Painel Geral (Dashboard), Dashboard Premium, Equipe (Funcionários), Configurações, Perfil, Planos e Assinatura, Importação, Sincronização, Guia do Criador, Suporte, Termos de Uso, Privacidade, Cobrança, Evolução do Rebanho, Planejamento, Calendário Operacional.

**Camada compartilhada:** Sidebar, AppHeader, MobileBottomNav, MobileFab, Modal, Toast, ConfirmModal, Button, Table, Badge, EmptyState.

**Validado ao vivo no preview (login real):** Painel Geral, Lotes e Rebanho, Animais, Movimentações Financeiras, drawer de menu mobile, modal "Cadastrar fazenda" — em 1920×1080, 1366×768 e 390×844.

---

## 2. Achados por gravidade

### 🔴 Crítico — quebra uso, corta tela, sobrepõe elementos

| # | Tela | Problema | Evidência | Status |
|---|------|----------|-----------|--------|
| C1 | **Painel Geral (mobile ≤640px)** | Os 3 botões do banner de boas-vindas ("Cadastrar fazenda", "Importar dados", "Ver guia do criador") usam `flex:1` forçando ~90px de largura cada, mas o texto usa `white-space: nowrap` + `overflow: visible` — o texto vaza para fora da caixa e **sobrepõe visualmente o botão vizinho**. Confirmado: largura da caixa 90px, largura real do texto 123–148px. | `src/styles/dashboard.css:1190-1209`, `src/pages/DashboardPage.jsx:312,330`. Reproduzido e medido no preview em 390×844. | ✅ **Corrigido** (ver seção 7) |
| C2 | **Lotes e Rebanho (mobile)** | O botão flutuante de ações rápidas (`MobileFab`) é `position:fixed`, `z-index:1460`, ancorado no canto inferior direito — **sobrepõe o filtro "Período"** no painel de filtros. | `src/components/MobileFab.jsx:6-9` (ativo em `lotes`), `src/styles/app.css:2480-2492,8250-8253`. Overlap confirmado por cálculo de bounding box no preview. | ✅ **Corrigido** (ver seção 7) |
| C3 | **Movimentações Financeiras (mobile)** | O mesmo `MobileFab` sobrepõe o card "Receita total" / "Despesa total". | Mesma causa-raiz de C2 — `acoesPorPagina.financeiro` em `MobileFab.jsx:9`. Confirmado visualmente e por bounding box. | ✅ **Corrigido** (ver seção 7) |

**Causa raiz comum de C2/C3:** o FAB é posicionado de forma fixa sem reservar espaço no conteúdo das 3 páginas onde aparece (`lotes`, `estoque`, `financeiro`). O mesmo problema foi confirmado também em **Estoque** durante a correção (seção 7) e resolvido junto.

### 🟠 Alto — prejudica entendimento ou fluxo

| # | Tela | Problema | Status |
|---|------|----------|--------|
| A1 | **Cadastro de conta (LoginPage)** | Ao criar conta com confirmação automática (sessão retornada), o código mostra "Conta criada e login realizado com sucesso." mas **não chama `acceptSession`** nem redireciona — o usuário fica preso na tela de login e precisa logar manualmente de novo. `src/pages/LoginPage.jsx` branch `modo === 'cadastro'` não tem o mesmo tratamento de sessão que o branch de login. Reproduzido ao vivo nesta auditoria. | ✅ **Corrigido** (ver seção 8) |
| A2 | **Simulador de Decisão (Cenários)** | Mostra "Viável: SIM/NÃO" em verde/vermelho sem explicar o porquê ao produtor; números brutos (UA, margem bruta projetada) sem contexto de interpretação, diferente do padrão bem resolvido em `RelatorioLotePage` (que tem texto de apoio). | Pendente |
| A3 | **Badge/status fragmentado** | Pelo menos 4 implementações diferentes de "badge de status" coexistem: `Badge.jsx` compartilhado, `status-badge`/`status-badge--ativo` ad-hoc, `ranking-badge` em `comparativo.css`, `notification-badge`/`notif-badge` duplicado em `app.css` (linhas 409, 3586, 4431). | ✅ **Corrigido** (`status-badge`/`alert-tipo-badge` unificados; `ranking-badge` e `notification-badge` mantidos por serem padrões distintos — ver seção 9) |
| A4 | **Empty state inconsistente em ~80% das páginas** | Existe um componente `EmptyState.jsx` bem feito (usado corretamente em `FazendasPage`, `RelatorioLotePage`, `RelatorioPesagensPage`, `RelatorioFinanceiroPage`, `RelatorioPastagensPage`, `RelatorioResumoGeralPage`), mas a maioria das páginas (Pastagens, Lotes, Animais, Pesagens, Estoque, Suplementação, Sanitário, Tarefas, Financeiro, FluxoCaixa, Custos, CustosCompartilhados, Cenários, RelatoriosGerenciais, Dashboard, EvolucaoRebanho, Planejamento, Calendário) usa `<div className="empty-state">` artesanal com texto solto, sem padrão visual único. | ✅ **Corrigido nas páginas prioritárias** (Lotes, Animais, Pesagens, Financeiro, Estoque, Sanidade, Cenários, Rotina/Calendário, Dashboard) — ver seção 9. Pastagens, Suplementação (já usa variante de tabela válida), CustosCompartilhados, FluxoCaixa, Custos, RelatoriosGerenciais, EvolucaoRebanho e Planejamento ficam para sprint futura. |

### 🟡 Médio — inconsistência visual ou de design

| # | Tela | Problema |
|---|------|----------|
| M1 | `LoteNutricaoTab.jsx:29-39` | Card com padding/radius hardcoded (`14px`) em vez dos tokens (`--layout-card-padding`), e cores `rgba(15,23,42,...)` / `rgba(248,250,252,...)` que parecem herdadas de um tema claro, destoando do dark theme do resto do app. |
| M2 | `Toast.jsx:6-18` | Cores de fundo hardcoded (`rgba(8,12,10,0.92)`, `rgba(12,8,8,0.92)`) em vez de variáveis de tokens. |
| M3 | Avatar 96px fixo | `DashboardPage.jsx` e `PerfilPage.jsx` usam `style={{ width: 96 }}` fixo para a área do avatar — funciona, mas não escala com o tamanho de tela tão bem quanto o resto do layout (não chega a cortar, mas é uma exceção ao padrão responsivo). |
| M4 | Configurações — módulo de acessos | Mensagem "Módulo de acessos em preparação" indica feature parcialmente pronta, com fallback funcional mas visivelmente "em construção". |

### ⚪ Baixo — polimento

| # | Tela | Problema |
|---|------|----------|
| B1 | Texto sem acento (vários arquivos) | Ver lista completa na seção 3. |
| B2 | `FinanceiroPage.jsx:206-208` | Busca defensiva por aliases `'alimentacao'`/`'alimentaçao'`/`'alimentação'` — sinal de que dados antigos foram gravados sem acento; não é bug visual, é dívida técnica de dados. |

---

## 3. Erros de português / acentuação (lista para correção)

**Todos os itens abaixo foram corrigidos no Bloco 3 (ver seção 9).**

| Arquivo | Linha | Atual | Correto | Status |
|---------|-------|-------|---------|--------|
| `PesagensPage.jsx` | 214 | `Voce nao tem permissao para executar esta acao.` | `Você não tem permissão para executar esta ação.` | ✅ |
| `PesagensPage.jsx` | 871 | `Pendencias da ultima pesagem` | `Pendências da última pesagem` | ✅ |
| `PesagensPage.jsx` | 417 | `Informe uma quantidade valida` | `Informe uma quantidade válida` | ✅ |
| `FinanceiroPage.jsx` | 534 | `Valor e data sao obrigatorios.` | `Valor e data são obrigatórios.` | ✅ |
| `FinanceiroPage.jsx` | 348 | `Acoes` (cabeçalho de tabela) | `Ações` | ✅ |
| `ConfiguracoesPage.jsx` | 906 | `Nao foi possivel criar o convite.` | `Não foi possível criar o convite.` | ✅ |
| `DashboardPage.jsx` | 468 | `Todos os lotes estao com pesagem em dia.` | `...estão...` | ✅ |
| `DashboardPage.jsx` | 476 | `Ultima pesagem:` | `Última pesagem:` | ✅ |
| `CalendarioOperacionalPage.jsx` | 454, 518 | `Responsavel` / `Sem responsavel` | `Responsável` / `Sem responsável` | ✅ |
| `CalendarioOperacionalPage.jsx` | 469 | `Recorrencia` | `Recorrência` | ✅ |
| `CalendarioOperacionalPage.jsx` | 480 | `Notificacao` | `Notificação` | ✅ |
| `CalendarioOperacionalPage.jsx` | 561 | `Saida` | `Saída` | ✅ |
| `CalendarioOperacionalPage.jsx` | 522, 538, 651 | `Sem responsavel` / `Agenda sanitaria` / `Rotina automatica` | `Sem responsável` / `Agenda sanitária` / `Rotina automática` | ✅ (encontrado durante o Bloco 3) |
| `RankingLotes.jsx` | 14 | `Nenhum dado disponivel para ranking.` | `Nenhum dado disponível para ranking.` | ✅ (encontrado durante o Bloco 3) |

---

## 4. O que funciona bem (não tocar)

- **Hierarquia de decisão nas páginas operacionais**: Lotes, Pesagens, Sanidade, Estoque, Tarefas e Pastagens surfaceiam o número certo primeiro (GMD, status crítico/vencido, dias restantes) com badges de cor — exatamente o padrão pedido no briefing.
- **Clareza financeira**: Financeiro, FluxoCaixa, Resultados, Indicadores e RelatorioLotePage explicam custo/receita/margem/ROI com rótulos claros e unidades.
- **Responsividade de tabelas e modais**: `Table.jsx` e `Modal.jsx` têm estratégia de overflow e max-height bem resolvida; nenhuma quebra encontrada nesses dois componentes em si.
- **Sidebar**: colapsa corretamente em desktop e vira drawer em mobile sem cortes (confirmado ao vivo).
- **Botão compartilhado (`Button.jsx`/`ui-button`)**: usado de forma consistente, sem estilos inline concorrentes na maior parte do app.

---

## 5. Prioridade sugerida para a Etapa 3

**Bloco 1 — Quebras críticas de layout (fazer primeiro):**
- C1: corrigir overflow de texto nos botões do banner do Dashboard em mobile.
- C2/C3 (+ verificar Estoque): dar ao `MobileFab` ciência do espaço ocupado, ou reposicionar/ajustar `padding-bottom` do conteúdo nas 3 páginas afetadas.

**Bloco 2 — Bug funcional isolado e seguro:**
- A1: completar o fluxo de `acceptSession`/redirecionamento após cadastro com sessão automática (sem tocar em Supabase/RLS — é só o handler JS local em `LoginPage.jsx`).

**Bloco 3 — Padronização de componentes:**
- A3: unificar badges de status sob `Badge.jsx`.
- A4: trocar `<div className="empty-state">` ad-hoc pelo componente `EmptyState.jsx` nas páginas listadas.
- M1/M2: substituir valores hardcoded por tokens.

**Bloco 4 — Textos e polimento:**
- B1: aplicar a lista de correções de acentuação da seção 3.
- A2: adicionar texto de apoio explicando viabilidade/ROI/break-even no Simulador de Decisão.

**Fica para sprint futura (fora do escopo desta auditoria):**
- M3 (avatar fixo) e M4 (módulo de acessos em preparação) — são itens menores ou já sinalizados como incompletos pelo próprio produto, sem urgência.
- Auditoria visual completa de Estoque, Suplementação, Sanidade, Tarefas, Modo Curral, Pastagens, Comparativo, Planejamento e Calendário **com dados reais carregados** (esta rodada usou conta nova/vazia; tabelas com muitas linhas, gráficos com dados reais e estados de "lote superlotado"/"vencido" não foram visualmente verificados ao vivo — a análise dessas telas nesta auditoria é por leitura de código, não por captura de tela).
- Padronização de cores/tokens em todo `app.css` (arquivo muito grande, 10k+ linhas — merece uma sprint dedicada de tokenização, não uma correção pontual).

---

## 6. Limitações desta auditoria (transparência)

- A conta usada para os testes ao vivo (`herdonapp+auditoria@gmail.com`) está **vazia** (sem fazenda, lote, animal ou lançamento cadastrado). A validação visual em telas com dados densos (tabelas longas, gráficos com séries, KPIs com valores reais) foi feita por leitura de código, não por captura de tela real — pode haver bugs de overflow/quebra em tabelas com muitas colunas ou gráficos com muitos pontos que só aparecem com volume real de dados.
- Nem todas as 25+ páginas foram visualmente abertas no preview nesta rodada (4 foram: Dashboard, Lotes, Animais, Financeiro). As demais foram auditadas por leitura de código pelos agentes de pesquisa, com citação de arquivo:linha para cada achado.
- As credenciais de teste em `.env.e2e` estavam inválidas (rejeitadas pelo Supabase); foi necessário criar uma conta nova pelo próprio fluxo de cadastro do app para validar o login ao vivo.

---

## 7. Bloco 1 — Correções aplicadas (2026-06-26)

**Escopo:** apenas os 3 bugs críticos C1/C2/C3. Nenhuma regra de negócio, autenticação, Supabase, RLS, Asaas ou cálculo foi tocado. Nenhuma outra página fora do escopo foi alterada.

### Arquivos alterados
- `src/styles/dashboard.css` (regra de mobile dos botões do banner)
- `src/styles/app.css` (regra de espaço reservado para o `MobileFab`)
- `src/App.jsx` (1 linha: adiciona a classe `main-has-fab` quando a página atual usa o FAB)

### C1 — Botões do banner do Dashboard

**Causa:** em `@media (max-width: 640px)`, `.dashboard-onboarding-actions .ui-button { flex: 1 }` forçava os 3 botões a ~90px de largura cada, mas o texto interno usava `white-space: nowrap` — o texto (até 148px) vazava da caixa e cobria o botão vizinho.

**Correção:** em mobile, os botões agora empilham verticalmente em largura total (`flex-direction: column` + `width: 100%` em vez de `flex: 1`), com `white-space: normal` como reforço. Em desktop (>640px) nada mudou — continuam lado a lado como antes.

**Validado:** em 390×844, `scrollWidth` de cada botão ≤ largura da caixa (sem overflow) nos 3 botões. Em 1920×1080, layout original lado a lado preservado.

### C2/C3 — `MobileFab` sobrepondo conteúdo (Lotes, Financeiro, e Estoque também confirmado)

**Causa real (mais sutil do que pareceu na auditoria):** o `MobileFab` é `position: fixed`, então sua posição na tela é constante independente do scroll. O overlap acontecia já na primeira visualização da página (sem precisar rolar) — então só reservar espaço no *final* do scroll (`padding-bottom`) não resolvia, porque o elemento sobreposto (filtro "Período", card "Receita total") não está no fim da página, está perto do topo. A correção certa precisava reservar espaço **horizontal** (coluna direita), não só vertical.

**Correção:** quando a página atual é `lotes`, `estoque` ou `financeiro`, o `<main>` recebe a classe `main-has-fab`, que reserva 76px de `padding-right` (largura do FAB + margem) durante toda a altura da página, além do `padding-bottom` extra para o fim da lista. Houve uma armadilha de especificidade CSS nessa correção: a regra pré-existente `.app-shell .main { padding-inline: 12px }` (em `layout.css`) tinha especificidade maior que `.main-has-fab` isolado e vencia silenciosamente — foi necessário escrever `.app-shell .main.main-has-fab` para garantir prioridade.

**Validado por cálculo de bounding box (não só visual):**
- Lotes: filtro "Período" e FAB → `overlap: false` (antes: `true`)
- Financeiro: card "Receita total" e FAB → `overlap: false` (antes: `true`)
- Estoque: confirmado visualmente sem sobreposição (terceira página afetada pela mesma causa, não estava nos 3 bugs originais da auditoria mas usa o mesmo `MobileFab`)
- Desktop (1366×768, 1920×1080): FAB não aparece (regra `display:none` fora do breakpoint mobile) — nenhuma mudança visual nessas larguras, confirmado por screenshot.

### Resultado de validação técnica
- `npm run lint`: ✅ sem erros
- `npm run build`: ✅ sucesso
- Preview: testado em 1920×1080, 1366×768 e 390×844, login real com a conta de auditoria, navegação real entre Painel Geral → Lotes → Financeiro → Estoque.

---

## 8. Bloco 2 — Correção aplicada (2026-06-26)

**Escopo:** apenas o bug funcional A1 (cadastro não loga automaticamente). Nenhuma regra de Supabase, RLS, política de banco ou regra de negócio foi alterada. Nenhuma outra página foi tocada. Visual da tela de login não foi alterado.

### Arquivo alterado
- `src/pages/LoginPage.jsx`

### Causa do bug

Comparando os dois fluxos em `handleSubmit`:
- **Login bem-sucedido:** grava marcadores no `localStorage`, limpa flags de fluxo de auth, chama `acceptSession(data.session, ...)` e redireciona para `/` após 50ms.
- **Cadastro bem-sucedido com sessão retornada** (`modo === 'cadastro'`, `data?.session` presente — acontece quando a confirmação de e-mail está desativada no projeto Supabase): o código só chamava `setMensagem('Conta criada e login realizado com sucesso.')` e retornava — **sem nunca chamar `acceptSession` nem redirecionar**. O usuário via a mensagem de sucesso mas continuava preso na tela de login, precisando logar manualmente de novo.

### Solução aplicada

1. Extraí a lógica de aceitar sessão (gravar marcadores, limpar flags, chamar `acceptSession`, redirecionar) para uma função única `aceitarSessaoEEntrar(session, source)`, reaproveitada nos dois fluxos — eliminando a duplicação que causou o bug em primeiro lugar.
2. No fluxo de cadastro, quando `data.session` existe (Cenário A do pedido), agora chama `aceitarSessaoEEntrar(data.session, 'cadastro_submit_success')` — o usuário entra automaticamente, igual ao login.
3. Quando não há sessão (Cenário B — confirmação de e-mail pendente), a mensagem foi trocada de *"Cadastro realizado com sucesso. Agora entre com seu e-mail e senha."* (enganosa quando há confirmação pendente) para **"Conta criada com sucesso. Verifique seu e-mail para confirmar o cadastro antes de acessar."**
4. Descoberta durante o teste ao vivo: quando o e-mail já está cadastrado, o Supabase deste projeto **não retorna erro** — devolve `data.user` com `identities: []` silenciosamente (comportamento documentado do Supabase para evitar enumeração de contas). Sem tratar esse caso, o usuário receberia a mensagem de "verifique seu e-mail" de forma enganosa. Adicionei a verificação `data.user.identities.length === 0` para mostrar **"Este e-mail já está cadastrado. Tente entrar ou recuperar sua senha."** nesse caso.
5. Mensagens de erro diferenciadas por tipo (função `getAuthErrorMessage`):
   - Login com credenciais inválidas → "E-mail ou senha incorretos. Verifique e tente novamente."
   - Cadastro com e-mail já registrado (quando o Supabase retorna erro explícito, caso diferente do item 4) → "Este e-mail já está cadastrado. Tente entrar ou recuperar sua senha."
   - Cadastro com senha fraca → "A senha é muito fraca. Use pelo menos 6 caracteres."
   - E-mail em formato inválido: já bloqueado nativamente pelo input `type="email"` do navegador antes de chegar ao Supabase.

### Testes realizados no preview (login real, não simulado)

| Teste | Resultado |
|---|---|
| Criar conta nova (`herdonapp+bloco2teste@gmail.com`) com sessão retornada | ✅ Login automático confirmado — usuário caiu direto no Painel Geral, header mostrando "AB Auditoria PROPRIETÁRIO" |
| Login com senha errada na conta recém-criada | ✅ Mensagem exibida: "E-mail ou senha incorretos. Verifique e tente novamente." |
| Cadastro com e-mail já existente | ✅ Mensagem exibida: "Este e-mail já está cadastrado. Tente entrar ou recuperar sua senha." |
| E-mail em formato inválido (`emailinvalido`) | ✅ Bloqueado pela validação nativa do navegador antes do envio |
| Login normal (conta original da auditoria) | ✅ Continua funcionando sem alteração de comportamento |

### Resultado de validação técnica
- `npm run lint`: ✅ sem erros
- `npm run build`: ✅ sucesso
- Preview: testado em 1920×1080 com login/logout/cadastro reais, fluxo completo ponta a ponta.

---

## 9. Bloco 3 — Correções aplicadas (2026-06-26)

**Escopo:** padronização visual (badges/status, estados vazios) e correção de português. Nenhuma regra de negócio, Supabase, RLS, Asaas, cálculo ou rota foi alterada.

### Arquivos alterados (16)
`AlertList.jsx`, `RankingLotes.jsx`, `FazendaCard.jsx`, `LoteCard.jsx`, `AnimaisPage.jsx`, `CalendarioOperacionalPage.jsx`, `CenariosPage.jsx`, `ConfiguracoesPage.jsx`, `DashboardPage.jsx`, `EstoquePage.jsx`, `FinanceiroPage.jsx`, `LotesPage.jsx`, `PesagensPage.jsx`, `RotinaPage.jsx`, `SanitarioPage.jsx`, `SincronizacaoPage.jsx`.

### 1. Badges/status unificados

Antes de editar, mapeei **todos** os usos de `.status-badge` no app e descobri que essa classe **nunca teve CSS definido** — todo badge que a usava renderizava como texto puro sem cor, fundo ou borda (bug mais grave do que "inconsistente": estava completamente quebrado visualmente). Encontrei 8 ocorrências, 4 mais do que a auditoria original havia citado:

| Arquivo | Badge | Antes | Depois (`Badge` compartilhado) |
|---|---|---|---|
| `AnimaisPage.jsx` | status do animal | `status-badge--ativo/inativo` (sem estilo) | `success` / `neutral` |
| `FazendaCard.jsx` | status da fazenda | `status-badge--ativo/inativo` (sem estilo) | `success` / `neutral` |
| `LoteCard.jsx` | risco do lote ("Atenção"/"OK") | `status-badge--atencao/sucesso` (sem estilo) | `warning` / `success` |
| `SincronizacaoPage.jsx` | status de sincronização | `status-badge--sucesso/critico/atencao` (sem estilo) | `success` / `danger` / `warning` |
| `DashboardPage.jsx` | "Sem críticos" / "N críticos" | `status-badge--sucesso/critico` (sem estilo) | `success` / `danger` |
| `DashboardPage.jsx` | prioridade do item ("Crítico"/"Atenção") | `status-badge--critico/atencao` (sem estilo) | `danger` / `warning` |
| `DashboardPage.jsx` | alerta crítico | `status-badge--critico` (sem estilo) | `danger` |
| `DashboardPage.jsx` | tarefa do dia ("Hoje") | `status-badge--pendente` (sem estilo) | `warning` |

Também padronizei `alert-tipo-badge` (`AlertList.jsx`) — outra classe sem CSS — para `Badge variant="neutral"`, já que é uma etiqueta de categoria (não de severidade; a severidade já é mostrada pela cor do ícone da linha).

**Mantidos intencionalmente, por serem padrões visuais diferentes e já estilizados corretamente:**
- `ranking-badge` (`RankingLotes.jsx`) — indicador de posição no ranking (#1, #2...), não um status semântico.
- `notification-badge`/`notif-badge` (`AppHeader.jsx`) — contador numérico de notificações, não um indicador de status.

A paleta de cores usada (`success`=verde, `warning`=amarelo/laranja, `danger`=vermelho, `neutral`=cinza) já existia em `Badge.jsx` e já correspondia exatamente ao padrão pedido nesta sprint.

### 2. Estados vazios padronizados

Troquei `<div className="empty-state">`/`<div className="empty-box">` artesanais pelo componente `EmptyState.jsx` (título, descrição, ícone, botão de ação), seguindo o modelo pedido ("o que falta → por que importa → ação clara"):

| Página | Antes | Depois |
|---|---|---|
| Lotes | "Nenhum lote encontrado." | "Você ainda não cadastrou nenhum lote." + "Crie seu primeiro lote para acompanhar pesagens, GMD, custos e resultado financeiro." + botão **Criar lote** |
| Animais (grupos) | "Nenhum grupo cadastrado." | "Você ainda não cadastrou nenhum grupo de animais." + botão **Cadastrar grupo** |
| Animais (individuais) | "Nenhum animal individual cadastrado." | + botão **Cadastrar animal** |
| Animais (movimentações) | "Nenhuma movimentação registrada." | mesmo texto, ícone e estrutura padronizados |
| Pesagens (histórico) | "Nenhuma pesagem cadastrada." | "Você ainda não registrou nenhuma pesagem." + botão **Registrar pesagem** |
| Pesagens (evolução) | "Sem dados suficientes para evolução." | + explicação de que são necessárias 2+ pesagens |
| Financeiro (lançamentos) | "Nenhuma movimentação financeira encontrada." | "Você ainda não lançou nenhuma movimentação financeira." + botão **Registrar movimentação** |
| Estoque (lista) | "Nenhum item cadastrado." | "Você ainda não cadastrou nenhum item no estoque." + botão **Novo item** |
| Estoque (modal de entrada) | "Cadastre um item antes de registrar entrada." | mesmo texto, versão `compact` do componente, dentro do modal |
| Sanidade | "Nenhum manejo sanitário registrado." | "Você ainda não registrou nenhum manejo sanitário." + botão **Registrar manejo** |
| Cenários | "Nenhum cenário simulado ainda." | "Você ainda não simulou nenhum cenário." (sem botão — o formulário já está visível acima) |
| Rotina (tarefas do dia/atrasadas/próximas) | `empty-box` artesanal reaproveitado em 3 colunas | `EmptyState compact`, mesmo texto |
| Calendário (dia selecionado) | "Sem eventos nesta data." | mesmo texto + botão **Novo evento**, versão `compact` |
| Calendário (próximos eventos) | "Nenhum evento futuro." | mesmo texto, versão `compact` |
| Dashboard (pesagens pendentes) | "Todos os lotes estao com pesagem em dia." | corrigido o acento + `EmptyState compact` |

**Não alterados (fora do escopo desta rodada):** Fazendas (já usava `EmptyState` corretamente, serviu de referência), Pastagens, Suplementação (usa `empty-state-td`, variante de tabela já estilizada e válida — não é "improvisada"), CustosCompartilhados, FluxoCaixa, Custos, RelatoriosGerenciais, EvolucaoRebanho, Planejamento, RelatoriosPage (hub — o card ali é um aviso contextual, não um estado vazio de lista).

### 3. Textos e acentuação

Todos os 11 itens da seção 3 deste relatório foram corrigidos, mais 4 encontrados durante a edição (não estavam na auditoria original): `RankingLotes.jsx` ("disponivel"), e em `CalendarioOperacionalPage.jsx` mais duas ocorrências de "Sem responsavel", "Agenda sanitaria" e "Rotina automatica".

### Validação no preview (login real, conta de auditoria)

| Verificação | Resultado |
|---|---|
| Badge "ativa" em card de fazenda | ✅ Renderiza verde via `.ui-badge` (antes: texto sem estilo) |
| Badge "Sem críticos" no Dashboard | ✅ Verde, `.ui-badge` |
| `EmptyState` em Lotes (com fazenda ativa) | ✅ Título, descrição, ícone e botão "Criar lote" — exatamente o texto do modelo pedido |
| Botão "Criar lote" → abre modal "Novo lote" | ✅ |
| `EmptyState` em Animais, Estoque, Sanidade, Cenários, Financeiro | ✅ Título/descrição/ação corretos em todos |
| Overflow horizontal em 1366×768 | ✅ Nenhum (`scrollWidth === innerWidth`) |
| Overflow horizontal em 390×844 | ✅ Nenhum (`scrollWidth === innerWidth`) |
| Botão de ação do `EmptyState` acessível em mobile | ✅ Abaixo da dobra mas alcançável por scroll (comportamento normal da página, não é corte) |

### Resultado de validação técnica
- `npm run lint`: ✅ sem erros
- `npm run build`: ✅ sucesso
- Preview: testado em 1920×1080, 1366×768 e 390×844; fazenda/lote criados e removidos durante o teste para validar o fluxo real de cada estado vazio.

### Limitações
- A conta de teste estava vazia; os badges de status em **tabelas com várias linhas** (ex.: tabela de animais, tabela de sincronização) foram verificados pelo código e por um exemplo isolado (card de fazenda), não por uma lista longa renderizada de fato.
- `notification-badge`/`notif-badge`, citados na auditoria original como "duplicados em `app.css`", não foram consolidados nesta rodada — são contadores numéricos (não status), e a duplicação é puramente de CSS (limpeza de código), não um problema visual visível ao usuário. Fica para sprint futura de limpeza de CSS.

---

## 10. Correção — usuários autenticados sem `public.profiles` (2026-06-26)

**Escopo:** este item não é parte da auditoria visual original; foi um bug funcional/backend reportado separadamente. Documentado aqui por continuidade. Nenhum layout, autenticação visual, Asaas ou cálculo foi alterado. RLS não foi alterada (apenas lida/verificada).

### Problema reportado
Usuários que entravam com Google ficavam autenticados e acessavam o app, mas não apareciam em `public.profiles`.

### Diagnóstico real (mais amplo do que o relato inicial)
Ao rodar as queries de diagnóstico pedidas, descobri que o problema **não era específico do Google** — **todo usuário criado recentemente** (e-mail/senha ou Google) estava sem profile. 8 de 9 usuários em `auth.users` não tinham linha em `public.profiles`.

**Causa raiz:** a tabela `public.profiles` tem `CHECK (perfil IN ('admin','gerente','operador','visualizador'))`, mas a função `handle_new_user_profile()` (e o `DEFAULT` da coluna `perfil`) inseriam o valor `'PROPRIETARIO'` — que **nunca** satisfez essa constraint. O gatilho `on_auth_user_created` já existia e já rodava corretamente em todo INSERT em `auth.users`, mas seu bloco `exception when others` capturava a violação da constraint silenciosamente (só um `RAISE WARNING`), deixando o usuário autenticado e sem profile, sem qualquer erro visível para o app ou para o usuário.

O valor `'admin'` foi escolhido por já ser tratado pelo alias map do próprio app (`src/auth/perfis.js`) como equivalente a `'proprietario'` (dono da conta) — é o único valor da constraint que corresponde à intenção original.

### Solução aplicada

**1. Migração no banco** (via Supabase MCP, `apply_migration`):
- `handle_new_user_profile()` corrigida para inserir `perfil = 'admin'` (era `'PROPRIETARIO'`).
- `DEFAULT` da coluna `profiles.perfil` corrigido de `'PROPRIETARIO'` para `'admin'`.
- Lógica de resolução de nome mantida (`raw_user_meta_data->>'nome'` → `'name'` → `'full_name'` → prefixo do e-mail → `'Novo usuário'`), já funcionava para Google (que popula `name`/`full_name`).

```sql
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  resolved_name text;
begin
  resolved_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'nome'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'Novo usuário'
  );

  insert into public.profiles (id, email, nome, perfil, owner_user_id, created_at, updated_at)
  values (new.id, new.email, resolved_name, 'admin', new.id, timezone('utc', now()), timezone('utc', now()))
  on conflict (id) do update
  set
    email = excluded.email,
    nome = coalesce(nullif(public.profiles.nome, ''), excluded.nome),
    perfil = coalesce(nullif(public.profiles.perfil, ''), excluded.perfil),
    owner_user_id = coalesce(public.profiles.owner_user_id, excluded.owner_user_id),
    updated_at = timezone('utc', now());

  return new;
exception
  when others then
    raise warning 'HERDON handle_new_user_profile failed for user %, error: %', new.id, sqlerrm;
    return new;
end;
$function$;

alter table public.profiles alter column perfil set default 'admin';
```

**2. Backfill dos 8 usuários antigos sem profile:**
```sql
insert into public.profiles (id, email, nome, perfil, owner_user_id, created_at, updated_at)
select u.id, u.email,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'nome'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(u.email, '@', 1), ''),
    'Novo usuário'
  ),
  'admin', u.id, timezone('utc', now()), timezone('utc', now())
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
```
Critério de aceite (`select ... where p.id is null` deve retornar zero linhas) — **confirmado, zero linhas.**

**3. Safety net no app** (`src/services/userAccess.js` — nova função `ensureUserProfile`; `src/auth/AuthContext.jsx` — chamada quando o profile vier `null` sem erro):
Caso a linha de `profiles` não exista por qualquer motivo futuro, o app cria via `upsert` com `ignoreDuplicates: true` (nunca sobrescreve um profile existente) e tenta buscar de novo, em vez de simplesmente seguir com `profile = null`. Verifiquei a policy de RLS `profiles_insert_self_or_manager` antes de implementar — ela permite que um usuário sem profile ainda insira a própria linha (`auth.uid() = id` e `owner_user_id` resolvendo para o próprio `auth.uid()` via `app_current_owner_user_id()`), então não foi necessária nenhuma alteração de RLS.

### Arquivos alterados
- `src/services/userAccess.js` (nova função `ensureUserProfile`)
- `src/auth/AuthContext.jsx` (chama `ensureUserProfile` + nova tentativa de fetch quando profile vem nulo)
- Banco: função `handle_new_user_profile()`, default da coluna `profiles.perfil` (via migrations do Supabase MCP, não há arquivo `.sql` no repo)

### Testes realizados (reais, não simulados)

| Teste | Resultado |
|---|---|
| Cadastro novo por e-mail (`herdonapp+profilefix@gmail.com`) | ✅ Profile criado pelo gatilho com `perfil='admin'`, `nome` correto, header do app mostra "Teste Profile Fix" / "Proprietário" |
| 3 usuários Google já existentes (`anavaleriomidias`, `henriquem.viale`, `joaovictorlopesrodrigues959`) | ✅ Backfill criou profile para os 3, com nome extraído de `raw_user_meta_data->>'name'` |
| Backfill completo (8 usuários, e-mail e Google) | ✅ Query de verificação retorna zero linhas sem profile |
| Login repetido / duplicidade | ✅ `id` é chave primária + `on conflict do nothing`/`ignoreDuplicates: true` — estruturalmente impossível duplicar |
| Safety net do app (simulando gatilho falho) | ✅ Apaguei manualmente o profile de um usuário de teste, recarreguei o app logado — `ensureUserProfile` recriou a linha automaticamente, sem travar o usuário |
| Login normal continua funcionando | ✅ Sem alteração de comportamento |

### Resultado de validação técnica
- `npm run lint`: ✅ sem erros
- `npm run build`: ✅ sucesso
- `get_advisors(security)`: nenhum aviso novo introduzido por esta correção (os avisos existentes sobre `SECURITY DEFINER` e `search_path` em outras funções já existiam antes e são pré-existentes, fora do escopo desta correção)

### Observação para o usuário
Não testei o fluxo real de login com Google "ao vivo" (exigiria credenciais Google reais no navegador, fora do alcance deste ambiente automatizado). A validação foi feita por: (1) backfill dos usuários Google que já tinham passado por esse fluxo anteriormente — confirmando que a causa raiz era genuinamente a constraint, e (2) teste completo do fluxo de e-mail/senha, que usa exatamente o mesmo gatilho de banco. Como a causa raiz (constraint de `perfil`) é independente do provedor de login, a correção cobre Google igualmente — mas recomendo um teste manual de login com Google real antes de considerar este item 100% encerrado em produção.
