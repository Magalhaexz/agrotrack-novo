# Decisão de Venda — HERDON (Sprint 32)

Responde duas perguntas centrais da pecuária de corte: **"este lote já está
no ponto de venda?"** e **"quanto está custando produzir uma arroba neste
lote?"**. Domínio: [`src/domain/decisaoVenda.js`](../src/domain/decisaoVenda.js).
Custo por arroba em detalhe: [CUSTO_POR_ARROBA_HERDON.md](CUSTO_POR_ARROBA_HERDON.md).

## Onde aparece

| Local | O que mostra |
|---|---|
| Relatório do Lote (`RelatorioLotePage.jsx`) | Card "Decisão de venda e custo por arroba" — arrobas, custo/@, lucro/@, ponto de equilíbrio, status, simulação "vender hoje vs manter 30 dias" |
| Resultado dos Lotes (`ResultadosPage.jsx`, aba "lote") | Colunas "Custo/@" e "Decisão de venda" na tabela por lote |
| Resumo WhatsApp do lote | Linha `Custo/@: R$ X · Lucro/@: R$ Y · Status: <status>` |
| Hoje na Fazenda / Dashboard | Prioridades "N lotes precisam de avaliação de venda" e "N lotes estão com custo por arroba alto", só quando há pelo menos 1 ocorrência |

## Reuso (nada foi duplicado)

| Métrica | Já calculada em |
|---|---|
| GMD, peso atual, dias no ciclo | `calcLote()` (`src/utils/calculations.js`) |
| Custo total, receita total, lucro total, margem | `calcularResultadoLote()` (`src/domain/calculos.js`) |
| Arrobas de carcaça, custo/@, lucro/@ (situação atual) | `getResumoLote()` (`src/domain/resumoLote.js`) |

`decisaoVenda.js` não recalcula nenhum desses números para o estado atual
do lote — só os organiza num formato estável (`montarDadosDecisaoVenda`) e
adiciona o que não existia: classificação, simulação de cenários e
mensagens em linguagem simples.

## Funções

| Função | O que faz |
|---|---|
| `montarDadosDecisaoVenda(db, loteId)` | Glue — monta o objeto `dados` a partir de `getResumoLote` + `lote.preco_arroba` |
| `calcularArrobasEstimadas({ qtdCabecas, peso, rendimentoCarcaca })` | Arrobas de carcaça para um peso informado — usada também para pesos **projetados** (futuro), o que `getResumoLote` não faz |
| `calcularCustoPorArroba({ custoTotal, arrobas })` | Custo realizado por arroba produzida |
| `calcularPontoEquilibrioArroba({ custoTotal, arrobas })` | Preço mínimo de venda da arroba para não ter prejuízo (mesma fórmula de custo/@, nome próprio porque o significado para o produtor é diferente) |
| `simularVendaHoje(dados)` | Receita, custo e lucro se vender agora |
| `simularManterLote(dados, opções)` | Projeta peso, arrobas, custo adicional e lucro se manter por mais dias |
| `compararVenderOuManter(dados, opções)` | Diferença entre os dois cenários + recomendação (`manter`/`vender`/`indiferente`) + aviso de que é estimativa |
| `classificarDecisaoVenda(dados)` | Status simples (5 categorias, ver abaixo) |
| `gerarInsightVenda(dados)` | Mensagem de uma linha (delega para `classificarDecisaoVenda`) |

## Classificação (5 categorias, em ordem de prioridade)

| Status | Label | Quando aparece |
|---|---|---|
| `dados_insuficientes` | Dados insuficientes | Falta peso, quantidade, arrobas ou custo financeiro |
| `abaixo_meta_gmd` | Abaixo da meta de ganho | Lote tem meta de GMD configurada e o GMD real está abaixo de 90% da meta |
| `custo_alto` | Custo alto por arroba | Custo/@ realizado ≥ 85% do preço-alvo da arroba |
| `pronto_avaliar` | Pronto para avaliar venda | Lucro > 0 e pelo menos 30 dias no lote, sem os problemas acima |
| `acompanhar` | Acompanhar por mais alguns dias | Nenhum problema, mas ainda não passou do mínimo de dias |

**Por que nunca "vender agora":** por instrução explícita da sprint, a
linguagem é sempre "avaliar venda", nunca uma ordem direta — a decisão
comercial final é do produtor, o HERDON só organiza os números.

## Simulação "vender hoje vs manter por mais dias"

Entradas: preço da arroba, dias adicionais, GMD esperado, custo diário por
cabeça, rendimento de carcaça (estes 3 últimos vêm do próprio histórico do
lote como estimativa de partida — ver
[CUSTO_POR_ARROBA_HERDON.md](CUSTO_POR_ARROBA_HERDON.md)).

Saída exibida no relatório:

```
Se vender hoje: lucro estimado de R$ X.
Se manter por 30 dias: lucro estimado de R$ Y.
Diferença estimada: R$ Z.
```

Sempre acompanhado de: **"Simulação estimada. Não substitui avaliação
comercial do produtor."**

## Estados de dados insuficientes

Tratados sem quebrar (ver `temDadosSuficientes` em `decisaoVenda.js`):
lote sem pesagem, sem financeiro, sem quantidade de cabeças, sem peso
atual, sem rendimento (usa 52% padrão), sem preço da arroba (usa R$270
padrão), lote encerrado (entra na classificação igual, sem tratamento
especial — métricas continuam válidas para um lote já fechado), lote sem
data de entrada (dias fica 0, tratado como "ainda não passou do mínimo").
Mensagem: "Ainda faltam dados de pesagem ou financeiro para uma decisão
segura."

## Limitações

- Preço da arroba é o cadastrado no lote (`preco_arroba`) ou R$270 padrão
  — não há cotação de mercado nem variação por praça.
- O custo diário por cabeça usado na simulação de "manter" é uma média do
  histórico do próprio lote, não uma projeção de custo futuro (que pode
  mudar com sazonalidade de suplemento, por exemplo).
- Limiares de classificação (90% da meta de GMD, 85% do preço da arroba,
  30 dias mínimos) são heurísticas de primeira versão — não configuráveis
  por usuário nesta sprint.
- Não há recomendação automática "vender agora" — decisão sempre com o
  produtor.

## Pendências futuras

- Preço da arroba por praça/região.
- Integração com cotação de mercado (B3, CEPEA, etc.).
- Recomendação automática por IA.
- Venda parcial do lote (parte dos animais).
- Venda por animal individual.
- Comparação entre propostas de diferentes compradores.
- Curva de engorda / previsão de acabamento (ponto de terminação).
- Limiares de classificação configuráveis por usuário/sistema de produção.
