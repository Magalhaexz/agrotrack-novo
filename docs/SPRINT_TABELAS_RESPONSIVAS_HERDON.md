# Sprint Visual 5 — Tabelas Densas e Responsividade — HERDON

**Data:** 2026-08-12
**Branch:** `design/responsive-dense-tables` (a partir de `design/kpi-empty-state-hierarchy` — Sprints 1–4 ainda não mergeadas em `main`, ver nota abaixo)
**Escopo:** leitura/uso de tabelas densas, principalmente em 1366×768 e mobile. Foco: Resultados/Panorama por lote; tabelas com 10+ colunas; scroll horizontal pouco evidente.

**Nota de base e cadeia de branches:** confirmado que nenhuma das Sprints 1–4 está em `main` (PRs abertos). Mantida a cadeia empilhada:
`design/responsive-dense-tables` → `design/kpi-empty-state-hierarchy` → `design/cta-action-hierarchy` → `design/typography-scale-hierarchy` → `design/typography-visual-audit` → `origin/main`.

---

## 1. Inventário

Medido ao vivo (sessão logada, 1366×768, `wrap.clientWidth` real = 889–904px conforme a tela — a área de conteúdo é mais estreita que o viewport por causa de sidebar + padding) ou verificado por código quando a conta de teste não tinha dado suficiente para renderizar a tabela.

| Página | Tabela | Colunas | Largura tabela | Largura container | Overflow? | Ação por linha | Coluna fixa | Como foi medido |
|---|---|---:|---:|---:|---|---|---|---|
| Resultados | Panorama por lote | 13 | 1487px | 889px | Sim (598px) | não | não (antes) | ao vivo |
| Financeiro | Resultado por lote | 10–11 | 1099px | 889px | Sim (210px) | 1 botão | não | ao vivo |
| Nutrição/Suplementação | Produtos nutricionais | 9 | 1127px | 904px | Sim (223px) | 1 botão | não | ao vivo |
| Financeiro | Lançamentos | 7–8 | — | — | não testável (0 registros na conta de teste) | ícones | não | código |
| Financeiro | Pagamentos | 7 | — | — | não testável (0 registros) | 1 botão | não | código |
| Animais | Grupos/Individuais | 7 | — | — | não testável (0 registros) | ícones | não | código |
| Estoque | Histórico de movimentações | 6 | — | — | vazio (0 itens) | — | não | código + ao vivo |
| Painel Gerencial | Cenários simulados | 5 | — | — | vazio (0 cenários) | — | não | código + ao vivo |
| Sanidade | Registros sanitários | 9–10 | — | — | vazio (0 manejos) — já tocada na Sprint 4 (progressive disclosure, não tabela) | 2 botões | não | ao vivo |
| Pesagens | Histórico | — | — | — | **não é tabela** — lista de linhas (`.pesagem-row`) | ícones | n/a | código |
| Relatórios (hub) | — | — | — | — | **sem tabela** — grade de cards | — | n/a | ao vivo |
| Equipe/Funcionários/Fazendas | — | — | — | — | **sem tabela** — listas de cards | — | n/a | código |
| Comparativo de Lotes | via `Table.jsx` | variável | — | — | vazio (só 1 lote na conta) | — | não | ao vivo |

**Prioridade de colunas** (classificação pedida na seção 6 do brief), usando o Panorama por lote como referência — a tabela mais densa:

- **Essencial:** Lote (identificação da linha).
- **Importante:** Animais, GMD, Peso médio, Margem, Status, Decisão de venda — os números que respondem "esse lote está indo bem?".
- **Complementar:** Fazenda (irrelevante no modo 1 fazenda), Receita, Custos, Custo/@ carcaça, Lucro/cabeça, Lucro/@ carcaça — detalhamento financeiro, consultado depois do essencial/importante.

No desktop nenhuma coluna foi escondida (conforme pedido) — só a primeira (essencial) ficou fixa durante o scroll.

## 2. Diagnóstico

Confirmado com precisão o que a Sprint 1 já havia apontado: Resultados/Panorama por lote tem 13 colunas e estoura a largura útil em notebook — mas a medição correta contra o container real (889px, não os 1366px do viewport) mostra um overflow ainda maior do que documentado antes (598px, não ~140px). O scroll em si já funcionava (`overflow-x: auto` num wrap dedicado, sem vazar pro `body`) — o que faltava era: (1) nenhum sinal visual de que há mais colunas à direita, e (2) nenhuma coluna fixa para não perder a referência de qual lote está sendo lido ao rolar.

O mesmo padrão de "scroll funciona, mas invisível" apareceu em mais duas tabelas de 9–11 colunas (Financeiro "Resultado por lote" e Nutrição "Produtos nutricionais") — ambas usando o padrão mais antigo `.table-responsive`/`.data-table` (não o componente `Table.jsx` que Resultados usa).

## 3. Estratégia de Resultados

Confirmado: scroll horizontal bem resolvido, não compressão de texto. Implementado em `src/components/ui/Table.jsx` (componente já usado por Resultados e Comparativo):

- **Fade lateral** (`.ui-table-fade`): aparece só quando há overflow real medido via JS (`scrollWidth`/`scrollLeft`/`clientWidth`, ver `src/hooks/useScrollEdges.js`), some sozinho ao chegar no início/fim do scroll.
- **Primeira coluna fixa** ("Lote"): `position: sticky; left: 0` em `th`/`td:first-child`, só quando a tabela usa `mobileMode="scroll"` (ver seção 5) — não foi aplicado a outras colunas, conforme pedido ("não congele muitas colunas").
- **Cabeçalho sticky vertical**: já existia (`​.ui-table thead th { position: sticky; top: 0 }`), mantido sem alteração.
- **Números alinhados à direita com `font-mono`**: já existia no sistema (`.is-number`, `--font-mono`) — confirmado, não duplicado.

## 4. Estratégia mobile

Para Resultados especificamente, a tabela **não** vira cards no mobile (diferente do padrão default de `Table.jsx`) — um novo prop `mobileMode="scroll"` mantém a tabela real com rolagem horizontal também em telas pequenas, porque cards quebrariam a comparação lado a lado entre lotes (pedida explicitamente na seção 7 do brief). Um texto discreto "Deslize para o lado para ver mais colunas →" aparece só no mobile e só quando ainda há conteúdo pra rolar à direita.

As outras tabelas que consomem `Table.jsx` (ex.: Comparativo de Lotes) mantiveram o comportamento padrão de cards no mobile — não foi alterado.

## 5. Comportamento de scroll

Indicador implementado como fade de opacidade (gradiente para a cor de fundo do card, `#12181b`), não como cor isolada — funciona também para quem não distingue cor (seção 18). Medido via `scroll`/`resize` listeners reais, não CSS especulativo. Reaproveitado em 3 lugares:

1. `Table.jsx` (Resultados, Comparativo) — direto, já tinha o wrap.
2. `TableScrollFade.jsx` (novo, `src/components/ui/TableScrollFade.jsx`) — envolve um `.table-responsive` já existente sem tocar no conteúdo interno da tabela. Usado em Financeiro ("Resultado por lote") e Nutrição ("Produtos nutricionais").

## 6. Sticky adotado ou rejeitado

- **Adotado:** primeira coluna ("Lote") só em Resultados/Panorama por lote — é a única tabela desta sprint com `mobileMode="scroll"` e overflow grande o bastante (598px) para perder a referência de linha ser um problema real.
- **Rejeitado:** sticky em Financeiro/Nutrição — overflow menor (210px/223px, ~2 colunas) e ambas continuam virando cards no mobile (onde sticky não se aplica); no desktop, 2 colunas de scroll não chegam a perder a referência da linha. Adicionar sticky ali seria complexidade sem necessidade comprovada — a instrução explícita foi "não congele muitas colunas" e "sticky se realmente ajudar".
- **Rejeitado:** sticky em qualquer coluna além da primeira, em qualquer tabela — não houve evidência de necessidade.

## 7. Tabelas alteradas

| Arquivo | Mudança |
|---|---|
| `src/components/ui/Table.jsx` | fade lateral (via `useScrollEdges`); novo prop `mobileMode` (`'cards'` padrão, `'scroll'` opcional); sticky na 1ª coluna e dica de scroll só quando `mobileMode="scroll"`. |
| `src/pages/ResultadosPage.jsx` | tabela "Panorama por lote" passa `mobileMode: 'scroll'` na config. |
| `src/pages/FinanceiroPage.jsx` | tabela "Resultado por lote" envolvida em `TableScrollFade`. |
| `src/pages/SuplementacaoPage.jsx` | tabela "Produtos nutricionais" envolvida em `TableScrollFade`. |
| `src/styles/ui.css` | `.ui-table-outer`/`.ui-table-fade`/`.can-scroll-left`/`.can-scroll-right` (fade compartilhado); `.ui-table-wrap--force-scroll` (mantém tabela real no mobile + sticky da 1ª coluna); `.ui-table-scroll-hint` (dica mobile). |
| `src/hooks/useScrollEdges.js` (novo) | hook compartilhado que mede overflow real de um container de scroll. |
| `src/components/ui/TableScrollFade.jsx` (novo) | wrapper reutilizável do fade para tabelas que não usam `Table.jsx`. |

## 8. Tabelas mantidas sem mudança

- **Financeiro — Lançamentos/Pagamentos, Animais, Estoque, Painel Gerencial (Cenários), Sanidade:** sem dado suficiente na conta de teste para confirmar overflow real; código mostra 5–8 colunas (abaixo do padrão de 9+ que gerou problema confirmado nas 3 tabelas alteradas). Não alteradas — sem evidência de "problema real", conforme pedido explícito de não mexer no que já funciona.
- **Pesagens:** não é uma tabela (lista de linhas em cards) — fora de escopo.
- **Relatórios (hub), Equipe, Funcionários, Fazendas:** sem tabela (grades/listas de cards) — fora de escopo.
- **Comparativo de Lotes:** usa `Table.jsx` sem `mobileMode` — herda o novo fade automaticamente, sem nenhuma mudança de código; comportamento mobile (cards) preservado.

**Total:** 13 tabelas/telas inventariadas, 3 alteradas (Resultados, Financeiro "Por lote", Nutrição "Produtos"), 1 beneficiada automaticamente sem mudança de código (Comparativo, via `Table.jsx`), 9 mantidas sem alteração por não apresentarem problema confirmado ou não serem tabelas.

## 9. Comparação antes/depois

| Página | Colunas | Largura antes | Estratégia antes | Estratégia depois |
|---|---:|---:|---|---|
| Resultados | 13 | ~1487px vs 889px de container | scroll funcional, sem indicador, sem coluna fixa | scroll + fade lateral + 1ª coluna fixa + tabela real no mobile (não card) |
| Financeiro — Por lote | 10–11 | ~1099px vs 889px | scroll funcional, sem indicador | scroll + fade lateral (sem sticky — overflow menor) |
| Nutrição — Produtos | 9 | ~1127px vs 904px | scroll funcional, sem indicador | scroll + fade lateral |

- Tabelas auditadas: 13.
- Tabelas realmente alteradas: 3.
- Tabelas beneficiadas sem alteração de código: 1 (Comparativo, via componente compartilhado).
- Tabelas mantidas sem mudança: 9, com razão registrada seção 8.

## 10. Acessibilidade

- As 3 tabelas continuam `<table>`/`<th>`/`<td>` semânticos — nada convertido para `<div>`.
- `scope` não estava presente antes e não foi adicionado (fora do escopo desta sprint — nenhuma tabela usava `scope`, mudar isso é uma limpeza de acessibilidade maior, não uma mudança de densidade/responsividade; registrado como pendência).
- Fade lateral e dica de scroll são puramente visuais (`aria-hidden="true"` nos `<span>` de fade) — não interferem em leitor de tela nem em navegação por teclado.
- Sticky da 1ª coluna não cobre foco: só a coluna 1 fica fixa, o restante da tabela rola normalmente por trás; nenhum controle interativo fica atrás da coluna fixa.
- Indicador de scroll não depende só de cor — é um gradiente de opacidade sobre o fundo do card, funciona em qualquer configuração de contraste/daltonismo; a versão mobile ainda soma um texto explícito.
- Touch scrolling: `-webkit-overflow-scrolling: touch` já existia no `.ui-table-wrap` (Sprint anterior), mantido.

## 11. Pendências

- `scope="col"` nos `<th>` das 3 tabelas alteradas (e das demais) — não implementado, é uma limpeza de acessibilidade separada da densidade/responsividade que esta sprint cobre.
- Financeiro (Lançamentos/Pagamentos) e Animais não puderam ser confirmados com dado real — recomendo reavaliar quando houver conta de teste com histórico populado.
- O fade lateral (`TableScrollFade`) ainda não foi aplicado a nenhuma tabela de `.table-responsive` fora das 2 identificadas como problemáticas — é reutilizável para qualquer tabela futura que precisar, sem trabalho extra de CSS.
- `scope`/`aria-sort` para colunas ordenáveis não foi avaliado — nenhuma das tabelas alteradas tem ordenação por coluna hoje.

---

## Fechamento

**Arquivos alterados:** `src/components/ui/Table.jsx`, `src/pages/ResultadosPage.jsx`, `src/pages/FinanceiroPage.jsx`, `src/pages/SuplementacaoPage.jsx`, `src/styles/ui.css` + novos `src/hooks/useScrollEdges.js`, `src/components/ui/TableScrollFade.jsx` + `docs/SPRINT_TABELAS_RESPONSIVAS_HERDON.md`.

**Tabelas auditadas:** 13 (contando telas sem tabela, confirmadas como tal).
**Tabelas alteradas:** 3 diretamente (Resultados, Financeiro "Por lote", Nutrição "Produtos") + 1 beneficiada sem mudança (Comparativo).

**Estratégia em Resultados:** scroll horizontal com fade lateral + 1ª coluna ("Lote") fixa + mobile mantém tabela real (não card) para preservar comparação entre lotes.

**Largura antes/depois:** tabela continua 1487px (nenhuma coluna removida ou comprimida) — o que mudou foi o container ganhar fade + coluna de referência fixa, não a largura da tabela em si.

**1366×768:** `body` sem overflow horizontal, só o container da tabela rola; header permanece legível (sticky vertical já existia); nenhuma célula sobreposta; nenhum dado escondido.

**Mobile:** Resultados mantém tabela real com scroll (não cards) nos 4 tamanhos testados (320×568, 360×800, 390×844, 412×915); dica "Deslize para o lado" visível quando há mais conteúdo à direita.

**Sticky:** adotado só na 1ª coluna de Resultados; rejeitado nas outras 2 tabelas alteradas (overflow menor, não comprovadamente necessário) e em qualquer coluna além da primeira.

**Indicador de scroll:** fade de opacidade medido via JS (`useScrollEdges`), reutilizado em 3 lugares via 2 componentes (`Table.jsx` direto, `TableScrollFade` para tabelas fora do componente compartilhado).

**Lint:** limpo. **Testes:** 1859/1859 passando. **Build:** ok (`vite build`, sem erros).
