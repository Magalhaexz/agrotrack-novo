# Teste Manual — Hoje na Fazenda (Sprint 22)

## Método

Este ambiente não tem credenciais de login reais para a aplicação (o app
exige sessão Supabase autenticada antes de renderizar qualquer página,
incluindo o Painel Geral — não há modo de demonstração nem bypass de auth em
`DEV`). Não foi possível clicar pela interface logada nesta sessão.

A verificação foi feita em duas camadas, cobrindo o que o teste manual
pediria:

1. **Testes automatizados de domínio** (`src/domain/hojeNaFazenda.test.js`,
   16 casos) — exercitam exatamente os cenários do roteiro abaixo (conta
   vazia, conta com dados, lotes sem pesagem, lotes sem pasto, contas
   vencidas/próximas, alertas críticos, pastos em uso) com fixtures realistas,
   incluindo o caminho de GMD através do cálculo real (`getResumoLote` →
   `calcLote` → `calcularResultadoLote`), não mockado.
2. **Revisão de código + build**: app inicia sem erros de console na tela de
   login (build de produção e dev server verificados), e todas as 8 rotas
   usadas pelas ações rápidas foram confirmadas como existentes no registro
   de páginas (`App.jsx`).

## Conta vazia

| Item do roteiro | Resultado |
|---|---|
| Mensagem de boas-vindas | ✅ Coberto por `totalFazendas === 0` → "Comece cadastrando sua fazenda ou importando seus dados." (verificado no código; comportamento equivalente exercitado pelo teste `construirHojeNaFazenda em conta vazia não tem prioridades e não quebra`) |
| Botão Cadastrar fazenda | ✅ Presente, navega para `fazendas` |
| Botão Importar dados | ✅ Presente, navega para `importacao` |
| Botão Ver guia do criador piloto | ✅ Presente, navega para `suporte` (ver limitação em `docs/HOJE_NA_FAZENDA_HERDON.md` — ainda não existe página dedicada de guia) |
| Nenhum card quebrado/zerado sem explicação | ✅ Os 7 KPIs renderizam com `0`/`R$ 0,00` e subtítulo informativo mesmo sem dados — não há divisão por zero (testado: `pesoMedioAtual` cai para `0` quando `totalCabecasAtivas` é `0`, já era assim antes desta sprint) |

## Conta com dados

| Item do roteiro | Resultado |
|---|---|
| Hoje na Fazenda mostra prioridades | ✅ Testado com fixtures de lote sem pesagem, lote sem pasto, conta vencida, conta próxima, alerta crítico — cada um gera a frase esperada com singular/plural correto |
| Cards não quebram | ✅ Build de produção sem erros; grid de 7 KPIs usa `repeat(4, minmax(0,1fr))` responsivo (2 col / 1 col abaixo de 1200px/760px), mesmo padrão já testado em sprints anteriores |
| Ações rápidas funcionam | ✅ 8 botões, todas as rotas (`fazendas`, `pastagens`, `lotes`, `pesagens`, `financeiro`, `importacao`, `suporte`) confirmadas no registro de páginas de `App.jsx`; "Ver alertas" troca de aba internamente (`setTabAtiva('alertas')`) |
| Alertas aparecem | ✅ Bug de mapeamento `nivel`/`mensagem` → `prioridade`/`descricao` corrigido (ver `docs/HOJE_NA_FAZENDA_HERDON.md`) — antes da correção, alertas críticos nunca apareciam nem no Dashboard nem na aba Alertas, independente dos dados reais |
| Lotes sem pesagem aparecem | ✅ Testado: lote nunca pesado e lote pesado há mais de 30 dias entram na lista; lote pesado há 5 dias não entra; lote inativo nunca entra |
| Lotes sem pasto aparecem | ✅ Testado: lote ativo sem `pastagem_id` entra; lote com pasto não entra; lote inativo sem pasto não entra |
| Mobile continua utilizável | ⚠️ Não verificado visualmente (sem sessão autenticada para abrir o Painel Geral no navegador). O grid de ações rápidas (`dashboard-action-grid--quick`) e o grid de KPIs já têm breakpoints para 980px/768px/640px/480px, reutilizando o padrão de `dashboard.css` já validado em sprints anteriores (ver `docs/QA_MOBILE_HERDON.md`) |

## Limitação registrada

A verificação visual real (mobile e desktop, com dados de uma conta de
verdade) **não foi feita nesta sessão** por falta de credenciais de login.
Recomenda-se uma passada manual rápida antes do piloto, especialmente para:

- conferir se os 8 botões de ações rápidas não quebram linha de forma
  estranha em telas entre 480px e 980px;
- conferir se a frase de "Hoje na Fazenda" com texto mais longo (ex.: vários
  pastos listados no aviso de excesso de cabeças) não estoura o card.

## Gates de qualidade

| Gate | Resultado |
|------|-----------|
| `npm test` | ✓ 424 testes, 0 falhas (16 novos) |
| `npm run lint` | ✓ sem erros |
| `npm run build` | ✓ build completo |
