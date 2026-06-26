# Auditoria Visual, UX e Utilidade — HERDON

**Data:** 2026-06-26
**Status:** Auditoria concluída. **Bloco 1 (quebras críticas C1/C2/C3) e Bloco 2 (bug de cadastro/login A1) corrigidos e validados em 2026-06-26** — ver seções 7 e 8. Blocos 3-4 ainda não executados.
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
| A3 | **Badge/status fragmentado** | Pelo menos 4 implementações diferentes de "badge de status" coexistem: `Badge.jsx` compartilhado, `status-badge`/`status-badge--ativo` ad-hoc, `ranking-badge` em `comparativo.css`, `notification-badge`/`notif-badge` duplicado em `app.css` (linhas 409, 3586, 4431). | Pendente |
| A4 | **Empty state inconsistente em ~80% das páginas** | Existe um componente `EmptyState.jsx` bem feito (usado corretamente em `FazendasPage`, `RelatorioLotePage`, `RelatorioPesagensPage`, `RelatorioFinanceiroPage`, `RelatorioPastagensPage`, `RelatorioResumoGeralPage`), mas a maioria das páginas (Pastagens, Lotes, Animais, Pesagens, Estoque, Suplementação, Sanitário, Tarefas, Financeiro, FluxoCaixa, Custos, CustosCompartilhados, Cenários, RelatoriosGerenciais, Dashboard, EvolucaoRebanho, Planejamento, Calendário) usa `<div className="empty-state">` artesanal com texto solto, sem padrão visual único. | Pendente |

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

| Arquivo | Linha | Atual | Correto |
|---------|-------|-------|---------|
| `PesagensPage.jsx` | 214 | `Voce nao tem permissao para executar esta acao.` | `Você não tem permissão para executar esta ação.` |
| `PesagensPage.jsx` | 871 | `Pendencias da ultima pesagem` | `Pendências da última pesagem` |
| `PesagensPage.jsx` | 417 | `Informe uma quantidade valida` | `Informe uma quantidade válida` |
| `FinanceiroPage.jsx` | 534 | `Valor e data sao obrigatorios.` | `Valor e data são obrigatórios.` |
| `ConfiguracoesPage.jsx` | 906 | `Nao foi possivel criar o convite.` | `Não foi possível criar o convite.` |
| `DashboardPage.jsx` | 468 | `Todos os lotes estao com pesagem em dia.` | `...estão...` |
| `DashboardPage.jsx` | 476 | `Ultima pesagem:` | `Última pesagem:` |
| `CalendarioOperacionalPage.jsx` | 454, 518 | `Responsavel` / `Sem responsavel` | `Responsável` / `Sem responsável` |
| `CalendarioOperacionalPage.jsx` | 469 | `Recorrencia` | `Recorrência` |
| `CalendarioOperacionalPage.jsx` | 480 | `Notificacao` | `Notificação` |
| `CalendarioOperacionalPage.jsx` | 561 | `Saida` | `Saída` |

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
