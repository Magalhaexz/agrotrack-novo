# Sprint Visual 4 — Hierarquia de KPIs, Estados Vazios e Progressive Disclosure — HERDON

**Data:** 2026-08-12
**Branch:** `design/kpi-empty-state-hierarchy` (a partir de `design/cta-action-hierarchy` — Sprints 1, 2 e 3 ainda não mergeadas em `main`, ver nota abaixo)
**Escopo:** hierarquia de KPIs, tratamento de zero/sem-dados e progressive disclosure em 4 telas — Painel Geral, Painel Gerencial, Sanidade, Central de Alertas. Sem remover informação, sem mudar cálculo/regra de negócio, sem tocar em fonte/escala tipográfica/CTAs fora do necessário.

**Nota de base e cadeia de branches:** a preparação pedia confirmar que as Sprints 1, 2 e 3 já estavam na base usada. Confirmado que nenhum dos 3 PRs foi mergeado em `main` ainda. Mantida a mesma cadeia empilhada das sprints anteriores:
`design/kpi-empty-state-hierarchy` → `design/cta-action-hierarchy` → `design/typography-scale-hierarchy` → `design/typography-visual-audit` → `origin/main`.
Cada branch contém só o diff da sua própria sprint; o PR final de cada um deve ser mergeado nessa ordem.

---

## 1. Diagnóstico por tela

**Painel Geral** — 6 KPIs principais (`KpiPanel`) já tinham um sistema de `variant` (success/warning/danger/info/neutral) parcialmente implementado, mas só `danger` de fato mudava algo visualmente (borda vermelha sutil); `success`/`info`/`neutral` eram idênticos entre si. O problema real não era falta de cor — era que o **número em si** (`.kpi-panel strong`, peso 600, `font-mono`) tinha o mesmo tamanho/peso tipográfico esteja zerado ou com dado real, então um "0" ocupava a mesma força visual que "1.234". "Peso médio" também mostrava "0,0 kg" quando não havia nenhuma cabeça ativa — um zero que na verdade é "sem dado para calcular" (`totalCabecasAtivas ? peso/total : 0`, fallback correto para matemática, mas confuso na tela).

**Painel Gerencial** — 27 indicadores (4 em `metric-tile` maior + 23 em `.summary-row` flat) todos exibidos ao mesmo tempo, com "Resumo da fazenda" já funcionando como uma primeira camada (visualmente maior) — mas os outros 23 (técnicos, econômicos, pastagem, evolução do rebanho) tinham peso idêntico entre si, misturando indicadores de leitura diária (margem, taxa de desfrute) com indicadores mais operacionais/granulares (evolução mês a mês do rebanho, 8 linhas).

**Sanidade** — confirmado exatamente o que a auditoria descreveu: Agenda Sanitária com 6 seções, cada uma podendo mostrar "Nada por aqui." independentemente (até 6 empty states simultâneos); Planejamento IATF (2 formulários + prévia de cronograma + timeline, ~15 campos) sempre renderizado por completo, mesmo para conta sem nenhum manejo; empty state geral só no final da página, depois de toda essa densidade.

**Central de Alertas** — os badges "Críticos" e "Vencidos" tinham a classe `alertas-summary-card--critico` (número em vermelho) **fixa no JSX**, e "Vencendo hoje" tinha `--atencao` (âmbar) fixa também — ou seja, mesmo com o valor zerado, 3 dos 7 badges apareciam coloridos como se exigissem atenção. O painel de "Filtros" (6 campos + 2 chips) sempre renderizava expandido, mesmo quando a lista de alertas estava vazia. O empty state de "zero alertas" já existia e já era bom (`"Nenhum alerta crítico no momento."`, ícone de sucesso, tom positivo) — não precisou de mudança.

## 2. Critérios de prioridade

- **Painel Geral:** os 6 KPIs já eram o conjunto mínimo definido em sprint anterior do próprio repo ("6 indicadores, não 7" — Fazendas virou contexto, não KPI); não foi criado nem removido nenhum. A hierarquia veio de tratar cada um como `zero` (sem urgência) ou não, usando o `variant` que a própria tela já calculava (ex.: alertas críticos > 0 → sempre peso cheio).
- **Painel Gerencial:** primeira camada = "Resumo da fazenda" (já existia, 4 tiles) + "Indicadores técnicos"/"Indicadores econômicos" (10 itens, leitura mais frequente — margem, taxa de desfrute, receita/custo). Segunda camada = "Pastagens e lotação" + "Evolução do rebanho" (13 itens, mais granular/operacional — variação mês a mês, UA, hectares). Critério: o que já é olhado todo dia (financeiro/produtividade) fica visível; o que é consultado sob demanda (planejamento de área, auditoria de movimentação) fica a um clique.
- **Sanidade:** Agenda Sanitária (o que está acontecendo agora) sempre visível, só comprimida quando vazia; IATF (planejamento avançado, opcional, usado por quem faz protocolo reprodutivo) vira progressive disclosure.
- **Alertas:** os 7 badges continuam todos visíveis sempre (nenhum removido) — só a cor de severidade passou a depender do valor real.

## 3. Comportamento de KPI zero

Adicionado um prop `zero` ao componente `KpiPanel` (Painel Geral): quando `zero === true` **e** a variant não é `warning`/`danger`, o card ganha a classe `kpi-panel--zero`, que troca o número de `color: var(--color-text)` + peso 600 para `color: var(--color-text-secondary)` + peso 500 — mesmo tamanho de fonte (não desloca layout), só menos contraste/peso. Zeros que exigem atenção (`warning`/`danger`) nunca recebem esse tratamento — continuam com peso cheio mesmo que o valor seja 0 (não é o caso hoje nos 6 KPIs, mas a regra está lá para o dia em que "Alertas críticos" virar `danger` com valor baixo, por exemplo).

Central de Alertas seguiu o mesmo princípio de forma mais direta: `alertas-summary-card--critico`/`--atencao` deixaram de ser classes fixas no JSX e passaram a ser condicionais (`resumo.criticos > 0 ? '...' : ''`) — zero nunca mais aparece em vermelho/âmbar.

## 4. Diferença entre zero e ausência de dados

Dois casos tratados nesta sprint:

1. **Painel Geral — "Peso médio":** `totalCabecasAtivas === 0` já é a condição que o próprio código usa para decidir o fallback matemático (`peso/total : 0`) — só passou a ser usada também na apresentação. Sem cabeças ativas, o card mostra "—" e o texto de apoio muda para "Sem cabeças ativas" (antes: "0,0 kg" / "Média do rebanho ativo", que sugeria um peso médio real de zero). `pesoMedioAtual` continua calculado exatamente igual internamente — nada mudou no valor, só a exibição de um caso que já era distinguível.
2. **Painel Gerencial:** os formatadores (`formatNumber`/`formatCurrency`/`formatPercent`) já retornavam `'Sem dados suficientes'` sempre que o valor não é finito (`!Number.isFinite(number)`) — ou seja, a distinção entre "0,00%" (zero real) e "Sem dados suficientes" (`NaN`/`undefined`) **já existia** antes desta sprint, só não estava documentada. Confirmado que continua funcionando, nada foi alterado aqui.

Não foi inventada nenhuma distinção onde a regra de negócio não fornecia a informação — nos dois casos, o dado para diferenciar "zero" de "sem dado" já existia no código, só não estava sendo usado na apresentação (caso 1) ou já estava correto e só foi verificado (caso 2).

## 5. Mudanças no Painel Geral

- `src/pages/DashboardPage.jsx`: `KpiPanel` ganhou prop `zero`; `kpisMain` passou a computar esse flag por item a partir dos mesmos valores já usados no cálculo (`totalPastos === 0`, `lotesAtivos.length === 0`, etc.); "Peso médio" mostra "—" quando não há cabeças ativas.
- `src/styles/dashboard.css`: nova regra `.kpi-panel--zero strong` (peso 500, cor secundária).
- Nenhuma mudança de posição de seção (a página já tem histórico de reorganização revertida por pedido da proprietária — "Ações rápidas" — então esta sprint manteve a ordem exatamente como está, só ajustou peso/apresentação).

## 6. Mudanças no Painel Gerencial

- `src/pages/RelatoriosGerenciaisPage.jsx`: os cards "Pastagens e lotação" e "Evolução do rebanho" (13 indicadores) passaram a ficar dentro de um bloco com toggle "Ver mais indicadores (pastagem e evolução do rebanho)" — recolhido por padrão, `aria-expanded`/`aria-controls`. "Resumo da fazenda" (4) + "Indicadores técnicos" (5) + "Indicadores econômicos" (5) seguem sempre visíveis, sem nenhuma mudança.
- `src/styles/relatorios.css`: regra de layout para o wrapper do botão de toggle.
- Nenhum indicador foi removido, recalculado ou teve seu valor alterado.

## 7. Mudanças em Sanidade

- `src/pages/SanitarioPage.jsx`:
  - Agenda Sanitária: quando as 6 seções estão todas vazias, mostra um único `EmptyState` compacto no lugar da grade de 6 cards; quando há dado em pelo menos uma seção, mostra só as seções com item (as vazias somem da grade, sem "Nada por aqui." repetido).
  - Planejamento IATF: virou uma seção com toggle (`iatfExpandido`, `useState(false)` — começa recolhido), com um resumo de uma linha quando fechado e o formulário completo (idêntico ao que já existia, nada removido) quando aberto.
  - Empty state geral da tabela (`dadosTabela.length === 0`) não foi alterado — já era um bloco único, título+subtítulo+CTA.
- `src/styles/app.css`: regras `.sanitario-iatf-toggle-icon` (rotação do chevron) e `.sanitario-iatf-collapsed-hint`.

## 8. Mudanças em Alertas

- `src/pages/AlertasPage.jsx`:
  - Os 7 badges de contagem: `Críticos`/`Vencidos` (`--critico`) e `Vencendo hoje` (`--atencao`) só recebem a classe de cor quando o valor correspondente é `> 0`.
  - Card "Filtros" ganhou toggle (`filtrosVisiveis`, inicializado com `alertasNormalizados.length > 0` — mesma condição do empty state "Tudo certo" logo abaixo). Sem alertas, começa recolhido com uma linha de contexto; com alertas, começa aberto como sempre foi.
  - Nenhuma lógica de filtro, ordenação ou tratativa foi alterada — só a visibilidade inicial do painel.
- `src/styles/alertas.css`: regra `.alertas-filtros-collapsed-hint`.

## 9. Progressive disclosure implementado

| Tela | O que virou expansível | Estado inicial |
|---|---|---|
| Sanidade | Planejamento IATF / Reprodução | Recolhido |
| Painel Gerencial | Pastagens e lotação + Evolução do rebanho | Recolhido |
| Alertas | Painel de Filtros | Recolhido só quando não há nenhum alerta |

Todos os três usam o mesmo padrão: `<Button variant="ghost">` com ícone `ChevronDown` que gira 180° quando aberto (`.sanitario-iatf-toggle-icon.is-open`, reaproveitada nas 3 telas), `aria-expanded`/`aria-controls`, conteúdo condicional por `useState`. Nenhum accordion novo foi criado — as 3 telas reaproveitam a mesma classe CSS de ícone giratório.

## 10. Empty states padronizados

- Agenda Sanitária (todas as seções vazias): 1 `EmptyState compact` no lugar de até 6 blocos "Nada por aqui." — título curto + subtítulo, sem CTA (a ação de registrar manejo já está no header da página).
- Central de Alertas: nenhuma mudança — o padrão já existente (`EmptyState` com `icon`/`tone="success"`, título+subtítulo, sem múltiplos CTAs) já seguia a receita da seção 9 do brief.

## 11. Comportamento mobile

Testado em 320×568, 390×844 e 412×915 nas 4 telas — sem overflow horizontal em nenhuma combinação. Os 3 toggles novos (IATF, Painel Gerencial, Filtros de Alertas) usam o `Button` padrão (altura mínima já garantida pelo design system, ver Sprint Visual 3) — área de toque adequada sem CSS extra. Botão de abertura da sidebar mobile não foi tocado.

## 12. Comparação antes/depois

| Tela | Problema anterior | Antes | Depois |
|---|---|---|---|
| Painel Geral | KPIs zero com mesmo peso de dado real | 6/6 KPIs peso 600 sempre | 6/6 com peso 500 quando zero e sem urgência (hoje: 6, pois a conta de teste está toda zerada) |
| Painel Gerencial | 27 indicadores no mesmo nível | 27 indicadores visíveis de uma vez | 14 visíveis (4 hero + 10) + 13 atrás de "Ver mais indicadores" |
| Sanidade | Múltiplos vazios + IATF sempre expandido | até 7 empty states simultâneos (6 da agenda + 1 geral) + IATF com ~15 campos sempre visível | 2 empty states (1 agenda combinada + 1 geral) + IATF recolhido (1 linha) |
| Alertas | Badges/filtros dominando estado vazio | 3/7 badges sempre coloridos (mesmo em 0) + filtros sempre expandidos | 0/7 badges coloridos em zero + filtros recolhidos quando não há alerta |

Outras métricas registradas:
- Cards visíveis acima da dobra (1366×768, conta de teste zerada): Painel Geral inalterado (6 KPIs + Ações rápidas, ordem preservada); Painel Gerencial 4 tiles + 2 cards (antes: 4 tiles + 4 cards); Sanidade 3 summary cards + 1 linha de agenda + 1 linha de IATF (antes: 3 cards + grade de 6 + formulário completo de IATF); Alertas 7 badges + 1 linha de filtro (antes: 7 badges + painel de 6 campos).
- Indicadores em primeiro nível: Painel Gerencial 27 → 14.
- Filtros inicialmente expandidos: Alertas 1/1 sempre → 0/1 quando vazio, 1/1 quando há alerta (comportamento condicional, não removido).

## 13. Pendências

- Painel Geral: as abas internas "Estoque" e "Alertas" do próprio Dashboard (KPIs `kpi-card--danger`/`kpi-card--warning` fixos, mesmo padrão do bug corrigido em Alertas) não foram auditadas — são conteúdo secundário atrás de uma aba, não a visão padrão "Geral" que é o que a sprint pediu como "Painel Geral".
- Painel Gerencial: os 27 indicadores em si não ganharam tratamento de zero-vs-dado individual (só a camada de agrupamento/disclosure) — os formatadores já cobrem "Sem dados suficientes" para `NaN`, o que resolve a parte mais importante (seção 4), mas um zero real de "Margem bruta" ainda tem o mesmo peso de qualquer outro valor dentro da sua própria camada.
- Sanidade/Alertas: nenhuma pendência nova identificada nas 4 telas desta sprint além do que já estava documentado nas sprints anteriores (tabela Resultados, Assinatura duplicada, etc. — fora de escopo aqui).
- `PesagemForm`/outras telas fora da lista de 4 não foram tocadas.

---

## Acessibilidade (seção 17 do brief)

- Os 3 toggles novos têm `aria-expanded` (true/false) e `aria-controls` apontando para o id do conteúdo que abrem/fecham — verificado ao vivo (`aria-expanded` alterna corretamente ao clicar).
- Controles são `<button>` nativos (via `Button`) — acionáveis por teclado (Tab + Enter/Espaço) sem JS adicional.
- Foco visível já vem do `Button`/`ui.css` (`:focus-visible` com anel verde), não foi alterado.
- Severidade nunca depende só de cor: os badges de Alertas mostram o rótulo ("Críticos", "Vencidos") + número, a cor é reforço, não o único canal. O mesmo vale para `.kpi-panel--danger` (borda + rótulo "Exigem atenção agora" no texto de apoio).
- Zeros continuam legíveis — só o peso/contraste caem (500 + `--color-text-secondary`, que ainda passa em contraste sobre o fundo escuro), nunca ficam ocultos ou `display:none`.

---

## Validação técnica

Confirmado antes de fechar:
- Nenhuma informação desapareceu — tudo que existia continua acessível (Agenda Sanitária, IATF, indicadores de Pastagem/Evolução, filtros de Alertas), só atrás de 1 clique quando fazia sentido.
- Nenhum KPI mudou de valor — só peso/cor de apresentação.
- Nenhum alerta mudou de severidade — a lógica de `resumirCentralAlertas`/`prioridade` não foi tocada, só a cor do badge de contagem.
- Nenhum filtro deixou de funcionar — mesma lógica de `filtrarAlertasCentral`, só a visibilidade inicial do painel mudou.
- Nenhum fluxo sanitário foi alterado — `salvarIatf`, cálculo de `iatfAgenda`/`proximaAcaoIatf` e o formulário em si são exatamente os mesmos, só ficaram atrás de um toggle.

**Lint:** limpo. **Testes:** 1859/1859 passando. **Build:** ok (`vite build`, sem erros). **Breakpoints testados:** 320×568, 390×844, 412×915 (mobile) e 1024×768, 1366×768, 1440×900, 1920×1080 (desktop) — sem overflow em nenhuma tela/resolução.

---

## Fechamento

**Arquivos alterados:** `src/pages/DashboardPage.jsx`, `src/pages/RelatoriosGerenciaisPage.jsx`, `src/pages/SanitarioPage.jsx`, `src/pages/AlertasPage.jsx`, `src/styles/dashboard.css`, `src/styles/relatorios.css`, `src/styles/app.css`, `src/styles/alertas.css` + novo `docs/SPRINT_KPI_EMPTY_STATE_HIERARQUIA_HERDON.md`.

**Componentes reutilizados:** `KpiPanel` (Painel Geral, prop `zero` nova), `EmptyState` (Sanidade, agenda combinada), `Button`/`ChevronDown` (os 3 toggles, mesma classe `.sanitario-iatf-toggle-icon` reaproveitada em Sanidade/Painel Gerencial/Alertas). Nenhum componente novo foi criado.

**KPIs principais definidos:** Painel Geral mantém os 6 já existentes (Pastos, Lotes ativos, Cabeças ativas, Peso médio, Alertas críticos, Resultado financeiro); Painel Gerencial elegeu "Resumo da fazenda" (4) + Indicadores técnicos/econômicos (10) como primeira camada, mantendo Pastagens/Evolução (13) como segunda camada.

**Indicadores rebaixados:** os 13 de Pastagens e lotação/Evolução do rebanho (Painel Gerencial), atrás de disclosure — não removidos.

**Empty states consolidados:** Agenda Sanitária (6 → 1 quando totalmente vazia).

**Seções com progressive disclosure:** IATF (Sanidade), Pastagens/Evolução (Painel Gerencial), Filtros (Alertas).

**Comparação antes/depois:** ver seção 12 do relatório.

**Breakpoints testados:** 320×568, 390×844, 412×915, 1024×768, 1366×768, 1440×900, 1920×1080.

**Lint:** limpo. **Testes:** 1859/1859. **Build:** ok.
