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

## Números desta rodada
- **48 achados** registrados (contando os já corrigidos).
- **4 P0** encontrados: **todos os 4 corrigidos** — venda/RPC do Telegram, Ajuste de Lotação, RLS de
  perfil (auditoria anterior) e Estoque "Tratamento"/"Saída" falhando silenciosamente (esta rodada).
- **2 P1 corrigidos** nesta rodada (EST-01/EST-02: Estoque); 3 P1 abertos (RLS granular por módulo,
  planejamento de suplementação sem persistência, LOT-2 pesagem retroativa).
- Suíte de testes: 1556/1556 passando após as correções desta rodada (1550 no baseline desta
  rodada; 1544 antes da auditoria anterior).

## Limitações desta auditoria
- **Sem navegador autenticado** nesta sessão (nem na anterior): as credenciais em `.env.e2e`
  continuam retornando `Invalid login credentials` do Supabase Auth ao tentar logar (retestado nesta
  rodada, mesma senha, mesmo erro) — nenhuma tela foi clicada ao vivo, nenhum viewport/perfil/
  Telegram/multi-fazenda foi validado visualmente. Recomendo o usuário rotacionar/confirmar essas
  credenciais antes da próxima sessão de QA visual; não é seguro nem apropriado tentar adivinhar a
  senha correta ou criar uma conta nova sem autorização explícita.
- Nenhum teste em múltiplos viewports foi executado (exigiria a mesma sessão autenticada).
- Achados marcados "não verificado ao vivo" nas seções de origem vêm de leitura de código com alta confiança (grep confirmando ausência de chamadas, lógica inequívoca), não de clique real na tela.
- `RetiradaAnimaisModal.jsx`, `FechamentoLoteModal.jsx`, `MoverPastoModal.jsx` foram auditados só via os pontos de entrada em `LotesPage.jsx`/`LoteAcoesMenu.jsx`, não linha a linha.
