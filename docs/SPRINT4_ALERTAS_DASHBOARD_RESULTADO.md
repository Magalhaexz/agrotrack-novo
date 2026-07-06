# Sprint 4 — Central de Alertas e Dashboard de Prioridades — HERDON

> Data: 2026-07-05. Escopo: `src/pages/DashboardPage.jsx` + `src/styles/dashboard.css`. Nenhuma migration, nenhum RLS, nenhum arquivo de domínio alterado, nenhum cálculo (`getResumoLote`, DRE, fluxo de caixa) tocado.

---

## 1. Auditoria dos sistemas de alerta existentes (antes de alterar qualquer coisa)

| Fonte | Arquivo | O que faz | Onde já é usada |
|---|---|---|---|
| **Legado** `buildAlerts()` | `src/utils/alerts.js` | Motor mais antigo e mais abrangente: estoque (crítico/baixo/vencido), sanitário (vencido/próximo), rotinas/tarefas (atrasada/hoje/recorrente), pesagem (ausente/atrasada), saída de lote, financeiro (pagamento vencido/próximo, janela 3 dias), pastos (ocupação). Nível `critical`/`warning`/`info`. | `App.jsx` gera e passa como prop `alerts` para o Dashboard; usado na aba "Alertas" (lista completa) e no card "Alertas importantes" (aba geral) |
| **Novo** `gerarAlertasPriorizados()` | `src/domain/alertasInteligentes.js` | Motor mais recente, com severidade em 4 níveis (`critico`/`alto`/`medio`/`baixo`) e regras mais refinadas: GMD (usa `gmdAlerta.js`), peso próximo do alvo, estoque (com projeção de consumo), tarefas atrasadas, sanidade próxima, custo acima do previsto (variação 30 dias). | `DecisoesFazendaPage`, `AssistenteHerdon` (não usado no Dashboard hoje) |
| **Agregador** `construirHojeNaFazenda()` | `src/domain/hojeNaFazenda.js` | Já é o "Prioridades do dia" do Dashboard — só que com esse nome interno. Tem detectores próprios e mais simples (sem severidade fina): lotes sem pesagem (30 dias), GMD abaixo da meta (comparação direta, sem os 3 níveis do `alertasInteligentes`), lotes sem pasto, contas a pagar vencidas/próximas (`listarContasFinanceiras`, janela 3 dias), estoque baixo (checagem direta de mínimo, sem projeção), lotes prontos para venda/custo alto (via `decisaoVenda.js`), revisão de manejo (via `manejoResultado.js`). Também recebe a lista `alerts` do legado e soma, num único item agregado, os alertas críticos de tipos que ele ainda não cobre sozinho. | `DashboardPage.jsx` (seção que hoje se chamava "Hoje na Fazenda") |
| **Sprint 3** `buildPagamentosVisaoGeral()` | `src/pages/FinanceiroPage.jsx` (local à página) | Vencidas/vencendo hoje/próximos 7 dias/previstas/pagas — construído sobre `listarContasFinanceiras` + helpers de `financeiroStatus.js`, não duplica cálculo. | Aba "Pagamentos" |
| **Dashboard, local** `pagamentosResumo` | `src/pages/DashboardPage.jsx` (local, **não alterado nesta sprint**) | Card "Resumo financeiro": conta vencidos/hoje/próximos, mas **só da categoria "Pagamento Diário"** — mais estreito que a Visão Geral de Pagamentos do Sprint 3. | Card "Resumo financeiro" (aba geral) |

### O que está duplicado

- **GMD abaixo da meta** é calculado de dois jeitos: `alertasInteligentes.detectarLotesAbaixoGmd` (com severidade em 3 níveis via `gmdAlerta.js`) e `hojeNaFazenda.listarLotesComGmdAbaixoDaMeta` (checagem direta, sem severidade). O Dashboard usa só a segunda.
- **Estoque baixo**: `alertasInteligentes.detectarEstoqueBaixo` (projeta dias restantes pelo consumo) vs `hojeNaFazenda.listarEstoqueBaixo` (só checa mínimo) vs `utils/alerts.js` (checa mínimo + validade). O Dashboard usa a versão mais simples (`hojeNaFazenda`).
- **Contas a pagar vencidas/próximas**: `utils/alerts.js` (janela 3 dias) vs `hojeNaFazenda.listarContasFinanceiras` (mesma função reaproveitada, janela 3 dias por padrão) vs Sprint 3 `buildPagamentosVisaoGeral` (janela 7 dias, mais granular). Todas no fundo usam a mesma função `listarContasFinanceiras`/mesmos helpers — não há cálculo duplicado aqui, só janelas diferentes por tela.
- **"Resumo financeiro" do Dashboard** usa um cálculo próprio, restrito a uma categoria específica — mais estreito que o resto. **Não alterado nesta sprint** (regra explícita: não mudar números), registrado como limitação (§5).

### O que deveria aparecer no Dashboard (decisão desta sprint)
Em vez de escolher UM motor e descartar os outros (risco alto, fora do escopo "menor intervenção"), a Central de Alertas Internos desta sprint **reaproveita o que já alimentava o Dashboard** (`hojeNaFazenda.prioridades`) e só adiciona os itens que o Sprint 3 tornou possível com mais precisão (pagamentos hoje vs 7 dias) e os que já existiam em outro canto da mesma página (tarefas atrasadas/hoje, já calculadas em `boardTarefas`/`tarefasDoDia`). **Nenhum motor de alerta foi descartado ou reescrito.**

### O que fica para depois
- Unificar de vez `alertasInteligentes.js` (mais rico) com `hojeNaFazenda.js` (mais simples, mas já é o que alimenta o Dashboard) é uma decisão de arquitetura maior, fora do escopo desta sprint (regra 10 — não criar nova arquitetura complexa sem necessidade). Registrado como o mesmo débito já apontado em `docs/AUDITORIA_COMPLETA_HERDON.md`.
- "Sanidade vencida" como item próprio na Central de Alertas não foi quebrado em linha dedicada — hoje só entra dentro do agregado genérico "alertas críticos" (item `alertas-criticos`, vindo do legado `buildAlerts()`). Fazer isso direito exigiria ler `alertasInteligentes.detectarSanidadeProxima` ou os registros de `sanitario` diretamente no Dashboard — não feito agora para não aumentar o escopo além do pedido.

---

## 2. Central de Alertas Internos — o que foi construído

Dentro do card que já existia (renomeado de **"Hoje na Fazenda"** para **"Prioridades de hoje"**), os itens agora aparecem agrupados em 3 blocos, cada um só aparece se tiver pelo menos 1 item:

**Crítico:** pagamentos vencidos (`contas-vencidas`, já existia) · tarefas atrasadas (novo, reaproveita `boardTarefas` já calculado para o Quadro de Tarefas) · alertas críticos gerais (`alertas-criticos`, já existia, vem do motor legado)

**Atenção:** pagamentos vencendo hoje (novo, `listarContasFinanceiras(db, 7)`) · pagamentos vencendo em 7 dias (novo, mesma função) · tarefas de hoje (novo, reaproveita `tarefasDoDia` já calculado) · lote sem pesagem recente · lote sem pasto · pasto em atenção/acima da capacidade · GMD abaixo da meta · estoque baixo · lote para revisão de manejo — todos já existentes em `hojeNaFazenda.prioridades`

**Decisão:** lote pronto para avaliar venda · lote com custo por arroba alto — já existentes em `hojeNaFazenda.prioridades`, só reclassificados visualmente neste grupo (mesmos dados, novo agrupamento)

Cada item agora mostra, além do texto e do badge de prioridade:
- **origem** (Financeiro / Pesagem / GMD / Pastagem / Estoque / Manejo-Sanidade / Tarefas / Decisão / Alertas gerais — deduzida do `id` do item, sem cálculo novo);
- **ação sugerida**, usando `getNavLabel()` (já existe em `navigation/navConfig.js`, mesma função que a sidebar usa) para escrever "Ver em {nome da tela}".

O item genérico antigo "X contas vencem nos próximos dias" (janela de 3 dias) foi retirado da lista para não duplicar com os dois novos itens mais precisos (hoje / 7 dias) — a função `listarContasFinanceiras` continua exatamente a mesma, só passei a chamá-la também com janela de 7 dias (a mesma usada pela Visão Geral de Pagamentos do Sprint 3) além da chamada de 3 dias que `construirHojeNaFazenda` já fazia internamente.

---

## 3. O que foi reaproveitado (nada recalculado do zero)

| Item novo na Central de Alertas | Fonte reaproveitada |
|---|---|
| Pagamentos vencendo hoje / próximos 7 dias | `listarContasFinanceiras()` (`domain/hojeNaFazenda.js`) + `getDataVencimento()` (`domain/financeiroStatus.js`) — mesma função que a Visão Geral de Pagamentos (Sprint 3) usa |
| Tarefas atrasadas | `boardTarefas` (já calculado no próprio Dashboard para o "Quadro de tarefas") |
| Tarefas de hoje | `tarefasDoDia` (já calculado no próprio Dashboard para o card "Tarefas do dia") |
| Todos os demais itens (contas vencidas, pesagem, pasto, GMD, estoque, manejo, decisão) | `hojeNaFazenda.prioridades` — sem nenhuma mudança em `domain/hojeNaFazenda.js` |
| Rótulo de destino ("Ver em X") | `getNavLabel()` (`navigation/navConfig.js`), já usado pela Sidebar |

---

## 4. O que foi reorganizado no Dashboard

- O card de prioridades passou a se chamar **"Prioridades de hoje"** (era "Hoje na Fazenda") e ganhou os 3 grupos acima, em vez de uma lista única sem hierarquia.
- **Nenhum número foi alterado** — o badge "X críticos"/"Sem críticos" no topo do card continua vindo exatamente da mesma fonte de antes (`hojeNaFazenda.detalhes.alertasCriticosTotal`). Os demais cards (KPIs, Alertas importantes, Tarefas do dia, Pesagens pendentes, Pastos em uso, Quadro de tarefas, Resumo financeiro, Resumo do rebanho) **não tiveram nem posição nem cálculo alterados** nesta sprint — a decisão foi concentrar a reorganização no único bloco que já cumpria o papel de "central de prioridades", em vez de reordenar cards independentes que já funcionavam (menor intervenção, menor risco de regressão visual).

---

## 5. Limitações e backlog para o próximo sprint

- **"Resumo financeiro" do Dashboard continua usando o cálculo estreito** (só categoria "Pagamento Diário"), diferente da Visão Geral de Pagamentos (Sprint 3) e da nova Central de Alertas (que já usa todas as despesas). Não alterado agora por instrução explícita ("não alterar os números, só reorganizar"). Registrado para uma sprint futura decidir se esse card deve passar a usar `listarContasFinanceiras` também.
- **Sanidade vencida** não tem linha própria na Central de Alertas — hoje some dentro do agregado "alertas críticos" genérico.
- **GMD abaixo da meta / estoque baixo** continuam usando a versão mais simples (`hojeNaFazenda.js`), não a versão com severidade fina de `alertasInteligentes.js` — unificar os dois motores é trabalho de arquitetura maior, fora desta sprint.
- **Telegram/WhatsApp/e-mail**: não implementado, como pedido. A Central de Alertas Internos desta sprint já deixa os dados no formato certo para uma futura notificação externa (`{id, tom, texto, rota}` — texto curto, prioridade, e destino de ação já resolvido). O caminho recomendado é o mesmo já registrado no Sprint 3: só integrar canais externos depois de decidir a arquitetura de uma Central de Alertas unificada (`docs/AUDITORIA_COMPLETA_HERDON.md`), para não mandar notificação de uma fonte que ainda tem duplicação interna.

---

## 6. Validação

| Comando | Resultado |
|---|---|
| `npm run lint` | ✅ 0 erros |
| `npm run test` | ✅ 789/789 testes, 0 falhas |
| `npm run build` | ✅ build ok — CSS novo (`.dashboard-priority-groups`/`.dashboard-priority-group-title`) confirmado no bundle `dist/` |
| `git diff --stat -- src/domain/` | Vazio — nenhum arquivo de domínio tocado |
| `git status --short -- src/` | Só `src/pages/DashboardPage.jsx` (modificado) e `src/styles/dashboard.css` (modificado) |

**Validação da lógica:** reproduzi em um script Node isolado (fora do app) a mesma composição usada em `DashboardPage.jsx` — `construirHojeNaFazenda` + `listarContasFinanceiras(db, 7)` + a filtragem/reclassificação — com dados fixos (conta vencida, vencendo hoje, vencendo em 3 dias, lote sem pesagem, lote sem pasto). Resultado: o item genérico "contas-proximas" foi corretamente substituído pelos dois itens novos (hoje/7 dias), e o agrupamento crítico/atenção/decisão classificou tudo corretamente.

**Validação visual:** confirmado por `preview_snapshot` que o card renderiza com o novo título "Prioridades de hoje" e a nova subtítulo, e que o estado vazio ("Tudo certo por aqui...") aparece corretamente para uma conta sem dados. O mesmo loop de boot de autenticação já registrado nos sprints anteriores impediu testar clique-a-clique com dados populados nesta sessão — não é regressão desta mudança (limitação de ambiente já documentada).

**Pagamentos (Sprint 3):** não impactado — `src/pages/FinanceiroPage.jsx` não foi tocado nesta sprint (confirmado por `git status`).

**Rotas/pageIds:** nenhum novo, nenhum removido — todas as navegações da Central de Alertas usam `onNavigate(item.rota)` com os mesmos `rota` que já existiam (`financeiro`, `pesagens`, `pastagens`, `lotes`, `estoque`, `resultados`, `tarefas`, `dashboard`).
