# Sprint 9 — Central de Alertas Final (Auditoria + Consolidação)

Objetivo: mapear toda a duplicação entre o sistema legado de alertas
(`src/utils/alerts.js`) e o Motor Único de Alertas (Sprint 5,
`src/domain/alertasUnificados.js`), fechar as lacunas de cobertura mais
importantes com segurança, e documentar honestamente o que **não** foi
consolidado nesta sprint e por quê.

**Resultado resumido:** `utils/alerts.js` foi **mantido**, não migrado nem
removido — ele alimenta o único fluxo de resolver/adiar alerta que existe no
HERDON (sino de notificações + aba "Todos os alertas" do Dashboard), e essa
migração exigiria redesenhar a granularidade do motor único (ver
[Por que a aba acionável não foi migrada](#por-que-a-aba-acionável-não-foi-migrada)).
O que avançou de fato: duas lacunas reais de cobertura do motor único foram
fechadas (validade de estoque e saída de lote vencida/próxima), sem duplicar
nenhum cálculo existente.

## 1. Usos encontrados do legado (`src/utils/alerts.js`)

| Arquivo | Como usa `buildAlerts(db)` |
|---|---|
| `src/App.jsx` | Fonte do `rawAlerts`/`alerts` — sino de notificações (`AppHeader`), contagem de notificações, e é o array passado como prop `alerts` para `DashboardPage`. Também é onde vivem `marcarAlertaComoFeito`/`adiarAlerta` (resolver/adiar), com `alerta.ackKey` como chave de persistência (`alertas_resolvidos`/`alertas_adiados`, local + Supabase). |
| `src/domain/relatorios.js` (`buildResumoGeralFazenda`) | Usa `buildAlerts(db)` para `alertasCriticos` (filtra `nivel === 'critical'`) e passa a lista inteira para `construirHojeNaFazenda(db, { alerts })`. Consumido por `docs`/relatório executivo e por `whatsappResumo.js#gerarResumoGeralTexto`. |
| `src/pages/DashboardPage.jsx` | Recebe `alerts` (a mesma lista de `App.jsx`, já filtrada por resolvido/adiado) via prop e monta `alertasFormatados` — é o que preenche a aba **"Todos os alertas"** com os botões Resolver/Adiar. |

Nenhum outro arquivo importa `utils/alerts.js`.

### Quais tipos de alerta o legado gera

`buildAlerts(db)` cobre, por item individual (cada item tem seu próprio
`ackKey` estável): **estoque** (crítico/baixo/vencido/validade próxima — 4
sub-tipos), **sanitário** (vencido/próximo), **rotinas** (atrasada/hoje/
recorrente — lê a tabela `db.rotinas`, **não** `db.tarefas`), **pesagem**
(sem pesagem/muito atrasada/pendente), **saída de lote** (vencida/próxima),
**financeiro** (vencido/próximo em 3 dias) e **pasto** (acima da
capacidade/atenção/sem dados + lote sem pasto).

### O que depende de resolver/adiar

Só `src/App.jsx` (`marcarAlertaComoFeito`, `adiarAlerta`) e
`src/components/AppHeader.jsx` (réplica da mesma lógica para o dropdown do
sino). Ambos operam **por `ackKey` individual** — resolvem/adiam **um item
específico** (ex.: `estoque-critico-42-3-10`), não uma categoria inteira.

### Achado extra (fora do escopo desta sprint)

`src/domain/alertas.js` (154 linhas: `gerarAlertasEstoque`,
`gerarAlertasCalendario`, `gerarAlertasPesagem`, `gerarAlertasLote`,
`ordenarAlertas`) **não tem nenhum importador em todo o `src/`** — parece
ser uma terceira tentativa de motor de alertas, abandonada antes de ser
conectada a qualquer tela. Não foi removido (fora do pedido desta sprint,
que é sobre `utils/alerts.js`), só fica registrado aqui para uma limpeza
futura.

## 2. Legado × Motor Único — tabela de equivalência

| Alerta no legado (`utils/alerts.js`) | Equivalente no motor único | Status | Risco de duplicação |
|---|---|---|---|
| Estoque crítico / baixo (qtd ≤ mínimo / mínimo×1,5) | `alertasInteligentes.js#detectarEstoqueBaixo` (mínimo **+** previsão por consumo — mais completo) | Migrado (motor único é estritamente melhor) | Baixo — mesma fonte (`db.estoque`), lógica não idêntica mas cobre o mesmo risco com mais contexto |
| Estoque vencido / validade próxima | **Ausente até esta sprint** → `agruparEstoqueValidade` (novo, Sprint 9) | **Migrado nesta sprint** | Nenhum — lê `data_validade`/`alerta_dias_antes`, campo que só o legado lia antes |
| Sanitário vencido / próximo | `alertasInteligentes.js` (detector de sanidade, tipo `sanidade`) | Migrado | Baixo |
| Rotinas atrasada/hoje/recorrente (tabela `db.rotinas`) | **Ausente** — motor único só lê `db.tarefas` (feature diferente, não a mesma tabela) | **Mantido só no legado** | Médio — se "Rotinas" ainda for usado ativamente, é uma lacuna real de cobertura, não uma duplicação (tabelas diferentes) |
| Pesagem sem registro / atrasada (30d) / muito atrasada (45d) | `hojeNaFazenda.js#listarLotesSemPesagemRecente` (limite 30d, sem 2º nível "muito atrasada") | Migrado (parcialmente — motor único não distingue 30d de 45d) | Baixo — mesmo limite de 30 dias, só falta a escalada de severidade |
| Saída de lote vencida / próxima (7 dias) | **Ausente até esta sprint** → `agruparSaidaLote` (novo, Sprint 9, mesma janela de 7 dias) | **Migrado nesta sprint** | Nenhum — lê `lote.saida`, mesmo campo que o legado já lia |
| Financeiro vencido / próximo (**3 dias**) | `hojeNaFazenda.js#listarContasFinanceiras` chamado com **7 dias** em `agruparFinanceiro` | Migrado, **com divergência de limite** | **Alto** — no dia 4 a 7 antes do vencimento, o legado já não mostra nada e o motor único ainda mostra "vence em breve"; contagens de "próximo" podem divergir entre os dois painéis |
| Pasto acima capacidade / atenção / sem dados | `hojeNaFazenda.js#construirResumoPastos` (mesma função `calcularOcupacaoPastos`) | Migrado | Nenhum — os dois sistemas chamam a **mesma função** de cálculo, só formatam diferente |
| Lote sem pasto definido | `hojeNaFazenda.js` (`listarLotesSemPasto`, mesma função) | Migrado | Nenhum — mesma função reaproveitada nos dois lugares |

## 3. Aba Alertas — por que não foi migrada (bloqueio documentado)

A regra do sprint permite documentar o bloqueio em vez de reescrever tudo, e
é o caminho escolhido aqui pelo motivo abaixo:

- O legado gera **um alerta por item** (`estoque-critico-42`,
  `pesagem-atrasada-17`...) — resolver/adiar atua sobre **um item
  específico**.
- O motor único gera **um alerta por categoria+prioridade** já agregado
  (`unificado-estoque-critico` representa *todos* os itens críticos juntos).
- Trocar a fonte do sino/aba "Todos os alertas" para o motor único faria
  "Resolver" esconder a categoria inteira (todos os itens daquele tipo) em
  vez de um item — mudança de comportamento visível, não uma migração
  transparente. Fazer isso direito exige adicionar granularidade por item ao
  motor único (ou manter os dois formatos), o que é redesenho, não
  consolidação incremental.

**Decisão:** manter `utils/alerts.js` + o fluxo `ackKey` exatamente como
está. O Dashboard continua mostrando as duas fontes lado a lado (ver
[Impacto no Dashboard](#impacto-no-dashboard)) — já era assim antes desta
sprint, não é uma regressão introduzida agora.

## 4. Alertas ausentes cobertos nesta sprint

Duas lacunas reais foram fechadas em `src/domain/alertasUnificados.js`,
seguindo o padrão das funções `agrupar*` já existentes (nenhuma dependência
nova, nenhum cálculo duplicado — leem os mesmos campos brutos que o legado
já lia):

- **`agruparSaidaLote(db, hoje)`** — `lote.saida` vencida (crítico) ou
  dentro de 7 dias (atenção). Mesma janela de 7 dias do legado
  (`LOTE_SAIDA_ALERT_DIAS`), para não criar um terceiro limite divergente
  para o mesmo sinal.
- **`agruparEstoqueValidade(db, hoje)`** — `estoque.data_validade` vencida
  (crítico) ou dentro de `item.alerta_dias_antes` (atenção) — reaproveita o
  campo que o usuário já configura por item na página de Estoque, em vez de
  inventar um limite global novo.

### O que ainda fica de fora (não implementado nesta sprint)

- **Rotinas** (tabela `db.rotinas`) — feature separada de "Tarefas"
  (`db.tarefas`); o motor único não cobre porque nunca leu essa tabela.
  Adicionar exigiria confirmar se "Rotinas" ainda é uma feature ativa antes
  de decidir se vale a pena — avaliação para um próximo sprint.
- **Revisão de manejo/suplementação** — nenhum dos dois sistemas
  (legado ou motor único) gera um *alerta* formal para isso hoje;
  `manejoResultado.js` já produz *insights* textuais (usados no resumo do
  lote), mas não entram na lista de alertas de nenhum dos dois motores.
  Ficou de fora por não ser uma migração (não existia em nenhum lugar como
  alerta) — registrado aqui para avaliação futura, não implementado agora
  para não expandir o escopo do sprint.

## 5. Riscos restantes (documentados, não corrigidos nesta sprint)

1. **Divergência de janela financeira** (3 dias legado × 7 dias motor
   único) — maior risco de inconsistência visível. Corrigir exigiria decidir
   qual painel muda de comportamento (produto), fora do escopo de uma
   auditoria técnica.
2. **Granularidade item × categoria** — impede migrar o painel acionável
   sem redesenho (ver seção 3).
3. **`src/domain/alertas.js` morto** — não afeta contagens (zero
   importadores), mas é código morto que confunde quem for auditar de novo.
4. **Pesagem sem 2º nível de severidade** no motor único (30d vs 45d do
   legado) — cosmético, não gera contagem diferente, só uma escalada a
   menos.

## 6. Impacto no Telegram

**Nenhuma mudança de comportamento visível.** `api/telegram-relatorio-diario.js`
e `api/telegram-webhook.js` já importavam `gerarAlertasUnificados` (Sprint
7/8) — passam a receber, quando aplicável, até 2 novos itens (`lote-saida-*`,
`estoque-*-validade`) na lista, que o formatador (`telegramRelatorio.js`) já
sabe exibir (agrupa por `prioridade`, não por `tipo` — nenhuma mudança
necessária ali). Os testes de `telegramRelatorio.test.js` continuam
passando sem alteração.

## 7. Impacto no Dashboard

- **"Central de Alertas Internos"** (grupos Crítico/Atenção/Decisão,
  `alertasUnificados`): passa a poder mostrar lotes com saída vencida/próxima
  e produtos vencidos/perto de vencer — sinais que antes só apareciam na aba
  "Todos os alertas" (legado). Isso **aumenta**, não diminui, a
  correspondência entre os dois painéis, mas não os torna idênticos (ver
  riscos).
- **"Todos os alertas"** (`alertasFormatados`, legado com Resolver/Adiar):
  **sem nenhuma mudança** — continua vindo de `buildAlerts(db)` via
  `App.jsx`, exatamente como antes.
- **KPI "Total de alertas"**: continua contando `alertasFormatados.length`
  (legado) — não foi alterado.

## Validação

- lint: 0 erros
- testes: 817 passando (4 novos em `src/domain/alertasUnificados.test.js`,
  cobrindo os dois detectores novos e o caso de `db` vazio)
- build: ok
- `getResumoLote`, DRE, financeiro, simulador e domínio pecuário: **não
  alterados** (só leitura de `db.lotes`/`db.estoque` em duas funções novas
  e isoladas)
- nenhuma migration criada, RLS não alterado
- Telegram continua importando `gerarAlertasUnificados` sem mudança de
  assinatura
