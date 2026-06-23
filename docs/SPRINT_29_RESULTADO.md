# Sprint 29 — Resultado

## Funcionalidade entregue

**Polimento Mobile Estrutural Real**

Identificado e corrigido, com **medição concreta** (não só leitura de código), o bug estrutural real por trás do "Menu Mais opções cortado" reportado nos prints: regras CSS de `app-shell` reservavam espaço de sidebar fixa em qualquer modal do app, sem media query — no mobile isso espremia o modal a ~78px de largura. Como a correção foi na camada compartilhada (`Modal.jsx`/`.ui-modal*`), ela beneficia **todos os modais do app**, não só o menu.

---

## 1. O que foi corrigido no header mobile

- **Indicador de conexão compacto**: no mobile, "Conectado"/mensagens de status longas agora colapsam para um círculo de 32×32px (só o ponto colorido), liberando espaço para a marca HERDON e os botões de ação no header de 390px. Texto completo preservado para leitores de tela.
- **Painel "⋯" (fazenda ativa/aba/conta) portalizado**: passou a usar `createPortal(..., document.body)`, igual ao dropdown de notificações já fazia — elimina o risco de o `backdrop-filter` do header (que cria um novo *containing block* para `position: fixed`) deslocar ou cortar o painel, especialmente em Safari iOS.

## 2. O que foi corrigido no menu "Mais"

**Descoberta importante:** o menu "Mais opções" dos prints é um `Modal` diferente do painel "⋯" do header — é aberto pelo botão "Mais" do menu inferior (`MobileBottomNav`) e mostra todos os módulos do app. A causa raiz: `src/styles/layout.css` tinha 4 regras (`.app-shell .ui-modal-overlay`, `.app-shell .ui-modal`, e as variantes `--sidebar-collapsed`) que subtraíam a largura da sidebar de **qualquer modal**, sem media query — herança de uma regra pensada só para desktop. Medido em 390px: modal limitado a ~78px de largura antes da correção, ~368px depois. Corrigido restringindo essas 4 regras a `@media (min-width: 901px)`.

## 3. O que foi corrigido na safe area

- Adicionado `env(safe-area-inset-right)` ao painel "⋯" do header (relevante em paisagem com cantos arredondados).
- Demais coberturas de safe area (header `top`, bottom nav `bottom`, `.main`/FAB `padding-bottom`) já estavam corretas de sprints anteriores — confirmado por auditoria, sem necessidade de alteração.

## 4. Páginas críticas polidas

Nenhuma página individual precisou de ajuste específico nesta sprint — a correção do modal é compartilhada por `Modal.jsx`, então **toda página com formulário modal** (Fazendas, Pastos, Lotes, Pesagens, movimentação de pasto, lançamentos financeiros) já se beneficia automaticamente. Páginas sem modal (Guia do Criador, Relatórios) não tinham o bug e não precisaram de mudança.

## 5. Resultado do teste visual

Testado com medição real (`getComputedStyle`/`getBoundingClientRect`) em 390px e 1280px, reconstruindo a árvore DOM real na tela de Login (acessível sem login). Confirmado numericamente que o bug existia e que a correção funciona, e que o desktop não regrediu. Verificação visual completa com conta autenticada continua pendente — ver `docs/MOBILE_POLISH_TESTE_MANUAL.md`.

---

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `src/styles/layout.css` | 4 regras de `.ui-modal-overlay`/`.ui-modal` restritas a desktop (`@media (min-width: 901px)`) |
| `src/styles/app.css` | Indicador de conexão compacto no mobile; `.mobile-header-panel` com `overflow-x: hidden`, safe-area-right, proteção de overflow interno |
| `src/components/AppHeader.jsx` | Painel "⋯" portalizado |
| `src/components/ConnectionIndicator.jsx` | Texto envolvido em span dedicado para poder ser ocultado visualmente no mobile sem perder acessibilidade |
| `docs/UI_UX_HERDON.md` | Atualizado com o achado e a correção |
| `docs/BETA_PILOTO_READY_HERDON.md` | Addendum Sprint 29 |

## Arquivos novos

| Arquivo | Descrição |
|---|---|
| `docs/MOBILE_POLISH_HERDON.md` | Diagnóstico completo, causa raiz medida, correções, pendências |
| `docs/MOBILE_POLISH_TESTE_MANUAL.md` | Roteiro de teste manual com medições antes/depois |
| `docs/SPRINT_29_RESULTADO.md` | Este documento |

## Decisão técnica: por que medir em vez de só ler código

Sprints anteriores (27, 28) já tinham auditado CSS por leitura e encontrado inconsistências reais (`.action-row` sem `display:flex`, breakpoints duplicados). Para esta sprint, em vez de presumir a causa pela leitura, reconstruí a árvore DOM real (mesmas classes CSS) na tela de Login — que não exige login — e medi com `getComputedStyle`/`getBoundingClientRect`. Isso permitiu confirmar a causa raiz com números concretos (78px → 368px) em vez de uma hipótese plausível mas não verificada. Essa técnica fica registrada como método replicável para futuras sprints de polimento sem acesso a conta autenticada.

## Limitações conhecidas

- Não foi possível testar nenhuma tela autenticada visualmente.
- Modais mobile aparecem centralizados verticalmente, não como bottom sheet — uma regra de bottom-sheet já escrita é sobreposta por uma regra posterior sem media query. Não alterado nesta sprint (escolha visual, não bug de corte).

## Pendências para Sprint 30

- Verificação visual real com conta autenticada (pendência desde a Sprint 22).
- Decidir se modais mobile devem virar bottom sheet de fato.
- Consolidar regras duplicadas de `.header.top-header`, `.ui-modal-overlay` e `.mobile-fab` em `app.css` (cada uma com 5-10+ definições espalhadas).
- Revisão de tabs/segmented controls específicos por página com visual real.

## Resultado dos gates

| Gate | Resultado |
|---|---|
| `npm test` | 534 testes, 0 falhas (inalterado — sem lógica de domínio nova) |
| `npm run lint` | 0 erros |
| `npm run build` | Build de produção concluído com sucesso |
