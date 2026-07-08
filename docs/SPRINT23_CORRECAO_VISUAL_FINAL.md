# Sprint 23 — Correção Visual Final antes do Teste do Produtor

## Origem

O `/design-critique` avaliou 4 telas mobile do HERDON (Sincronização,
Rateio de Custos, Modo Curral, Pesagens) e apontou um problema crítico
(P0) e três importantes (P1/P2). Esta sprint corrige tudo isso via
código, CSS e inspeção de DOM — sem plugin de design.

## P0 — Rateio de Custos (corrigido)

**Causa raiz:** `CustosCompartilhadosPage.jsx` usava classes CSS que
nunca existiram no projeto (`form-group`, `form-label`, `form-input`,
`btn`, `btn-primary`, `btn-outline`, `btn-xs`, `empty-state-text`). O
reset global (`button, input, select, textarea { background:
transparent; border: none; }`, `src/styles/app.css` ~linha 110) some com
toda a aparência nativa desses elementos, e como nenhuma classe própria
restaurava border/fundo/padding, os campos viravam texto corrido —
exatamente o bug relatado ("Descrição \*Ex: Energia elétrica de junho").

**Correção:** o formulário foi reescrito usando os componentes
`Input`/`Button` de `src/components/ui/`, os mesmos já usados em
praticamente todo o resto do app (Estoque, Pastagens, Financeiro etc.).
Cada campo (Descrição, Valor total, Data, Categoria, Critério de rateio)
agora tem label acima, campo com borda/fundo/padding via
`.ui-input-shell` (confirmado por `getComputedStyle`: borda
`1px solid rgba(255,255,255,0.08)`, fundo `rgba(9,12,10,0.88)`,
`border-radius: 16px`), e gap de 6px entre label e campo
(`.ui-input-wrap { display: grid; gap: 6px }`).

## Seleção de lotes no Rateio (corrigido)

- Mensagem clara quando não há lote ativo: "Nenhum lote ativo encontrado.
  Cadastre ou ative um lote para fazer rateio de custos."
- Botões "Todos"/"Limpar" agora só renderizam quando existe pelo menos um
  lote ativo (antes apareciam mesmo sem nada para selecionar).
- Botão "Confirmar e gerar despesas" já dependia de
  `form.loteIds.length > 0` (parte de `formValido`) — confirmado
  `disabled: true` via DOM quando não há lote ativo. Nenhuma lógica de
  rateio foi alterada.

## Card "Prévia do rateio" (corrigido)

Estava esticando para a mesma altura do formulário por herdar
`align-items: stretch` do grid `.dashboard-grid--dual` (classe
compartilhada por ~10 páginas — não alterada globalmente). Corrigido com
`alignSelf: 'start'` só no wrapper da coluna direita desta página.
Confirmado: card de prévia com ~200px de altura contra ~574px do
formulário no mesmo grid, em vez de altura igual artificial.

## P1 — Pesagens (corrigido)

- "Nova pesagem" no cabeçalho usava a classe `primary-btn`, que só tem
  uma regra de `width:100%` no mobile — mesmo bug raiz do Rateio (reset
  global sem restauração). Trocado por `<Button size="sm">`, agora com
  classe `ui-button ui-button--primary ui-button--sm` real.
- Mesma correção aplicada ao botão "Registrar pesagem" da aba Alertas
  (também usava `primary-btn`).
- Bônus: corrigido o mesmo bug em `src/pages/CustosPage.jsx` ("+ Novo
  custo"), que já tinha sido documentado como pendência P2 não resolvida
  na Sprint 22 ("card vazio no topo de Custos por Lote") — na verdade não
  era um card vazio, era um botão invisível pelo mesmo motivo.
- **GMD médio:** antes usava `.kpi-value` (fonte grande, ~36px, mono) até
  para o texto de status "Sem dados suficientes". Agora esse texto usa
  `.kpi-hint` (confirmado 15.2px via `getComputedStyle`), proporcional ao
  conteúdo; o valor numérico real continua em `.kpi-value` quando
  disponível.

## P2 — Modo Curral (corrigido)

Estado vazio trocado de um `<div className="empty-state"><p>...</p></div>`
solto para o componente `EmptyState` (já usado em outras páginas),
`compact` (padding 24px em vez do padrão maior), com título dinâmico
("Nenhuma fazenda cadastrada" / "Sem conexão" / "Nenhum lote disponível",
conforme o motivo real do estado vazio) e botão discreto "Ir para Lotes"
(via `onNavigate('lotes')`) quando a fazenda já existe mas falta lote.
Nenhuma lógica offline foi tocada — a função `obterMensagemEstadoVazio`
em `src/domain/modoCurral.js` não foi alterada.

## Ícone circular cortado (não reproduzido)

Investigado a fundo: o componente `MobileFab` (botão flutuante "+") só
renderiza nas páginas `lotes`/`estoque`/`financeiro` — não em Sincronização
nem Modo Curral, então não pode ser ele. Verificado via
`getComputedStyle`/`getBoundingClientRect` em todos os elementos com
`position: fixed` em 375px e ~960px, em ambas as páginas citadas, com
conta real logada: nenhum elemento circular pequeno na borda direita foi
encontrado em nenhum dos dois casos. **Conclusão: não foi possível
reproduzir nem localizar no código — não foi feita alteração.** Se o
ícone persistir em capturas futuras, precisa de uma nova screenshot com a
mesma conta/estado para investigar de novo (pode ser artefato da
ferramenta usada para capturar aquela screenshot específica, não do app).

## Achado extra corrigido: breakpoint sidebar/bottom-nav quebrado entre 768-900px

Durante a validação em tablet (768px), a sidebar de desktop apareceu fora
da tela (`transform: translateX`) mesmo com o bottom-nav mobile já oculto
(fix da Sprint 22, breakpoint 767px) — uma faixa de largura sem navegação
nenhuma. Causa: `src/styles/app.css` tinha **quatro** blocos
`@media (max-width: 900px)` distintos e redundantes controlando
`.sidebar`/`.mobile-topbar` (resíduo de reescritas anteriores do layout
mobile, não limpas), nunca atualizados quando o breakpoint principal foi
corrigido para 767px em `layout.css` na Sprint 22. Os quatro blocos foram
alinhados para 767px. Regras não relacionadas à navegação que compartilhavam
esses blocos (`.grid-2/3/4`, `.filter-row`, usadas em formulários reais)
foram deixadas em 900px, intactas. Confirmado nos dois limites exatos:
767px → mobile (bottom-nav visível, sidebar fora da tela); 768px →
desktop (sidebar visível, bottom-nav oculto), sem faixa intermediária
quebrada.

## Telas validadas

| Tela | 375px (mobile) | 768px (tablet) | 1280px (desktop) |
|---|---|---|---|
| Rateio de Custos | OK — campos com aparência real, botão desabilitado sem lote, prévia proporcional | OK — grid colapsa para 1 coluna, sem overflow | OK — 2 colunas, prévia ~200px vs formulário ~574px |
| Pesagens | OK — botão real, GMD proporcional, abas em grade sem corte | OK — abas com `flex-wrap: wrap`, sem overflow | OK — sem overflow |
| Modo Curral | OK — EmptyState compacto, título e CTA "Ir para Lotes" | OK — sidebar visível, sem overflow | OK — card compacto, sidebar visível |
| Sincronização | OK — sem overflow, botões/cards já estavam bons | — (não pedido) | OK — 3 cards + 4 botões bem distribuídos |

Método: `preview_screenshot` funcionou parcialmente nesta sessão (timeout
intermitente, mesma limitação de sessões anteriores); todas as telas
foram confirmadas por inspeção de DOM/CSS (`getBoundingClientRect`,
`getComputedStyle`, `scrollWidth <= clientWidth`, checagem de
`console.error`) quando o screenshot não respondeu — método explicitamente
previsto pela própria sprint como alternativa válida.

## Resultado mobile

Sem overflow horizontal em nenhuma das 4 telas em 375px. Sem erro de
console durante toda a sessão. Nenhum texto solto sem estilo de botão
restante nas telas corrigidas.

## Resultado tablet (768px)

Sidebar de desktop visível (bug de breakpoint corrigido), sem bottom-nav
duplicado, sem overflow em Rateio de Custos, Pesagens ou Modo Curral.

## Resultado desktop (1280px)

Sem overflow em nenhuma das 4 telas. Rateio de Custos em 2 colunas com
prévia proporcional; Modo Curral com card compacto; Sincronização com
cards e botões bem distribuídos.

## Pendências

- Ícone circular cortado: não reproduzido, ver seção acima — precisa de
  nova evidência para investigar futuramente.
- `AcompanhamentoPesoPage.jsx` tem 2 usos do mesmo `primary-btn` sem
  estilo (mesma causa raiz do Rateio/Pesagens/Custos), fora do escopo
  desta sprint — sinalizado como tarefa separada (`task_e9c23553`) em vez
  de expandir o escopo aqui.

## Validações executadas

- `npm run lint` — sem erros.
- `npm test -- --run` — 956 testes, 0 falhas (nenhum teste novo; mudanças
  são JSX/CSS de apresentação, sem lógica nova).
- `npm run build` — build ok.
- Nenhuma migration criada, nenhum `.env`/token alterado ou exposto,
  nenhum print/log/arquivo Obsidian commitado.

## Liberação para teste de 1 mês

**Sim.** O único bug genuinamente bloqueante (formulário do Rateio de
Custos ilegível) está corrigido e verificado estruturalmente. Os P1/P2
relatados também foram corrigidos. O achado extra (gap de navegação
768-900px) era mais grave do que os itens originalmente relatados e
também foi resolvido nesta mesma sprint.
