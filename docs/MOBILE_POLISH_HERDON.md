# Polimento Mobile Estrutural (Sprint 29)

## Método

Sem credenciais de conta autenticada (limitação recorrente desde a Sprint 22), a investigação foi feita por:
1. Leitura profunda do CSS real (`src/styles/app.css` ~9.000 linhas, `src/styles/layout.css`, `src/styles/ui.css`) e dos componentes (`AppHeader.jsx`, `MobileBottomNav.jsx`, `Modal.jsx`, `App.jsx`).
2. Reconstrução da árvore DOM real (mesmas classes, mesma estrutura de aninhamento) na tela de Login — a única acessível sem login — para medir com `getComputedStyle`/`getBoundingClientRect` como o CSS real se comporta em 390px e 1280px, sem precisar estar autenticado.

Esse segundo passo foi o que permitiu confirmar o bug real (abaixo) com evidência numérica, não só leitura de código.

## Achado principal: o "Menu Mais opções" reportado nos prints **não é** o painel do `AppHeader`

Existem **dois menus mobile diferentes** no HERDON:

1. `.mobile-header-panel` (dentro de `AppHeader.jsx`, botão "⋯" no canto do header) — mostra fazenda ativa / aba / conta.
2. **O modal "Mais opções"** (`src/App.jsx`, `<Modal title="Mais opções">`, aberto pelo botão "Mais" da `MobileBottomNav`) — mostra **todos os módulos do menu lateral**. Este é o menu dos prints do usuário.

## Causa raiz confirmada (com medição, não suposição)

`src/styles/layout.css`, regras `.app-shell .ui-modal-overlay` e `.app-shell .ui-modal` (e as variantes `--sidebar-collapsed`), **sem media query**, reservavam espaço para a sidebar fixa do desktop subtraindo a largura dela de qualquer modal:

```css
.app-shell .ui-modal-overlay {
  padding-left: calc(var(--layout-sidebar-width) + var(--layout-page-padding-inline)); /* ~292px */
}
.app-shell .ui-modal {
  max-width: calc(100vw - var(--layout-sidebar-width) - (var(--layout-page-padding-inline) * 2));
}
```

No mobile, a sidebar é um *drawer* fora da tela (`transform: translateX(...)`), não ocupa espaço fixo — mas como essas regras não tinham media query, elas continuavam ativas em qualquer largura de tela. Medido em 390px: **o modal ficava limitado a ~78px de largura**, colado na borda direita (`padding-left` de ~292px num viewport de 390px). Isso é exatamente "menu cortado na lateral" — só que o "corte" é o próprio modal sendo espremido pelo CSS, não um problema de overflow ou z-index.

**Confirmado por medição antes/depois:**

| | Antes (390px) | Depois (390px) | Desktop (1280px) |
|---|---|---|---|
| `padding-left` do overlay | ~292px | 8px | ~300px (preservado) |
| Largura do modal | 78px | 368px | ~937px (preservado) |

Como `ConfirmModal` e todos os formulários do app (Fazenda, Pasto, Lote, Pesagem, movimentação de pasto, etc.) usam o mesmo componente `Modal.jsx`/classes `.ui-modal*`, **essa única correção melhora todos os modais do app no mobile**, não só o menu "Mais opções".

**Correção:** as 4 regras (`.app-shell .ui-modal-overlay`, `.app-shell .ui-modal`, e as duas variantes `--sidebar-collapsed`) foram envolvidas em `@media (min-width: 901px)` — passam a só reservar espaço da sidebar quando ela de fato ocupa espaço fixo na tela.

## Etapa 2 — Header mobile

### Problema confirmado: indicador de conexão competindo por espaço

`ConnectionIndicator` renderizava texto completo ("Conectado", ou frases longas como "Sem internet. Os registros serão salvos neste aparelho e sincronizados quando a conexão voltar.") dentro de uma pílula de até 160px, ao lado de 3 outros botões (sincronizar, notificações, "⋯") e da marca HERDON — sem espaço suficiente em telas de 390px.

**Correção:** no mobile (`≤900px`), o indicador colapsa para um círculo de 32×32px (só o ponto colorido), com o texto movido para um `<span>` interno (`connection-indicator__label`) visualmente oculto mas mantido para leitores de tela (`role="status"` preservado). Libera ~120-200px de espaço no header.

### Painel "⋯" do header (`.mobile-header-panel`) — portalizado por segurança estrutural

`.app-shell .header.top-header` aplica `backdrop-filter: blur(16px)` sem media query — isso cria um novo *containing block* para qualquer descendente `position: fixed`, fora do padrão (o dropdown de notificações já evitava esse problema usando `createPortal(..., document.body)`, mas o painel "⋯" não usava). Mesmo não tendo reproduzido um deslocamento horizontal grave neste painel especificamente (o header ocupa a largura toda no mobile, então a substituição do *containing block* não desloca o ponto de referência), a inconsistência era uma fragilidade real — Safari iOS é conhecido por tratar `backdrop-filter` + `position: fixed` de forma menos previsível que outros navegadores.

**Correção:** o painel "⋯" agora usa `createPortal(..., document.body)`, igual ao dropdown de notificações — elimina toda essa classe de risco. Também recebeu `overflow-x: hidden`, `box-sizing: border-box`, `env(safe-area-inset-right)` e proteção de `min-width`/`text-overflow` nos itens internos (fazenda, abas, conta) para nunca mais depender de cálculo de posição relativo a um ancestral potencialmente filtrado.

## Etapa 4 — Safe area

Auditado e já estava, em geral, bem coberto por sprints anteriores:
- Header: `top: env(safe-area-inset-top)`.
- Bottom nav: `padding-bottom: calc(10px + env(safe-area-inset-bottom))`.
- `.main`/`.page`: `padding-bottom` com a altura do bottom nav + safe area.
- FAB: posicionado acima do bottom nav com safe area.

Adicionado nesta sprint: `env(safe-area-inset-right)` no painel "⋯" (Etapa 2), relevante para iPhones em modo paisagem com cantos arredondados.

## Etapas 5-7 — Botões, cards, tabs

Auditados sem alteração nesta sprint (já endereçados em sprints anteriores ou de baixo risco/baixo retorno sem poder testar visualmente):
- `.action-row` (corrigido na Sprint 27) já garante espaçamento consistente de botões em formulários e barras de ação.
- `.mobile-nav-option` (cards dentro do modal "Mais opções") já tem padding/gap/ícone consistentes — não precisou de ajuste, só deixou de ficar visualmente espremido pelo bug do modal.
- `.segmented-control`/`.tab-bar`/`.header-tab` já têm tratamento mobile de sprints anteriores (scroll horizontal, largura 100% em telas pequenas).

**Não alterado por decisão de risco:** encontrada uma inconsistência menor em `.ui-modal-overlay` — uma regra mobile pede `align-items: flex-end` (estilo *bottom sheet*) mas uma regra posterior sem media query força `align-items: center`, então hoje os modais aparecem centralizados verticalmente no mobile, não como bottom sheet. Não é um bug "cortado", é só uma escolha visual diferente da sugerida pela sprint — documentado como pendência, não alterado sem poder confirmar visualmente o resultado.

## Etapa 8 — Páginas críticas

Como a correção do modal é global (`Modal.jsx`/`.ui-modal*`), **toda página com modal de cadastro** (Fazenda, Pasto, Lote, Pesagem, movimentação de pasto, lançamento financeiro) se beneficia automaticamente, sem precisar de ajuste individual por página. Não foram feitas alterações específicas de Dashboard/Financeiro/Pastos/Lotes/Pesagens/Sincronização/Relatórios além dessa correção estrutural compartilhada — não há evidência de bug adicional *crítico* nessas páginas que eu pudesse confirmar sem acesso autenticado, e o risco de "polir no escuro" sem visual real supera o benefício.

## Etapa 9 — Desktop

Confirmado por medição (1280px): `padding-left`/`max-width` da sidebar no modal permanecem exatamente como antes (~300px / ~937px) — nenhuma regressão de desktop.

## Arquivos alterados

| Arquivo | O que mudou |
|---|---|
| `src/styles/layout.css` | `.app-shell .ui-modal-overlay`/`.ui-modal` (e variantes `--sidebar-collapsed`) restritos a `@media (min-width: 901px)` |
| `src/styles/app.css` | Indicador de conexão compacto no mobile (`.connection-indicator__label`); `.mobile-header-panel` com `overflow-x: hidden`, safe-area-right, proteção de overflow nos itens internos |
| `src/components/AppHeader.jsx` | Painel "⋯" portalizado via `createPortal(..., document.body)` |
| `src/components/ConnectionIndicator.jsx` | Texto envolvido em `<span className="connection-indicator__label">` |

## Pendências para Sprint 30

- Verificação visual real com conta autenticada (pendência recorrente desde a Sprint 22) — esta sprint corrigiu o bug com maior confiança até agora porque foi *medido*, não só lido, mas a confirmação visual definitiva continua pendente.
- Decidir se os modais mobile devem virar bottom sheet (`align-items: flex-end`) de fato — hoje aparecem centralizados por uma regra posterior sobrepor a regra de bottom-sheet já escrita.
- Consolidação geral dos breakpoints/regras duplicadas de `app.css` (pendência desde a Sprint 27) — `header.top-header`, `.ui-modal-overlay` e `.mobile-fab` têm, cada um, 5-10+ definições espalhadas pelo arquivo.
- Revisão de tabs/segmented controls específicos por página (DRE/Por Lote, abas do lote) com visual real.
