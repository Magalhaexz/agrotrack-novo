# Manejo, Sanidade e Suplementação ligados ao Resultado — HERDON (Sprint 33)

Conecta sanidade e suplementação ao GMD, custo por arroba (Sprint 32) e
resultado do lote, respondendo de forma prática:

- "Este lote está recebendo suplemento, mas isso está aparecendo no ganho
  de peso?"
- "Os manejos sanitários deste lote estão em dia?"
- "O custo de suplemento está pesando no custo por arroba?"
- "Existe risco operacional que pode afetar o desempenho do lote?"

Não é um módulo veterinário completo — é uma leitura prática: **manejo
feito, suplemento usado, custo gerado e efeito no desempenho**. Domínio:
[`src/domain/manejoResultado.js`](../src/domain/manejoResultado.js).
Detalhamento por área: [SANIDADE_HERDON.md](SANIDADE_HERDON.md) e
[SUPLEMENTACAO_HERDON.md](SUPLEMENTACAO_HERDON.md).

## Reuso (nada foi duplicado)

| Dado | Já calculado em |
|---|---|
| GMD, peso, dias no ciclo, arrobas | `calcLote()` / `getResumoLote()` |
| Custo total, custo por arroba, lucro por arroba, status de decisão de venda | `decisaoVenda.js` (Sprint 32) |
| Registros sanitários | `db.sanitario` (já existia) |
| Registros de consumo de suplemento | `db.consumo_suplementacao` (já existia) |

`manejoResultado.js` só lê esses dados e organiza a leitura — não
recalcula GMD, arrobas, custo ou lucro.

## Função glue

`montarDadosManejoResultado(db, loteId)` monta:

```
{
  encontrado,
  sanidade: { status, statusLabel, mensagem, ultimaOcorrencia, diasDesdeUltimoManejo, totalOcorrenciasPeriodo, tipoMaisRecente },
  suplementacao: { temRegistro, custoSuplementoTotal, quantidadeTotal, custoPorCabeca, custoPorArroba, status, statusLabel, mensagem },
  relacaoGmd: { sinal, mensagem },
  risco: { nivel, mensagem },
  insights: [string, ...],
}
```

## Risco operacional (`classificarRiscoSanitario`)

Responde "existe risco operacional que pode afetar o desempenho do
lote?" combinando status sanitário e GMD x meta — não é diagnóstico
veterinário, é um sinal de atenção operacional.

| Nível | Quando |
|---|---|
| Alto | Sanidade em "Revisar manejo" |
| Médio | Sanidade em "Atenção"/"Sem registro", OU GMD abaixo de 90% da meta |
| Baixo | Sanidade "Em dia" e GMD dentro/acima da meta (ou sem meta) |

## Integração com Resultado do Lote

Card "Manejo, sanidade e suplementação" no Relatório do Lote
(`RelatorioLotePage.jsx`): status sanitário, custo de suplementação no
período, custo/cabeça, custo/@, e os insights gerados. Estado vazio:
"Ainda não há registros suficientes de sanidade ou suplementação para
este lote."

## Integração com Decisão de Venda (Sprint 32)

`gerarSinaisComplementaresVenda(dadosManejo)` **não muda** a classificação
de `classificarDecisaoVenda` — só acrescenta avisos complementares,
mostrados junto ao card de Decisão de Venda:

- "Atenção: custo de suplementação elevado pode estar afetando o custo
  por arroba." (quando suplementação está em "Custo de suplemento
  elevado")
- "Atenção: há manejo recente que merece acompanhamento antes da venda."
  (quando sanidade está em "Revisar manejo")

## Integração com Hoje na Fazenda / Dashboard

Uma única prioridade combinada (`listarLotesParaRevisaoManejo`, em
`hojeNaFazenda.js`), para não poluir o painel:

> "N lotes precisam de revisão de manejo ou suplementação."

Inclui lotes com sanidade em "Revisar manejo" OU suplementação em "Custo
de suplemento elevado" — união, sem duplicar contagem por lote.

## Integração com Relatórios e WhatsApp

- `buildRelatorioLote()` ganha `manejoResultado` e `sinaisComplementaresVenda`.
- `gerarResumoLoteTexto()` ganha uma linha:
  `Manejo: Sanidade em dia · Suplemento: R$ 72/cab · Insight: <texto>`
  (cada segmento só aparece se houver dado; sem nenhum dado, a linha é
  `Manejo: sem registros suficientes.`).

## Modo Curral — decisão de não adicionar atalho nesta sprint

Avaliado e **não implementado**: os formulários existentes de sanidade
(`SanitarioForm.jsx`) e suplementação (`SuplementacaoConsumoModal.jsx`)
gravam direto no Supabase (online), sem passar pela fila offline que o
Modo Curral usa para as outras 4 ações (Sprint 31). Adicionar um atalho
significaria ou (a) duplicar um fluxo offline novo para esses dois
formulários — módulo grande, fora do escopo desta sprint — ou (b) quebrar
a garantia de "tudo no Modo Curral funciona offline" ao incluir uma ação
que só funciona online. Documentado como pendência para avaliação futura,
conforme permitido pela própria sprint.

## Estados de dados insuficientes (Etapa 10)

Tratados sem quebrar: lote sem sanidade, sem suplementação, sem
pesagens, sem financeiro, sem custo, sem quantidade de cabeças, sem data
de entrada, registros incompletos, `db` nulo/vazio. Sempre que faltar a
base mínima, a função retorna o status "sem registro"/"dados
insuficientes" com a mensagem correspondente — nunca lança erro nem
mostra `R$ 0,00`/`NaN` como se fosse um valor real.

## Limitações e pendências futuras

- Calendário sanitário, carência, protocolos por categoria animal.
- Estoque vinculado ao manejo, consumo diário por cocho.
- Integração com previsão de acabamento / curva de engorda.
- Comparação entre dietas, custo alimentar detalhado.
- Limiares de classificação (dias, % de custo) configuráveis.
- Atalhos de Modo Curral para sanidade/suplementação (ver acima).
