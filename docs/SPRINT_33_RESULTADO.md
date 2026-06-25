# Sprint 33 — Resultado

## Funcionalidade entregue

**Sanidade e Suplementação ligadas ao Resultado**

Conecta os registros já existentes de sanidade (`db.sanitario`) e
suplementação (`db.consumo_suplementacao`) ao GMD, custo por arroba
(Sprint 32) e resultado do lote, respondendo de forma prática: o manejo
está em dia, o suplemento está custando o quanto e isso aparece (ou não)
no desempenho do lote. Não é um módulo veterinário — não há recomendação
de medicamento, dose ou protocolo, e nenhuma causalidade absoluta é
afirmada (linguagem de "indício"/"acompanhar"/"comparar").

## 1. Onde aparece sanidade/suplementação ligada ao resultado

- **Relatório do Lote** (`RelatorioLotePage.jsx`) — novo card "Manejo,
  sanidade e suplementação": status sanitário, custo de suplementação no
  período, custo/cabeça, custo/@ e os insights gerados.
- **Card de Decisão de Venda** (mesma página) — sinais complementares
  quando há custo de suplemento alto ou manejo a revisar.
- **Resumo WhatsApp do lote** — linha nova `Manejo: Sanidade <status> ·
  Suplemento: R$ X/cab · Insight: <texto>` (ou linha de fallback quando
  faltam dados).
- **Hoje na Fazenda / Dashboard** — uma prioridade combinada nova: "N
  lotes precisam de revisão de manejo ou suplementação."

## 2. Métricas criadas

- Status sanitário em 4 categorias (Em dia, Atenção, Sem registro,
  Revisar manejo), com última ocorrência, dias desde o último manejo,
  total de ocorrências no período (90 dias) e tipo mais recente.
- Custo de suplemento por cabeça e por arroba, isolando o que já estava
  agregado no custo total do lote desde a Sprint 32.
- Classificação de eficiência da suplementação em 5 categorias
  (Suplementação com desempenho positivo, Custo de suplemento elevado,
  Sem dados suficientes, Sem registro de suplemento, Acompanhar GMD).
- Sinal simples (não causal) entre custo de suplemento e GMD x meta.
- Risco operacional em 3 níveis (baixo/médio/alto), combinando sanidade e
  GMD.

Detalhes e fórmulas: [MANEJO_RESULTADO_HERDON.md](MANEJO_RESULTADO_HERDON.md),
[SANIDADE_HERDON.md](SANIDADE_HERDON.md),
[SUPLEMENTACAO_HERDON.md](SUPLEMENTACAO_HERDON.md).

## 3. Integração com Decisão de Venda

**Sim, sem mudar a classificação original.** `gerarSinaisComplementaresVenda`
acrescenta até 2 avisos complementares ao card de Decisão de Venda:
"Atenção: custo de suplementação elevado pode estar afetando o custo por
arroba." e "Atenção: há manejo recente que merece acompanhamento antes da
venda." — exibidos junto, sem alterar `classificarDecisaoVenda` (Sprint
32), que continua intacta.

## 4. Integração com Hoje na Fazenda

**Sim, uma única prioridade combinada** (não 5 separadas, para não poluir
o painel): `listarLotesParaRevisaoManejo` une lotes com sanidade "Revisar
manejo" ou suplementação "Custo de suplemento elevado", deduplicados por
lote, e gera "N lotes precisam de revisão de manejo ou suplementação."

## 5. Integração com relatório e WhatsApp

**Sim.** `buildRelatorioLote()` (relatorios.js) ganha `manejoResultado` e
`sinaisComplementaresVenda`. `gerarResumoLoteTexto()` (whatsappResumo.js)
ganha a linha de manejo descrita no item 1, retrocompatível (relatórios
antigos sem `manejoResultado` continuam funcionando sem essa linha).

## 6. Resultado do teste manual

**Parcial, documentado honestamente.** Sem credenciais de conta
autenticada, não foi possível abrir as telas logado e confirmar
visualmente. App builda e roda sem erros; tela de login carrega limpa.
Roteiro de 11 itens pendente de execução por alguém com acesso real — ver
[MANEJO_RESULTADO_TESTE_MANUAL.md](MANEJO_RESULTADO_TESTE_MANUAL.md).

## 7. Quantidade de testes criados

**34 testes novos:**
- 26 em `src/domain/manejoResultado.test.js` (sanidade sem registro/em
  dia/atenção/revisar manejo, ocorrência crítica recente, custo de
  suplemento por cabeça/arroba, classificação de eficiência da
  suplementação nas 5 categorias, relação suplemento×GMD, risco
  sanitário, insights combinados, sinais de venda, integração via
  `montarDadosManejoResultado`).
- 4 em `src/domain/hojeNaFazenda.test.js` (lista combinada de revisão de
  manejo, prioridade no Dashboard).
- 2 em `tests/relatorios.test.js` (relatório sem dados de manejo,
  relatório com sanidade/suplementação reais).
- 2 em `tests/whatsappResumo.test.js` (linha de manejo no WhatsApp com e
  sem registros).

## 8. Resultado de `npm test`, `lint` e `build`

| Gate | Resultado |
|---|---|
| `npm test` | 607 testes, 0 falhas (573 antes + 34 novos) |
| `npm run lint` | 0 erros |
| `npm run build` | Build de produção concluído com sucesso |

## Arquivos novos

| Arquivo | Descrição |
|---|---|
| `src/domain/manejoResultado.js` | Domínio puro: sanidade, suplementação, risco, insights, sinais de venda |
| `src/domain/manejoResultado.test.js` | 26 testes do domínio |
| `docs/SANIDADE_HERDON.md` | Documentação da leitura sanitária |
| `docs/SUPLEMENTACAO_HERDON.md` | Documentação da leitura de suplementação |
| `docs/MANEJO_RESULTADO_HERDON.md` | Documentação da integração completa |
| `docs/MANEJO_RESULTADO_TESTE_MANUAL.md` | Registro honesto do que foi e não foi testado |
| `docs/SPRINT_33_RESULTADO.md` | Este documento |

## Arquivos modificados

| Arquivo | O que mudou |
|---|---|
| `src/domain/relatorios.js` | `buildRelatorioLote` ganha `manejoResultado` e `sinaisComplementaresVenda` |
| `src/domain/whatsappResumo.js` | `gerarResumoLoteTexto` ganha linha de manejo/sanidade/suplementação |
| `src/domain/hojeNaFazenda.js` | Nova função `listarLotesParaRevisaoManejo` + 1 prioridade combinada |
| `src/pages/RelatorioLotePage.jsx` | Novo card "Manejo, sanidade e suplementação" + sinais complementares no card de venda |
| `docs/RELATORIOS_HERDON.md` | Nota sobre a integração nova |
| `docs/MODO_CURRAL_HERDON.md` | Pendência de atalho de sanidade/suplemento reavaliada e justificada |
| `docs/BETA_PILOTO_READY_HERDON.md` | Atualização de sprint |
| `tests/relatorios.test.js`, `tests/whatsappResumo.test.js`, `src/domain/hojeNaFazenda.test.js` | Testes novos de integração |

## Decisões técnicas

### Por que não usar os campos `lotes.supl_*` para o custo de suplementação

Esses campos (`supl_rkg`, `supl_pv_pct`, `supl_meta_dias`,
`supl_estoque_kg`) são **planejamento/meta**, não consumo real — já
alimentam alertas de estoque em `calcLote` desde antes desta sprint.
Misturá-los com `consumo_suplementacao` (registro real, com despesa
financeira vinculada) inflaria ou distorceria o custo real. A Sprint 33
usa exclusivamente o consumo real, que é o que efetivamente entra no
custo do lote.

### Por que uma prioridade combinada em Hoje na Fazenda, não várias

A própria sprint pediu explicitamente para evitar poluir o Dashboard,
com o exemplo "3 lotes precisam de revisão de manejo ou suplementação."
— um item, não cinco. A função `listarLotesParaRevisaoManejo` já faz essa
união internamente.

### Por que não adicionar atalho de sanidade/suplemento no Modo Curral

Documentado em
[MANEJO_RESULTADO_HERDON.md](MANEJO_RESULTADO_HERDON.md#modo-curral--decisão-de-não-adicionar-atalho-nesta-sprint):
os formulários existentes não são offline-safe, e adicioná-los ao Modo
Curral sem essa garantia quebraria a consistência estabelecida na Sprint
31. A própria Sprint 33 autorizou deixar isso como pendência documentada.

## Limitações conhecidas

- Limiares de classificação (60/120 dias para sanidade, 40% para custo
  de suplemento alto, 90 dias para janela de ocorrências críticas) são
  heurísticas fixas de primeira versão.
- Não há calendário sanitário, carência, protocolo por categoria, estoque
  vinculado ao manejo, consumo por cocho, curva de engorda ou comparação
  entre dietas.
- Nenhuma verificação visual/funcional com conta autenticada foi possível.

## Pendências para Sprint 34

- Rodar o roteiro de teste manual
  (`docs/MANEJO_RESULTADO_TESTE_MANUAL.md`) com conta autenticada e
  lotes em estágios variados de sanidade/suplementação.
- Avaliar se os limiares de classificação devem ser configuráveis.
- Avaliar atalho de Modo Curral para sanidade/suplemento com fluxo
  offline dedicado, se a demanda do piloto justificar.
- Calendário sanitário e carência (pendências da Sprint 32 também
  seguem abertas: roteiro de teste manual da decisão de venda,
  `supabase migration repair`, avisos do `get_advisors`).
