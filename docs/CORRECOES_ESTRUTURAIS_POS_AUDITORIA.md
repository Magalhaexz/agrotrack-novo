# Correções Estruturais Pós-Auditoria — HERDON

Sprint de correção das pendências técnicas identificadas em `docs/AUDITORIA_FUNCIONAL_COMPLETA_HERDON.md` e `docs/AUDITORIA_COMPLETA_HERDON.md`. Base: commit `6c9a30e` (confirmado como `HEAD` e `origin/main` no pré-check). Nenhuma correção anterior foi desfeita.

## 1. Estado inicial (pré-check)

- Branch: `main`. `HEAD` = `origin/main` = `6c9a30e`.
- Árvore de trabalho: só arquivos do vault Obsidian como untracked (fora de escopo, não tocados).
- `npm run lint`: limpo. `npm test`: 1166/1166. `npm run build`: ok.
- Migrations locais (`supabase/migrations/`) e remotas conferidas via MCP antes de qualquer alteração.

## 2. Autorização real por perfil (Parte 1) — P0

**Problema:** a interface tem um modelo de permissões rico (`src/auth/perfis.js`, `permissoesPorPerfil`), mas o RLS do banco nunca validava o papel do usuário — só o vínculo com a conta.

**Evidência:** `select … from pg_policies` mostrou que toda tabela de negócio (`lotes`, `animais`, `estoque`, `movimentacoes_financeiras`, `custos`, `sanitario`, `pastagens`, `funcionarios`, `usuarios`, `tarefas`, `rotinas`, `configuracoes`, `cenarios`, `suplementacao`, `consumo_suplementacao`, `alertas_tratativas`, etc.) usava `app_is_same_account(owner_user_id)` — sem checagem de `perfil` — em INSERT/UPDATE/DELETE. Um usuário com perfil `visualizador` (somente-leitura por definição de produto) conseguia gravar/apagar direto via API/Supabase client, contornando toda a checagem da UI.

**Causa:** RLS nunca foi estendido além do isolamento por conta; a granularidade de papel ficou só no front-end.

**Correção:** nova função `app_current_role_can_write()` (nega por padrão — null/vazio/`visualizador`) aplicada via migration a toda policy `_same_account` de escrita (INSERT/UPDATE/DELETE) que usava apenas `app_is_same_account`. SELECT não foi tocado (visualizador continua podendo ler o que a UI já permite). Tabelas já protegidas por `app_can_manage_account` (proprietário/admin — `invites`, `billing_events`, `checkout_sessions`, `customer_subscriptions`, `profiles`) não foram alteradas, pois já excedem o requisito mínimo.

**Arquivos:** `supabase/migrations/20260713193754_rls_role_gate_block_visualizador_writes.sql` (aplicada via MCP e salva localmente).

**Teste:** verificação direta via SQL (`pg_policies` antes/depois — 76 policies passaram a exigir `app_current_role_can_write()`) e `get_advisors(security)` sem novas advertências. Não há harness de teste automatizado para RLS neste projeto (os testes existentes de "matriz view/write" cobrem o `writeGuard` do front-end, não o banco) — ver pendências.

**Validação visual:** não executada (requer login manual com um usuário `visualizador` real e uma conta multiusuário — ver Parte 12).

**Situação:** ✅ corrigido o gap mais grave (visualizador não escreve mais no banco, ponto). ⚠️ **Residual documentado, não corrigido:** o RLS ainda não diferencia `gerente` de `operador` nos pontos onde o app já é mais granular (ex.: `operador` não deveria tocar `custos` nem `funcionarios`, mas hoje só `visualizador` é bloqueado no banco). Estender essa granularidade exige mapear e testar cada uma das ~40 permissões de `permissoesPorPerfil` contra RLS — proponho isso como sprint dedicado, não improvisado aqui.

## 3. Datas e fuso horário (Parte 2) — P0

**Problema:** nenhum utilitário central de datas existia. Cerca de 65 pontos usavam `new Date().toISOString().slice(0, 10)`/`.toISOString()` para datas civis (pesagem, vencimento, manejo, venda, entrada de lote), o que desloca o dia entre ~21h e meia-noite em `America/Sao_Paulo` (UTC-3).

**Evidência:** grep completo em `src/` + agente de investigação confirmaram o padrão em formulários (Pesagem, Financeiro, Sanidade, Lotes) e, mais grave, em funções-raiz compartilhadas por Dashboard, Central de Alertas **e Telegram** (`calcHelpers.js`, `alertasInteligentes.js`, `alertasUnificados.js`, `hojeNaFazenda.js`, `saudeLote.js`, `tratativasAlertas.js`, `manejoResultado.js`, `respostasAssistente.js`, `telegram/cadastros.js`).

**Causa:** uso direto de `toISOString()` (que converte para UTC) para representar "hoje" civil, sem timezone explícito — e o app roda tanto no browser (fuso do usuário) quanto no runtime serverless da Vercel (`api/*`, Telegram — fuso do servidor, tipicamente UTC).

**Correção:** novo utilitário `src/domain/dataCivil.js` com `hojeLocalISO()`, usando `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' })` — correto tanto no browser quanto no servidor, sem depender do relógio local do processo. Aplicado nas funções-raiz (fix de root cause, não por chamador) e em todos os ~47 pontos de formulário/página que ainda usavam o padrão antigo (varredura mecânica + inserção de import, com `npm run lint`/`test`/`build` limpos após).

**Arquivos:** `src/domain/dataCivil.js` (novo) + 47 arquivos de `src/domain`, `src/pages`, `src/components`, `src/utils` (ver `git diff --stat`). Consolidado também um `hojeISO()` duplicado em `src/components/PesagemForm.jsx` para usar o utilitário central.

**Teste:** `src/domain/dataCivil.test.js` — cobre virada de dia entre UTC e America/Sao_Paulo (o caso exato do bug) e virada de mês/ano.

**Validação visual:** não executada (requer relógio do sistema/simulação próxima da meia-noite com login manual — ver Parte 12). Verificado por build/console limpo (smoke test não-autenticado).

**Situação:** ✅ corrigido nas funções-raiz e nos formulários mapeados. Arquivos de teste (`*.test.js`) que já usavam o mesmo padrão para gerar valores esperados foram deixados como estão (autoconsistentes, não afetam usuário final).

## 4. Unificação dos sistemas de alertas (Parte 3) — P1, não unificado nesta sprint

**Problema:** a auditoria original supôs 3 sistemas; a investigação encontrou **5 motores** (2 mortos).

**Evidência:**
1. `src/utils/alerts.js` (`buildAlerts`) — legado, em memória, sem persistência. Alimenta o sino de notificações do `AppHeader` **e** a aba "Alertas" do `DashboardPage.jsx`.
2. `src/domain/alertasInteligentes.js` — motor de severidade, insumo do unificado.
3. `src/domain/alertasUnificados.js` ("Motor Único") — consumido por Dashboard, Central de Alertas **e todo o Telegram**. Dedupe por agrupamento (ids fixos por categoria).
4. `src/domain/centralAlertas.js` — normaliza a saída do (3) para a Central.
5. `src/domain/tratativasAlertas.js` + tabela `alertas_tratativas` — única persistência real (resolver/adiar/ignorar), só usada pela Central.
6. Mortos (0 importadores, removidos nesta sprint): `src/domain/alertas.js` e `src/components/AlertList.jsx`.

**Achado crítico:** a aba "Alertas" do Dashboard usa o motor legado (1) com resolver/adiar simples via `App.jsx`; a Central usa o motor unificado (3) com tratativas persistidas (5). São dois fluxos de resolução independentes — resolver um alerta na Central não fecha o mesmo item no Dashboard, e vice-versa.

**Por que não foi unificado agora:** migrar a aba "Alertas" do Dashboard para o motor unificado + tratativas persistidas é uma mudança estrutural (contrato de dados diferente, severidades com vocabulário diferente — `critical/warning/info` vs `critico/atencao/decisao/informativo`) que toca uma tela usada no dia a dia. Fazer isso "de improviso" dentro de uma sprint que já cobre RLS/datas/DRE arrisca regressão sem tempo hábil de validação visual completa. Meu Telegram já usa a fonte correta (motor unificado) — não há divergência real entre app e Telegram, só entre as duas telas do próprio app.

**Correção aplicada:** remoção seca dos dois arquivos mortos (`domain/alertas.js`, `components/AlertList.jsx`) — zero risco, zero importadores confirmados em todo o repositório (`src/` e `tests/`).

**Situação:** ⚠️ **Pendência registrada para próximo sprint dedicado:** migrar a aba "Alertas" do `DashboardPage.jsx` para consumir `alertasUnificados.js` + `tratativasAlertas.js`, aposentando `utils/alerts.js` e unificando o vocabulário de severidade em um único enum.

## 5. DRE e lançamentos cancelados (Parte 4) — P0

**Problema:** a função central `deveEntrarNoResultadoLote` (`src/domain/financeiroStatus.js`, já testada e usada corretamente por `calcularResultadoLote`, `calcularFluxoCaixa`, `listarContasFinanceiras`) não era aplicada em todos os consumidores de DRE.

**Evidência:** `computeDRE` (aba DRE + exportação CSV/PDF do Financeiro) somava `despesasGerais`/`receitasGerais`, o gráfico mensal e a quebra por categoria **sem excluir `cancelado`/`previsto`**. O cálculo de `deducoes` (Frete/Comissão) por lote também não filtrava cancelado. `buildRelatorioFinanceiro` (`domain/relatorios.js`, alimenta "Maior custo" no resumo do Telegram) tinha o mesmo gap.

**Causa:** a regra central existe, mas foi reimplementada de forma incompleta nesses pontos em vez de reutilizada.

**Correção:** `computeDRE` extraída para `src/pages/financeiroDreLogic.js` (mesmo padrão de `financeiroLancamentoLogic.js`/`lotesLogic.js`, só assim é testável — o arquivo original é `.jsx` com JSX, não importável pelo runner de testes) e agora filtra a lista de movimentações por `deveEntrarNoResultadoLote` antes de qualquer soma. `deducoes` e `buildRelatorioFinanceiro` também passaram a aplicar o mesmo filtro.

**Arquivos:** `src/pages/financeiroDreLogic.js` (novo), `src/pages/FinanceiroPage.jsx`, `src/domain/relatorios.js`.

**Teste:** `src/pages/financeiroDreLogic.test.js` — lançamento cancelado fora dos totais gerais, previsto fora do gráfico mensal, receita/despesa por lote independente do status geral.

**Validação visual:** não executada (requer dados reais e login manual — ver Parte 12).

**Situação:** ✅ corrigido nos 3 pontos identificados. DRE (competência) e Fluxo de Caixa (`fluxoCaixa.js`, já correto) permanecem conceitualmente separados, como já eram.

## 6. Rastreabilidade da suplementação (Parte 5) — P1, já melhor do que a hipótese inicial

**Problema (hipótese da auditoria):** suplementação sem rastreabilidade completa entre lote/produto/estoque/custo.

**Evidência real (investigação):** já existe rastreabilidade real — `SuplementacaoConsumoModal.jsx` baixa o saldo de `estoque` de verdade (não é estimativa) e cria uma `movimentacoes_financeiras` vinculada (`origem_tipo: 'consumo_suplementacao'`, `origem_id`), que já alimenta `calcularCustoLote`/`arroba.js`. Isolamento multi-fazenda confirmado (`fazenda_id` gravado e filtrado).

**Gaps reais, menores do que o suposto:**
1. A baixa de estoque é feita por escrita direta em `estoque.quantidade_atual`, não via `movimentacoes_estoque` — perde uma linha de auditoria própria (mas o saldo e o vínculo financeiro estão corretos).
2. Não há campo persistido de "estimado vs. realizado": todo consumo registrado entra como `realizado` (status ausente = realizado, por `financeiroStatus.js`). A aba "Planejamento" é só um comparativo em memória, não grava nada.

**Por que não foi corrigido agora:** ambos os gaps exigem decisão de modelo de dados (criar registro em `movimentacoes_estoque` duplicando a baixa direta, ou migrar para ele; definir se "estimado" deveria mesmo poder ser um status financeiro). Não é um bug ativo (não há perda de dado nem valor incorreto hoje) — é uma melhoria de auditabilidade. Registrado para o próximo sprint.

**Situação:** ⚠️ nenhuma alteração de código nesta sprint. Achado documentado para não ser reaberto como "sem rastreabilidade" — a rastreabilidade básica (lote → produto → estoque → custo → fazenda) já existe e funciona.

## 7. Componentes órfãos, duplicados e código morto (Parte 6) — P2

**Removidos (zero importadores confirmados em `src/` e `tests/`):**
- `src/components/FazendaForm.jsx`
- `src/components/FuncionarioForm.jsx`
- `src/components/SuplementacaoForm.jsx`
- `src/components/EstoqueForm.jsx`
- `src/components/EntradaEstoqueModal.jsx`
- `src/components/SaidaEstoqueModal.jsx`
- `src/pages/AssinaturaBloqueadaPage.jsx`
- `src/domain/alertas.js` (motor de alertas morto, ver Parte 4)
- `src/components/AlertList.jsx`

**Correção de processo:** a primeira verificação de importadores rodou só em `src/`, e `src/components/loteFormLogic.js` foi apagado por engano — `npm test` acusou na hora (`tests/lotes-consumo.test.js` importa `normalizarInitialData`/`validarForm` de lá). Arquivo restaurado e recebeu a mesma correção de data da Parte 2 (também usava `toISOString().slice(0,10)`). Lição registrada: checar importadores no repo inteiro, não só em `src/`.

**Também limpo:** `hojeISO()` duplicado em `src/components/PesagemForm.jsx` (fazia a mesma coisa manualmente) substituído pelo import de `hojeLocalISO()`.

**Não removido/resolvido — pendência documentada:**
- Duplicação `funcionarios` (página) vs `equipeAcessos` (Central de Equipe): `FuncionariosPage.jsx` segue registrada em `pageMap`/`routes.js`, mas fora do menu. Decisão de produto necessária (aposentar ou migrar dados) — não é uma remoção segura de código morto.
- `loteFormLogic.js` continua com lógica paralela a `lotesLogic.js` (funções equivalentes, nomes diferentes) — os dois são usados de verdade (um por `LoteForm.jsx`/testes, outro por `LotesPage.jsx`), então não é código morto; é duplicação real que exigiria consolidar dois fluxos de formulário testados separadamente.

**Situação:** ✅ 9 arquivos mortos confirmados removidos. ⚠️ 2 duplicações reais documentadas, não resolvidas (exigem decisão de produto ou refatoração maior que o escopo desta sprint).

## 8. Testes

Novos: `src/domain/dataCivil.test.js` (2), `src/pages/financeiroDreLogic.test.js` (3). Total após a sprint: **1171 testes, 1171 passando, 0 falhas** (1166 da baseline + 5 novos).

RLS não tem teste automatizado (ver Parte 2/pendências) — verificado manualmente via SQL contra o banco (Supabase MCP).

## 9. Validação visual

**Não executada de forma autenticada** — o ambiente desta sessão não tem credenciais de um usuário real, e a instrução do próprio sprint proíbe inserir credenciais em código/log/commit. Foi feito apenas um smoke test não-autenticado: `npm run dev`, tela de login carregando sem erros de console e sem tela branca.

**Pendente para o usuário (login manual):** perfil `visualizador` tentando escrever (deve falhar agora, tanto na UI quanto — a novidade — se forçado via API); criar pesagem/lançamento perto da meia-noite e confirmar que a data não muda ao recarregar; DRE com um lançamento cancelado antes/depois da correção; Central de Alertas vs. aba Alertas do Dashboard (para confirmar visualmente a divergência documentada na Parte 4, ainda não corrigida).

## 10. Classificação dos problemas

| Problema | Área | Impacto | Prioridade | Correção | Teste |
|---|---|---|---|---|---|
| RLS não valida perfil (visualizador escreve via API) | Banco/RLS | Acesso cruzado por papel | P0 | ✅ Corrigido (gate visualizador) | Verificação SQL manual |
| `toISOString()` para "hoje" civil em ~65 pontos | Datas | Dado gravado no dia errado | P0 | ✅ Corrigido (root cause + varredura) | `dataCivil.test.js` |
| DRE soma cancelado/previsto (computeDRE, deducoes, maioresCategorias) | Financeiro | Resultado incorreto | P0 | ✅ Corrigido | `financeiroDreLogic.test.js` |
| Dashboard "Alertas" usa motor legado, Central usa motor unificado | Alertas | Resolver não sincroniza entre telas | P1 | ⚠️ Documentado, não corrigido | — |
| Suplementação sem `movimentacoes_estoque`/sem status estimado-vs-realizado | Suplementação | Auditabilidade limitada (sem perda de dado hoje) | P1 | ⚠️ Documentado, não corrigido | — |
| RLS não diferencia gerente/operador (só visualizador é bloqueado) | Banco/RLS | Operador pode gravar em `custos`/`funcionarios` via API, hoje só a UI impede | P1 | ⚠️ Documentado, não corrigido | — |
| `funcionarios` página duplica `equipeAcessos` | Navegação | Confusão de UX, não bug funcional | P2 | ⚠️ Documentado, não corrigido | — |
| 9 arquivos órfãos/mortos | Código | Bundle/manutenção | P2 | ✅ Removidos | build/lint/test limpos |
| `loteFormLogic.js` duplica `lotesLogic.js` | Código | Dois fluxos de formulário paralelos | P2 | ⚠️ Documentado, não resolvido | — |

## 11. Pendências reais e próximos sprints propostos

1. **RLS granular por perfil** (gerente vs. operador vs. visualizador em cada tabela, não só o binário visualizador/resto).
2. **Unificação do motor de alertas** (aposentar `utils/alerts.js`, migrar aba Dashboard para `alertasUnificados.js` + `tratativasAlertas.js`, um único vocabulário de severidade).
3. **Suplementação:** decidir se a baixa de estoque passa a gerar `movimentacoes_estoque`, e se "estimado" vira um status financeiro de verdade.
4. **Duplicação `funcionarios`/`equipeAcessos`** e **`loteFormLogic.js`/`lotesLogic.js`** — decisão de produto/consolidação de código.
5. **Validação visual autenticada completa** (Parte 9 acima) — depende de login manual do usuário.

## 12. Riscos residuais

- A varredura de datas tocou 47 arquivos de forma mecânica; risco mitigado por lint+test+build limpos e smoke test de boot, mas validação visual autenticada real (formulários preenchidos, submetidos, recarregados) ainda não foi feita.
- O gate de RLS é novo em produção; se algum fluxo legítimo depender de um perfil fora de `admin`/`visualizador` com um valor de `perfil` inesperado, a escrita será negada (comportamento "ação desconhecida = negada", intencional, mas vale monitorar erros de escrita após deploy).
