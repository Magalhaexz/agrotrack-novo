# Sprint 26 — Correção de layout financeiro (Custos + Financeiro/DRE)

Este documento tem duas partes: o adendo P0 do botão Cancelar da Pesagem
(já commitado em `f1b7937`) e a correção principal do sprint — layout de
Custos Operacionais e Movimentações Financeiras/DRE.

## Bug P0 encontrado

No formulário de Pesagem (`PesagemForm`, aberto a partir da aba "Nova
pesagem" de `PesagensPage.jsx`), clicar em "Cancelar" não fechava o
modal — o usuário ficava preso na tela de cadastro.

### Causa raiz

A Sprint 25 mudou a aba padrão de Pesagens para "Histórico" e passou a
renderizar o `PesagemForm` automaticamente sempre que a aba "Nova
pesagem" estivesse ativa:

```jsx
{(abrirForm || (abaAtiva === 'nova' && (lotes || []).length > 0)) && (
  <PesagemForm ... onCancel={() => { setAbrirForm(false); setPesagemEditando(null); }} />
)}
```

O `onCancel` só resetava `abrirForm`/`pesagemEditando`, nunca `abaAtiva`.
Como a condição de exibição do modal tem duas cláusulas ligadas por `||`,
zerar `abrirForm` não bastava: se o usuário tivesse chegado pela aba
"Nova pesagem" (clique direto ou atalho do Dashboard), a segunda
cláusula (`abaAtiva === 'nova' && lotes.length > 0`) continuava
verdadeira e o modal reaparecia imediatamente — na prática, o clique em
Cancelar não tinha efeito visível nenhum.

## Correção aplicada

`src/pages/PesagensPage.jsx` — o `onCancel` passado ao `PesagemForm`
agora também troca a aba ativa para `'historico'`:

```jsx
onCancel={() => {
  setAbrirForm(false);
  setPesagemEditando(null);
  setAbaAtiva('historico');
}}
```

Isso cobre os dois casos:
- **Nova pesagem** (via menu → aba, ou via atalho do Dashboard): Cancelar
  fecha o modal e leva para o Histórico, sem salvar nada.
- **Editar pesagem existente** (via Histórico → "Editar", que usa
  `abrirForm=true` sem depender da aba): Cancelar fecha o modal sem
  alterar o registro; o usuário já estava/volta para o Histórico.

Nenhum cálculo de pesagem, GMD, histórico ou regra de negócio foi
alterado — só o comportamento de fechamento do modal. O botão "Salvar
pesagem" (desabilitado até preencher campos obrigatórios, Sprint 23) não
foi tocado.

## Validação

Testado logado, nos dois fluxos de entrada (menu → aba "Nova pesagem";
atalho "Nova pesagem" do Dashboard), em três larguras:

| Largura | Menu → Nova pesagem → Cancelar | Atalho Dashboard → Cancelar |
|---|---|---|
| 375px (mobile) | OK — volta para Histórico, sem overflow | OK — volta para Histórico, sem overflow |
| 768px (tablet) | OK | — (mesmo componente, mesmo comportamento) |
| 1280px (desktop) | — | OK — volta para Histórico, sem overflow |

Confirmado via `getBoundingClientRect`/estado do DOM: modal presente
antes do clique, ausente depois, aba ativa = "Histórico" depois, sem
erro de console em nenhum dos casos.

## Validações executadas

- `npm run lint` — sem erros.
- `npm test -- --run` — 972 testes, 0 falhas (nenhum teste novo — mudança
  é de fiação de estado em um único componente, coberta pela validação
  manual acima; não há teste automatizado de UI para `PesagensPage` no
  projeto).
- `npm run build` — build ok.
- Nenhuma migration, nenhum `.env`/token, nenhum print/log/arquivo
  Obsidian.

## Parte principal: layout de Custos e Financeiro/DRE

### Causa raiz

Duas classes CSS quebradas, cada uma explicando um dos dois sintomas
relatados — nenhuma tinha relação com cálculo, exportação ou regra de
negócio, era puramente `src/styles/app.css` incompleto:

**1. `.kpi-grid-3` nunca teve `display: grid` definido.** A classe é
usada só em `CustosPage.jsx`. O arquivo tem várias regras que ajustam
`grid-template-columns`/`gap` de `.kpi-grid-3` dentro de media queries
(supondo que ela já fosse um grid), mas a regra base nunca foi escrita.
Resultado: `display: block`, e os três `div.kpi-card` (que por sua vez
usam `display:flex; align-items:center` na base) empilhavam como blocos
de largura total. Além disso, `CustosPage.jsx` colocava `.kpi-label`,
`.kpi-value` e `.kpi-sub` como filhos diretos de `.kpi-card` (sem o
wrapper `.kpi-content` que o resto do app usa — ver `PesagensPage.jsx`),
então dentro de cada `.kpi-card` os três elementos ficavam lado a lado
numa linha flex, esticando o card até virar o "banner horizontal" e o
valor "gigante" relatados (na real, o `font-size` do valor não estava
exagerado — o problema era só de layout).

**2. As duas `ResponsiveContainer` de "DRE mensal" e "Distribuição de
despesas" (`FinanceiroPage.jsx`) sempre renderizavam com altura fixa
(220px), mesmo sem dados** — Recharts com `data=[]` ainda ocupa o
espaço todo, só sem nenhuma barra/fatia visível. Sem lotes/movimentações
cadastradas (como no ambiente de piloto), isso são duas caixas pretas
vazias de 220px cada.

Não havia bug nos KPIs "Receita total"/"Despesa total"/"Resultado"
(`.kpi-panel`): a inspeção mostrou fonte 24px/700 no valor e 16.8px/700
no label, dentro do range pedido — o card só parecia "pesado" porque
ficava ao lado dos dois gráficos vazios gigantes.

### Custos Operacionais — corrigido

`src/pages/CustosPage.jsx`: os 3 KPIs (Total lançado / Lançamentos /
Maior categoria) passaram a usar o padrão já validado em
`PesagensPage.jsx` — `kpi-card kpi-card--compact` envolvendo um
`.kpi-content` com label/valor/sub empilhados, e `kpi-grid-3
kpi-grid-3--compact` no grid. Removida também a classe
`kpi-value--large` (não tinha nenhuma regra CSS associada — não fazia
nada).

`src/styles/app.css`: adicionada a regra base que faltava:

```css
.kpi-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
```

Cabeçalho ("Custos Operacionais" + "+ Novo custo") já usa o
`PageHeader` compartilhado — não precisou de ajuste próprio, o
alinhamento "perdido no centro" era efeito colateral do grid quebrado
abaixo dele.

### Financeiro / DRE — corrigido

`src/pages/FinanceiroPage.jsx`: os cards "DRE mensal" e "Distribuição
de despesas" agora checam se há dado antes de montar o gráfico
(`dre.mensal.length === 0` / `Object.keys(dre.despesaPorCategoria)
.length === 0`) e mostram `<EmptyState compact .../>` no lugar —
mesma mensagem pedida ("Sem dados suficientes para gerar o gráfico." /
"Cadastre receitas e despesas para visualizar a análise."). Com dados,
o gráfico aparece normalmente na altura de sempre (220px) — nada mudou
para quem já tem lançamentos.

`src/styles/app.css`: `.export-actions` (usado por `ExportActions.jsx`)
não tinha nenhuma regra própria, só herdava `.action-row` (flex/gap) —
por isso ficava colado nas abas acima e no card de KPIs abaixo. Adicionado
`margin: 4px 0 16px` só nessa classe.

KPIs "Receita total"/"Despesa total"/"Resultado" (`.kpi-panel`) não
precisaram de CSS novo — já estavam dentro do range de fonte pedido; o
que fazia parecer "grande e pesado" eram os gráficos vazios ao lado,
resolvidos acima.

### Exportação preservada

Nenhuma mudança em `exportacaoRelatorios.js`, `exportacaoArquivos.js`,
nem nas colunas/linhas passadas para `baixarCsv`/
`abrirRelatorioParaImpressao`. `ExportActions` só ganhou espaçamento
(`margin`), nenhuma prop ou comportamento novo.

### Validação visual

Logado, sem lotes/movimentações cadastrados (dado real do ambiente de
piloto — pior caso para o bug dos gráficos vazios):

| Largura | Custos Operacionais | Financeiro/DRE |
|---|---|---|
| 375px (mobile) | OK — 1 coluna, sem overflow (`scrollWidth === clientWidth`) | OK — 1 coluna, sem overflow |
| 768px (tablet) | OK — 1 coluna (breakpoint padrão do app a 768px, mesmo de `.grid-2/3/4`) | OK |
| 1280px (desktop) | OK — 3 colunas iguais | OK — KPIs em 2 colunas + 1 linha (breakpoint pré-existente do `.dashboard-grid--kpi-main` a `max-width:1280px`, não é regressão desta sprint); gráficos mostram EmptyState compacto em vez de caixa vazia |

Confirmado via `getComputedStyle`/`getBoundingClientRect` (screenshot
indisponível nesta sessão por instabilidade da ferramenta de preview):
`kpi-value` com `font-size: 23px`, `font-family: Inter` (sem
monoespaçada) em Custos; sem erro de console; sem `NaN`/`undefined` no
texto renderizado.

### Pendências / observações

- `.dashboard-grid--kpi-main` (usado por Financeiro) é a mesma classe
  do Dashboard/Painel principal, que já tem um sistema de breakpoints
  próprio e complexo (`repeat(4)` sem media, mais 6 media queries
  diferentes ajustando de 4 até 1 coluna). Em 1280px exatos essa classe
  já colapsava para 2 colunas antes desta sprint — não mexi nesse
  sistema (risco alto de regressão no Painel para um efeito só
  perceptível na borda exata de 1280px); os 3 KPIs do Financeiro
  aparecem 2+1 em vez de 3 em linha nessa largura específica, mas de
  forma proporcional, sem overflow nem card gigante.
- Não há teste automatizado de UI para `CustosPage`/`FinanceiroPage`
  neste projeto — validação é via inspeção do DOM renderizado
  (`preview_inspect`/`preview_eval`), documentada acima.
