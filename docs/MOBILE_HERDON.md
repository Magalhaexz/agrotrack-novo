# Mobile — HERDON (Sprint 35)

## Bug corrigido: cabeçalho cortado em 375px (achado da Sprint 34)

### Sintoma

Em viewports ≤900px, o cabeçalho principal (`.header.top-header`) ficava
10px mais largo que a tela, cortando a borda direita — texto da marca/
título sobreposto, ícones de notificação/sincronização espremidos ou
parcialmente fora da área visível.

### Causa raiz

Havia **duas regras CSS concorrentes** para `.header.top-header`, ambas
dentro de `@media (max-width: 900px)`, em pontos diferentes de
`src/styles/app.css`:

1. Uma regra mais antiga (linha ~4751) usa o padrão "cartão flutuante":
   `left:0; right:0; margin: 0 10px;` (insets de 10px de cada lado).
2. Uma regra mais nova (linha ~8174) usa o padrão "full bleed":
   `left:0; width:100%;` — mas **não reseta `margin`**, herdando o
   `margin: 0 10px` da regra #1.

Resultado: `width:100%` (375px, ignorando margem) **mais** `margin-left:
10px` (da regra #1) = caixa de 375px começando em x=10, terminando em
x=385 — 10px fora da viewport de 375px. Confirmado por
`getBoundingClientRect()` antes e depois da correção.

Esta é a mesma classe de problema já documentada desde a Sprint 27
(`docs/POLIMENTO_VISUAL_HERDON.md`) — duplicidade de regras de cabeçalho
mobile em `app.css`/`layout.css` nunca consolidada.

### Correção

`src/styles/app.css`, regra #2 (full bleed, a que realmente vence a
cascata): adicionado `margin: 0;` para neutralizar a margem herdada da
regra #1, já que o design "full bleed" não pretende ter insets.

```css
@media (max-width: 900px) {
  .header.top-header {
    left: 0;
    width: 100%;
    margin: 0; /* Sprint 35 */
    z-index: 1500;
  }
}
```

Confirmado por medição: `document.body.scrollWidth` igual à largura da
viewport (sem overflow horizontal) em 375/390/430/768px e desktop.

### O que NÃO foi corrigido

A duplicidade de regras em si (dezenas de blocos `.header.top-header`
espalhados por `app.css`) **não foi consolidada** — só a colisão
específica que causava o overflow real. Consolidar tudo em um único
bloco coerente é um trabalho de CSS maior, fora do escopo desta sprint
de correção pontual de fluxo.

## Validação objetiva por breakpoint (Sprint 35)

Verificação feita medindo `document.body.scrollWidth` (overflow
horizontal real, não inspeção visual) com a conta QA autenticada, em
375px, 390px, 430px, 768px e desktop (1280px), nas páginas:

| Página | 375 | 390 | 430 | 768 | Desktop |
|---|---|---|---|---|---|
| Dashboard / Hoje na Fazenda | ✅ | ✅ | ✅ | ✅ | ✅ |
| Modo Curral | ✅ | ✅ | ✅ | ✅ | — |
| Sincronização | ✅ | ✅ | ✅ | ✅ | — |
| Resultado dos Lotes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Relatório do Lote | ✅ | ✅ | — | — | — |
| Lotes e Rebanho | ✅ | ✅ | ✅ | ✅ | — |
| Pesagens | ✅ | ✅ | ✅ | ✅ | — |
| Movimentações Financeiras | ✅ | ✅ | ✅ | ✅ | — |
| Pastos | ✅ | ✅ | ✅ | ✅ | — |
| Login | ✅ | — | — | — | — |

"—" significa que a combinação específica não foi testada nesta sessão
(não que tenha falhado) — coberto o suficiente para confirmar que a
correção do cabeçalho generalizou bem, sem testar exaustivamente toda
combinação de página×breakpoint.

## Limitações

- A verificação usa `scrollWidth` (ausência de overflow horizontal), não
  screenshot — a ferramenta de screenshot apresentou instabilidade nesta
  sessão (timeouts). A medição numérica é, na prática, mais confiável
  para detectar overflow/corte do que inspeção visual manual.
- Não foi feita verificação de overlap vertical (elementos sobrepostos
  sem causar overflow horizontal) além do cabeçalho — se houver, não foi
  detectado por este método.
