# Inteligência HERDON — Motor de Alertas e Insights

> Sprint 1: "Motor de Alertas Inteligentes e Insights do HERDON"
> Data: 2026-07-02 · Branch `main`

## 1. Objetivo

Criar o motor central de alertas e insights do HERDON — funções puras, sem UI — que respondem a perguntas de gestão da fazenda. É a base para features futuras: **Decisões da Fazenda**, **Alertas Automáticos**, **Assistente HERDON**, **Saúde do Lote** e **Relatórios**. Nenhuma tela nova foi criada nesta sprint.

## 2. Arquivos criados

| Arquivo | Papel |
|---|---|
| `src/domain/alertasInteligentes.js` | Motor de detecção: 6 detectores + 1 agregador priorizado |
| `src/domain/alertasInteligentes.test.js` | 27 testes cobrindo os detectores e o agregador |
| `src/domain/insightsFazenda.js` | Camada de insight: saúde geral da fazenda + resumo em texto |
| `src/domain/insightsFazenda.test.js` | 8 testes cobrindo classificação de saúde e resumo |

Nenhum arquivo existente foi alterado. O motor **reaproveita** regras já testadas em vez de duplicá-las:
- `avaliarDesempenhoGmd` (`gmdAlerta.js`) e `getResumoLote` (`resumoLote.js`) para GMD e peso;
- `deveEntrarNoResultadoLote` (`financeiroStatus.js`) para filtrar despesas válidas;
- `toNumber`/`toDateKey`/`daysBetween`/`isAnimalAtivo` (`calcHelpers.js`) para datas e números.

Também confirmei que já existe um protótipo antigo em `src/domain/alertas.js` — **não é importado por nenhum arquivo** (código morto de uma sprint anterior). Não foi tocado nem removido, por estar fora do escopo desta sprint.

## 3. Contrato de cada alerta

```js
{
  id: string,               // estável, único por origem (ex.: 'gmd-abaixo-12')
  tipo: string,              // 'gmd' | 'peso_alvo' | 'estoque' | 'tarefa' | 'sanidade' | 'custo'
  severidade: string,        // 'critico' | 'alto' | 'medio' | 'baixo' (export SEVERIDADE)
  titulo: string,
  descricao: string,
  entidade: { tipo, id, nome }, // 'lote' | 'estoque' | 'tarefa' | 'sanidade' | 'financeiro'
  acaoSugerida: string,
  pagina: string,            // página sugerida (chave de rota do app: 'resultados', 'estoque', 'tarefas', 'sanitario', 'financeiro')
}
```

## 4. Os 7 entregáveis

1. **`detectarLotesAbaixoGmd(db)`** — lotes ativos com `gmd_meta` cadastrada cujo GMD realizado (via `getResumoLote`) fica abaixo da meta, com pesagens suficientes (`avaliarDesempenhoGmd` exige ≥2). Severidade por % de desvio: ≥20% crítico, ≥10% alto, abaixo disso médio.
   Exemplo real gerado: *"Lote Nelore está abaixo do GMD esperado"* — "GMD atual de 0.50 kg/dia, 50% abaixo da meta de 1.00 kg/dia."

2. **`detectarLotesProximosPesoAlvo(db)`** — lotes ativos com `peso_alvo` cadastrado e peso atual (`getResumoLote`) ≥90% do alvo. ≥100% → alto ("atingiu o peso alvo, avaliar venda"); ≥95% → médio; ≥90% → baixo.
   Exemplo: *"Lote Nelore está próximo do peso alvo"*.

3. **`detectarEstoqueBaixo(db, agora)`** — combina estoque zerado, abaixo do mínimo cadastrado **e** previsão de esgotamento pelo consumo real dos últimos 30 dias (`movimentacoes_estoque` tipo `saida`). ≤7 dias de estoque → crítico; ≤15 dias → médio; abaixo do mínimo sem previsão → alto; até 1,5× o mínimo → baixo.
   Exemplo real gerado: *"Sal mineral pode acabar em 7 dias"*.

4. **`detectarTarefasAtrasadas(db, agora)`** — tarefas (`db.tarefas`) com `data_vencimento` no passado e status ≠ `concluida`. ≥7 dias de atraso ou prioridade `alta`/`critica` → crítico; ≥2 dias → alto; senão médio.

5. **`detectarSanidadeProxima(db, agora)`** — registros de `sanitario` com `proxima` vencida ou dentro da janela de aviso (`alerta_dias_antes`, padrão 7 dias). Vencido → crítico; hoje/amanhã → alto; dentro da janela → médio.
   Exemplo real gerado: *"Vacinação do Lote Recria vence amanhã"*.

6. **`detectarCustoAcimaDoPrevisto(db, agora)`** — compara despesas da fazenda dos últimos 30 dias com os 30 dias anteriores (`movimentacoes_financeiras`, respeitando `deveEntrarNoResultadoLote`). Só alerta com alta ≥15% **e** dado nas duas janelas (evita falso positivo por falta de histórico). ≥50% crítico, ≥30% alto, ≥15% médio. Quando há cabeças ativas cadastradas, o título e a descrição passam a falar em "custo por cabeça" (simplificação documentada no código: usa o plantel atual como divisor das duas janelas, por não haver histórico de plantel por data).
   Exemplo real gerado: *"Custo por cabeça subiu nos últimos 30 dias"*.

7. **`gerarAlertasPriorizados(db, agora)`** — roda os 6 detectores e devolve a lista ordenada por severidade (crítico → alto → médio → baixo); dentro da mesma severidade, ordena por `id` para saída estável.

## 5. Camada de insights (`insightsFazenda.js`)

Construída sobre o agregador, sem duplicar sua lógica:

- **`construirInsightsFazenda(db, agora)`** → `{ totalAlertas, porSeveridade, porTipo, saude, saudeLabel, topAlertas (5), alertas }`. `saude` é `otima` (0 alertas), `boa` (só médio/baixo), `atencao` (algum alto) ou `critica` (algum crítico) — a base numérica para um futuro "Saúde do Lote"/"Saúde da Fazenda".
- **`construirResumoTextoInsights(insights)`** → frase única em português pronta para um card de dashboard ou resposta de assistente (ex.: *"2 alertas encontrados: 1 crítico, 1 de alta prioridade."*).

## 6. Testes

- 27 testes em `alertasInteligentes.test.js`: cada detector tem casos de cada faixa de severidade, casos de "não deve alertar" (dados insuficientes, dentro da meta, tarefa concluída, janela sem histórico) e um caso de agregação verificando ordenação estável.
- 8 testes em `insightsFazenda.test.js`: as 4 classificações de saúde, agrupamento por tipo, limite de `topAlertas`, e as duas variações do resumo em texto.
- Convenção de datas seguida do restante do projeto: GMD/peso usam datas relativas a `new Date()` real (porque `getResumoLote`/`calcLote` não aceitam data injetada — mesmo padrão de `hojeNaFazenda.test.js`); os demais detectores recebem `agora` fixo (`2026-07-02T12:00:00Z`) para determinismo total.

## 7. Critérios de aceite

- ✅ Motor funciona com o formato real de `db` do app (mesmas tabelas/campos usados por `hojeNaFazenda.js`, `utils/alerts.js`, `calculos.js`).
- ✅ Não depende de UI — só funções puras `(db, agora?) => alertas[]`.
- ✅ Testes cobrem os principais cenários (35 testes novos, 0 falhas).
- ✅ Não quebra o Dashboard atual — nenhum arquivo existente foi alterado; `App.jsx`, `utils/alerts.js` e `hojeNaFazenda.js` continuam exatamente como estavam.
- ✅ `npm run lint`: sem erros.
- ✅ `npm run build`: sucesso.
- ✅ `npm test`: 701 testes, 0 falhas (666 já existentes + 35 novos).

## 8. Próximos passos sugeridos (fora desta sprint)

- Ligar `gerarAlertasPriorizados`/`construirInsightsFazenda` a um card real no Dashboard ou a uma futura página "Decisões da Fazenda".
- Persistir resolução/adiamento desses alertas (hoje `buildAlerts`, em `utils/alerts.js`, já tem esse mecanismo via `alertas_resolvidos`/`alertas_adiados` — poderia ser reaproveitado aqui com o mesmo `ackKey`).
- Avaliar remover o código morto `src/domain/alertas.js` (protótipo não usado) em uma sprint de limpeza.
