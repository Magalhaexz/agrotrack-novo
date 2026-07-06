# Sprint 5 — Motor Único de Alertas Internos — HERDON

> Data: 2026-07-05. Escopo: novo arquivo `src/domain/alertasUnificados.js` + `src/pages/DashboardPage.jsx`. Nenhuma migration, nenhum RLS, nenhum Supabase alterado. `getResumoLote`, DRE, fluxo de caixa e cálculos do simulador **não foram tocados**.

---

## 1. Auditoria rápida — onde cada fonte de alerta é usada

| Fonte | Onde é usada hoje | Depois desta sprint |
|---|---|---|
| `utils/alerts.js` (`buildAlerts`) | `App.jsx` gera e passa como prop `alerts`; consumida na aba "Alertas" (lista completa) e no card "Alertas importantes" do Dashboard | **Sem mudança** — continua exatamente como estava |
| `domain/alertasInteligentes.js` (`gerarAlertasPriorizados`) | `DecisoesFazendaPage`, `AssistenteHerdon` | **Sem mudança nessas telas** — passou a ser reaproveitada também por dentro do novo agregador (só leitura, a função em si não mudou) |
| `domain/hojeNaFazenda.js` (`construirHojeNaFazenda` e as funções `listarX`) | `DashboardPage.jsx` (pastos, pesagens pendentes, KPI "Alertas críticos") | **Sem mudança na função** — `construirHojeNaFazenda` continua sendo chamada no Dashboard para tudo que já usava (pastos, pesagens pendentes, badge de críticos); as funções `listarX` individuais (`listarContasFinanceiras`, `listarLotesSemPesagemRecente`, `listarLotesSemPasto`, `listarLotesPorStatusDecisaoVenda`, `construirResumoPastos`) passaram a ser reaproveitadas também pelo novo agregador |
| Alertas financeiros do Dashboard (Sprint 4, inline) | Cálculo de "pagamentos vencendo hoje/7 dias" e "tarefas atrasadas/hoje" que eu tinha colocado direto em `DashboardPage.jsx` | **Removido do Dashboard** — a mesma lógica foi movida para dentro do novo agregador (`src/domain/alertasUnificados.js`), sem duplicar nada |
| Alertas do Estoque | `alertasInteligentes.detectarEstoqueBaixo` (com projeção de consumo) e `hojeNaFazenda.listarEstoqueBaixo` (checagem simples) coexistem | Sem mudança nas funções — o motor único usa `detectarEstoqueBaixo` (via `gerarAlertasPriorizados`), a versão mais rica |
| Alertas de GMD | `alertasInteligentes.detectarLotesAbaixoGmd` (severidade fina) e `hojeNaFazenda.listarLotesComGmdAbaixoDaMeta` (checagem simples) coexistem | O motor único usa a versão de `alertasInteligentes` (mais rica) |
| Lote sem pesagem | `hojeNaFazenda.listarLotesSemPesagemRecente` | Reaproveitada, sem mudança |
| Lote pronto para venda / custo alto | `hojeNaFazenda.listarLotesPorStatusDecisaoVenda` (usa `decisaoVenda.js`) | Reaproveitada, sem mudança |
| Sanidade | `alertasInteligentes.detectarSanidadeProxima` (vencida/próxima, com janela configurável) e `utils/alerts.js` (mesma ideia, algoritmo levemente diferente) coexistem | O motor único usa a versão de `alertasInteligentes` |

---

## 2. Fonte canônica escolhida

**Novo arquivo `src/domain/alertasUnificados.js`**, função `gerarAlertasUnificados(db, opcoes)`. Não é um motor de cálculo novo — é uma camada de composição/padronização por cima do que já existia:

- Reaproveita `gerarAlertasPriorizados()` (`alertasInteligentes.js`) para GMD, peso alvo, estoque, tarefas atrasadas, sanidade e custo — e **agrupa** os alertas por-entidade que essa função já produz em 1 alerta resumido por tipo/faixa de prioridade (sem recalcular severidade, só conta quantos itens cada `alerta.severidade` já calculada gerou).
- Reaproveita `listarContasFinanceiras()`, `listarLotesSemPesagemRecente()`, `listarLotesSemPasto()`, `listarLotesPorStatusDecisaoVenda()` e `construirResumoPastos()` (`hojeNaFazenda.js`) para financeiro, pesagem, pasto, decisão de venda e pastos.
- Só uma checagem é nova (não existia em nenhum arquivo de domínio antes): tarefas com vencimento **hoje** (ainda não atrasadas) — a mesma lógica que eu tinha colocado ad-hoc dentro do Dashboard no Sprint 4, agora centralizada aqui.

### Formato padrão de cada alerta

```js
{
  id,             // string estável, ex: "unificado-financeiro-vencidas"
  tipo,           // ex: "gmd", "estoque", "financeiro-vencido", "pronto-venda"
  prioridade,     // "critico" | "atencao" | "decisao" | "informativo"
  origem,         // "financeiro" | "estoque" | "rebanho" | "sanidade" | "tarefas" | "decisao"
  titulo,         // texto curto, já com a contagem embutida
  descricao,      // até 3 exemplos concretos (nome do lote/descrição da conta), separados por " · "
  acaoSugerida,   // frase de ação (reaproveitada de `alertasInteligentes` quando existe)
  pageId,         // destino de navegação (`onNavigate(pageId)`), já validado contra pageIds reais
  dataReferencia, // reservado para uso futuro (hoje sempre null — nenhuma fonte atual expõe 1 data por grupo)
}
```

A lista final vem ordenada por prioridade (`critico` → `atencao` → `decisao` → `informativo`).

---

## 3. Telas adaptadas

### Dashboard (`src/pages/DashboardPage.jsx`)
O bloco **"Prioridades de hoje"** (criado no Sprint 4) agora consome `gerarAlertasUnificados()` em vez da composição ad-hoc que existia ali. A aparência não mudou: mesmos 3 grupos (Crítico/Atenção/Decisão), mesmo layout de card com origem + "Ver em X". O que mudou por baixo:
- GMD e estoque agora usam a classificação de severidade **correta** (antes, todo item de `hojeNaFazenda.prioridades` para essas categorias vinha marcado genericamente como "atenção", mesmo quando `alertasInteligentes` já sabia que era crítico — ex.: estoque zerado. Agora um estoque zerado aparece corretamente em **Crítico**).
- Nenhum outro card do Dashboard foi alterado (KPIs, Alertas importantes, Tarefas do dia, Pesagens pendentes, Pastos em uso, Quadro de tarefas, Resumo financeiro, Resumo do rebanho, aba Estoque, aba Alertas) — todos continuam lendo exatamente as mesmas fontes de antes.
- O badge "X críticos"/"Sem críticos" no cabeçalho do card continua vindo de `hojeNaFazenda.detalhes.alertasCriticosTotal` (não mudou — mesma fonte do Sprint 4).

### Finanças
**Não adaptada nesta sprint.** A aba "Pagamentos" (`FinanceiroPage.jsx`) continua com sua própria função local `buildPagamentosVisaoGeral` (Sprint 3), que já reaproveita as mesmas peças (`listarContasFinanceiras`, helpers de `financeiroStatus.js`) — ela não foi movida para dentro do motor único porque monta uma visão **detalhada por conta individual** (5 faixas com tabela linha a linha), diferente do formato **resumido por categoria** que o motor único produz para o Dashboard. Migrar isso exigiria decidir se a aba Pagamentos passa a mostrar alertas resumidos (perderia a tabela detalhada atual) ou se o motor único ganha um modo "detalhado" — decisão de produto fora do escopo desta sprint (regra 12 — menor intervenção). `FinanceiroPage.jsx` não foi tocado nesta sprint (confirmado por `git status`).

### Decisões da Fazenda
**Não adaptada nesta sprint** — continua usando `alertasInteligentes`/`insightsFazenda.js` diretamente, como antes. Não foi tocada (confirmado por `git status`) e continua funcionando exatamente igual.

---

## 4. Sistemas legados mantidos (e por quê)

- **`utils/alerts.js` (`buildAlerts`) continua em uso ativo** em `App.jsx` → aba "Alertas" (lista completa com Resolver/Adiar/Abrir) e card "Alertas importantes" do Dashboard. Não foi removido porque: (1) cobre sinais que o motor único ainda não tem — **saída de lote vencida/próxima** (campo `lote.saida`) e **validade de produto no estoque** (`data_validade`); (2) tem os botões de ação Resolver/Adiar que dependem do formato `ackKey` dele, usados em `App.jsx` (`getAlertAckKey`, `resolvedAlertKeys`, `snoozedAlerts`) — migrar isso é uma mudança maior, fora do escopo "menor intervenção" desta sprint.
- **`domain/hojeNaFazenda.js` (`construirHojeNaFazenda`) continua em uso ativo** no Dashboard para pastos, pesagens pendentes e o contador de críticos do cabeçalho — não foi substituída porque essas 3 coisas não fazem parte do pedido desta sprint (só o bloco "Prioridades de hoje" precisava mudar de fonte) e trocar teria sido risco sem necessidade.
- **O que falta para aposentar o legado:** levar "saída de lote" e "validade de estoque" para dentro do motor único (2 novas funções de agrupamento, mesmo padrão das demais) e migrar Resolver/Adiar para trabalhar com o novo formato de alerta — só depois disso a aba "Alertas" poderia trocar de fonte sem perder funcionalidade. Não feito agora por ser mudança de escopo maior que uma sprint de "menor intervenção".

---

## 5. Limitações

- **Contagens não são idênticas ao Sprint 4** para GMD e estoque — de propósito: agora refletem a severidade real (crítico separado de atenção), o que é uma correção, não uma regressão, mas quem comparar número a número com o Sprint 4 vai ver a mudança.
- **"Saída de lote vencida/próxima" e "validade de produto no estoque"** não aparecem no motor único — continuam só na aba "Alertas" e no card "Alertas importantes" (não perderam visibilidade para o usuário, só não entraram na consolidação desta sprint).
- **Revisão de manejo/suplementação** (`hojeNaFazenda.listarLotesParaRevisaoManejo`) não entrou no motor único — não estava na lista de fontes pedida nesta sprint; ainda aparecia no Sprint 4 e deixou de aparecer no Dashboard. Registrado para uma próxima iteração do motor único, se fizer sentido.
- **Sem paginação/limite de itens** por grupo além dos 3 exemplos na descrição — aceitável para o volume atual do piloto.

---

## 6. Preparação para Telegram (nada implementado, só estrutura pronta)

O formato padronizado (`{id, tipo, prioridade, origem, titulo, descricao, acaoSugerida, pageId}`) já é o suficiente para gerar uma mensagem de notificação sem nenhuma tradução adicional — por exemplo, `"🔴 [Financeiro] 2 contas estão vencidas — Regularizar os pagamentos vencidos."`. Continua fora do escopo (regra 1): nenhum canal externo foi criado. O próximo passo, quando aprovado, é decidir **onde** rodar `gerarAlertasUnificados()` para gerar notificações (ex.: uma function agendada) e **quando** disparar (evitar notificar o mesmo alerta repetidamente) — isso é trabalho de uma sprint própria de notificações, não desta.

---

## 7. Validação

| Comando | Resultado |
|---|---|
| `npm run lint` | ✅ 0 erros |
| `npm run test` | ✅ 789/789 testes, 0 falhas |
| `npm run build` | ✅ build ok |
| `git status --short -- src/` | `M src/pages/DashboardPage.jsx` · `?? src/domain/alertasUnificados.js` (só isso) |
| `git diff --stat` em `resumoLote.js`, `fluxoCaixa.js`, `calculos.js`, `calculations.js`, `alertasInteligentes.js`, `hojeNaFazenda.js`, `utils/alerts.js` | Vazio em todos — nenhum arquivo de cálculo ou de alerta legado foi alterado |
| Migration/RLS/Supabase | Nada criado ou alterado |

**Validação da lógica:** rodei um script Node isolado (fora do app) chamando `gerarAlertasUnificados()` diretamente com dados fixos (estoque zerado, conta vencida, conta vencendo hoje, conta vencendo em 3 dias, 2 lotes sem pesagem, 2 lotes sem pasto, 1 tarefa atrasada, 1 tarefa de hoje). Resultado: 8 alertas gerados, cada um na prioridade/origem esperada, sem nenhuma duplicidade de contagem (cada situação apareceu em exatamente 1 alerta).

**Validação visual:** `preview_snapshot`/`preview_screenshot` confirmam que o Dashboard renderiza sem erro de console, com o card "Prioridades de hoje" mostrando corretamente o estado vazio para a conta de teste (sem lotes cadastrados) — mesma limitação de ambiente já documentada nos sprints anteriores impede clique-a-clique com dados populados nesta sessão (não é regressão: reproduzida de forma idêntica em sprints anteriores, incluindo em itens não relacionados às mudanças). Mobile (375px) conferido: layout intacto, bottom nav funcionando.

**Pagamentos (Sprint 3):** não impactado — `src/pages/FinanceiroPage.jsx` não foi tocado nesta sprint.

**Decisões da Fazenda:** não impactada — página não foi tocada nesta sprint, e os arquivos de domínio que ela usa (`alertasInteligentes.js`, `insightsFazenda.js`) também não foram alterados.

**Rotas/pageIds:** nenhum novo, nenhum removido — os `pageId` emitidos pelo motor único (`financeiro`, `estoque`, `pesagens`, `lotes`, `resultados`, `pastagens`, `tarefas`, `sanitario`) já existem em `navConfig.js`/`App.jsx`.
