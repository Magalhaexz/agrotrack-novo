# Matriz de Testes Funcionais — HERDON (Auditoria 360º)

> Data: 2026-07-17 · Branch `main` · Banco Supabase `ljpiszxicmmuefbiixui`.
> Método: auditoria código-grounded (leitura direta de `src/`, `api/`, `supabase/migrations/`) +
> introspecção read-only do banco de produção (`pg_policies`, `pg_trigger`, `pg_proc`, advisors) +
> suíte de testes existente (1550 testes). **Sem navegador autenticado nesta sessão** (credenciais
> de e2e em `.env.e2e` estão inválidas — ver limitações no fim). Toda linha abaixo é rastreável a um
> arquivo:linha; nenhuma foi marcada "funciona" sem evidência de código.
>
> Colunas: **Encontrável** (existe entrada de UI/menu) · **Funciona (código)** (a lógica está correta)
> · **Persiste** (grava de fato no Supabase, não só estado local) · **Permissão** (`hasPermission`
> no cliente e/ou RLS no servidor) · **Severidade** P0–P3 (ver critérios no plano de ação) ·
> **Status**: 🔴 aberto · 🟡 aberto, achado documentado antes · ✅ corrigido nesta auditoria.

## Legenda de severidade
- **P0** — perda/corrupção de dado, escrita cross-account, vulnerabilidade explorável, cálculo financeiro errado.
- **P1** — função principal quebrada ou não persiste.
- **P2** — funciona, mas com atrito de UX/inconsistência relevante.
- **P3** — cosmético / código morto sem impacto de dado.

---

## Rebanho e Campo

| ID | Módulo | Tela | Operação | Encontrável | Funciona | Persiste | Permissão | Severidade | Evidência | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| VND-01 | Lotes/Animais | App (web) | Venda/morte/transferência não sincronizava `animais.qtd` (só `lote.qtd`) — animais vendidos continuavam aparecendo no resumo e na aba "Grupos" da página Animais, inclusive após reload | Sim | ~~Não~~ Sim | Sim | Sim | **P0** | `src/services/movimentacoes.js` (`sincronizarAnimaisGrupoDoLote`); antes: `AnimaisPage.jsx:187` somava `animais[].qtd` cru | ✅ **corrigido** (commit `fix: corrige venda e atualizacao de quantidade dos lotes`) |
| VND-02 | Telegram | Bot — venda/morte/abate/descarte/transferência | RPC `registrar_saida_lote` tinha o mesmo bug de VND-01 no lado SQL (usada só pelo bot, não pelo app web) | Sim | ~~Não~~ Sim | Sim | Sim | **P0** | `supabase/migrations/20260716180853_rpcs_transacionais_lote_pesagem.sql:133` (só `update lotes`); corrigido em `20260717120000_...sql` | ✅ **corrigido** |
| LOT-1 | Lotes | Detalhe do lote → "Ajuste de lotação" | Mesmo bug de VND-01, terceiro caminho (correção administrativa de contagem) | Sim | ~~Parcial~~ Sim | Sim | Sim (`lotes:editar`) | **P1** | `src/pages/LotesPage.jsx` (`handleAjusteLotacao`), `src/pages/lotesLogic.js:192` (`buildAjusteLotacaoPatch`) | ✅ **corrigido** |
| LOT-2 | Lotes/Pesagens | Detalhe do lote → "Nova Pesagem" | Segunda implementação de "registrar pesagem", divergente de `PesagensPage.jsx`; grava `lote.p_at` com o valor digitado sem checar se é a pesagem mais recente por data | Sim | Não | Sim | Sim (`pesagens:editar`) | **P2** | `src/pages/LotesPage.jsx:553-588` (`handleSalvarPesagem`) vs `src/domain/pesagensLote.js:52-60` (`recalcularPesoAtualLote`, não usado aqui) | 🔴 aberto — pesagem retroativa lançada por esse caminho corrompe "peso atual" |
| PST-1 | Pastagens | Tela Pastos → status de ocupação | `uaEstimada`/status "acima da capacidade" usa `animais` cru, não `lote.qtd`; `cabecasEstimadas` (número exibido) já está correto | Sim | Não (fonte errada no cálculo de status) | N/A (leitura) | N/A | **P2** | `src/domain/ocupacaoPastos.js:59-79`, `src/domain/unidadeAnimal.js:7-15` | 🔴 aberto — mesma classe de bug de VND-01, agora no cálculo de UA por pasto |
| PST-2 | Pastagens | KPI "UA da fazenda"/"Taxa de lotação" | Soma **todos** os registros de `animais` sem filtrar lotes `encerrado`/`vendido` | Sim | Não | N/A (leitura) | N/A | **P2** | `src/pages/PastagensPage.jsx:99-126`, `src/domain/unidadeAnimal.js:17-23` (`calcularUaTotalFazenda`) | 🔴 aberto — lote finalizado continua contando na capacidade total da fazenda |
| FAZ-1 | Fazendas | (nenhuma — código morto) | Diagnóstico de nuvem / reconectar / sincronizar (3 funções, ~380 linhas) sem nenhum botão que as chame | Não | N/A | N/A | N/A | P3 | `src/pages/FazendasPage.jsx:316-667` | 🔴 aberto — limpeza, sem risco funcional |
| FAZ-2 | Fazendas | Cadastro/Edição | Botão "Editar" abre o modal mesmo sem permissão; só bloqueia no salvar | Sim | Sim | Sim | Inconsistente (bloqueio só no submit) | P3 | `src/pages/FazendasPage.jsx:87-194,726` | 🔴 aberto — UX, não é falha de segurança (RLS protege a escrita) |
| FAZ-3 | Fazendas | Excluir | Bloqueia exclusão com lotes/animais/financeiro/estoque/sanitário vinculados | Sim | Sim | Sim | Sim | OK | `src/pages/FazendasPage.jsx:196-281` | ✅ já correto |
| PST-3 | Pastagens | Tabela de pastos | Editar/Excluir sem `disabled` visual por permissão (só bloqueia no clique) | Sim | Sim | Sim | Checagem só no handler | P3 | `src/pages/PastagensPage.jsx:490-491` | 🔴 aberto — inconsistente com Sanidade/Lotes |
| SAN-1 | Sanidade | CRUD de manejo sanitário | Cadastrar/editar/excluir, sincroniza estoque, rotina automática | Sim | Sim | Sim | Sim, botões `disabled` | OK | `src/pages/SanitarioPage.jsx:175-457` | ✅ sólido, sem achados novos |
| SAN-2 | Sanidade | Protocolo IATF | Salvar protocolo reaproveita o mesmo pipeline | Sim | Sim | Sim | Sim | OK | `src/pages/SanitarioPage.jsx:478-497` | ✅ correto |
| PES-1 | Pesagens | Aba Nova pesagem/Histórico | Cadastrar/editar/excluir (lote e individual), recalcula `lote.p_at` pela fonte única correta | Sim | Sim | Sim | Sim | OK | `src/pages/PesagensPage.jsx:308-780` | ✅ correto — contraste com LOT-2 |

## Estoque, Suplementação e Financeiro

| ID | Módulo | Tela | Operação | Encontrável | Funciona | Persiste | Permissão | Severidade | Evidência | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| EST-01 | Estoque | Registrar Saída | Tipos "Tratamento" e "Saída" no dropdown não existiam em `tiposValidos` do serviço — a chamada falhava silenciosamente (`console.warn`, nada mudava) e o modal fechava como se tivesse dado certo | Sim (opções no menu) | ~~Não~~ Sim | ~~Não~~ Sim | `estoque:editar` | **P0** | `src/services/movimentacoes.js` (`registrarSaidaEstoque`, enum canônico `['consumo','tratamento','ajuste','perda','venda']`, agora lança erro em vez de silenciar); `src/pages/EstoquePage.jsx` (`SaidaModal`, trata erro com toast, não fecha nem limpa em falha) | ✅ **corrigido** (commit `fix: corrige movimentacoes de saida do estoque`) — "Saída" removida do dropdown (redundante com o próprio título da tela); "Tratamento" agora é tipo válido, gera despesa `tratamento_sanitario` quando vinculado a um lote |
| EST-02 | Estoque | Registrar Entrada | Compra de item de estoque via UI nunca gerava despesa financeira (lógica duplicada em `EstoquePage.jsx` nunca usava o serviço real; `App.jsx` sempre passava `onRegistrarEntradaEstoque`, mas a página não usava essa prop) | Sim | ~~Parcial~~ Sim | ~~Parcial~~ Sim | `estoque:editar` | **P1** | `src/services/movimentacoes.js` (`registrarEntradaEstoque`, agora chamada de fato via `onRegistrarEntradaEstoque`); `src/pages/EstoquePage.jsx` (`EntradaModal`) | ✅ **corrigido** — lógica de persistência duplicada removida, entrada agora sempre passa por `registrarEntradaEstoque` (gera despesa `compra_estoque`) |
| EST-03 | Estoque | Item/Histórico | Não existe exclusão/estorno de item ou movimentação de estoque geral | Não | N/A | N/A | N/A | P2 | grep completo sem `deleteOperationalRecord('estoque'…)`/`('movimentacoes_estoque'…)` | 🔴 aberto |
| EST-04 | Estoque/Suplementação | Cadastro de produto | 3 heurísticas diferentes decidem se um item é "nutricional" (`estoqueLogic.js`, `SuplementacaoPage.jsx`, `SuplementacaoConsumoModal.jsx`) — item cadastrado em "Insumo geral" pode não aparecer no dropdown de Consumo | Parcial | Inconsistente | — | — | P2 | `src/pages/estoqueLogic.js:13-38`, `src/pages/SuplementacaoPage.jsx:48-60`, `src/components/SuplementacaoConsumoModal.jsx:22-27` | 🔴 aberto |
| EST-05 | Estoque/Suplementação | Saída vs Consumo | Regra de saldo negativo diverge: Estoque bloqueia (`throw`), Suplementação usa `window.confirm` nativo e permite negativo | — | Inconsistente | Sim | — | P2 | `src/services/movimentacoes.js:667-671` vs `src/components/SuplementacaoConsumoModal.jsx:253` | 🔴 aberto |
| SUP-01 | Suplementação | Planejamento (aba "Dietas") | Salva só em estado React local — **nunca persiste na nuvem** | Sim | Sim (local) | **Não** | — | **P1** | `src/pages/SuplementacaoPage.jsx:739-785` (`salvar()` só chama `setDb`) | 🟡 aberto — já avisado na própria UI ("Dietas ficam salvas apenas neste dispositivo"), então não engana o usuário, mas é uma feature incompleta |
| SUP-02 | Suplementação | Registrar consumo real | Baixa estoque + gera financeiro corretamente, sem duplicar (busca por `origem_tipo`+`origem_id` antes de criar) | Sim | Sim | Sim | `estoque:editar` | OK | `src/components/SuplementacaoConsumoModal.jsx:246-371` | ✅ correto |
| SUP-03 | Suplementação | Editar consumo (trocar produto) | Estorna 100% do produto antigo antes de baixar o novo | Sim | Sim | Sim | — | OK | `src/components/SuplementacaoConsumoModal.jsx:294-317` | ✅ correto |
| SUP-04 | Suplementação | Excluir/estornar consumo | Devolve ao estoque corretamente; fórmula única reaproveitada por Lotes | Sim | Sim | Sim | `estoque:editar` | OK | `src/services/consumoSuplementacao.js:15-47` | ✅ correto |
| SAN-3 | Sanidade → Estoque | Consumo de produto em manejo | Baixa só o delta na edição, bloqueia saldo insuficiente, reverte 100% na exclusão (Sprint 15) | Sim | Sim | Sim | Sim | OK | `src/services/estoqueSanidade.js` | ✅ confirmado ainda correto |
| FIN-01 | Financeiro | Filtro por categoria / DRE | Categorias fixas do filtro (Title-Case) nunca batem com os slugs reais gerados por Estoque/Suplementação (`compra_estoque`, `consumo_estoque`, `nutricao`) | Parcial | Quebrado para despesas auto-geradas | Sim | — | **P2** | `src/pages/FinanceiroPage.jsx:29-30` vs `src/services/movimentacoes.js:595,713,730`, `src/services/consumoSuplementacao.js:325` | 🔴 aberto — despesas somem do filtro por categoria, só aparecem em "Todas" |

## Rotina, Alertas, Equipe, Segurança e Telegram

| ID | Módulo | Tela | Operação | Encontrável | Funciona | Persiste | Permissão (cliente) | Permissão (servidor/RLS) | Severidade | Evidência | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| S-01 | Segurança/RLS | `public.profiles` | Qualquer usuário autenticado podia alterar o **próprio `perfil`** para `proprietario` via API REST direta (`PATCH /rest/v1/profiles?id=eq.<próprio_id>`) — escalada de privilégio completa | N/A (via API, não UI) | Sim (explorável) | Sim | `podeAlterarPapel` (só cliente) | **Nenhuma** — policy legada permissiva + policy nova não restringiam coluna, sem trigger | **P0** | Confirmado por consulta direta a `pg_policies`/`pg_trigger`/`pg_proc` no banco de produção (ver Auditoria Geral §Segurança) | ✅ **corrigido nesta auditoria** — policy legada removida + trigger `profiles_bloquear_autoescalada` aplicado diretamente no banco |
| S-02 | Segurança/RLS | Todas as telas de escrita | RLS (`app_current_role_can_write()`) só distingue `visualizador` do resto — não reflete a matriz granular de `src/auth/perfis.js` (ex.: `operador` não deveria gravar em Financeiro/Custos/Funcionários) | Não via UI / Sim via API direta | Sim | Sim | Granular (`hasPermission`) | Só binário (visualizador × resto) | **P1** | `src/auth/perfis.js:87-123`; migrations `20260713193754`/`20260713204723`; confirmado via `pg_policies` | 🔴 aberto — pendência já conhecida de sessões anteriores, confirmada ainda válida em produção |
| S-03 | Equipe | `FuncionariosPage` | Único CRUD do app sem nenhum `hasPermission` no cliente (mitigado hoje pelo RLS binário) | Sim | Sim | Sim | **Nenhum** | Só binário (ver S-02) | P2 | `src/pages/FuncionariosPage.jsx` inteiro | 🔴 aberto |
| S-04 | Segurança/RLS | Tabelas do bot Telegram | `telegram_operacoes_pendentes`, `telegram_conversas`, `telegram_connection_codes`, `telegram_notification_logs`: RLS ligado sem nenhuma policy | N/A | N/A | N/A | Bloqueia tudo (só service role acessa) | P3 | Supabase advisor `rls_enabled_no_policy` (4 ocorrências) | 🔴 aberto — parece intencional, documentar a intenção |
| S-05 | Segurança/RLS | Funções internas | 10 funções `SECURITY DEFINER` chamáveis via RPC por `anon`/`authenticated` (`app_can_manage_account`, `app_is_same_account` etc.) | N/A | N/A | N/A | Baixo risco isolado, mas viola menor privilégio | P3 | Supabase advisor `security` | 🔴 aberto |
| S-06 | Segurança | Supabase Auth | Proteção de senha vazada (HaveIBeenPwned) desligada | N/A | N/A | N/A | Config de projeto | P3 | Advisor `auth_leaked_password_protection` | 🔴 aberto — fácil de ligar no painel |
| T-01 | Tarefas | Kanban | Criar/editar/mover/excluir — duas camadas de permissão corretas (cliente + RLS) | Sim | Sim | Sim | Sim | Sim | OK | `src/pages/TarefasPage.jsx:90-224` | ✅ padrão de referência |
| R-01 | Rotina | `RotinaPage` | CRUD de rotina | Sim | Sim | Sim | Sim | Sim | OK | `src/pages/RotinaPage.jsx:130-232` | ✅ correto |
| R-02 | Calendário | `CalendarioOperacionalPage` | CRUD de evento | Sim | Sim | Sim | Sim | Sim | OK | `src/pages/CalendarioOperacionalPage.jsx:60-97,518-519` | ✅ correto |
| A-01 | Alertas | Central de Alertas | Resolver/adiar/marcar em análise/reabrir | Sim | Sim | Sim | Sim | Sim | OK | `src/pages/AlertasPage.jsx:195,228` | ✅ motor único confirmado consolidado |
| A-02 | Alertas | Painel legado (header/Dashboard) | Resolver/adiar em tabelas **diferentes** (`alertas_resolvidos`/`alertas_adiados`) coexistindo com a Central | Sim (ainda visível) | Sim | Sim | — | Mesmo padrão same_account | P3 (dívida conhecida) | `src/App.jsx`, `src/domain/telegram/acoesAlerta.js` | 🟡 aberto — confirmado que a dívida documentada em sessões anteriores continua real |
| C-01 | Configurações | Salvar preferências | Upsert por `id`, permissão + RLS corretos | Sim | Sim | Sim | Sim | Sim | OK | `src/pages/ConfiguracoesPage.jsx:157` | ✅ correto |
| TG-01 | Telegram | Todas as intenções mutáveis | Bot reimplementa a matriz granular de `perfis.js` no servidor **antes** de qualquer escrita (mais rigoroso que o RLS do app web) | Sim | Sim | Sim | Granular por intenção | Service role (bypassa RLS) | OK | `src/domain/telegram/permissoesTelegram.js` | ✅ arquitetura correta |
| TG-02 | Telegram × App | Contagem de cabeças por lote | Telegram e app usam a mesma função (`getResumoLote`/`calcLote`) — sem divergência entre superfícies para o mesmo lote | Sim | Sim | — | — | — | P3 | `src/domain/telegram/respostasConsulta.js:59,72,250` | 🔴 aberto — ordem de fallback inconsistente entre módulos do próprio domínio, mas não é um bug cross-surface |

---

## Teste de Campo (retomada 3, mesmo dia) — 5 achados reportados pelo uso real

| ID | Módulo | Tela | Operação | Encontrável | Funciona | Persiste | Permissão | Severidade | Evidência | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| CAMPO-01 | Fazendas | Excluir fazenda | Lote **encerrado** (sem nenhuma operação ativa) ainda bloqueava a exclusão para sempre, sem nenhum caminho oferecido ao usuário | Sim | ~~Não~~ Sim | ~~Não~~ Sim | `fazendas:editar` | **P1** | `src/pages/FazendasPage.jsx::excluirFazenda` — `hasLinkedRecords` checava qualquer lote, sem distinguir status; coluna `fazendas.status` (default `'ativa'`) e o campo "Status" no `FazendaModal.jsx` **já existiam no banco e na tela de edição**, mas a mensagem de bloqueio nunca mencionava essa saída | ✅ **corrigido** — mensagem agora orienta a inativar (`Editar fazenda → Status → Inativa`, fluxo que já existia); `pastagens`/`tarefas` (que podem existir sem nenhum lote) entraram na checagem de bloqueio, que antes só olhava `lotes/animais/financeiro/estoque/sanitário` |
| CAMPO-02 | Pastagens | Indicadores de capacidade/lotação | `uaEstimada`/status de lotação por pasto e o KPI de UA da fazenda somavam `animais[]` cru (não `lote.qtd`) e não filtravam lotes finalizados/vendidos — mesma classe de bug já corrigida para venda (VND-01) | Sim (sempre visível) | ~~Não~~ Sim | N/A (leitura) | N/A | **P2** | `src/domain/unidadeAnimal.js` (`calcularUaPorLote`/`calcularUaTotalFazenda`, agora aceitam lote/lotes canônicos), `src/domain/ocupacaoPastos.js`, `src/pages/PastagensPage.jsx`, `src/domain/indicadoresEstrategicos.js` | ✅ **corrigido** (mesma correspondência de PST-1/PST-2 já documentada) |
| CAMPO-03 | Pastagens | Cadastro de pasto | Retestado após as mudanças de Lotes/Fazendas/UA desta rodada — nenhuma regressão: o formulário de cadastro em si não foi tocado | Sim | Sim | Sim | Sim | OK | `src/pages/PastagensPage.jsx` (formulário "Cadastrar pasto"/"Editar pasto", inline na própria página — não alterado nesta rodada, só os cálculos de indicadores acima dele) | ✅ aprovado — mobile e multi-fazenda **ainda não verificados ao vivo** (sem navegador autenticado) |
| CAMPO-04 | Lotes | Cadastro de lote (conta multi-fazenda) | Campo "Fazenda" era só um texto fixo mostrando a fazenda ativa da conta — **sem select**, impossível escolher outra fazenda para o novo lote sem trocar a fazenda ativa em outra tela e reabrir o formulário | Sim | ~~Não~~ Sim | ~~Não~~ Sim | `lotes:editar` | **P1** | `src/components/LoteForm.jsx` — o campo era um `<span>` somente leitura (`fazendaSelecionada?.nome`); `db.fazendas` (fonte real) já continha todas as fazendas da conta (confirmado em `src/domain/escopoFazenda.js::filtrarDbPorFazenda`, que nunca filtra a chave `fazendas`) — o problema era 100% de apresentação, não de dado | ✅ **corrigido** — vira `<select>` real quando há mais de uma fazenda ATIVA e o lote é novo (edição de lote continua com o texto fixo, por ser uma operação maior fora de escopo); escolha manual do usuário não é mais sobrescrita pelo efeito de sincronização com a fazenda ativa da conta; fazenda **inativa** não é oferecida como destino de lote novo |
| CAMPO-05 | Suplementação | Cadastro de dieta | Fluxo difícil/pouco intuitivo — confirmado: só 1 produto por dieta na prática (`itens[0]`), sem tabela `dietas` no banco (dieta é 100% local, nunca persiste — já era SUP-01), sem ações rápidas (copiar/repetir/pausar/finalizar) | Sim | Parcial | **Não** | `estoque:editar` | **P1** (já registrado como SUP-01) | `src/pages/SuplementacaoPage.jsx` (`getDietaEditData` usa só `itens[0]`); `information_schema.tables` confirma que **não existe tabela `dietas`** no banco | 🔴 **não implementado nesta rodada** — redesenho completo (múltiplos itens, persistência real com migration nova, ações rápidas, wizard) é uma feature nova, não uma correção; exige navegador autenticado para não arriscar quebrar UI às cegas. Ver proposta detalhada em `AUDITORIA_UX_ESTOQUE_SUPLEMENTACAO.md` |

## Números desta rodada
- **53 achados** registrados no total (48 da auditoria original + 5 do teste de campo).
- **4 P0** — todos corrigidos (nenhum P0 novo neste teste de campo).
- **3 P1 corrigidos** nesta retomada (CAMPO-01 exclusão de fazenda, CAMPO-04 seletor de fazenda no
  lote) além dos 2 já corrigidos na retomada anterior (EST-01/EST-02); **4 P1 abertos** (RLS
  granular, LOT-2 pesagem retroativa, CAMPO-05 redesenho de dieta — mesmo item que SUP-01 já
  registrava, e um novo achado de dieta multi-item/ações rápidas incorporado ao mesmo item).
- **1 P2 corrigido** nesta retomada (CAMPO-02, capacidade de pasto por UA).
- Suíte de testes: 1559/1559 passando após as correções desta rodada (1556 antes desta retomada).

## Limitações desta auditoria
- **Sem navegador autenticado**, confirmado em 2 rodadas anteriores desta mesma auditoria (mesma
  senha em `.env.e2e`, mesmo erro `Invalid login credentials` do Supabase). Não repeti a tentativa
  nesta 3ª rodada (retestar a mesma credencial inalterada não traria informação nova) — nenhuma tela
  foi clicada ao vivo em nenhuma das três rodadas, incluindo os achados CAMPO-01/02/03/04/05 abaixo
  (corrigidos/documentados por leitura de código e testes automatizados, não por clique real).
  Recomendo confirmar/rotacionar essa credencial antes da próxima sessão de QA visual; não é seguro
  nem apropriado tentar adivinhar a senha correta ou criar uma conta nova sem autorização explícita.
- Nenhum teste em múltiplos viewports foi executado (exigiria a mesma sessão autenticada).
- Achados marcados "não verificado ao vivo" nas seções de origem vêm de leitura de código com alta confiança (grep confirmando ausência de chamadas, lógica inequívoca), não de clique real na tela.
- `RetiradaAnimaisModal.jsx`, `FechamentoLoteModal.jsx`, `MoverPastoModal.jsx` foram auditados só via os pontos de entrada em `LotesPage.jsx`/`LoteAcoesMenu.jsx`, não linha a linha.

---

# Auditoria UX Completa (retomada 4) — experiência do pecuarista

> Objetivo: antes de criar novos módulos (Dietas persistidas), auditar todos os fluxos existentes
> pensando em cliques, telas confusas, campos redundantes, inconsistência entre telas parecidas,
> operações repetidas e comportamento inesperado. Método: 4 sub-auditorias paralelas + revisão
> própria do Telegram, 100% por leitura de código (sem navegador ao vivo — mesma limitação de
> sempre). Corrigidos nesta rodada **apenas os P0/P1 evidentes** (causa raiz clara, fix isolado,
> baixo risco); o restante fica registrado aqui para a próxima sequência de sprints.

## Corrigidos nesta rodada

| ID | Módulo | Problema | Severidade | Evidência | Correção |
|---|---|---|---|---|---|
| UX-P0-1 | Lotes/Transferência | "Transferência de saída" no modal de retirada do lote nunca perguntava o lote de destino — `registrarSaidaAnimal` sempre exige `destinoLoteId` para esse tipo, então a operação falhava com erro **100% das vezes** | **P0** | `src/components/lotes/RetiradaAnimaisModal.jsx` (sem campo destino); `src/services/movimentacoes.js` (exige `destinoLoteId`) | ✅ Select "Lote de destino" adicionado, populado com lotes ativos da mesma fazenda (exceto o próprio); Telegram já fazia isso corretamente (resolve por nome) — web app não tinha o equivalente |
| UX-P1-2 | Lotes/Retirada | Mensagem de sucesso era escolhida pelo botão que abriu o modal (`retiradaModo`), não pelo tipo realmente salvo — trocar de "Venda" para "Morte/perda" no dropdown antes de confirmar ainda mostrava "Venda parcial registrada com sucesso." | P1 | `src/pages/LotesPage.jsx::handleRetirada` | ✅ Mensagem agora baseada no `tipoSaida` retornado pelo formulário |
| UX-P1-3 | Lotes/Animais | Dois modais de movimentação sem trava de duplo-envio (`PesagemModal` embutido em `LotesPage.jsx`, `AnimalMovementModal.jsx`) — duplo clique/toque podia criar 2 pesagens ou 2 movimentações | P1 | Ambos sem `useSubmitOnce`, diferente de `PesagemForm`/`RetiradaAnimaisModal`, que já usavam | ✅ `useSubmitOnce` adicionado aos dois, com botão desabilitado + "Salvando..." durante o envio |
| UX-P1-4 | Pastagens | Excluir um pasto não checava se algum lote ativo ainda estava vinculado (`lote.pastagem_id`) — diferente de excluir fazenda, que checa 7 tabelas. O próprio bot do Telegram já bloqueava esse caso e **documentava a lacuna do app em comentário no código** (`cadastroPasto.js`) | P1 | `src/pages/PastagensPage.jsx::excluirPastagem` (sem checagem) vs `src/domain/telegram/cadastroPasto.js:115-133` (bloqueia, com o comentário do gap) | ✅ Mesma regra do bot replicada: bloqueia enquanto houver lote não encerrado vinculado |

Sem teste automatizado novo para os 4 itens acima (mudança de UI/wiring de React; projeto sem
infraestrutura de teste de componente) — verificados por leitura de código e, no caso de UX-P0-1,
pelos testes já existentes de `registrarSaidaAnimal` em `movimentacoes.test.js` (que já cobriam a
exigência de `destinoLoteId` no serviço; só a tela não coletava o dado).

## Achados registrados para a próxima sequência de sprints (não corrigidos nesta rodada)

### Fazendas, Pastos, Lotes, Ajuste de Lotação

| ID | Módulo | Cenário | Severidade | Evidência | Sugestão |
|---|---|---|---|---|---|
| UX-F1 | Fazendas × Pastagens | "Capacidade (UA)" do cadastro de fazenda nunca é usado em nenhum cálculo — a página Pastos calcula sua própria capacidade a partir das pastagens. Dois números com o mesmo nome, sem relação, sem indicação de qual é o oficial | P1 | `src/domain/unidadeAnimal.js:59-63`; `src/components/fazendas/FazendaCard.jsx`; `src/pages/PastagensPage.jsx` | Remover o campo manual ou renomeá-lo deixando claro que não é usado no cálculo de lotação |
| UX-F2 | Fazendas | "Ver detalhes" e "Editar" no card abrem exatamente o mesmo modal — não existe tela de detalhe real (diferente de Lote) | P2 | `src/components/fazendas/FazendaCard.jsx` | Remover um dos dois botões |
| UX-F3 | Fazendas | Empty state promete "ou importando seus dados" sem nenhum link para a página de Importação | P2 | `src/pages/FazendasPage.jsx` (empty state) | Adicionar link/botão para `ImportacaoPage` |
| UX-F4 | Fazendas | Mensagem de sucesso genérica ao criar ("Registro salvo") vs específica ao editar ("Fazenda atualizada") | P3 | `src/pages/FazendasPage.jsx` | Padronizar |
| UX-PS1 | Pastagens | Clicar "Editar" na tabela não rola até o formulário no topo — só o CTA do empty state faz isso | P2 | `src/pages/PastagensPage.jsx` (`preencherForm` sem scroll) | Chamar `focarFormularioPasto()` também em `preencherForm` |
| UX-PS2 | Pastagens | Cadastro de Pasto é card inline sempre visível; Fazenda e Lote usam modal — três padrões diferentes para "cadastrar item" no mesmo domínio | P2 | Comparar os 3 componentes de cadastro | Unificar em modal, ou justificar a exceção |
| UX-L1 | Lotes | Cadastro exige metas zootécnicas completas (peso alvo, GMD) como obrigatórias, bem mais pesado que Fazenda/Pasto (1-2 campos) | P2 | `src/components/LoteForm.jsx::validarForm` | Avaliar tornar opcional no cadastro rápido, preenchível depois via edição |
| UX-L2 | Lotes | Criar lote dispara 2 gravações silenciosas em segundo plano (grupo em `animais`, pesagem inicial); se falharem, só um toast de aviso indica a causa | P3 (já mitigado) | `src/pages/LotesPage.jsx` | Toast poderia linkar direto para a tela de Animais |

### Pesagens, Vendas, Mortes, Transferências

| ID | Módulo | Cenário | Severidade | Evidência | Sugestão |
|---|---|---|---|---|---|
| UX-P1-1 | Animais individuais | Venda/morte de um ANIMAL INDIVIDUAL (`AnimaisPage.jsx::registrarOperacaoIndividual`) nunca atualiza `lote.qtd`/`p_at` do lote de origem — mesma classe de bug já corrigida várias vezes para o nível de lote (venda/ajuste/RPC), agora reaberta por um 4º caminho de escrita | **P1** | `src/pages/AnimaisPage.jsx:300-398` (sem update em `lotes`) vs `src/services/movimentacoes.js` (que sim atualiza) | Reaproveitar `sincronizarAnimaisGrupoDoLote` também aqui — mesmo padrão já validado 3 vezes nesta auditoria |
| UX-P2-1 | Pesagens | Três formulários diferentes para "Registrar pesagem" (`PesagensPage`/`PesagemForm` completo, mini-modal em `LotesPage.jsx` sem rendimento/preço, e o modal offline/Curral) — campos e regras divergentes | P2 | Comparar os 3 componentes | Unificar em um único `PesagemForm` parametrizável |
| UX-P2-2 | Venda | Venda de lote pede "Comprador"; venda de animal individual não tem esse campo | P2 | `RetiradaAnimaisModal.jsx` vs `AnimalMovementModal.jsx` | Adicionar campo Comprador na venda individual |
| UX-P2-3 | Morte/perda | Peso é obrigatório na morte a nível de lote, mas a nível individual usa silenciosamente o último peso conhecido, sem chance de correção | P2 | `AnimalMovementModal.jsx`; `AnimaisPage.jsx` (fallback `p_at`) | Padronizar a regra de peso entre os dois níveis |
| UX-P2-4 | Transferência | Valor salvo para "transferência" diverge entre lote (`'transferencia_saida'`) e individual (`'transferencia'`) — quebra o filtro da aba "Retiradas" para transferências individuais | P2 | `src/components/lotes/constants.js` vs `AnimalMovementModal.jsx` | Unificar o valor do enum |
| UX-P2-5 | Venda total | Vender 100% das cabeças de um lote não oferece finalizar o lote na mesma ação — fica "vivo" com 0 cabeças até o usuário lembrar de finalizar separadamente | P2 | `RetiradaAnimaisModal.jsx` (`qtd > maxCabecas`, não `>=`) | Ao detectar venda total, oferecer finalizar o lote na mesma confirmação |
| UX-P3 | Retirada | Rótulos de confirmação divergem entre os dois fluxos ("Salvar retirada" vs "Confirmar venda/morte/saída") | P3 | — | Padronizar verbo |

### Estoque, Suplementação, Sanidade

| ID | Módulo | Cenário | Severidade | Evidência | Sugestão |
|---|---|---|---|---|---|
| UX-SAN1 | Sanidade | Carência sanitária (`data_fim_carencia`) é 100% decorativa — nenhuma tela de venda/movimentação lê esse campo; não bloqueia nem avisa | **P1** | `src/domain/agendaSanitaria.js`; ausência em `movimentacoes.js` | Decisão de produto necessária: bloquear venda ou só avisar com confirmação extra? |
| UX-SAN2 | Sanidade | Em modo "Todas as fazendas", a tela mistura manejos/lotes de todas as fazendas sem filtro nem coluna de origem; o próprio seletor "Fazenda" do bloco IATF não filtra o dropdown de Lote | **P1** | `src/pages/SanitarioPage.jsx` (fora de `FULL_DB_PAGE_KEYS`, sem `fazendaSelecionada`) | Aplicar o mesmo guard de recorte por fazenda já usado em Estoque |
| UX-EST1 | Estoque/Suplementação | Editar um item/produto já cadastrado sobrescreve o saldo diretamente pelo formulário, sem gerar nenhuma movimentação de auditoria — quebra a trilha que Ajuste/Consumo preservam | P1 | `EstoquePage.jsx` (rótulo "Quantidade inicial" na edição); `SuplementacaoPage.jsx` (mesmo padrão) | Gerar uma movimentação tipo "correção" ao mudar o saldo na edição |
| UX-SUP1 | Suplementação | Cadastrar produto com nome repetido funde silenciosamente a quantidade e sobrescreve dados de embalagem/custo, sem avisar | **P1** | `src/pages/SuplementacaoPage.jsx` (match por nome, sem confirmação) | Confirmar explicitamente antes de fundir |
| UX-SUP2 | Suplementação | Heurística de "produto nutricional" do modal de consumo é mais estreita que a da aba "Produtos nutricionais" — item visível na lista pode não aparecer no dropdown de consumo | P1 | `SuplementacaoConsumoModal.jsx` vs `SuplementacaoPage.jsx` | Unificar num único helper compartilhado |
| UX-EST2 | Estoque | Entrada/Saída não têm o mesmo guard de "fazenda específica" que "Novo item" já tem em modo consolidado | P1/P2 | `EstoquePage.jsx` | Replicar o guard existente |
| UX-SAN3-9 | Sanidade | Edição de IATF cai no formulário genérico errado; duplo-clique pode criar protocolo repetido; lembrete sem responsável falha silenciosamente; exclusão de item de manejo composto pode órfãar o lembrete do grupo; campos sem unidade; validação fraca de quantidade | P2/P3 | `SanitarioPage.jsx`, `SanitarioForm.jsx` | Ver detalhamento no relatório da sub-auditoria (arquivado nesta sessão) |
| UX-SUP3 | Suplementação | "Realizado/dia" no planejamento por lote é a média de TODOS os lançamentos já feitos, sem filtro de data — 2 lançamentos no mesmo dia distorcem a coluna "Diferença" | P2 | `SuplementacaoPage.jsx` | Agrupar por dia antes de calcular a média |
| UX-SUP4 | Suplementação | Aba "Consumo diário" quase vazia, redundante com o botão do cabeçalho | P3 | `SuplementacaoPage.jsx` | Remover ou dar propósito próprio |

### Financeiro, Custos, Tarefas, Alertas, Relatórios

| ID | Módulo | Cenário | Severidade | Evidência | Sugestão |
|---|---|---|---|---|---|
| UX-FN1 | Financeiro | Lançamentos (despesa/receita manual) **não podem ser editados nem excluídos** — nenhum botão de ação na aba "Lançamentos", diferente de Custos, que já tem essas ações por linha | **P0/P1** | `src/pages/FinanceiroPage.jsx` (aba `lanc`, sem ações) vs `CustosPage.jsx` (tem) | Adicionar editar/excluir por linha, mesmo padrão de Custos |
| UX-FN2 | Financeiro | Botões "Nova receita"/"Nova despesa"/"Registrar movimentação" abrem o mesmo modal, sempre com Tipo = Despesa por padrão | P2 | `FinanceiroPage.jsx` | Passar o tipo inicial de acordo com o botão clicado |
| UX-FN3 | Financeiro (DRE) | Sem filtro de período — só totais acumulados de sempre; período só existe em outra página (Relatório Financeiro) | P1/P2 | `financeiroDreLogic.js` vs `RelatorioFinanceiroPage.jsx` | Adicionar seletor de período na própria aba DRE |
| UX-FN4 | Financeiro/Custos/Rateio | Três taxonomias de categoria diferentes (capitalização/acentuação/slug) convivem sem bater entre si — aprofunda o FIN-01 já documentado | P1 | `CustoForm.jsx`, `CustosCompartilhadosPage.jsx`, `FinanceiroPage.jsx` | Unificar num único enum de categorias |
| UX-FN5 | Financeiro | "Marcar como pago" nos blocos (vencidas/hoje/próximas) não tem desfazer; só o checkbox de "Pagamento Diário" é reversível | P2 | `FinanceiroPage.jsx` | Padronizar em um mecanismo reversível |
| UX-CU1 | Custos | Nenhuma exportação/impressão disponível na tela | P2 | `CustosPage.jsx` | Adicionar `ExportActions` |
| UX-TF1 | Tarefas | "Adiar" usa `window.prompt()` nativo pedindo para digitar dias ou data — ruim em celular | P1/P2 | `TarefasPage.jsx` | Reaproveitar o padrão já usado em Alertas (input date inline) |
| UX-TF2 | Tarefas | "Resolver" muda status para `em_andamento`, que não é nenhuma coluna do Kanban — tarefa reaparece em "Pendentes" sem indicação visual de mudança | P2 | `TarefasPage.jsx` | Adicionar coluna "Em andamento" ou remover o botão duplicado |
| UX-RE1 | Relatórios | Dois padrões de exportação diferentes coexistem (`AcoesRelatorio`: PDF/Copiar/WhatsApp; `ExportActions`: CSV/Imprimir), com opções diferentes para a mesma necessidade | P2 | `AcoesRelatorio.jsx` vs `ExportActions.jsx` | Unificar num único componente |
| UX-RE2 | Financeiro | Só a aba DRE tem exportação; "Por Lote"/"Lançamentos"/"Pagamentos" não têm nenhuma | P2 | `FinanceiroPage.jsx` | Adicionar `ExportActions` também nessas abas |

### Telegram (revisão própria, sem sub-agente)

Verifiquei especificamente o caso mais grave encontrado no app (UX-P0-1, transferência sem destino):
o Bot do Telegram **já implementava corretamente** a resolução do lote de destino por nome
(`api/_telegramBot.js::prepararConfirmacaoTransferencia`, usa `resolverLotePorNome` para achar o
lote de destino a partir do texto do usuário) — nunca teve esse bug. O gap era exclusivo da tela do
app web, que agora tem paridade. Nenhum achado novo de inconsistência Telegram×app nesta rodada além
do já documentado (TG-02, ordem de fallback de contagem).

## Números da Auditoria UX Completa
- **~35 achados novos** de UX/fluxo (além dos 53 já registrados nas rodadas anteriores).
- **4 corrigidos nesta rodada** (todos P0/P1 evidentes, isolados, baixo risco).
- **4 P1 significativos ainda abertos que merecem prioridade alta na próxima sprint**: UX-P1-1
  (venda/morte individual não sincroniza o lote — mesma classe de bug já corrigida 3 vezes),
  UX-FN1 (lançamentos financeiros sem editar/excluir), UX-SAN1/UX-SAN2 (carência decorativa e
  vazamento cross-fazenda em Sanidade).
- Suíte de testes: 1559/1559 passando após as correções desta rodada (sem testes novos — mudanças
  de UI sem infraestrutura de teste de componente).
