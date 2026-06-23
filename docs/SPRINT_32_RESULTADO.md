# Sprint 32 — Resultado

## Funcionalidade entregue

**Decisão de Venda e Custo por Arroba**

Transforma os dados de peso, custo, receita e GMD que o HERDON já calcula
em uma leitura prática: "este lote já está no ponto de venda?" e "quanto
está custando produzir uma arroba neste lote?". Toda a base de cálculo
(GMD, arrobas, custo, receita, lucro, ROI) já existia — esta sprint criou
a camada de classificação, simulação e mensagens em linguagem simples por
cima dela, sem duplicar nenhuma fórmula.

## 1. Onde aparece a decisão de venda

- **Relatório do Lote** (`RelatorioLotePage.jsx`) — novo card "Decisão de
  venda e custo por arroba": arrobas estimadas, custo/@, lucro/@, ponto de
  equilíbrio, preço-alvo, status e simulação resumida.
- **Resultado dos Lotes** (`ResultadosPage.jsx`, aba "lote") — colunas
  novas "Custo/@" e "Decisão de venda" (com badge colorido) na tabela por
  lote.
- **Resumo WhatsApp do lote** — linha nova `Custo/@: R$ X · Lucro/@: R$ Y
  · Status: <status>`.
- **Hoje na Fazenda / Dashboard** — duas prioridades novas, só quando há
  pelo menos 1 ocorrência: "N lotes precisam de avaliação de venda" e "N
  lotes estão com custo por arroba alto".

## 2. Como o custo por arroba é calculado

```
arrobas de carcaça = (cabeças × peso vivo atual × rendimento de carcaça) / 15
custo por arroba    = custo total do lote / arrobas de carcaça
```

Rendimento de carcaça padrão 52% (configurável por lote). Custo total =
despesas vinculadas ao lote em `movimentacoes_financeiras` (excluindo
`previsto`/`cancelado`) + custos legados não duplicados. **Nenhuma dessas
fórmulas foi recalculada do zero** — vêm de `calcularResultadoLote()`
(`src/domain/calculos.js`) e `getResumoLote()` (`src/domain/resumoLote.js`),
já existentes. Detalhes completos: [CUSTO_POR_ARROBA_HERDON.md](CUSTO_POR_ARROBA_HERDON.md).

## 3. Simulações criadas

- **Vender hoje** (`simularVendaHoje`): receita = arrobas × preço-alvo;
  lucro = receita − custo total.
- **Manter por mais dias** (`simularManterLote`): projeta peso (peso atual
  + GMD × dias), recalcula arrobas para o peso projetado, soma custo
  adicional (custo diário por cabeça × cabeças × dias) e calcula lucro
  projetado.
- **Comparação** (`compararVenderOuManter`): diferença entre os dois
  lucros + recomendação (`manter`/`vender`/`indiferente`) + aviso fixo:
  "Simulação estimada. Não substitui avaliação comercial do produtor."

No Relatório do Lote, a simulação usa 30 dias adicionais, o GMD atual do
lote como GMD esperado, e o custo diário por cabeça **estimado a partir do
histórico do próprio lote** (custo total ÷ dias ÷ cabeças) — não é um
campo novo para o produtor preencher nesta primeira versão.

## 4. Relatórios atualizados

- `src/domain/relatorios.js` (`buildRelatorioLote`) — adiciona
  `precoArroba`, `decisaoVenda` (classificação) e `simulacaoVenda`
  (comparação vender/manter, `null` quando dados insuficientes).
- `src/domain/whatsappResumo.js` (`gerarResumoLoteTexto`) — linha nova de
  custo/lucro por arroba e status, só quando o relatório tiver
  `decisaoVenda` (retrocompatível com chamadas antigas sem esse campo).
- `RelatorioLotePage.jsx` — novo card visual.
- `ResultadosPage.jsx` — novas colunas na tabela "Panorama por lote".

## 5. Resultado do teste manual

**Parcial, documentado honestamente.** Sem credenciais de conta
autenticada, não foi possível abrir as telas logado e confirmar
visualmente. App builda e roda sem erros; tela de login carrega limpa.
Roteiro de 11 itens pendente de execução por alguém com acesso real — ver
[DECISAO_VENDA_TESTE_MANUAL.md](DECISAO_VENDA_TESTE_MANUAL.md).

## 6. Quantidade de testes criados

**27 testes novos:**
- 20 em `src/domain/decisaoVenda.test.js` (arrobas estimadas, custo/@,
  ponto de equilíbrio, vender hoje, manter por dias, diferença entre
  cenários, dados insuficientes, GMD abaixo da meta, custo alto, lote
  pronto para avaliação, nunca recomenda "vender agora").
- 3 em `src/domain/hojeNaFazenda.test.js` (classificação por status,
  prioridade nova no Dashboard).
- 2 em `tests/whatsappResumo.test.js` (linha de custo/@ no WhatsApp,
  compatibilidade sem `decisaoVenda`).
- 2 em `tests/relatorios.test.js` (relatório com dados completos,
  simulação ausente quando faltam dados financeiros).

## 7. Resultado de `npm test`, `lint` e `build`

| Gate | Resultado |
|---|---|
| `npm test` | 573 testes, 0 falhas (546 antes + 27 novos) |
| `npm run lint` | 0 erros |
| `npm run build` | Build de produção concluído com sucesso |

## Arquivos novos

| Arquivo | Descrição |
|---|---|
| `src/domain/decisaoVenda.js` | Domínio puro: arrobas, custo/@, ponto de equilíbrio, simulações, classificação |
| `src/domain/decisaoVenda.test.js` | 20 testes do domínio |
| `docs/DECISAO_VENDA_HERDON.md` | Documentação de produto/arquitetura |
| `docs/CUSTO_POR_ARROBA_HERDON.md` | Documentação detalhada da fórmula |
| `docs/DECISAO_VENDA_TESTE_MANUAL.md` | Registro honesto do que foi e não foi testado |
| `docs/SPRINT_32_RESULTADO.md` | Este documento |

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `src/domain/resumoLote.js` | Nenhuma alteração de lógica — só confirmado por leitura, é a base reaproveitada |
| `src/domain/relatorios.js` | `buildRelatorioLote` ganha `precoArroba`, `decisaoVenda`, `simulacaoVenda` |
| `src/domain/whatsappResumo.js` | `gerarResumoLoteTexto` ganha linha de custo/lucro por arroba e status |
| `src/domain/hojeNaFazenda.js` | Nova função `listarLotesPorStatusDecisaoVenda` + 2 prioridades novas |
| `src/pages/RelatorioLotePage.jsx` | Novo card "Decisão de venda e custo por arroba" |
| `src/pages/ResultadosPage.jsx` | Novas colunas "Custo/@" e "Decisão de venda" na tabela por lote |
| `docs/RELATORIOS_HERDON.md` | Nota sobre a integração nova |
| `docs/BETA_PILOTO_READY_HERDON.md` | Atualização de sprint |
| `tests/whatsappResumo.test.js`, `tests/relatorios.test.js` | Testes novos de integração |

## Decisões técnicas

### Por que não recalcular GMD/arrobas/custo do zero

A Etapa 1 (diagnóstico) confirmou que `calcLote`, `calcularResultadoLote`
e `getResumoLote` já produzem exatamente os números que a Sprint 32
precisa para o estado atual do lote. Recalcular seria duplicar fórmula —
proibido pela própria sprint. `decisaoVenda.js` só recalcula arrobas numa
situação que as funções existentes não cobrem: peso **projetado**
(hipotético, usado na simulação de "manter por mais dias"), que não existe
em nenhum animal real ainda.

### Por que "ponto de equilíbrio" é uma função própria, mesmo sendo a mesma conta de "custo por arroba"

Documentado em detalhe em
[CUSTO_POR_ARROBA_HERDON.md](CUSTO_POR_ARROBA_HERDON.md#por-que-ponto-de-equilíbrio-é-função-separada-de-custo-por-arroba) —
resumindo: significado diferente para o produtor (olhar para trás vs.
decisão), mesmo que o número hoje seja idêntico.

### Por que a classificação nunca diz "vender agora"

Instrução explícita da sprint. A linguagem é sempre "avaliar venda" — o
HERDON organiza os números, a decisão comercial (quando, para quem, por
qual preço) continua sendo do produtor.

### Por que o custo diário por cabeça da simulação é estimado, não pedido ao usuário

Pedir um campo novo no formulário de lote seria escopo maior do que a
sprint aprovou ("primeira versão"). Usar a média do próprio histórico do
lote (custo total ÷ dias ÷ cabeças) dá um número de partida razoável sem
exigir cadastro novo — documentado como limitação, não como dado
definitivo.

## Limitações conhecidas

- Preço da arroba sem cotação de mercado/praça — só o cadastrado no lote
  ou R$270 padrão.
- Custos compartilhados (rateio) não entram automaticamente no custo do
  lote — mesma limitação já existente antes desta sprint.
- Limiares de classificação (90% da meta de GMD, 85% do preço da arroba,
  30 dias mínimos) são heurísticas fixas, não configuráveis.
- Nenhuma verificação visual/funcional com conta autenticada foi possível.

## Pendências para Sprint 33

- Rodar o roteiro de teste manual (`docs/DECISAO_VENDA_TESTE_MANUAL.md`)
  com conta autenticada e lotes em estágios variados.
- Avaliar se os limiares de classificação devem ser configuráveis.
- Considerar integração com cotação de arroba por praça/região.
- Considerar venda parcial e venda por animal individual.
- `supabase migration repair --status applied 20260618000000` (pendência
  da Sprint 30.1, ainda aberta).
- Avaliar os avisos do `get_advisors` do Supabase (pendência da Sprint
  30.1, ainda aberta).
