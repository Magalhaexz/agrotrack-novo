# Sprint Visual 2 — Escala Tipográfica, Pesos e Hierarquia — HERDON

**Data:** 2026-08-12
**Branch:** `design/typography-scale-hierarchy` (a partir de `design/typography-visual-audit`, que ainda não foi mergeado em `main` — ver nota abaixo)
**Escopo:** padronizar tamanhos, pesos, line-height e letter-spacing em componentes globais, layout compartilhado e 8 telas prioritárias. Sem redesign, sem mudança de fluxo, sem mudança de família tipográfica (Inter/IBM Plex Mono seguem como definido em `docs/AUDITORIA_VISUAL_LAYOUT_HERDON.md`).

**Nota de base:** a instrução pedia branch a partir de `origin/main` atualizado, assumindo que a Sprint 1 (`design/typography-visual-audit`) já estivesse mergeada. Como o PR ainda está aberto, criar a partir de `origin/main` teria descartado toda a consolidação de fonte da Sprint 1 e o próprio `docs/AUDITORIA_VISUAL_LAYOUT_HERDON.md` que esta sprint pede para ler seguiria inexistente. O branch foi criado a partir de `design/typography-visual-audit` em vez disso.

---

## 1. Sistema anterior

Herdado da Sprint 1: família única Inter (corpo/título) + IBM Plex Mono (números). O que não tinha sido tocado ainda:

- **Escala de tamanho:** `tokens.css` já definia `--text-xs` a `--text-3xl` (7 tokens), mas quase ninguém usava — só 12 ocorrências de `var(--text-` em todo `app.css`, contra ~200 declarações de `font-size` com valor solto. `app.css` tinha **47 valores distintos** de `font-size`, muitos a 0.01–0.02rem de diferença (`0.72rem`/`0.73rem`/`0.74rem`/`0.75rem`/`0.76rem` todos coexistindo).
- **Pesos:** `app.css` tinha 53 ocorrências de `font-weight: 700` e 16 de `800`, muitas em labels/badges uppercase pequenos que não precisavam de tanto peso.
- **Hierarquia quebrada:** h2 de seção (17.28px/700) e h3 de card (16.8px/700) do Painel Geral eram quase indistinguíveis — mesmo peso, menos de 1px de diferença de tamanho.
- **Tokens duplicados/mortos:** três `:root` diferentes definiam `--text-*` com valores levemente diferentes (`tokens.css` oficial, `app.css` com `--text-base: 0.95rem` etc., e `index.css` replicando os valores oficiais só para serem sempre sobrescritos pela cascata). Fonte real de verdade sempre foi `tokens.css`; os outros dois eram ruído.

## 2. Escala definida

Adicionado **1 token novo** (`--text-2xs`) e reaproveitados os 7 que já existiam em `tokens.css` — 8 no total, dentro do limite pedido:

| Token | Valor | Papel |
|---|---|---|
| `--text-2xs` | 0.6875rem (11px) | micro-label, badge, dot, eyebrow em caixa alta |
| `--text-xs` | 0.75rem (12px) | label, badge, caption, tabela (cabeçalho) |
| `--text-sm` | 0.875rem (14px) | texto secundário, tabela (célula), subtítulo |
| `--text-base` | 1rem (16px) | corpo, valor de card |
| `--text-lg` | 1.125rem (18px) | subtítulo de seção, H2 |
| `--text-xl` | 1.25rem (20px) | reservado — sem uso direto ainda |
| `--text-2xl` | 1.5rem (24px) | título de destaque |
| `--text-3xl` | 1.875rem (30px) | H1 grande / hero KPI |

Os 47 valores soltos de `app.css` foram mapeados para o token mais próximo (por distância absoluta ao valor original); onde dois valores empatavam (ex.: `0.8rem` entre `--text-xs` e `--text-sm`), a escolha seguiu o papel predominante do maior grupo de usos, não um cálculo cego. Diferenças de até ~1px entre o valor antigo e o token foram aceitas deliberadamente — é exatamente a consolidação que a sprint pediu (`0.72/0.73/0.74/0.75/0.76rem` → todos `--text-xs`).

## 3. Mapa semântico aplicado

| Papel | Tamanho | Peso |
|---|---|---|
| H1 (página) | `--text-3xl`/clamp equivalente | 600 |
| H2 (seção) | `--text-lg` | 600 |
| H3 / card title | `--text-base` | 600 |
| Subtítulo de página | `--text-sm` | 400 |
| Label / badge / caption uppercase | `--text-2xs`/`--text-xs` | 600 |
| Texto secundário (`small`) | conforme contexto | 500 |
| KPI — label | `--text-xs` | 600 |
| KPI — valor | `--text-base`…`--text-3xl` (clamp) | 600–700 (só o valor, nunca o card inteiro) |
| KPI — comparação/variação | `--text-xs` | 500 |
| Botão | — | 600 |
| Input / label de formulário | `--text-sm` | 500 |
| Tabela — cabeçalho | `--text-2xs`/`--text-xs` | 600 |
| Tabela — célula | `--text-sm` | 400 (herdado) |

## 4. Pesos definidos

Regra aplicada (seção 5 do brief): 400 corpo, 500 labels/leves, 600 títulos/ações, 700 só destaque real, 800 evitado. Nenhuma substituição cega — cada um dos 69 pontos de `font-weight: 700/800` de `app.css` foi lido em contexto (seletor + papel) e classificado individualmente antes de decidir o novo valor. Exceções mantidas em 700 (10 pontos, todas com justificativa funcional):

- **Valor numérico real** — `.fazenda-stat-value`, `.metric-tile__value`, `.kpi-value`/`.kpi-val`/`.animais-kpi-value`, `.estoque-card-quantidade`, `.lote-history-item`/`.dashboard-list-copy p` (padrão invertido documentado no próprio CSS onde `p` é o valor, não `strong`) — destaque forte é o próprio propósito do elemento.
- **Wordmark/marca** — `.sidebar-logo-text`/`.sidebar-logo-icon`, `.header-brand-copy strong`, `.header-sync-copy strong`, `.relatorio-lote-preview__marca` (letterhead do PDF exportado) — tratados como exceção de marca, não de texto de interface; ainda assim reduzidos de 800→700 onde estavam em 800.
- **Selo de impressão** — `.reports-page::before` (`@media print`, texto fixo "HERDON - Relatório") — fora do escopo de tela, não influencia a percepção de peso na UI normal, deixado como estava.

Todo o restante (labels, badges, títulos de card, nomes, chips, tags, botões, cabeçalhos de tabela, `kpi-panel-label`, `kpi-variation`) foi rebaixado — a maioria para 600, três seletores especificamente com tag `<small>` (`.header-farm-copy small`, `.header-user-copy small`, `.header-sync-copy small`) para 500 por já sinalizarem papel secundário na própria marcação HTML.

## 5. Componentes migrados

**Etapa A — globais:** `tokens.css` (token novo + comentário de papel), `index.css` (`.subtitle`, `.kpi-label`, `.kpi-value`, `.kpi-unit`, `.nav-link`, `.badge` — tokens + pesos; removida a redefinição morta de `--text-*` que só duplicava `tokens.css`), `ui.css` (`.ui-badge`, `.ui-table thead th`, `.ui-modal-head`, `.ui-button` peso 650→600, `.ui-input-label` 600→500, `.ui-card-title`, `.section-header h3/h4/p`).

**Etapa B — layout compartilhado:** `layout.css` (`.page-header h1`/`.ph h1` — ganhou `font-weight: 600` explícito, antes dependia do bold padrão do navegador; `.sidebar-section-title`, `.sidebar-farm-consolidada`, `.sidebar-farm-copy small/strong`, `.sidebar-group-toggle`, `.sidebar-flyout-title`, `.header-farm-item span/small`) e os blocos compartilhados de `app.css` (Header/Sidebar/Cards/Badges/Tables/Forms, linhas 1–1357 do arquivo).

**Etapa C — páginas prioritárias:** `dashboard.css` (Painel Geral — 33 `font-size` + 16 `font-weight` revisados), `rebanho.css` (Lotes/Animais/Pesagens — 38 `font-size` + 1 `font-weight`), `pastagens.css` (Pastos — 8 `font-size`), `perfil.css` (Perfil — 5 `font-size` + 1 `font-weight`), `relatorios.css` (Painel Gerencial/Relatórios — 14 `font-size` + 6 `font-weight`). Sanidade e Resultados vivem dentro do próprio `app.css` (sem arquivo dedicado — `.page--sanitario`/`.sanitario-*`, tabela "Panorama por lote") e já foram cobertos pela varredura completa desse arquivo. O modal "Novo Lote" (`LoteForm.jsx`) não tem CSS próprio — usa só classes compartilhadas de `ui.css` (`.section-card`, `.ui-input-label` etc.), já migradas na Etapa A.

## 6. Exceções mantidas

- `font-weight: 700` nos 10 pontos listados na seção 4 (valores numéricos reais e marca/wordmark).
- `clamp(...)` em `font-size` (12 ocorrências em `app.css` + `.page-header h1`/`.metric-tile__value`) não foi tocado — são responsivos por design, e substituir um `clamp()` por um token fixo mudaria comportamento entre breakpoints, o que não é "consolidar valor duplicado".
- Arquivos fora da lista de telas prioritárias (`login.css`, `comparativo.css`, `alertas.css`, `configuracoes.css`, `tarefas.css`, `subscription.css`) ainda têm `font-weight: 700/800` sem revisão — ver pendências (seção 10).
- Itens explicitamente fora de escopo por instrução (seção 13 do brief): CTAs duplicados, formulário Novo Lote, tabela Resultados, Assinatura duplicada, sidebar estrutural, cards/shadows/border-radius, filtros, reorganização do Painel Gerencial — nada disso foi tocado.

## 7. Métricas antes/depois

Escopo: os 8 arquivos efetivamente tocados nesta sprint (`app.css`, `ui.css`, `layout.css`, `dashboard.css`, `rebanho.css`, `pastagens.css`, `perfil.css`, `relatorios.css`).

| Métrica | Antes | Depois |
|---|---|---|
| Valores distintos de `font-size` em `app.css` | 47 | 0 (só `var(--text-*)` e `clamp()`) |
| `font-weight: 700` (soma dos 8 arquivos) | 83 | 19 |
| `font-weight: 800` (soma dos 8 arquivos) | 18 | 0 |
| Usos de `var(--text-*)` (soma dos 8 arquivos) | 73 | 368 |

Não se buscou "zero valores hardcoded" artificialmente — os 19 `font-weight: 700` e os `clamp()` remanescentes são exceções deliberadas e documentadas (seção 6), não sobras esquecidas.

## 8. Telas avaliadas

Painel Geral, Lotes, Pastos, Sanidade, Resultados, Painel Gerencial, Perfil e o modal "Novo Lote" — as 8 telas com maior concentração de P1 na Sprint 1. Verificado ao vivo (sessão logada, `magalhaesh617@gmail.com`) em 1366×768 (foco principal) e checagem pontual em 390×844, 1024×768, 1440×900 e 1920×1080 na tela mais densa (Resultados, tabela de 13 colunas) — sem overflow de `body` em nenhuma resolução testada.

Antes/depois confirmado ao vivo no Painel Geral: h2 de seção ("Visão do rebanho") foi de 17.28px/700 para **18px/600**, h3 de card ("Pastos em uso") foi de 16.8px/700 para **16px/600** — agora claramente diferenciáveis por tamanho, sem depender de bold idêntico para os dois níveis.

## 9. Regressões encontradas

Nenhuma. `lint`, suíte de testes (1859/1859) e build de produção passaram sem alteração de comportamento. Verificação visual não encontrou overflow, corte de texto ou quebra de tabela/modal introduzidos pela mudança — a tabela de Resultados continua exigindo scroll horizontal em 1366×768 (1487px vs 1366px, era 1507px antes; comportamento inalterado, só ligeiramente mais estreita pelos tamanhos de fonte menores — a correção estrutural dessa tabela é pendência de outro sprint, não desta).

## 10. Pendências deixadas para outros sprints

- `font-weight: 700/800` não revisado em `login.css`, `comparativo.css`, `alertas.css`, `configuracoes.css`, `tarefas.css`, `subscription.css` (fora da lista de telas prioritárias desta sprint).
- `--text-xl` (1.25rem) definido mas sem consumidor direto ainda — nenhum valor do site mapeou para ele; token mantido para uso futuro, não removido (não é dead code, é gap de escala esperado).
- Todos os itens listados na seção 13 do brief (CTAs duplicados, formulário Novo Lote, tabela Resultados, Assinatura duplicada, sidebar estrutural, cards/shadows/border-radius, filtros, Painel Gerencial) — continuam exatamente como documentado na Sprint 1.
- PR da Sprint 1 (`design/typography-visual-audit`) ainda não foi mergeado em `main` — recomendo mergear antes de abrir o PR desta sprint, para não empilhar branches dependentes.

---

## Fechamento

**Arquivos alterados:** `src/styles/tokens.css`, `src/index.css`, `src/styles/ui.css`, `src/styles/layout.css`, `src/styles/app.css`, `src/styles/dashboard.css`, `src/styles/rebanho.css`, `src/styles/pastagens.css`, `src/styles/perfil.css`, `src/styles/relatorios.css` + novo `docs/SPRINT_TIPOGRAFIA_HIERARQUIA_HERDON.md`.

**Escala final:** 8 tokens (`--text-2xs` a `--text-3xl`), 1 novo.
**Pesos finais:** 400/500/600 como papel dominante; 700 restrito a 19 pontos justificados (valores numéricos e marca); 800 zerado nos arquivos tocados.
**Tamanhos distintos:** 47 → 0 valores soltos em `app.css`.
**700/800 (8 arquivos tocados):** 83/18 → 19/0.
**Diferença visual principal:** h2/h3 do Painel Geral agora se distinguem por tamanho (18px vs 16px) em vez de serem quase idênticos; badges/labels uppercase deixaram de usar bold 700/800 quase universal; H1 de página ganhou peso 600 explícito em vez de herdar bold 700 do navegador.

**Lint:** limpo. **Testes:** 1859/1859 passando. **Build:** ok (`vite build`, sem erros).
**Breakpoints testados:** 1024×768, 1366×768 (foco), 1440×900, 1920×1080, 390×844 — sem overflow introduzido.
