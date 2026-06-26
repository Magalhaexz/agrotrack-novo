# QA Funcional Completo — Sprint 37

> **Continuação:** a auditoria de ação real botão a botão (criar/editar/excluir/recarregar) por módulo,
> que este documento aponta como pendência na seção "Escopo NÃO coberto", foi feita na Sprint 37.1.
> Ver [SPRINT_37_1_RESULTADO.md](SPRINT_37_1_RESULTADO.md) e [QA_BOTAO_POR_BOTAO_HERDON.md](QA_BOTAO_POR_BOTAO_HERDON.md).

**Gerado em:** 2026-06-25
**Conta usada:** "QA Piloto Sprint 34" (perfil PROPRIETÁRIO), ambiente Supabase de produção.
**Ambientes testados:** `npm run dev` (Vite dev server) e build de produção real (`npm run build` + `vite preview`), ambos com a mesma sessão autenticada.

## Escopo coberto

- Reprodução dirigida dos dois bugs reportados pela usuária.
- Varredura de navegação em todas as 27 páginas acessíveis pelo menu lateral + 4 páginas públicas.
- QA de viewport mobile/tablet em 375px, 390px, 430px e 768px, com sweep automatizado por página (overflow horizontal + erros de console) e inspeção visual via screenshot.
- Verificação de persistência pós-reload em dados já existentes (fazenda, lote).
- Suíte de testes automatizados (`npm test`), lint (`npm run lint`) e build de produção (`npm run build`).

## Escopo NÃO coberto nesta sprint (transparência)

- **Auditoria botão a botão de cada módulo** (Etapa 4 do pedido original, na íntegra) — não foi viável testar exaustivamente cada CRUD/validação/estado vazio de ~30 módulos dentro desta sessão. O que foi feito: smoke test de carregamento de todas as páginas (zero erros de console) e teste dirigido das duas ações reportadas como quebradas.
- **Upload real de arquivo na Importação** — mesma limitação já registrada em sprints anteriores (ambiente de teste não permite anexar arquivo binário).
- **Teste com perfis não-proprietário** (operador/visualizador) e com planos de assinatura diferentes do atual — não testado nesta sprint.
- **Persistência de criação de novos registros** (só foi confirmada persistência de dados pré-existentes via reload, para não escrever dados de teste adicionais na conta de produção sem necessidade).

## 1. Bugs reportados — resultado da investigação

### 1.1 Modo Curral → "Ver pendências"

**Não reproduzido.** Testado nos dois botões "Ver pendências" da tela (cabeçalho da seção e card secundário), em dev e em build de produção real, com a conta da usuária. Em ambos os casos a navegação para Sincronização ocorre normalmente, sem erro de console, sem tela branca.

Hipóteses não confirmadas para o relato original: ambiente realmente publicado na Vercel rodando build diferente deste repositório, dispositivo/navegador específico, ou estado de dados específico (item da fila offline malformado) não reproduzido aqui.

### 1.2 Suporte (menu Ajuda)

**Não reproduzido.** A página `/suporte` é pública (renderizada antes do shell autenticado) e não depende de `db`/`session`. Testada em dev e produção, abre corretamente com todo o conteúdo, sem erro de console.

### 1.3 Bug real encontrado durante a investigação (não estava na lista original)

**Cabeçalho mobile sobreposto à marca HERDON em telas estreitas (≤768px).**

- **Onde:** `.top-header-actions` (ícone de conexão + sino de notificações + menu "..."), dentro de `AppHeader.jsx`.
- **Causa raiz:** regra CSS `@media (max-width: 1024px) { .header.top-header .top-header-actions { flex-wrap: wrap; } }` em `src/styles/app.css:7751` tem especificidade maior (`.header.top-header .top-header-actions`, 2 classes) que as regras de "modo compacto mobile" mais recentes (`.top-header-actions` sozinho, 1 classe, em `src/styles/app.css:8373`), então o `flex-wrap: wrap` antigo continuava ganhando em qualquer largura ≤1024px — mesmo depois do hotfix mobile mais novo. Com 3 grupos de ícones competindo por uma faixa de ~340px, o conteúdo quebrava em até 3 linhas (104px de altura) dentro de um cabeçalho fixo de 64-68px, fazendo os ícones de notificação vazarem por cima/baixo do cabeçalho e sobrepor o texto "HERDON".
- **Por que isso já tinha sido "corrigido" antes:** o histórico (`SPRINT_35_RESULTADO.md`) registra uma correção quase idêntica ("cabeçalho mobile sobreposto em 375px, duas regras CSS concorrentes"). O arquivo `app.css` tem múltiplos blocos `@media` redundantes para o mesmo seletor acumulados em sprints sucessivos (comentários como "Sprint 18A4", "SPRINT18W6 HOTFIX" no próprio arquivo confirmam isso); a correção da Sprint 35 resolveu um conflito específico, mas não esse outro par de regras com especificidade diferente. É um padrão recorrente de regressão por dívida técnica em CSS, não um bug pontual.
- **Correção aplicada:** adicionado `flex-wrap: nowrap` ao seletor de maior especificidade (`.header.top-header .top-header-actions`) dentro do bloco de modo compacto mobile (`@media (max-width: 900px)`), e ocultado o wrapper vazio que sobrava de `.header-user-btn` (oculto via outra regra, mas seu `<div>` pai continuava ocupando espaço).
- **Verificado em:** 375px, 390px, 430px, 768px — altura de `.top-header-actions` voltou a 46px (compatível com o cabeçalho de 64-68px), sem overflow horizontal, sem erro de console, em 7+ páginas diferentes.
- **Teste de regressão criado:** `e2e/smoke.spec.js` → `mobile: cabeçalho não sobrepõe a marca em telas estreitas`.

## 2. Mapa de páginas (Etapa 2)

### Páginas autenticadas (`pageMap`, acessíveis pelo menu)

dashboard, modoCurral, fazendas, pastagens, lotes, animais, pesagens, estoque, suplementacao, sanitario, tarefas, financeiro, fluxoCaixa, custosCompartilhados, resultados, cenarios, indicadores, relatoriosGerenciais, relatorios, funcionarios, minhaAssinatura, importacao, sincronizacao, configuracoes, perfil, guiaCriador, suporte\* (\*tem entrada dupla: também é pública).

Adicionalmente presentes no `pageMap` mas sem entrada no menu (acessadas por navegação interna): calendarioOperacional, comparativo, rotina, acompanhamentoPeso, custos, evolucaoRebanho, dashboardPremium, relatorioLote, relatorioPesagens, relatorioFinanceiro, relatorioPastagens, relatorioResumoGeral, planejamento.

### Páginas públicas (`publicPageMap`, sem login)

termos (`/termos-de-uso`), privacidade (`/politica-de-privacidade`), cobranca (`/politica-de-cobranca`), suporte (`/suporte`).

## 3. QA de navegação (Etapa 3)

Varredura automatizada: clique em cada botão do menu lateral → confirmação de troca de página (legenda do topo + conteúdo principal) → captura de `console.error`/`window.onerror`/`unhandledrejection`.

| Página | Abre? | Erro console? | Observação |
|---|---|---|---|
| Painel Geral | ✅ | Nenhum | |
| Modo Curral | ✅ | Nenhum | |
| Fazendas | ✅ | Nenhum | |
| Pastos | ✅ | Nenhum | |
| Lotes e Rebanho | ✅ | Nenhum | |
| Animais | ✅ | Nenhum | |
| Pesagens | ✅ | Nenhum | |
| Estoque | ✅ | Nenhum | |
| Suplementação | ✅ | Nenhum | |
| Sanidade | ✅ | Nenhum | |
| Tarefas | ✅ | Nenhum | |
| Movimentações Financeiras | ✅ | Nenhum | |
| Fluxo de Caixa | ✅ | Nenhum | |
| Rateio de Custos | ✅ | Nenhum | |
| Resultado dos Lotes | ✅ | Nenhum | |
| Simulador de Decisão | ✅ | Nenhum | |
| Indicadores | ✅ | Nenhum | |
| Painel Gerencial | ✅ | Nenhum | |
| Relatórios | ✅ | Nenhum | |
| Equipe | ✅ | Nenhum | |
| Planos e Assinatura | ✅ | Nenhum | |
| Importação | ✅ | Nenhum | |
| Sincronização | ✅ | Nenhum | |
| Configurações | ✅ | Nenhum | |
| Perfil | ✅ | Nenhum | |
| Guia do Criador | ✅ | Nenhum | |
| Suporte | ✅ | Nenhum | Página pública, sem sidebar (esperado) |
| Termos / Privacidade / Cobrança | ✅ | Nenhum | Testadas via link do rodapé do Suporte |

**Resultado: 0 páginas quebradas, 0 erros de console em toda a varredura de navegação.**

## 4. QA mobile (Etapa 5)

Testado com sweep automatizado (clique + verificação de `scrollWidth` vs largura do viewport + erros de console) nas larguras 375, 390, 430 e 768px, em 7-12 páginas por largura (Painel Geral, Modo Curral, Sincronização, Lotes, Pesagens, Financeiro, Resultados, Suplementação, Simulador, Importação, Sanidade, Fazendas).

- **Antes da correção:** overlap visual do cabeçalho em todas as larguras ≤768px (ver seção 1.3).
- **Depois da correção:** nenhum overflow horizontal, nenhum erro de console, cabeçalho com altura estável (~46px de ações + altura fixa do header) em todas as larguras testadas.
- Capturado screenshot de antes/depois em 375px confirmando visualmente a correção.

## 5. QA de persistência (Etapa 6, parcial)

Confirmado por reload completo da página (não apenas troca de aba/estado em memória): a fazenda "Fazenda QA Sprint 34" e seu lote continuam visíveis após reload total do navegador, tanto em dev quanto na build de produção — confirma que a leitura do Supabase no boot do app funciona corretamente para dados já existentes.

Não foram criados novos registros de teste para verificar escrita+persistência+reload de cada módulo individualmente (fazenda, pasto, lote, pesagem, despesa, etc.) nesta sprint, para evitar poluir a conta de produção da usuária sem necessidade — recomenda-se um ambiente de teste dedicado (branch Supabase ou projeto separado) para essa verificação mais profunda.

## 6. Testes automatizados

- `npm test` → **625/625 passando**, 0 falhas.
- `npm run lint` → limpo, 0 problemas.
- `npm run build` → build de produção concluído com sucesso.
- Adicionados a `e2e/smoke.spec.js` (Playwright, condicionados a credenciais de ambiente via `test.skip`, mesmo padrão dos testes existentes):
  - `Modo Curral: Ver pendências navega para Sincronização sem erro`
  - `Suporte abre sem erro a partir do menu Ajuda`
  - `mobile: cabeçalho não sobrepõe a marca em telas estreitas`

## 7. Severidade dos achados

| Achado | Severidade | Status |
|---|---|---|
| Cabeçalho mobile sobreposto (≤768px) | **Alto** (afeta toda navegação mobile, recorrência de bug já visto na Sprint 35) | ✅ Corrigido |
| "Ver pendências" causando queda no Modo Curral | — | Não reproduzido nesta sessão |
| Suporte causando queda | — | Não reproduzido nesta sessão |
| Falta de auditoria botão a botão completa | Informativo | Pendência de escopo, não bug |

## 8. Recomendação

Não recomendo prosseguir direto para auditoria de cibersegurança/landing/piloto sem fechar o ciclo dos dois bugs originais com a usuária: como não reproduziram aqui, o próximo passo eficiente é confirmar com ela se o problema persiste no ambiente publicado (Vercel) — se sim, é provável mismatch de deploy; se não, os dois bugs podem ter sido resolvidos por este fix de cabeçalho (cliques em mobile com o cabeçalho sobreposto podem ter acertado elementos errados, parecendo "queda" do app) ou por uma correção anterior já mesclada. Ver detalhes da investigação em [SPRINT_37_RESULTADO.md](SPRINT_37_RESULTADO.md).
