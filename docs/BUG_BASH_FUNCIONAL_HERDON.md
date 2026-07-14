# Bug Bash Funcional — HERDON

Sprint bloqueador. Base original: commit `1c0973d`. Rodada atual iniciada em `95e331d` (confirmado como `HEAD` e `origin/main` no pré-check desta rodada). Nenhum recurso novo, nenhuma melhoria só visual, nenhum avanço para piloto/produção até P0 e P1 estarem zerados.

## Origem dos bugs

Não havia um relatório formal de um testador externo disponível nesta sessão (o usuário confirmou isso explicitamente). Em vez de inventar bugs a partir de títulos genéricos, esta rodada é uma **varredura funcional exploratória própria**, com reprodução real em navegador autenticado (conta QA criada nesta sessão, ver abaixo) — não substitui um bug bash real com o testador que encontrou os problemas originais. Cobertura real (não 100%) está registrada na seção final.

## Conta de homologação

Criada via fluxo de cadastro real da aplicação (não inserida direto no banco):
- `qa-bugbash-1@example.com` — perfil `admin` (proprietário), conta nova.
- Assinatura `internal_test` concedida via SQL (mesmo mecanismo usado por outras contas QA já existentes no banco, ex. `qa.sprint34`) para liberar escrita — sem isso a conta cai no modo visualização do gate comercial.
- Dados de teste identificados com prefixo `QA-` conforme pedido, criados e removidos ao final quando temporários.

## Pré-check

```
HEAD = origin/main = 1c0973d
git status --short: só arquivos do vault Obsidian (fora de escopo)
npm run lint: limpo
npm test: 1171/1171
npm run build: ok
```

## Nota de metodologia

Ao interagir via automação de navegador, cliques disparados via `dispatchEvent` sintético (JS puro) mostraram-se **não confiáveis** neste app — em 3 casos separados (dropdown de troca de fazenda, botão "Criar lote" no estado vazio, botão "Salvar pesagem") um clique sintético não disparava o handler React, dando a falsa impressão de bug (nenhuma ação, nenhum erro, nenhum toast). Refeito com clique real do harness (`computer` + `ref` do `read_page`, ou `form_input` para campos), todos os três funcionaram corretamente. Nenhum desses 3 casos é um bug real — registrados aqui só para não serem reabertos por engano. A partir daqui, toda verificação usa `computer`/`form_input`, não `dispatchEvent`.

## Bugs encontrados

| ID | Tela | Ação executada | Resultado esperado | Resultado obtido | Evidência | Prioridade | Status |
| -- | ---- | -------------- | ------------------- | ------------------ | --------- | ---------- | ------ |
| BB-01 | Financeiro (e potencialmente qualquer tela sem tratamento especial em `buildOperationalCreatePayload`) | Conta nova (sem nenhum lançamento ainda) tenta salvar a primeira receita/despesa em "Registrar movimentação" | Lançamento salva e aparece na DRE | Salvamento falha silenciosamente — sem toast, sem fechar modal, sem persistir. Console mostra `[HERDON_SAVE_ERROR]` com `postgresCode: 23505` (duplicate key) | Reproduzido 2x com conta QA nova (perfil="admin", conta sem lançamentos prévios); `select` no banco confirmou zero linhas após o clique; chamada direta a `createOperationalRecord` sem o campo `id` funcionou; `buildOperationalCreatePayload` em `src/services/operationalPersistence.js` não removia `id` no caminho padrão (usado por `movimentacoes_financeiras` e toda tabela sem branch especial), diferente de `fazendas`/`lotes`/`pesagens`/`animais`/`estoque` que já removiam | **P0** (dado não persiste, sem qualquer feedback de erro ao usuário) | ✅ Corrigido |
| BB-02 | Estoque | Cadastrar item novo em "Estoque geral" com categoria explícita "Medicamento" e nome contendo a palavra "Sal" (ex.: "Sal Mineral" — produto real e comum em fazenda) | Item aparece na lista de "Estoque geral" | Item salva corretamente no banco (confirmado via SQL) mas não aparece em nenhuma lista após criar nem após recarregar a página — some para o usuário, parece que o cadastro falhou | `itemEhNutricao()` em `src/pages/EstoquePage.jsx` reclassificava o item como nutrição só por `produto.includes('sal')`, ignorando a `categoria` explícita escolhida no formulário; item ficava oculto na aba padrão "Estoque geral" (só aparecia em "Todos os itens"). `metadata.modulo === 'nutricao'` (sinal oficial usado por `SuplementacaoPage.jsx`) nem era considerado | **P0** (dado parece perdido para o usuário, mesmo estando salvo) | ✅ Corrigido |
| BB-03 | Backend/RLS (afeta toda tabela com policy legada `_own`) | Testado direto via API (bypassando a UI, que já esconde os botões corretamente): usuário convidado com perfil `visualizador` chama `createOperationalRecord('lotes', {...}, session)` | Escrita bloqueada pelo banco, igual ao gate aplicado na sprint anterior | Escrita **bem-sucedida** — a migration anterior (`20260713193754`, sprint passado) só gateou as policies `_same_account`; as policies legadas `_own` (`owner_user_id = auth.uid()`) usam texto de `qual`/`with_check` diferente e não foram tocadas. Qualquer usuário autenticado conseguia inserir um registro com `owner_user_id = seu próprio auth.uid()`, contornando o gate de perfil inteiro — reproduzido com uma segunda conta real (`qa-bugbash-teammate@example.com`) convidada como visualizador da conta QA | **P0** (bypass completo do gate de autorização por perfil aplicado na sprint anterior) | ✅ Corrigido (`supabase/migrations/20260713204723_rls_role_gate_own_policies_visualizador.sql`) — reconfirmado bloqueado após o fix, e reconfirmado que o proprietário real continua escrevendo normalmente |

## Achado residual da sprint anterior — corrigido nesta rodada

**BB-04 — Injeção de registro órfão referenciando fazenda/lote de outra conta.** Documentado como pendência na rodada anterior: qualquer usuário autenticado (mesmo de uma conta completamente não relacionada, sem convite) conseguia inserir uma linha com `owner_user_id = seu próprio id` e um `faz_id`/`lote_id`/`item_estoque_id`/`animal_id` de **qualquer outra conta**, sem que existisse validação de que essa chave estrangeira pertence à mesma conta. A policy `_own` gateada por perfil (BB-03) impedia um `visualizador` de fazer isso, mas não um `admin` de uma conta totalmente estranha (ele é admin da própria conta vazia).

**Correção:** trigger `validar_integridade_conta_fazenda()` (`supabase/migrations/20260713224735_integridade_fk_entre_contas.sql`), aplicado via `BEFORE INSERT OR UPDATE` em toda tabela que tem `owner_user_id` + alguma coluna de referência (`fazenda_id`/`faz_id`/`lote_id`/`item_estoque_id`/`animal_id` — 25 tabelas). Sempre que a linha referenciar uma dessas entidades, o dono da entidade referenciada precisa ser o mesmo `owner_user_id` da linha; caso contrário, `raise exception` com `errcode 23514`.

**Teste em navegador autenticado (não apenas simulação):** conta teammate promovida a `admin` da própria conta independente (sem vínculo com a conta QA) tentou inserir um lote com `faz_id` da fazenda da conta QA → bloqueado (`23514 faz_id 646 nao pertence a mesma conta do registro`). Revertido para `admin` de si mesma, escrita normal continuou funcionando. Proprietário real da conta QA testado depois: `lotes`, `movimentacoes_financeiras` (com `lote_id`+`fazenda_id`) e `estoque` (com `fazenda_id`) continuam salvando normalmente — sem regressão.

**Prioridade:** P0 (era o achado residual mais grave). **Status:** ✅ Corrigido.

## Pastagens

Testado em navegador autenticado: cadastro de pasto (área, capacidade UA/ha, cálculo de "Diagnóstico de capacidade" correto), "Trocar lote de pasto" a partir do card do lote, vínculo refletido no header do lote e na aba "Pasto".

**BB-05 — texto do histórico de movimentação de pasto errado logo após a ação.** Ao trocar de pasto, a mensagem no histórico aparecia como "...foi vinculado ao pasto **um novo pasto**." em vez do nome real do pasto, até a página ser recarregada (depois do refresh, o texto corrigia sozinho). Causa: `handleMoverPasto` em `src/pages/LotesPage.jsx` prependia `resultado.data` (retorno cru do INSERT, sem o relacionamento `pastagem_destino` embutido) direto no estado local `historicoPastos`; `formatHistoricoMensagem` caía no fallback `'um novo pasto'`. Corrigido enriquecendo o registro com `pastagensMap` (que o componente já tinha em memória) antes de atualizar o estado — texto correto imediatamente, sem precisar de refresh. Reproduzido e corrigido com dados reais (troca QA-Pasto Um → QA-Pasto Dois), confirmado texto completo "...foi movido do pasto QA-Pasto Um para o pasto QA-Pasto Dois." **Prioridade P2** (texto incorreto, sem perda de dado — o registro em si sempre esteve correto no banco). **Status:** ✅ Corrigido.

## Auditoria de erros silenciosos / submissão duplicada

Grep dirigido por `catch` vazio: nenhum encontrado. Grep por `onSave?.(`/`onSave(` sem `await` (o padrão que causaria fechar/resetar o formulário antes da persistência real, ou permitir duplo clique) encontrou **6 formulários sem a trava `useSubmitOnce`** já usada em `PesagemForm.jsx`/`NovoLancamentoModal` (Financeiro)/`LoteForm.jsx`: `CustoForm.jsx`, `AnimalForm.jsx`, `funcionarios/FuncionarioModal.jsx`, `fazendas/FazendaModal.jsx`, `SanitarioForm.jsx`, `RotinaForm.jsx`, `TarefasPage.jsx` (`TaskForm`).

**BB-06 — Custos, Animais, Funcionários, Fazendas, Sanidade, Rotinas e Tarefas sem proteção contra duplo clique/duplo envio.** Sem `useSubmitOnce`, um duplo clique em "Salvar" nesses 7 formulários dispara `createOperationalRecord`/`updateOperationalRecord` duas vezes antes do primeiro terminar — o mesmo padrão de "ação duplicada" (P0 na classificação deste sprint) já corrigido antes em Pesagens/Lotes/Financeiro. `createOperationalRecord` não lança exceção (retorna `{persisted:false, error}`), então o risco real não é erro não tratado — é o registro duplicado em si.

**Correção:** aplicado o mesmo padrão já usado nos demais formulários (`const { executar, isSubmitting } = useSubmitOnce()`, `try { await executar(() => onSave?.(...)) } catch { setErro(...) }`, botão com `loading={isSubmitting}`/`disabled={isSubmitting}`) nos 7 arquivos.

**Validação:** lint limpo, 1178/1178 testes, build ok. **Não foi possível reverificar em navegador** — a ferramenta de browser ficou temporariamente indisponível (erro do classificador de segurança) no fim desta sessão. A mudança segue exatamente o mesmo padrão mecânico já verificado ao vivo em `PesagemForm`/`NovoLancamentoModal` mais cedo nesta mesma sessão de bug bash, mas os 7 formulários específicos listados aqui não foram reabertos no navegador depois da alteração.

**Prioridade:** P1 (risco de duplicidade, não confirmado por reprodução em navegador desta vez — diferente de BB-01 a BB-05, que foram todos reproduzidos e reconfirmados ao vivo). **Status:** ✅ Corrigido no código, validado por lint/test/build; **validação visual pendente** (ver pendências).

## Cobertura real — sprint "fechamento funcional" (esta rodada)

```
Pastagens: testado em navegador (cadastro, capacidade, trocar lote de pasto) — 1/1 fluxo principal
Sanidade: NÃO testado nesta rodada
Calendário: NÃO testado nesta rodada
Suplementação: NÃO testado nesta rodada (investigado por código na rodada anterior, não neste sprint)
Assinatura: NÃO testado nesta rodada
Telegram: NÃO testado nesta rodada
Rotas: NÃO testado sistematicamente (só as rotas já visitadas incidentalmente ao testar Lotes/
  Pesagens/Financeiro/Estoque/Pastagens)
Mobile: 0/5 viewports testados
Integridade entre contas/fazenda: corrigido e testado com 2 contas reais (BB-04)

Bugs encontrados nesta rodada: 3 (BB-04 P0, BB-05 P2, BB-06 P1)
Bugs corrigidos: 3 de 3 no código
Confirmados ao vivo em navegador após o fix: BB-04 e BB-05 (2 de 3)
BB-06 (7 formulários) corrigido no código e validado por lint/test/build, mas não reaberto no
  navegador — a ferramenta de browser ficou indisponível (erro transitório do classificador de
  segurança) no fim desta sessão
P0 abertos: 0 dos encontrados nesta rodada. O achado P0 explicitamente pedido no início deste
  sprint (integridade entre contas/fazendas) foi corrigido e confirmado.
P1 abertos: 0 corrigidos no código; 1 (BB-06) sem confirmação visual pós-fix
Cobertura funcional total: parcial — Pastagens e a integridade cross-conta foram fechadas;
  Sanidade, Calendário, Suplementação, Assinatura, Telegram, rotas sistemáticas e mobile
  permanecem no mesmo estado de "não testado nesta rodada" que estavam antes deste sprint
```

Não declaro o HERDON pronto para piloto/produção. O pedido mais crítico deste sprint — fechar o risco de integridade entre contas e fazendas — foi corrigido e confirmado com dados reais. O restante do escopo (Sanidade, Calendário, Suplementação, Assinatura, Telegram, rotas, mobile) segue pendente de teste; não foi possível cobrir nesta única rodada dado o tempo que a investigação de cada bug real exige quando feita com reprodução e correção (não apenas leitura de código).

## Rodada 2 — Sanidade (`95e331d` em diante)

### Pré-check desta rodada

```
HEAD = origin/main = 95e331d
git status --short: só arquivos do vault Obsidian (fora de escopo)
npm run lint: limpo
npm test (antes do fix): 1178 testes, 1173 pass, 5 fail
npm test (depois do fix): 1178/1178 pass
npm run build: ok
```

**Fix de flakiness nos testes (não é um bug de produto):** 5 testes falhavam porque calculavam "hoje" via `new Date().toISOString().slice(0,10)` (UTC), enquanto o código de produção já usa `hojeLocalISO()` (data civil America/Sao_Paulo) desde a correção documentada em sessão anterior (`dataCivil.js`). Isso faz os testes falharem ~3h/dia (janela em que o dia civil em UTC já virou mas o de São Paulo não). Corrigido apontando os 8 arquivos de teste afetados (`calcHelpers.test.js`, `lotesLogic.test.js`, `hojeNaFazenda.test.js`, `manejoResultado.test.js`, `respostasConsulta.test.js`, `alerts.test.js`, `alertasUnificados.test.js`, `alertasInteligentes.test.js`, `relatorioLote.test.js`, `saudeLote.test.js`, `respostasAssistente.test.js`) para usar `hojeLocalISO()` em vez de recalcular a data em UTC. Nenhum código de produção foi alterado.

### Conta usada

Mesma conta de homologação da rodada anterior (`.env.e2e`, `E2E_ADMIN_EMAIL`), fazenda ativa `QA-Fazenda Um`, lote `QA-Lote Confinamento`, produto de estoque `QA-Sal Mineral` (saldo inicial 100 kg).

### Fluxos testados em navegador autenticado (reais, com reload e conferência de estoque)

| Fluxo | Resultado |
| ----- | --------- |
| Cadastro de manejo (vacina, sem produto) | Salva, aparece na tabela e em "Realizados recentemente", sobrevive a reload completo da página |
| Duplo clique em "Salvar manejo" | Não duplica (1 registro, não 2) — confirma que a proteção `useSubmitOnce` aplicada em `SanitarioForm.jsx` na rodada anterior (BB-06) está funcionando ao vivo |
| Cadastro de manejo com produto do estoque + quantidade utilizada | Estoque baixado corretamente (100 → 80 kg), movimentação tipo `consumo` criada e vinculada ao lote |
| Edição do manejo alterando quantidade utilizada (20 → 30) | Estoque desconta só o delta (80 → 70 kg, não 80 → 50) — sem duplicar a baixa |
| Exclusão do manejo | Reverte 100% do consumido via movimentação tipo `ajuste` (70 → 100 kg) — rastreável no histórico |
| Consumo maior que o saldo disponível (9999 kg pedido, 80 kg disponível) | Manejo é salvo (registro clínico não é bloqueado por design — comentário em `estoqueSanidade.js`: "uma falha aqui nunca desfaz o registro sanitário, só avisa"), mas a baixa de estoque **não é aplicada** (saldo permanece 80, nenhuma movimentação nova) e um toast de aviso é disparado (`SanitarioPage.jsx:171`). Texto vermelho no formulário ("Estoque insuficiente...") é só indicativo, não bloqueia o clique em "Salvar" — comportamento intencional, não bug, mas vale registrar porque o texto sozinho pode ser confundido com um bloqueio |
| Lote não selecionado | Bloqueado com mensagem inline "Selecione o lote.", modal permanece aberto, campos preservados, nenhum registro parcial criado |
| Quantidade atendida negativa (-5) | Bloqueado com mensagem inline "Quantidade atendida deve ser maior que zero.", modal permanece aberto, nenhum registro parcial |
| Exclusão — confirmação | Usa modal customizado próprio da aplicação (`onConfirmAction`), não `window.confirm()` nativo — confirmado clicando no botão "Confirmar" do modal |

Nenhum bug nos fluxos acima (cadastro/edição/exclusão/duplo-clique/Estoque/validações). Mas testar a Agenda Sanitária com datas reais (vencido/vencendo hoje/próximos 7/próximos 30/em carência) expôs dois bugs de data reais, descritos abaixo.

### BB-07 — `toDateKey()` convertia `Date` para UTC em vez de data civil (P1)

**Reprodução:** criei um manejo sanitário com "Próxima dose" = hoje (13/07/2026). Esperado: cair no balde "Vencendo hoje" da Agenda Sanitária. Obtido: caiu em "Vencidos" — o balde "Vencendo hoje" ficou zerado.

**Causa:** `construirAgendaSanitaria()` (`src/domain/agendaSanitaria.js:41`) calcula `hoje = toDateKey(new Date())`. `toDateKey()` (`src/domain/calcHelpers.js`), ao receber um `Date`, convertia via `value.toISOString().slice(0,10)` — **UTC**, não data civil. No horário em que os testes rodaram (noite no Brasil), UTC já tinha virado o dia seguinte, então `hoje` calculado era "14/07" enquanto o dia civil real em São Paulo era "13/07" — exatamente a mesma classe de bug já corrigida nos testes (ver acima) e documentada em `dataCivil.js`, mas aqui em código de produção, com `toDateKey` sendo chamado por dezenas de outros pontos do domínio (`alertasInteligentes.js`, `alertasUnificados.js`, `centralAlertas.js`, `indicadoresEstrategicos.js`, `relatorios.js`, etc.).

**Correção:** `toDateKey()` agora usa `hojeLocalISO()` (já importado no arquivo) para os dois ramos que faziam `.toISOString()` — o de `Date` e o de string em formato não-padrão. Corrige o problema na função raiz, para todos os ~30 call sites de uma vez, sem tocar cada chamador.

**Validação:** reproduzido com o registro real "QA-Bug-Bash vencendo hoje" (ainda visível na Sanidade da conta QA), confirmado indo para "Vencidos" antes do fix e para "Vencendo hoje" depois, com reload completo da página entre as duas checagens.

### BB-08 — `obterStatus()` de Sanidade parseava data-only string como UTC, zerava hora em horário local (P1)

**Reprodução:** o mesmo registro "vencendo hoje" — a coluna "Status" da tabela de manejos e o KPI "Manejos Vencidos" continuavam mostrando "Vencido" mesmo depois do fix do BB-07 (a Agenda Sanitária já mostrava certo, mas a tabela abaixo dela não).

**Causa:** `obterStatus()` (`src/pages/SanitarioPage.jsx`) fazia `new Date(dataProxima)` com `dataProxima = "2026-07-13"` (string `YYYY-MM-DD`, sem horário). Por especificação do JS, uma string de data pura é interpretada como **meia-noite UTC**; num timezone atrás de UTC (America/Sao_Paulo, UTC-3), isso já corresponde a 21h do dia anterior em horário local. O código então chamava `.setHours(0,0,0,0)` (hora **local**) nesse valor, zerando para meia-noite local do dia anterior — um shift de um dia para trás, sistemático e não dependente de horário (diferente do BB-07, esse acontecia o dia inteiro, todo dia).

**Correção:** reescrito para usar `daysBetween(hojeLocalISO(), dataProxima)` — a mesma função já usada em `agendaSanitaria.js` para o mesmo cálculo, evitando o parsing ambíguo de `new Date(string)`.

**Achado relacionado, não corrigido nesta rodada:** o mesmo padrão (`new Date(stringDeData)` seguido de `.setHours(0,0,0,0)`) existe em `src/pages/TarefasPage.jsx` (`isOverdue`, `isInPeriodo` — corrigido nesta rodada, ver abaixo), `src/pages/RotinaPage.jsx` (`zerarHora`, usado no cálculo de recorrência de rotinas — **não corrigido**, pertence ao módulo Calendário/Rotinas ainda não testado ao vivo) e `src/utils/alerts.js` (`zerarHora`, usado por ~6 detectores de alerta diferentes — **não corrigido**, é código mais entrelaçado que alimenta a Central de Alertas inteira e merece teste dedicado por tipo de alerta antes de mexer, não um fix às cegas).

### BB-09 — Tarefa sem responsável/lote/fazenda não salvava (P0)

**Reprodução:** criar uma tarefa em `Tarefas` preenchendo só título + data de vencimento, deixando Responsável/Lote/Fazenda em "Não definido"/"Sem lote"/"Sem fazenda" (as opções padrão, claramente apresentadas como opcionais na UI) — clique em "Salvar tarefa" falhava sempre, com o toast genérico "Há um campo com valor inválido. Revise os dados informados e tente novamente." Formulário permanecia aberto e os campos preenchidos eram preservados (isso já funcionava certo), mas **nenhuma tarefa geral (sem vínculo) podia ser criada**.

**Causa:** `buildOperationalCreatePayload()` (`src/services/operationalPersistence.js`) tem builders especializados para `fazendas`/`estoque`/`consumo_suplementacao`/etc. que sanitizam campos `*_id` vazios para `null` via `toNullableNumber()`. `tarefas` (e outras 8 tabelas: `movimentacoes_financeiras`, `custos`, `sanitario`, `suplementacao`, `pastagens`, `funcionarios`, `usuarios`, `rotinas`, `cenarios`) usa o caminho genérico/padrão, que não fazia essa sanitização — `responsavel_id: ''`/`lote_id: ''`/`fazenda_id: ''` (valor de um `<select>` não escolhido) ia direto para o INSERT, e Postgres rejeita string vazia para coluna `bigint` com `22P02`.

**Correção:** no caminho genérico de `buildOperationalCreatePayload`, qualquer chave terminando em `_id` (exceto `cloud_id`, que é uuid, não bigint) com valor `''` agora vira `null` antes do INSERT — corrige a raiz para as 9 tabelas do caminho genérico de uma vez, sem builder por tabela.

**Validação:** reproduzido e corrigido ao vivo — antes do fix, "QA-Bug-Bash tarefa vence hoje" falhava sempre com o toast de valor inválido; depois do fix, salvou (`Pendentes (1)`), sobreviveu a reload completo, e ficou corretamente em "Pendentes" (não em "Vencidas"), confirmando também o fix do padrão `isOverdue`/`isInPeriodo` abaixo.

**Fix relacionado no mesmo caminho:** `isOverdue()` e `isInPeriodo()` em `TarefasPage.jsx` tinham exatamente o bug do BB-08 (`new Date(dateStr)` + `setHours` local) — reescritos para `daysBetween(hojeLocalISO(), dateStr)`. Sem esse fix, mesmo com a tarefa salvando, ela apareceria incorretamente como atrasada quando o vencimento fosse hoje.

## Rodada 3 — Rotinas da Equipe e Calendário

### BB-10 — `RotinaPage.jsx` tinha o mesmo bug de data do BB-08, sistemicamente (P1)

**Reprodução:** ao ler o código antes de testar (para não repetir BB-08 às cegas), `recorrenciaValeHoje`, `tarefasHojeAvulsas`, `tarefasAtrasadas` e `proximasTarefas` todos faziam `zerarHora(new Date(item.data))` — o mesmo `new Date(stringDeData)` (parseado como UTC) seguido de `.setHours(0,0,0,0)` (local) do BB-08, causando o mesmo shift de um dia para trás. Diferente do BB-08 (uma tabela de status), aqui o bug afetava a classificação inteira da página: uma tarefa avulsa vencendo **amanhã** apareceria em "Tarefas para hoje", e uma vencendo **hoje** apareceria em "Tarefas atrasadas".

**Correção:** reescrito para o mesmo padrão `daysBetween(hojeLocalISO(), item.data)` já usado em `agendaSanitaria.js`/`SanitarioPage.jsx`/`TarefasPage.jsx`. O check de dia-da-semana da recorrência semanal (`getDay()`) precisou de um parse à parte, com `new Date('${hojeStr}T00:00:00')` (sem `Z`, interpretado em horário local, sem o shift).

**Validação ao vivo:** criei uma tarefa avulsa para hoje (13/07) e outra para amanhã (14/07) — antes do fix ambas apareceriam trocadas; depois do fix, "hoje" caiu em "Tarefas para hoje" e "amanhã" em "Próximas tarefas", confirmado com reload completo. Testei também recorrência diária (aparece todo dia, confirmado hoje) e semanal com dois casos: dia certo (segunda-feira, hoje é segunda) aparece em "hoje"; dia errado (quarta-feira) não aparece em nenhuma lista hoje — comportamento correto, mas a tela não tem "próximas ocorrências" de recorrentes (só mostra se vale hoje ou não) — isso é limitação de escopo do design atual, não bug.

**Achado colateral:** `RotinaForm.jsx` só oferece recorrência "Diária"/"Semanal" — não existe "Mensal"/"Anual" na UI. Não é um bug (a função nunca prometia suportar isso; o comentário antigo "adicionar lógica para mensal/anual se necessário" confirma que nunca foi construído) — é escopo não implementado. Não construí isso agora (fora do pedido original de corrigir bugs).

**Achado colateral 2 — bloqueio de fluxo:** `RotinaForm.jsx` exige selecionar um "Funcionário" (campo obrigatório), mas a página que cadastra funcionários (`FuncionariosPage`) foi deliberadamente removida do menu em sprint anterior a favor de "Equipe e Acessos" (`EquipePage`, gestão de contas de usuário — conceito diferente de "funcionário" como colaborador de campo; comentário no código confirma a decisão: `navConfig.js:109`). Resultado: **uma conta nova não tem nenhum caminho de UI para cadastrar o funcionário que Rotinas da Equipe exige**, travando o módulo inteiro por trás de um campo obrigatório sem forma de preencher. Não corrigido nesta rodada (é uma decisão de produto sobre navegação, não algo para reverter sem contexto) — testei inserindo um funcionário QA direto no banco via SQL para conseguir validar a lógica de datas. Registrado aqui para decisão do time: ou reabrir `FuncionariosPage` no menu, ou tornar o campo "Funcionário" opcional em `RotinaForm.jsx`, ou remover a duplicidade de vez.

### BB-11 — Cards de resumo de Rotinas nunca mostravam número (P1)

**Reprodução:** os 4 cards no topo de Rotinas da Equipe ("Total de Rotinas", "Pendentes Hoje", "Atrasadas", "Concluídas Hoje") sempre apareciam sem nenhum valor — só o título, nunca o número.

**Causa:** `RotinaPage.jsx` usa `<Card title="..." value={resumo.total} />`, mas o componente `Card` (`src/components/ui/Card.jsx`) não tem nem nunca teve uma prop `value` — só renderiza `title`/`subtitle`/`action`/`children`. O padrão correto, já usado em todas as outras páginas (Sanidade, por exemplo), é passar o valor como `children`: `<Card title="..."><strong>{valor}</strong></Card>`. `RotinaPage.jsx` era o único arquivo do repositório usando o padrão `value=` inexistente (confirmado por grep).

**Correção:** os 4 cards passaram a usar `<strong>{valor}</strong>` como children, igual ao padrão de Sanidade.

**Validação ao vivo:** antes do fix, os 4 cards apareciam vazios (confirmado inspecionando o DOM renderizado, não só o texto visível). Depois do fix: "Total de Rotinas: 5", "Pendentes Hoje: 2", "Atrasadas: 0", "Concluídas Hoje: 1" — todos batendo com os dados reais criados na sessão. Testei também "Concluir hoje" numa tarefa recorrente diária: marca `concluido_datas` (não o status global do registro base), reflete corretamente nos 4 cards, e sobrevive a reload completo.

### Calendário Operacional — smoke test

Não fiz uma varredura completa (viradas de mês/ano, dia 31, fevereiro), mas naveguei para o mês corrente com os dados de teste já criados (Sanidade + Rotinas) e conferi visualmente: dia 13 (hoje) mostra os 9 eventos esperados; a tarefa recorrente semanal "segunda" aparece nos dias 13/20/27 (todas segundas-feiras); a "quarta" aparece nos dias 15/22/29 (todas quartas); a diária aparece todo dia. `CalendarioOperacionalPage.jsx` tem sua própria função de expansão de recorrência (`expandRecurringRotinas`) independente de `RotinaPage.jsx`, e já usa o padrão seguro (`new Date('${data}T00:00:00')`, sem `Z`) — não encontrei o mesmo bug de data aqui. Não testei virada de mês/ano, edição/exclusão a partir do calendário, nem o botão "Novo evento".

### Cobertura atualizada

```
Sanidade: parcial — cadastro/edição/exclusão/duplo-clique/integração com Estoque (baixa,
  delta na edição, estorno na exclusão)/validações de campo/Agenda Sanitária (5 baldes:
  vencido/vencendo hoje/próximos 7/próximos 30/em carência) testados e corretos após BB-07/BB-08.
  NÃO testado ainda: Planejamento IATF/Reprodução, tarefa automática de "próxima dose",
  responsável, exportação CSV/PDF, lote de outra fazenda/conta (bloqueio de FK cross-conta já
  validado genericamente na Rodada 1 via BB-04, não re-testado especificamente em Sanidade)
Tarefas: cadastro básico (sem vínculo) testado e corrigido (BB-09); classificação hoje/atrasada
  testada e corrigida. NÃO testado: edição, conclusão, adiar, resolver, exclusão, filtros,
  tarefa vinculada a lote/fazenda/responsável, duplo clique
Rotinas da Equipe: cadastro (avulsa/diária/semanal), classificação hoje/amanhã/dia-da-semana,
  conclusão por data (concluido_datas), cards de resumo testados e corrigidos (BB-10, BB-11).
  BLOQUEIO DE PRODUTO documentado (não bug de código): campo "Funcionário" obrigatório sem
  caminho de UI para cadastrar funcionários numa conta nova (FuncionariosPage fora do menu).
  NÃO testado: edição, exclusão, tarefa avulsa recorrente virando não-recorrente e vice-versa,
  data_fim de recorrência, duplo clique (código já usa useSubmitOnce, não confirmado ao vivo)
Calendário: smoke test ok (ver acima) — NÃO testado a fundo (virada de mês/ano, dia 31,
  fevereiro, novo evento, edição/exclusão a partir do calendário)
Suplementação: NÃO testado
Assinatura: NÃO testado
Telegram: NÃO testado
Rotas: NÃO testado sistematicamente
Mobile: 0/5 viewports
Central de Alertas: bug de data equivalente identificado por leitura de código em
  src/utils/alerts.js (zerarHora), NÃO corrigido — alimenta ~6 detectores de alerta diferentes,
  requer teste dedicado por tipo de alerta antes de qualquer fix

P0 abertos: 0 (BB-09 era P0, corrigido e confirmado ao vivo)
P1 abertos: 0 dos corrigidos (BB-07, BB-08, BB-10, BB-11 corrigidos e confirmados ao vivo).
  Achado NÃO corrigido (mesma classe de bug): utils/alerts.js zerarHora — candidato a P1 quando
  Central de Alertas for testada. Achado de produto NÃO resolvido (não é código): campo
  Funcionário obrigatório em Rotinas sem caminho de UI para cadastro numa conta nova.
```

## Rodada 4 — Central de Alertas (utils/alerts.js, hojeNaFazenda.js)

### Nota importante: drift de relógio real durante a sessão

No meio desta rodada, o relógio real da máquina avançou de 13/07/2026 para
**14/07/2026** (a sessão já durava várias horas). Isso inicialmente pareceu
um bug novo — "QA-Bug-Bash tarefa vence hoje" (criada com vencimento
13/07) passou a aparecer como atrasada no Dashboard e na Central de
Alertas. **Não é bug**: a tarefa foi criada "para hoje" quando hoje era
13/07; um dia real se passou, então ela está genuinamente vencida agora.
Registrado aqui para não ser confundido com regressão numa futura sessão,
e porque o restante das validações desta rodada usa "hoje" real (14/07),
não a data desta rodada anterior.

### BB-12 — `utils/alerts.js` misturava datas âncoradas em UTC com zeragem de hora local (P1)

**Causa:** `parseISODate()` convertia a data civil corretamente (via
`toDateKey`, já corrigido no BB-07) para um instante `Date.UTC(...)` — mas
a função `zerarHora()`, chamada em cima desse resultado em quase toda
função do arquivo (`diferencaEmDias`, `recorrenciaValeNaData`), fazia
`new Date(instanteUTC)` seguido de `.setHours(0,0,0,0)` (hora **local**).
Meia-noite UTC de um dia civil corresponde a 21h do dia anterior em
America/Sao_Paulo; zerar a hora localmente nesse instante empurra a data
para o dia anterior — um shift de um dia, **sistemático, não só à noite**
(diferente do BB-07/BB-08, que só apareciam numa janela de horário). Isso
afetava praticamente todo o arquivo: validade de estoque, manejo
sanitário, tarefas avulsas (rotinas), pesagem, saída de lote e vencimento
financeiro — qualquer item "vencendo hoje" aparecia como "vencido".

**Correção:** reescrito para o padrão canônico já estabelecido nesta
sessão — `hojeLocalISO()` para "hoje" e `daysBetween(hojeStr, dataString)`
para toda diferença de dias, sem nenhum objeto `Date` intermediário na
lógica de comparação. `parseISODate`/`zerarHora`/`diferencaEmDias`/
`formatarDataISO` foram removidas (mortas após a reescrita); mantida só
uma função `dataOrdenavel()` para o campo `data_sort` (usado apenas para
ordenar a lista final, não para nenhuma comparação de vencimento).

**Validação ao vivo:** criado um manejo sanitário real com "próxima dose"
= hoje (14/07/2026). Antes do fix este teria caído em "vencido"; depois
do fix, tanto a Central de Alertas (`gerarAlertasUnificados`, que já
usava `toDateKey` corrigido) quanto o badge de notificações do cabeçalho
(`buildAlerts`, o arquivo corrigido aqui) contaram o item corretamente —
badge foi de 8 para 9 alertas pendentes, Central de Alertas mostrou
"Vence Hoje · 14/07/2026 · vacina do QA-Lote Confinamento vence hoje".

**Testes de regressão adicionados** em `alerts.test.js`: manejo sanitário
hoje → aviso (não vencido); despesa vencendo hoje → aviso; rotina avulsa
hoje → "pendente hoje" (não atrasada); rotina recorrente diária → vale
hoje; saída de lote hoje → "próxima" (não vencida); lote pesado hoje →
não entra em "pesagem pendente". Todos usam `hojeLocalISO()` real (dia 0
relativo), não uma data fixa, para travar exatamente o limite que
quebrava antes.

### BB-13 — `hojeNaFazenda.js`: dias sem pesagem calculado por aritmética de instante (P2)

**Causa:** `listarLotesSemPesagemRecente()` calculava
`(new Date() - new Date(ultima_pesagem)) / msPorDia` — aritmética de
milissegundos entre dois instantes, não contagem de dias civis. Diferente
dos outros achados desta sessão, o impacto prático é pequeno (limiar de
30 dias, o erro máximo é de algumas horas), mas é a mesma classe de bug
pedida na auditoria e o arquivo já tinha `hojeIso()`/`daysBetween`
disponíveis e não os usava nesta função.

**Correção:** reescrito para `daysBetween(lote.ultima_pesagem, hojeIso())`.

**Teste de regressão:** lote pesado exatamente hoje não pode aparecer em
"sem pesagem recente" (antes, dependendo do horário, um resto de hora
podia empurrar o resultado para "1 dia sem pesar").

### Cobertura atualizada

```
Central de Alertas: corrigida e validada ao vivo (BB-12) — Dashboard ("Prioridades de hoje" /
  "Alertas importantes"), página Central de Alertas (gerarAlertasUnificados) e badge do
  cabeçalho (buildAlerts) comparados entre si e conferidos consistentes para o mesmo evento
  criado nesta rodada. NÃO testado: mudança de mês/ano (só validado no "hoje" real da sessão),
  Telegram e relatório diário ainda não comparados (ver pendências)
```

P0 abertos: 0
P1 abertos: 0 (BB-12 corrigido e confirmado ao vivo). BB-13 é P2 (baixo impacto prático).

## Rodada 5 — Bloqueio de Funcionário em Rotinas (BM-25)

### Mapeamento antes de alterar (pedido explícito antes de qualquer fix)

- **Por que `FuncionariosPage` foi tirada do menu:** commit `2f3ca29`
  ("chore(nav): reorganize sidebar groups"), sem justificativa na mensagem
  do commit. A decisão já estava sinalizada antes disso, na Sprint 13
  (`docs/FASE0_NAVEGACAO_SIDEBAR_HERDON.md`): "'Equipe' existe como duas
  páginas diferentes... reorganizar sem decidir qual sobrevive só move a
  confusão de lugar." Documentada como pendência **BM-25** em
  `docs/HERDON_BACKLOG_MESTRE.md`, reafirmada na Sprint 18
  (`docs/SPRINT18_NAVEGACAO_UX_PAGINAS_ORFAS.md`): "Mantida oculta (sem
  mudança)... decisão de produto necessária (aposentar ou migrar dados) —
  não é uma remoção segura de código morto." Ou seja: **já era um achado
  conhecido e deliberadamente adiado por 3+ sprints**, não uma descoberta
  nova desta sessão.
- **Qual entidade substituiu Funcionário:** nenhuma. `EquipePage.jsx`
  ("Equipe e Acessos") gerencia contas de usuário com login (papéis
  proprietário/gerente/operador/visualizador via `profiles`/convites) —
  um conceito totalmente diferente de "funcionário" (registro de
  colaborador de campo: nome, CPF, cargo, salário, admissão). As duas
  tabelas nunca foram cruzadas em nenhum lugar do código.
- **Se Equipe deveria alimentar o select:** não, sem uma decisão de
  produto para fundir as duas entidades — misturar "conta com login" e
  "colaborador de campo" silenciosamente seria uma mudança de modelo de
  dados, não um bug fix.
- **Se o campo deveria continuar obrigatório:** não. `rotinas.funcionario_id`
  **não tem `NOT NULL`** no schema (`docs/supabase-production-schema.sql`)
  — a obrigatoriedade era só uma validação de frontend em
  `RotinaForm.jsx`. Nenhuma razão de integridade de dados para mantê-la.
- **Se registros antigos dependem de `funcionario_id`:** `utils/alerts.js`,
  `DashboardPage.jsx`, `CalendarioOperacionalPage.jsx` e `SanitarioPage.jsx`
  também leem `funcionarios`, mas todos já tratam ausência com fallback
  (`|| 'Sem responsável'`/`'—'`) — nenhum outro campo obrigatório dependia
  disso além do `RotinaForm.jsx`.

### Solução escolhida: Opção C — tornar o campo opcional

Não escolhi a Opção A (reabrir `FuncionariosPage` no menu) nem a Opção B
(migrar para Equipe) porque ambas são exatamente a decisão de produto que
já foi adiada deliberadamente 3 vezes ("aposentar ou migrar dados" —
BM-25) — não é uma chamada que corrija sozinho no meio de um bug bash.
A Opção C resolve o bloqueio real (conta nova não consegue usar Rotinas
de jeito nenhum) sem tocar nessa decisão pendente, é segura no banco (sem
`NOT NULL` para relaxar) e não descarta nenhum dado.

**Correção:** `RotinaForm.jsx` — removida a validação
`if (!form.funcionario_id) return 'Selecione o funcionário.'`; o payload
agora envia `null` quando não selecionado (mesmo padrão já usado para
`lote_id`); rótulo do campo e opção vazia trocados para "Funcionário
(opcional)" / "Sem responsável", consistente com o padrão já usado em
`TarefasPage.jsx`.

**Validação ao vivo:** criada uma rotina avulsa sem selecionar
funcionário — salvou, apareceu em "Tarefas para hoje" mostrando "—" no
lugar do nome (fallback já existente), sobreviveu a reload completo.

**BM-25 continua em aberto** — esta correção só remove o bloqueio
funcional; a duplicação Funcionário × Equipe segue sendo uma decisão de
produto pendente, agora sem urgência (não bloqueia mais nenhuma tela).

### Cobertura atualizada

```
Rotinas da Equipe: bloqueio de Funcionário obrigatório resolvido (campo agora opcional) —
  conta nova consegue usar o módulo do zero, sem depender de seed manual via SQL
```

P0 abertos: 0
P1 abertos: 0
