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

## 8. Próximos passos sugeridos (da Sprint 1)

- ~~Ligar `gerarAlertasPriorizados`/`construirInsightsFazenda` a um card real no Dashboard ou a uma futura página "Decisões da Fazenda".~~ → feito na Sprint 2 (seção 9).
- Persistir resolução/adiamento desses alertas (hoje `buildAlerts`, em `utils/alerts.js`, já tem esse mecanismo via `alertas_resolvidos`/`alertas_adiados` — poderia ser reaproveitado aqui com o mesmo `ackKey`).
- Avaliar remover o código morto `src/domain/alertas.js` (protótipo não usado) em uma sprint de limpeza.

---

# Sprint 2 — Tela "Decisões da Fazenda"

> Data: 2026-07-02 · Branch `main`

## 9. Objetivo

Transformar o motor da Sprint 1 em uma tela de decisão: o HERDON deixa de ser só um app de cadastro e passa a responder, de forma direta, "o que merece minha atenção hoje" e "onde estou perdendo dinheiro". Nenhum alerta é criado dentro da tela — ela só consome e organiza o que o motor já calcula.

## 10. Arquivos criados/alterados

| Arquivo | O que mudou |
|---|---|
| `src/pages/DecisoesFazendaPage.jsx` (novo) | A tela: lê `construirInsightsFazenda(db)`, agrupa e renderiza os cards |
| `src/styles/decisoes.css` (novo) | Grid dos cards e cor lateral por severidade |
| `src/domain/insightsFazenda.js` | +`agruparAlertasPorTipo`, +`listarAtencaoImediata`, +`CATEGORIAS_TIPOS_DECISAO` (lógica pura, testável, sem UI) |
| `src/domain/insightsFazenda.test.js` | +5 testes cobrindo as duas funções novas |
| `src/navigation/navConfig.js` | Item "Decisões da Fazenda" no topo da seção "Decisão" do menu |
| `src/auth/perfis.js` | `decisoesFazenda: 'dashboard:ver'` — mesma visibilidade do Painel Geral, para todos os papéis |
| `src/services/subscriptions.js` | `'decisoesFazenda'` adicionado a `MODULES_BASIC` (disponível em todos os planos pagos) |
| `src/App.jsx` | Import lazy + entrada em `pageMap` |

A tela **não chama nenhum detector individualmente** (`detectarLotesAbaixoGmd`, `detectarEstoqueBaixo`, etc.) — usa só `construirInsightsFazenda`, que por sua vez já roda `gerarAlertasPriorizados` (Sprint 1). Isso garante zero duplicação de cálculo: qualquer ajuste de regra continua vivendo só em `alertasInteligentes.js`.

## 11. Os 7 cards e as perguntas que respondem

| Card | Tipo de alerta (`insights.alertas` filtrado) | Pergunta respondida |
|---|---|---|
| **Atenção imediata** | crítico/alto de qualquer tipo, exceto `peso_alvo` (via `listarAtencaoImediata`) | "O que merece minha atenção hoje?" / "O que preciso fazer primeiro?" |
| **Lotes abaixo da meta** | `gmd` | "Qual lote está pior?" |
| **Estoque crítico** | `estoque` | "O que pode virar problema?" |
| **Sanidade próxima** | `sanidade` | "O que pode virar problema?" |
| **Tarefas atrasadas** | `tarefa` | "O que preciso fazer primeiro?" |
| **Financeiro/custos** | `custo` | "Onde estou perdendo dinheiro?" |
| **Oportunidades** | `peso_alvo` | "Qual lote está melhor?" |

`peso_alvo` é tratado à parte da "Atenção imediata": um lote perto do peso alvo é uma boa notícia (chance de venda), não um problema — por isso vira o card "Oportunidades" com selo verde "Oportunidade" em vez de severidade vermelha/amarela.

Cada item de decisão mostra, na ordem pedida: **título** (já vem de `alerta.titulo`) → **motivo** (`alerta.descricao`) → **impacto** (frase curta derivada da severidade — só apresentação, não recalcula nada) → **ação sugerida** (`alerta.acaoSugerida`). O card "Atenção imediata" tem um botão por item ("Abrir tela relacionada", usando `alerta.pagina`); os outros 6 cards têm um botão único no cabeçalho (já que todos os itens de uma mesma categoria sempre apontam para a mesma página).

## 12. Estado vazio

Distingue duas situações:
- **Sem dado nenhum cadastrado** (nenhum lote, pesagem, estoque, custo ou movimentação financeira): mostra o `EmptyState` com o texto pedido — *"Ainda não há dados suficientes para gerar decisões."* — e orienta a cadastrar lotes, pesagens, estoque e custos, com botão "Cadastrar lotes".
- **Tem dado, mas zero alertas em uma categoria**: a categoria continua visível no grid, mostrando uma mensagem positiva ("Tudo em dia por aqui", "Estoque sob controle...") — reforça que o app está de fato observando, e não apenas escondendo cards vazios.

## 13. Paywall de escrita

A tela é **100% leitura** — nenhum formulário, nenhum `createOperationalRecord`/`update`/`delete`. Os únicos botões chamam `onNavigate(pagina)` (navegação), que já é permitida em modo visualização (ver sprint de paywall de escrita). Por isso não há nada a bloquear aqui: usuário sem plano vê a tela inteira normalmente; se quiser agir sobre um alerta (ex.: cadastrar uma pesagem), é levado à tela de destino, onde o paywall de escrita (já existente) entra em ação normalmente ao tentar salvar.

## 14. Testes e validação

- 5 testes novos em `insightsFazenda.test.js` (agrupamento por tipo preservando ordem e categorias vazias; atenção imediata filtrando severidade/excluindo oportunidades, respeitando limite, e preservando a ordem de prioridade do motor).
- `npm run lint`: sem erros.
- `npm run build`: sucesso — chunk `DecisoesFazendaPage` gerado (13,98 kB / 4,96 kB gzip + CSS próprio).
- `npm test`: **706 testes, 0 falhas** (701 da Sprint 1 + 5 novos).
- Verificação manual interativa (logada) **não foi possível neste ambiente**: o servidor de desenvolvimento local não tem as chaves do Supabase configuradas (limitação já registrada em sprints comerciais anteriores), então não há como autenticar e navegar até a tela pelo Sidebar nesta sessão. A confiança na integração vem de: build de produção bem-sucedido (compila e resolve todo o grafo de imports/JSX do componente), lint limpo, e cobertura total da lógica de dados por teste automatizado — só a renderização visual final (cores, layout responsivo) não foi vista ao vivo.

## 15. Próximos passos sugeridos (da Sprint 2)

- ~~Verificar visualmente a tela em produção (mobile e desktop) após o deploy deste commit.~~
- Ligar o card "Atenção imediata" a uma notificação push/e-mail diária (Assistente HERDON).
- Reaproveitar `alertas_resolvidos`/`alertas_adiados` (já usado em `utils/alerts.js`) para permitir marcar um item da tela como resolvido/adiado, usando o mesmo `id` do alerta como chave.

---

# Sprint 3 — Painel de Saúde do Lote

> Data: 2026-07-02 · Branch `main`

## 16. Objetivo

Dar ao produtor um número único por lote — 0 a 100 — que resuma se aquele lote está bem ou precisa de atenção, com explicação em português de por que o score é o que é. Não é um alerta a mais: é uma síntese que se apoia em tudo que já existe (Sprint 1 e 2) mais três sinais novos (frequência de pesagem, custo por cabeça, mortalidade/perdas).

## 17. Arquivos criados/alterados

| Arquivo | O que mudou |
|---|---|
| `src/domain/saudeLote.js` (novo) | `calcularSaudeLote(db, loteId, agora)`, `listarSaudeLotes(db, agora)`, `classificarScore`, `SAUDE_LOTE_CLASSIFICACAO` |
| `src/domain/saudeLote.test.js` (novo) | 26 testes cobrindo os 8 fatores, os 4 patamares de classificação, confiabilidade e o ranking |
| `src/components/lotes/SaudeLoteCard.jsx` (novo) | Componente de exibição (score + badge + explicações), reaproveitado nos 3 lugares pedidos |
| `src/components/lotes/LoteCard.jsx` | `<SaudeLoteCard compact />` no card da listagem |
| `src/components/lotes/LoteOverviewTab.jsx` | `<SaudeLoteCard />` completo na aba "Visão geral" dos detalhes do lote |
| `src/pages/LotesPage.jsx` | `lote.saude = calcularSaudeLote(db, lote.id)` no enriquecimento de cada lote |
| `src/pages/DecisoesFazendaPage.jsx` | Novo card "Saúde dos lotes" com `listarSaudeLotes`, rankeando os 6 piores |
| `src/styles/rebanho.css` | Classes `.saude-lote*` (cor lateral por classificação, badge, lista de explicações) |
| `src/styles/decisoes.css` | Grid `.decisoes-saude-lotes` para o novo card |

## 18. Como o score é calculado

Começa em **100 pontos** e só **subtrai** — nunca soma acima de 100. Um fator "em dia" com dado disponível não aumenta o score (já está no teto), só aumenta a **confiança** (registrada como uma frase própria, ex. "Sanidade em dia aumentou a confiança do score." — texto literal do enunciado). Um fator sem dado suficiente **não penaliza** — fica fora da conta e reduz a confiabilidade geral.

| # | Fator | Como decide (reaproveitado de) | Penalidade máxima |
|---|---|---|---|
| 1 | GMD em relação à meta | `detectarLotesAbaixoGmd` (Sprint 1) — só decide severidade/pontos aqui | -20 |
| 2 | Frequência de pesagem | Última data em `db.pesagens` do lote (lógica nova, simples) | -15 |
| 3 | Tarefas atrasadas | `detectarTarefasAtrasadas` (Sprint 1), filtrado pelas tarefas do lote | -10 |
| 4 | Sanidade pendente | `detectarSanidadeProxima` (Sprint 1), filtrado pelos registros do lote | -15 |
| 5 | Estoque/suplementação vinculada | `detectarEstoqueBaixo` (Sprint 1), filtrado pelos itens que o lote consome (via `consumo_suplementacao`) | -10 |
| 6 | Custo por cabeça | `getResumoLote` + o mesmo limiar de "custo alto" de `decisaoVenda.js` (`LIMIAR_CUSTO_ALTO_PCT`/`PRECO_ARROBA_PADRAO`) — nenhum threshold novo inventado | -15 |
| 7 | Proximidade do peso alvo | `detectarLotesProximosPesoAlvo` (Sprint 1) — **nunca penaliza**, só confirma confiança ou descreve o estágio de crescimento | 0 |
| 8 | Mortalidade/perdas | `movimentacoes_animais` (tipo `morte`/`descarte` = perda; `venda`/`abate` = saída normal, não penaliza) | -20 |

Para os fatores 1, 3, 4 e 5, o `saudeLote.js` **não recalcula severidade** — ele chama o detector do Sprint 1 sobre o `db` inteiro e filtra o resultado pelos registros (`entidade.id`) vinculados àquele lote. Zero duplicação de threshold: só conversão de "severidade" em "pontos".

**Classificação** (Entrega 3, faixas exatas do enunciado): 85–100 saudável · 70–84 atenção · 50–69 risco · abaixo de 50 crítico.

## 19. Quando faltam dados

Dois níveis, conforme pedido no enunciado ("reduzir confiança do score ou mostrar dados insuficientes"):

- **Confiança reduzida**: o score é calculado normalmente com os fatores disponíveis; `confiabilidade` fica `'media'` (4-5 de 8 fatores) ou `'baixa'` (≤3 de 8), e quando é `'baixa'` aparece a mensagem *"Poucos dados disponíveis para este lote — o score pode não refletir a situação real."*
- **Dados insuficientes (bail-out)**: quando **nenhum** dos 8 fatores tem dado (lote recém-criado, nada lançado ainda) ou o lote não existe, `score` e `classificacao` voltam `null` e `dadosInsuficientes: true` — o app nunca mostra um número inventado sem base real. Descoberto e corrigido durante os testes: o fator "frequência de pesagem" só conta como disponível se o lote já tem cabeças (`heads > 0`); sem isso, "nunca foi pesado" não é um sinal de saúde real, é só "ainda não começou a operar" — sem essa checagem, um lote 100% vazio recebia score 85 ("saudável"), o que seria enganoso.

## 20. Onde o score aparece (Entregas 5, 6 e 7)

1. **Card do lote** (`LotesPage` → `LoteCard`): versão compacta — score, classificação e badge, sem a lista de explicações (mobile-friendly, card já é denso).
2. **Detalhes do lote** (`LoteDetailsPanel` → `LoteOverviewTab`, aba "Visão geral"): versão completa, com todas as explicações e o aviso de confiabilidade quando aplicável.
3. **Decisões da Fazenda**: novo card "Saúde dos lotes", com `listarSaudeLotes` — os 6 lotes com pior score primeiro (lotes com dados insuficientes vão para o final do ranking), cada um em formato compacto, respondendo diretamente "qual lote está pior" e "qual está melhor".

## 21. Testes e validação

- 26 testes novos em `saudeLote.test.js`: as 8 faixas de classificação, os 8 fatores (positivo, negativo e indisponível para cada um, incluindo os dois exemplos literais do enunciado — "Sem pesagem recente reduziu 10 pontos." e "Sanidade em dia aumentou a confiança do score."), confiabilidade alta/média/baixa, lote não encontrado, lote sem nenhum dado, e o ranking de `listarSaudeLotes`.
- `npm run lint`: sem erros.
- `npm run build`: sucesso — chunks de `LotesPage` e `DecisoesFazendaPage` compilam normalmente com os novos imports.
- `npm test`: **732 testes, 0 falhas** (706 da Sprint 2 + 26 novos).
- Mesma limitação das sprints anteriores: sem chaves Supabase no `.env` local, não há como logar e ver o score renderizado ao vivo nesta sessão. Confirmei que o app sobe limpo (zero erro de console) na tela de login com os novos módulos já no grafo de build.

## 22. Próximos passos sugeridos

- Ver o painel em produção (mobile e desktop) após o deploy.
- Permitir abrir o lote específico a partir do card de ranking em "Decisões da Fazenda" (hoje o botão só leva para a lista de lotes, não para o lote específico — limitação de navegação já existente no app, não introduzida por esta sprint).
- Se o produto quiser, mostrar o score também no card "Lotes abaixo da meta"/"Oportunidades" da tela de Decisões, para reforçar a relação entre o alerta pontual e a saúde geral do lote.
