# Auditoria Visual e Tipográfica — HERDON

**Data:** 2026-08-12
**Branch:** `design/typography-visual-audit`
**Escopo:** (1) implementação de tipografia global; (2) auditoria visual completa, sem redesign.
**Método:** leitura de `src/styles/**` (22 arquivos CSS, ~20.9k linhas) + análise estática via grep/contagem; sessão real logada no app local (`http://localhost:5173`, conta de teste `magalhaesh617@gmail.com`, fazenda `yellowstone` com 1 lote encerrado e pouquíssimos dados) navegando 19 telas + 1 modal; inspeção via DOM (`get_page_text`, accessibility tree, `getComputedStyle`, medição de `scrollWidth`) em 1366×768 e checagem pontual em 390×844.
**Limitação de método:** o painel de navegador desta sessão não conseguiu compor screenshots (pane não exibido no cliente), então a auditoria não tem capturas de tela anexadas — os achados abaixo vêm de inspeção estrutural/DOM/CSS ao vivo, não de comparação pixel a pixel. Recomenda-se uma passada com screenshots reais (Playwright, já configurado em `scripts/run-e2e.mjs`) antes de fechar o próximo sprint visual. Existe também uma auditoria anterior, `docs/AUDITORIA_VISUAL_UX_HERDON.md` (2026-06-26), com achados de quebra crítica (C1-C3) já corrigidos — não duplicados aqui.

---

## 1. Diagnóstico geral

O HERDON já tinha uma base tipográfica melhor do que o comum: `tokens.css` definia oficialmente Inter (corpo/UI), Sora (títulos) e IBM Plex Mono (números), com pesos coerentes carregados via Google Fonts. O problema não era "fonte errada" — era **dispersão**: um segundo sistema tipográfico inteiro (Fraunces/DM Mono/Outfit) sobrevivia morto em `src/index.css`, e pelo menos 6 seletores em `app.css`/`relatorios.css`/`subscription.css` apontavam para "Inter Tight" e "Manrope", que **nunca foram carregadas** — incluindo o seletor global `input, select, textarea`, ou seja, todo campo de formulário do sistema renderizava em fonte de fallback do SO, não na fonte real do app. Some-se a isso uma escala de tamanhos fragmentada (~45 valores de `font-size` distintos em incrementos de 0.01–0.02rem) e uso pesado de `font-weight: 700/800` (69 ocorrências em `app.css`), e o resultado é uma interface que parece mais pesada e menos consistente do que o próprio design system pretendia.

## 2. Fonte anterior

- **Corpo/UI:** Inter (400–800), carregada via Google Fonts em `index.html`.
- **Títulos:** Sora (500–700), só para h1/h2/headers de seção.
- **Números:** IBM Plex Mono (500–600), reservada a KPIs/valores monetários/pesos.
- **Sistema paralelo morto:** `src/index.css` importava Fraunces (serifada), DM Mono e Outfit, e definia seu próprio `:root` com `--font-sans: 'Outfit'`. Esse arquivo carrega *antes* de `tokens.css` no bundle, mas como os dois escrevem a mesma custom property em `:root`, a cascata dá a palavra final a quem carrega depois — `tokens.css` sempre venceu para `body`. Na prática, Outfit/Fraunces/DM Mono nunca apareciam na tela, mas os 3 arquivos de fonte eram baixados à toa (custo de rede sem benefício visual).
- **Fontes hardcoded fora do token:** `"Inter Tight"` (4 seletores: inputs de sidebar/header/card title, `.sanitario-summary-card strong`, `.metric-tile__value`, `.reports-module-chip strong`) e `"Manrope"` (todo `input, select, textarea` do app) — nenhuma das duas está no link do Google Fonts, então caíam no fallback `"Segoe UI", sans-serif`.

## 3. Fontes comparadas

| Fonte | Legibilidade números | Peso web | Distinção 0/O 1/l/I | Sensação |
|---|---|---|---|---|
| **Inter** (já em uso) | Ótima, tabular-nums nativo | ~5 pesos, altamente otimizada | Boa | Neutra, profissional, muito testada em produtos B2B |
| DM Sans | Boa | Leve | Média | Um pouco mais "redonda"/casual — arriscaria parecer menos sério para financeiro |
| Manrope | Boa | Leve | Média | Geométrica, levemente mais "tech/startup" que o desejado |

Inter já vence claramente as duas alternativas nos critérios do sprint (números, tabelas, PT-BR, performance — é a fonte mais usada e mais bem cacheada do Google Fonts) e já está implantada e testada em produção. Trocar a família inteira não teria ganho visual proporcional ao risco de regressão. **Sora** (título) foi comparada à própria Inter em peso 600/700: na tela, títulos como "Painel Geral" (h1, 28.7px/600) e "Visão do rebanho" (h2, 17.3px/700) não se beneficiavam de uma segunda família — o salto perceptível vinha do tamanho, não do desenho da letra, e misturar duas famílias por um ganho marginal contraria o pedido explícito do sprint de preferir uma família única.

## 4. Fonte escolhida

**Inter, como família única do sistema** (corpo, títulos, labels, botões, tabelas, sidebar, badges, tooltips). **IBM Plex Mono mantida como exceção única e deliberada**, restrita a números tabulares em KPIs e colunas monetárias/peso — onde alinhamento de dígitos e distinção 0/O, 1/l/I têm valor funcional real (isso já era assim antes; não é uma adição nova).

## 5. Justificativa

1. Inter já era a fonte de maior uso real na interface (corpo inteiro + a maioria dos componentes que hoje usam `var(--font-heading)`/`var(--font-sans)`).
2. Nenhuma candidata (DM Sans, Manrope, Work Sans, Source Sans) supera Inter nos critérios obrigatórios do sprint — legibilidade de números, tabelas, indicadores financeiros, peso de animal, disponibilidade web, PT-BR.
3. O sprint pede explicitamente "uma única família... hierarquia por tamanho, peso e espaçamento" — isso significa **remover** a segunda família de título (Sora), não escolher uma terceira.
4. Menos famílias = menos requisições de fonte = ganho de performance real (saíram 3 famílias inteiras do bundle: Fraunces, DM Mono, Outfit; e Sora).
5. Trocar a fonte de título por Inter é uma mudança de baixo risco: `--font-heading` já era uma variável centralizada consumida em 4 arquivos (`app.css`, `dashboard.css`, `pastagens.css`, `rebanho.css`) — bastou redefinir o token, sem tocar em nenhum consumidor.

## 6. Sistema tipográfico implementado

- `src/styles/tokens.css`: `--font-heading` deixou de ser `'Sora', 'Inter', ...` e passou a ser `'Inter', system-ui, -apple-system, sans-serif` (idêntica a `--font-sans`, mantida como variável separada só para não obrigar a tocar os 4 arquivos que já a consomem). `--font-mono` inalterada (IBM Plex Mono).
- `index.html`: link do Google Fonts perdeu `Sora:wght@500;600;700` — agora só carrega `Inter:wght@400;500;600;700;800` e `IBM+Plex+Mono:wght@500;600`.
- `src/index.css`: removido o `@import` de Fraunces/DM Mono/Outfit; `--font-sans` do próprio `:root` corrigida de `'Outfit'` para `'Inter'` (elimina a fonte de verdade duplicada e divergente); `.title-brand`, `.title-page`, `.text-mono` removidas (0 usos em `src/**/*.jsx`, hardcodavam Fraunces/DM Mono); `.kpi-value`/`.kpi-unit` (usadas em `KpiCard.jsx`, `ResultadoLoteCard.jsx` e 7+ páginas, mas hoje sempre sobrescritas por regras mais específicas de `app.css`) corrigidas para `var(--font-mono)`/`var(--font-sans)` em vez de `'DM Mono'`/`'Outfit'`.
- `src/styles/app.css` (4 seletores) + `src/styles/relatorios.css` (1) + `src/styles/subscription.css` (1): `"Inter Tight"`/`"Manrope"` trocadas por `var(--font-heading)`/`var(--font-sans)`. Isso conserta, entre outros, o `font-family` de **todo `input`/`select`/`textarea` do sistema**, que estava silenciosamente fora da fonte oficial.
- **Não alterado nesta sprint** (documentado como pendência, não corrigido): a fragmentação da escala de `font-size` (dezenas de valores em rem quase-duplicados) e o uso pesado de `font-weight: 700/800` espalhado por `app.css`. Trocar esses valores um a um é redesign de detalhe, não "implementação de tipografia" — fica para um sprint de correção dedicado (ver seção 13).

## 7. Problemas sistêmicos

| Achado | Evidência | Severidade |
|---|---|---|
| Escala de `font-size` fragmentada — ~45 valores distintos em `app.css` (0.62rem a 2rem, muitos a 0.01–0.02rem de diferença: 0.72/0.73/0.74/0.75/0.76rem coexistindo) | `grep -o "font-size:\s*[0-9.]*rem" app.css \| sort \| uniq -c` | P1 |
| Tokens de tamanho (`--text-xs`…`--text-3xl`) quase não são usados — só 11 ocorrências de `var(--text-` em `app.css` contra centenas de valores soltos | mesmo grep | P1 |
| `font-weight: 700` (53×) e `800` (16×) dominam `app.css`; hierarquia de peso vira ruído em vez de sinal | `grep -c "font-weight: 7/800"` | P1 |
| `border-radius` com 12+ valores distintos em uso (8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30px) contra 4 tokens definidos (`--radius-sm/md/lg/xl` = 6/10/14/20) — só ~38 de ~200 usos referenciam o token | `grep -o "border-radius:..." app.css \| sort \| uniq -c` | P2 |
| `text-transform: uppercase` em 36 seletores de `app.css` — combinado com bold pesado, contribui para sensação "gritada" em labels/badges | grep | P2 |
| Hierarquia h2/h3 quase indistinguível: no Dashboard, h2 de seção (17.28px/700) e h3 de card (16.8px/700) diferem menos de 1px e têm o mesmo peso — o olho não separa "seção" de "card" | `getComputedStyle` ao vivo em `/` | P1 |
| CTA duplicado na mesma tela: "Cadastrar pasto" aparece 4× em Pastos; "registrar pesagem" tem 3 rótulos diferentes (header, aba, empty state) na mesma tela de Pesagens | inspeção de `/pastagens`, `/pesagens` | P2 |

## 8. Problemas por tela

**Login** — card único, hierarquia clara, sem achados relevantes. OK.

**Painel Geral** — 12 títulos na tela, todos peso 700 (nenhum peso 500/600 usado para diferenciar nível); KPIs a zero recebem o mesmo destaque visual que teriam com dados reais, sem estado "vazio" mais discreto. P1.

**Lotes** — 19 botões visíveis, 11 com fundo preenchido (cor sólida) numa tela com 1 lote só — muito primary-button competindo. P1.

**Animais** — empty state limpo, CTA único e claro. OK.

**Pesagens** — 3 rótulos diferentes para a mesma ação de registrar pesagem visíveis ao mesmo tempo ("Cadastrar nova pesagem" no header, "Nova pesagem" na aba, "Registrar pesagem" no empty state). P2.

**Pastos** — "Cadastrar pasto" repetido 4× na mesma tela (header + botão do formulário relabelado "Novo pasto" + 2 empty states). P1.

**Sanidade** — tela muito densa para uma conta sem manejos: "Agenda Sanitária" mostra 6 subseções, cada uma com seu próprio "Nada por aqui"; abaixo, um formulário completo de planejamento IATF (avançado, reprodução) sempre expandido; abaixo disso, o empty state geral da página. Três camadas de "vazio"/complexidade competindo por atenção antes de qualquer dado existir. P1.

**Nutrição/Suplementação** — com 1 produto cadastrado, tabela de 9 colunas cabe em 1366px sem scroll. OK, sem achados relevantes.

**Estoque** — toolbar com 5 botões de ação mais "Novo item"; "Registrar entrada"/"Registrar saída" competem visualmente com "Novo item" sem diferenciação clara de prioridade. P2.

**Financeiro** — números reais renderizam corretamente (receita, despesa, resultado negativo). OK.

**Resultados (Panorama por lote)** — tabela de 13 colunas mede 1507px de largura contra 1366px de viewport em notebook — **estoura o breakpoint mais citado no sprint (1366×768)**, exigindo scroll horizontal não sinalizado visualmente. P1.

**Relatórios** — lista de cards simples e clara. OK.

**Painel Gerencial** — 5 seções × 4–6 indicadores cada, quase todos zerados, todos com o mesmo peso visual — para um "resumo executivo", não há hierarquia entre o que importa agora e o resto. P1.

**Alertas** — 7 badges de contagem no topo + painel de filtro com 6 grupos sempre expandido, mesmo com zero alertas. Chrome pesado ao redor de um resultado vazio. P2.

**Equipe** — texto claro sobre papéis, cadastro simples. OK.

**Configurações** — banner de aviso de dados sem fazenda bem posicionado; abas (Geral/Notificações/Integrações/Dados e Segurança) — só a aba Geral foi auditada em profundidade nesta rodada (limitação de tempo, não achado). Sem P0/P1 na aba avaliada.

**Assinatura / Perfil** — o card completo de "Minha Assinatura" (plano, limites, badges "LIBERADO", grade de planos) aparece **duplicado por inteiro** dentro da página Perfil, idêntico ao que existe na página própria `/minha-assinatura`. "Sair da conta" aparece 2× em Perfil (uma vez dentro do card de assinatura, outra na seção "Sessão"). P1.

**Guia do Criador** — checklist e cards de próximo passo bem resolvidos, boa hierarquia. OK.

**Modal "Novo lote"** — formulário longo em rolagem única com 6 blocos de conteúdo (Identificação, Operação, Metas zootécnicas, Nutrição/manejo, Financeiro, Resumo/projeção) sem separação visual forte entre eles (sem accordion/stepper); vários campos avançados marcados "(opcional)" aparecem sempre abertos por padrão. Um pecuarista sem prática de software pode se perder no meio do formulário. P1.

## 9. P0 — bloqueia uso

Nenhum achado P0 nesta rodada (nada impede o pecuarista de completar uma ação essencial). As quebras críticas de mobile (FAB sobrepondo conteúdo) já estavam resolvidas por `docs/AUDITORIA_VISUAL_UX_HERDON.md`, seção 7.

## 10. P1 — prejudica bastante a experiência

1. Escala de `font-size` fragmentada, sem disciplina de tokens (seção 7).
2. `font-weight` 700/800 dominante, hierarquia de peso virou ruído (seção 7).
3. h2/h3 quase indistinguíveis no Dashboard (seção 8).
4. Painel Geral: KPIs zerados com o mesmo peso visual de dados reais (seção 8).
5. Lotes: excesso de botões preenchidos competindo (seção 8).
6. Pastos: CTA "Cadastrar pasto" repetido 4× (seção 8).
7. Sanidade: 3 camadas de vazio/complexidade competindo antes de haver dados (seção 8).
8. Resultados: tabela de 13 colunas estoura 1366×768 sem scroll sinalizado (seção 8).
9. Painel Gerencial: 20+ indicadores zerados sem hierarquia de importância (seção 8).
10. Assinatura duplicada por inteiro dentro de Perfil, com CTA "Sair da conta" repetido (seção 8).
11. Modal "Novo lote": formulário longo de 6 blocos sem separação visual (seção 8).

## 11. P2 — refinamento visual

1. `border-radius` com 12+ valores distintos, maioria fora dos tokens (seção 7).
2. `text-transform: uppercase` em excesso combinado com bold (seção 7).
3. Pesagens: 3 rótulos diferentes para a mesma ação (seção 8).
4. Estoque: "Registrar entrada/saída" duplicando sentido de "Novo item" (seção 8).
5. Alertas: painel de filtro pesado sempre expandido mesmo vazio (seção 8).
6. 94 `box-shadow` declarados em `app.css`, muitos com rgba solto em vez de `var(--shadow-*)`.

## 12. Componentes que deveriam ser padronizados

- **Escala tipográfica**: adotar de fato os tokens `--text-xs`…`--text-3xl` (mais 1–2 intermediários se necessário) e substituir os valores soltos por eles, começando pelos componentes compartilhados (`ui.css`, `layout.css`) antes de páginas individuais.
- **Pesos de heading**: padronizar um mapa explícito por papel (h1=600, h2=600, h3=600, corpo destacado=500) para acabar com "tudo é 700".
- **`border-radius`**: migrar os ~160 usos fora do token para `var(--radius-sm/md/lg/xl)`.
- **Botão primário por tela**: definir regra de "1 ação primária visível por contexto", os demais como secundário/ghost — hoje várias telas (Lotes, Pastos, Estoque) têm múltiplos botões preenchidos competindo.
- **Bloco "Assinatura"**: extrair como componente único reaproveitado por `/minha-assinatura` e `/perfil` em vez de duplicar o JSX/conteúdo.

## 13. Recomendações de design

- Tratar a fragmentação de `font-size`/`font-weight` como dívida de maior prioridade — é a causa raiz mais repetida nos achados P1 e P2 desta auditoria.
- Em telas de indicador (Painel Gerencial, Alertas, Sanidade), aplicar hierarquia de exibição: mostrar só o essencial "hoje" em destaque, e mover indicadores secundários para uma seção expandível — hoje tudo aparece no mesmo nível.
- Tabelas com 10+ colunas (Resultados) precisam de uma estratégia deliberada para notebook (scroll horizontal sinalizado, colunas prioritárias fixas, ou modo compacto) — não just deixar a tabela vazar.
- Consolidar CTAs repetidos por página antes de qualquer novo trabalho de conteúdo.

## 14. Próximos sprints visuais propostos

1. **Sprint — Escala tipográfica e pesos**: aplicar os tokens `--text-*` e um mapa de pesos por papel em todo `app.css`/`ui.css`, sem mudar fonte (já resolvida).
2. **Sprint — Consolidação de CTAs e botão primário único por tela** (Lotes, Pastos, Estoque, Pesagens).
3. **Sprint — Hierarquia de KPIs/indicadores** (Painel Geral, Painel Gerencial, Alertas, Sanidade): reduzir ruído de dados zerados, layout progressivo.
4. **Sprint — Tabelas densas responsivas** (Resultados e afins) para 1366×768.
5. **Sprint — Unificar bloco Assinatura** entre `/minha-assinatura` e `/perfil`.
6. **Sprint — `border-radius`/`box-shadow` nos tokens** (P2, baixo risco, bom para depois das prioridades acima).

---

## Tabela consolidada

| Tela | Problema | Severidade | Causa | Recomendação |
|---|---|---|---|---|
| Sistema (global) | Escala de `font-size` fragmentada (~45 valores) | P1 | Falta de disciplina de tokens desde o início | Migrar para `--text-xs..3xl` |
| Sistema (global) | `font-weight` 700/800 dominante | P1 | Escolha repetida de bold por padrão | Mapa de pesos por papel |
| Sistema (global) | `border-radius` com 12+ valores soltos | P2 | Números "no olho" em vez de token | Migrar para `--radius-*` |
| Sistema (global) | `text-transform: uppercase` em excesso | P2 | Uso decorativo repetido | Reduzir a labels/badges específicos |
| Painel Geral | h2/h3 quase indistinguíveis; KPIs zerados com mesmo peso visual | P1 | Falta de mapa de pesos + sem estado "vazio" dedicado | Diferenciar tamanho/peso h2 vs h3; estado zero mais discreto |
| Lotes | 11/19 botões preenchidos numa tela com 1 registro | P1 | Sem regra de "1 primário por tela" | Rebaixar ações secundárias |
| Pastos | CTA "Cadastrar pasto" repetido 4× | P1 | Cada bloco (header/form/2 empty states) tem seu próprio CTA | Unificar em 1–2 pontos de entrada |
| Sanidade | 3 camadas de vazio/complexidade (6 subseções + form IATF + empty geral) | P1 | Tudo exibido sempre, sem progressive disclosure | Colapsar IATF e subseções vazias por padrão |
| Resultados | Tabela de 13 colunas estoura 1366×768 (1507px vs 1366px) | P1 | Sem estratégia de tabela densa para notebook | Scroll sinalizado ou colunas prioritárias |
| Painel Gerencial | 20+ indicadores zerados sem hierarquia | P1 | Todas as seções com peso visual igual | Priorizar 3–5 indicadores "hoje" |
| Perfil / Assinatura | Card de Assinatura duplicado por inteiro + CTA "Sair" 2× | P1 | Conteúdo copiado em vez de componentizado | Extrair componente único reaproveitado |
| Modal Novo Lote | Formulário de 6 blocos em rolagem única sem separação | P1 | Sem accordion/stepper para campos avançados | Separar "essencial" de "avançado (opcional)" |
| Pesagens | 3 rótulos diferentes para a mesma ação | P2 | Copy não revisada entre header/aba/empty state | Unificar rótulo |
| Estoque | "Registrar entrada/saída" duplica sentido de "Novo item" | P2 | Toolbar com ações sobrepostas em significado | Agrupar ou diferenciar hierarquia |
| Alertas | Painel de filtro pesado sempre expandido, mesmo vazio | P2 | Filtro sempre visível independente de haver dados | Colapsar quando lista vazia |

---

## Arquivos alterados nesta sprint

- `src/styles/tokens.css` — `--font-heading` de Sora para Inter (documentado).
- `index.html` — link do Google Fonts sem `Sora`.
- `src/index.css` — `@import` morto removido; `--font-sans`/`body` corrigidos para Inter; `.title-brand`/`.title-page`/`.text-mono` removidas (dead code); `.kpi-value`/`.kpi-unit` apontando para os tokens.
- `src/styles/app.css` — 4 seletores hardcoded (`"Inter Tight"`/`"Manrope"`, incluindo `input, select, textarea` global) trocados por `var(--font-heading)`/`var(--font-sans)`.
- `src/styles/relatorios.css`, `src/styles/subscription.css` — mesmo tipo de correção, 1 seletor cada.

Nenhuma mudança de banco, regra de negócio, navegação ou fluxo. Nenhuma página foi redesenhada — só a tipografia (família) foi implementada globalmente; os demais achados ficam documentados para sprints futuros, conforme pedido.
