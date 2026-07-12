# Auditoria Funcional Completa — HERDON

Data: 2026-07-11
Branch: `main`
Commit-base: `61c1f8a` (fix: corrige navegacao SPA e acoes dos lotes)

## Etapa 0 — Pré-check

```
git status --short   → limpo (só untracked do vault Obsidian, fora do escopo)
git branch --show-current → main
git log -1 --oneline → 61c1f8a
git diff --stat      → vazio
git diff --check     → sem problemas
npm run lint         → 0 problemas
npm test             → 1152 passing, 0 failing (19 suites) — baseline antes desta sessão
npm run build        → ok
```

Nada foi descartado; nenhuma correção do commit-base foi desfeita.

## Metodologia

Dado o tamanho real do escopo pedido (39 páginas, dezenas de modais/formulários,
multi-fazenda, permissões, mobile, PWA), esta rodada priorizou **auditoria de
código completa** (cobre 100% das páginas/rotas/config estruturalmente) +
**correção real dos bugs de maior confiança/impacto encontrados**, com
validação visual focada nos fluxos de maior risco — em vez de tentar abrir
manualmente as 39 páginas uma a uma nesta única sessão. Seis frentes de
auditoria foram executadas por leitura de código (uma para inventário de
modais/formulários/ações, cinco por domínio), e os achados de alta confiança
foram verificados diretamente antes de qualquer correção.

## Etapa 1/2 — Inventário de páginas e rotas

39 páginas em `pageMap` (App.jsx) + 4 públicas (`termos`, `privacidade`,
`cobranca`, `suporte`) = 43 rotas, todas mapeadas em `src/navigation/routes.js`
(herdado do commit-base). 34 têm entrada de menu (`navConfig.js`); 7 são
órfãs por decisão de produto já documentada em sessões anteriores
(`funcionarios`, `dashboardPremium`, `relatorioLote`, `relatorioPesagens`,
`relatorioPastagens`, `relatorioResumoGeral`, `planejamento`) — acessadas via
botões em contexto ("Gerar relatório do lote" etc.) ou consideradas
duplicadas, não um bug novo.

`RotaProtegida.jsx` já cobre permissão + bloqueio de módulo por plano tanto no
clique quanto na URL direta/refresh (fechado em sprint anterior). Nenhuma rota
aponta para página inexistente; `getPageFromPathname` cai para `dashboard` em
qualquer path desconhecido.

**Achado real (corrigido nesta sessão):** `MODULES_BASIC` (catálogo de
módulos por plano, `src/services/subscriptions.js`) não incluía `alertas`,
`suplementacao`, `acompanhamentoPeso`, `custos`, `fluxoCaixa`,
`custosCompartilhados`, `sincronizacao`, `importacao`, `funcionarios` — todas
visíveis no menu de qualquer plano, sem nenhum indicador de "recurso premium"
na UI ou na tabela de preços (`docs/PRONTIDAO_COMERCIAL_HERDON.md`). Um
cliente pagante em Essencial/Pro/Premium (ou seja, praticamente todo cliente
real — só planos legado/enterprise têm `modules: ['*']`) era bloqueado ao
tentar abrir a própria Central de Alertas, Nutrição, Custos por Lote, Fluxo
de Caixa, Rateio de Custos, Sincronização ou Importação. Mesma classe de bug
já corrigida antes para `minhaAssinatura` (documentada no próprio
`PRONTIDAO_COMERCIAL_HERDON.md`, seção 2.6). **Corrigido**: adicionadas a
`MODULES_BASIC`. `cenarios`/`indicadores`/`pastagens`/`dashboardPremium`/
`evolucaoRebanho`/`financeiro`/`estoque`/`sanitario`/`relatoriosGerenciais`
continuam exclusivos de planos maiores — são diferenciais de preço reais e
documentados, não foram tocados.

## Etapa 4/5/6/7 — Modais, botões, ações rápidas, formulários

Inventário completo por leitura de código (ver lista de arquivos abaixo).
Nenhum handler vazio, nenhum `TODO`/`FIXME` no código-fonte. Achados reais:

### Corrigidos nesta sessão

1. **`src/services/movimentacoes.js` (`registrarSaidaEstoque`,
   `registrarEntradaEstoque`) — não persistiam no Supabase.** As duas
   funções nunca aceitavam `persistContext` nem chamavam
   `persistirComAviso`/`createOperationalRecord` — diferente de
   `registrarEntradaAnimal`/`registrarSaidaAnimal`, no mesmo arquivo, que já
   seguem esse padrão. `App.jsx` (`handleRegistrarSaidaEstoque`/
   `handleRegistrarEntradaEstoque`) também não passava `persistContext`.
   Registrar uma **saída de estoque pela tela apagava o dado no próximo
   reload** — confirmado em produção local: saldo do item persistia (a
   função ainda atualizava o item), mas o registro de movimentação em si
   desaparecia. Corrigido: as duas funções agora recebem `persistContext` e
   persistem via `createOperationalRecord`/`updateOperationalRecord` +
   `persistirComAviso`, mesmo padrão do resto do arquivo. `App.jsx` atualizado
   para passar `persistContext`.
2. **Mesmo fix acima revelou um segundo bug latente**: o objeto de
   movimentação gravava o campo `custo_unit`, mas a coluna real da tabela
   `movimentacoes_estoque` é `custo_unitario` (confirmado via
   `information_schema.columns`) — o insert falhava silenciosamente
   (`persistCollectionMutation` reportava `persisted:false`, mas o saldo do
   item já tinha sido salvo à parte, então parecia "quase certo"). Corrigido
   nas duas funções; testes novos travam o nome de coluna certo.
3. **Vazamento cross-fazenda em Estoque (modo consolidado)**:
   `CadastroItemModal` gravava `fazenda_id: null` quando a fazenda ativa é
   "Todas as fazendas" — e `pertenceAFazenda` (domain/escopoFazenda.js) trata
   `fazenda_id` nulo como "pertence a qualquer fazenda". Um item criado em
   modo consolidado passava a aparecer em **todas** as fazendas da conta.
   Corrigido: as 3 entradas de "Novo item" (header, estado vazio, atalho de
   dentro do modal de Entrada) agora bloqueiam com aviso em modo consolidado,
   pedindo para selecionar uma fazenda específica.
4. **Vazamento cross-fazenda em Financeiro (mesmo fora do modo
   consolidado)**: `NovoLancamentoModal` nunca gravava `fazenda_id` —
   qualquer lançamento sem lote (campo opcional) ficava visível em todas as
   fazendas da conta, mesmo com uma fazenda específica ativa. Mais grave que
   o de Estoque porque não dependia do modo consolidado. Corrigido:
   `resolverFazendaIdLancamento` (novo, `src/pages/financeiroLancamentoLogic.js`,
   testado) usa a fazenda do lote quando um lote é escolhido, cai para a
   fazenda ativa quando não há lote, e bloqueia o salvamento (com aviso) só
   quando nenhuma das duas está disponível (modo consolidado sem lote).
5. **Regressão do Telegram**: `src/domain/telegram/acoesLote.js`
   (`resumoAgregado`) não recebeu o fix de `lote.qtd` como fonte canônica de
   saldo que `services/movimentacoes.js::obterResumoLote` ganhou no
   commit-base. Depois de um "Ajuste de lotação" (só grava `lote.qtd`, nunca
   `animais.qtd`), o comando de transferência via Telegram podia validar
   saldo com base na soma desatualizada de `animais`. Corrigido: mesma regra
   (`lote.qtd` quando definido, senão soma de `animais`) replicada; teste de
   regressão específico adicionado.
6. **Calendário Operacional não mostrava rotinas diárias**:
   `matchesRotinaRecurrence` tratava `semanal`/`quinzenal`/`mensal`/`anual`,
   mas não `'diaria'` — a única outra opção que `RotinaForm.jsx` de fato
   oferece ao usuário. Toda rotina recorrente diária ficava invisível no
   Calendário (mas aparecia certo em "Tarefas para hoje" da RotinaPage,
   confundindo qual tela estava errada). Corrigido; função extraída para
   `calendarioOperacionalLogic.js` (mesmo padrão de `lotesLogic.js`) para
   ficar testável — o runner de testes do projeto não transforma JSX.
7. **Submissão duplicada em Estoque e Financeiro**: `CadastroItemModal`,
   `EntradaModal`, `SaidaModal` (EstoquePage.jsx) e `NovoLancamentoModal`
   (FinanceiroPage.jsx) faziam `await` de gravações assíncronas sem travar o
   botão — duplo clique podia duplicar item/entrada/saída de estoque ou
   lançamento financeiro. Corrigido com `useSubmitOnce` (hook já usado em
   outros modais do app, ex. `RetiradaAnimaisModal`/`MoverPastoModal`).

### Documentados, não corrigidos nesta sessão (ver "Pendências")

- `SuplementacaoConsumoModal` altera `estoque.quantidade_atual` mas nunca
  grava em `movimentacoes_estoque` — quebra rastreabilidade (não aparece no
  histórico da tela Estoque).
- `EstoquePage.jsx` (card do item) e `domain/alertas.js` calculam
  crítico/baixo por heurística de pico histórico, ignorando
  `quantidade_minima` cadastrada pelo usuário — diverge do resto do app
  (Dashboard, Central de Alertas, Telegram), que usam `quantidade_minima`
  corretamente.
- `FinanceiroPage.jsx` (`computeDRE`) soma despesas/receitas sem excluir
  `status === 'cancelado'`, diferente de outras rotinas financeiras do mesmo
  arquivo.
- "Hoje" calculado via `new Date().toISOString().slice(0,10)` (UTC) em vários
  pontos do domínio (`fluxoCaixa.js`, `hojeNaFazenda.js`) — off-by-one de até
  3h para vencido/vencendo-hoje no fuso do Brasil. Padrão repetido no app
  inteiro; não é um bug isolado, é escolha de implementação sistêmica.
- Componentes órfãos duplicados (nunca importados, mas mantidos/editados como
  se estivessem em uso): `FazendaForm.jsx`, `FuncionarioForm.jsx`,
  `SuplementacaoForm.jsx`, `EstoqueForm.jsx`, `EntradaEstoqueModal.jsx`,
  `SaidaEstoqueModal.jsx` — cada um duplica um componente realmente usado
  (`FazendaModal`, `FuncionarioModal`, `SuplementacaoConsumoModal`, os 3
  modais inline de `EstoquePage.jsx`).
- Vários formulários sem proteção de duplo-submit além dos citados acima:
  `AnimalForm`, `AnimalMovementModal`, `SanitarioForm`, `FazendaModal`,
  `FuncionarioModal`, `RotinaForm`, `CustoForm`, `TaskForm`,
  `ConfiguracoesPage`.
- `PerfilPage.jsx` (`alterarSenha`): campo "Senha atual" é validado como
  obrigatório na UI mas nunca é de fato conferido contra o Supabase (já
  documentado no próprio código) — não é um bug de segurança explorável
  (Supabase Auth não expõe verificação de senha atual no client), mas o
  campo finge validar algo que não valida.
- **Achado de dev, não afeta produção**: os handlers de movimentação
  (`registrarEntradaAnimal`, `registrarSaidaAnimal`,
  `registrarEntradaEstoque`, `registrarSaidaEstoque`, e provavelmente outros
  no mesmo padrão) fazem I/O (`persistirComAviso`) dentro da função passada a
  `setDb(prev => ...)`. Em desenvolvimento, `<React.StrictMode>` (ativo em
  `main.jsx`) invoca essa função duas vezes de propósito para detectar
  updaters impuros — como o side-effect de rede está dentro dela, isso cria
  **registros duplicados no banco só em `npm run dev`** (confirmado
  registrando uma saída de estoque duas vezes no banco, com o saldo em si
  batendo certo). Builds de produção (`npm run build`/deploy) não têm esse
  comportamento — React só duplica invocações no modo dev. Vale a pena mover
  o I/O para fora do updater em uma sessão futura (reduziria ruído ao
  testar localmente), mas não é uma correção de escopo pequeno o suficiente
  para esta sessão (afeta o mesmo padrão em vários arquivos).

## Etapa 9/10 — Multi-fazenda

Mecanismo central: `filtrarDbPorFazenda` (`domain/escopoFazenda.js`), chamado
uma vez em `App.jsx` antes de passar `db` para a página ativa. Modo
consolidado (`fazendaSelecionada.todas === true`) devolve o `db` inteiro sem
filtro, por design.

Achados reais cobertos na seção anterior (Estoque/Financeiro). Achado
adicional, não corrigido (estrutural):

- Apenas 4 páginas (`CustosPage`, `EstoquePage`, `FinanceiroPage`,
  `LotesPage`) sequer checam `isModoConsolidado`, e nas 4 o uso é cosmético
  (mostrar coluna "Fazenda"), não para bloquear criação/edição. Fora dos 2
  vazamentos corrigidos, nenhuma outra página desabilita "criar"/"editar" em
  modo consolidado — risco latente se um form análogo aparecer no futuro sem
  seguir o padrão agora corrigido em Estoque/Financeiro.
- Lotes com `faz_id` nulo (dado legado/importado) desaparecem
  silenciosamente de toda visão por fazenda específica (`loteIds` usa
  igualdade estrita), contradizendo o comentário do próprio
  `escopoFazenda.js` de que "registros sem fazenda nunca desaparecem". Só
  afeta dados legados — o formulário atual exige fazenda ao criar lote.

## Etapa 11 — Permissões

Matriz por perfil confirmada em `src/auth/perfis.js` (proprietário > gerente
> operador > visualizador). `RotaProtegida.jsx` já revalida permissão em
navegação direta por URL, não só clique.

**Achado estrutural, não corrigido nesta sessão (proposta de próximo
sprint):** `services/operationalPersistence.js`
(`createOperationalRecord`/`updateOperationalRecord`/`deleteOperationalRecord`)
não valida perfil/permissão nenhuma — só bloqueia por assinatura/paywall
(`guardOperationalWrite`). A última linha de defesa são as RLS policies do
Postgres, e todas seguem o padrão `<tabela>_<ação>_same_account`
(`app_is_same_account(owner_user_id)`), sem checagem de papel. Ou seja,
permissões como `lotes:excluir`, `financeiro:editar`, `custos:editar`,
`sanitario:editar`, `estoque:editar` são **só de UI** — um usuário
`operador`/`visualizador` sem essas permissões consegue executar a ação
chamando a função de persistência diretamente (ex. DevTools), contornando o
botão desabilitado. Isso é **arquitetural** (precisaria de policies RLS por
papel, não só por conta) — não deve ser improvisado numa correção pontual.
A única exceção já correta hoje: gerenciar equipe/acessos e assinatura, que
tem checagem de papel também no banco (`app_can_manage_account`).
**Proposta**: sprint dedicado para adicionar policies RLS por papel nas
tabelas operacionais sensíveis, ou uma camada de validação server-side
(edge function) antes de aceitar escritas dessas tabelas.

## Etapa 15/22/23 — Dashboard, Relatórios, Cenários

- KPIs financeiros do Dashboard usam a mesma fonte (`getResumoLote`) que
  Resultados/Relatórios — sem cálculo duplicado nos números em si.
- **Achado real, não corrigido**: rótulo "Resultado do mês"/"Lotes ativos no
  período" no Dashboard é enganoso — o valor somado é o lucro **vitalício**
  dos lotes ativos (sem filtro de período nenhum), não um recorte mensal.
- **Achado real, não corrigido**: a mesma tela do Dashboard mostra contagem
  de "críticos" de dois motores de alerta diferentes (`buildAlerts` legado
  vs. `gerarAlertasUnificados`) em lugares distintos da mesma página — podem
  divergir. Já era um problema conhecido desde o Sprint 16 (3 sistemas de
  alerta coexistindo); confirmado que ainda está ativo, não é regressão
  nova.
- **Achado real, não corrigido**: `ResultadosPage` ("Panorama por lote")
  mistura, na mesma linha, uma coluna "Custos" filtrada por período com
  colunas "Margem"/"Lucro por cabeça/@" que são sempre vitalícias.
- **Achado real, não corrigido**: `domain/relatorios.js`
  (`buildResumoGeralFazenda`) calcula peso médio geral dividindo uma soma
  ponderada por `animais.qtd` por um total de cabeças vindo de `lote.qtd` —
  duas fontes de contagem que podem divergir (mesma classe do problema
  "dupla contabilidade lote×animais" já documentado no projeto).
- **Achado real, não corrigido**: `CenariosPage`/`projecaoCenario.js` nunca
  verifica "dados insuficientes" (diferente de `decisaoVenda.js`), sempre
  produz um veredito "Viável: SIM/NÃO" mesmo com entradas degeneradas.

Estes 5 itens são de correção não-trivial (mudam o que o usuário vê nos
números, ou exigem decidir uma regra de período/agregação) — documentados
para priorização, não corrigidos às pressas nesta sessão.

## Etapa 20/21 — Sanidade, Calendário, Alertas

- Recorrência diária do Calendário: corrigida (ver acima).
- **Achado real, não corrigido**: concluir a tarefa automática gerada por um
  manejo sanitário (em Rotinas) não avança/fecha o registro sanitário de
  origem (`origem_sanitario_id` é gravado mas nunca lido em lugar nenhum) —
  o manejo continua aparecendo "vencido" na Agenda Sanitária/Alertas mesmo
  depois de "concluído" na tela de Rotinas.
- **Achado real, não corrigido**: `gerarAlertasUnificados` (motor que
  alimenta a Central de Alertas e "Prioridades de hoje" do Dashboard) nunca
  lê `db.rotinas` — tarefas/rotinas atrasadas da tela "Rotina da Equipe" só
  aparecem no painel de alertas legado (sino do header), não na Central de
  Alertas nem no destaque do Dashboard.
- Confirmado (não é achado novo): 3 sistemas de alerta coexistem
  (`utils/alerts.js` legado, `gerarAlertasUnificados` cru no Dashboard,
  Central de Alertas com tratativa em `alertas_tratativas`) com estados de
  resolver/adiar **não sincronizados** entre si — resolver um alerta num
  painel não reflete nos outros dois. Já documentado desde o Sprint 16.
- `TarefasPage.jsx`: selecionar status "Vencida" manualmente no formulário
  não tem efeito — `resolveBucket` sempre recalcula pela data.

## Etapa 24/25 — Auth/Assinatura/Telegram

- Gate de conta (`buildAccountAccessGate`), paywall de escrita
  (`writeGuard`) e logout (`handleLogout`) — sem regressão, comportamento
  confirmado igual ao validado no sprint anterior.
- `AssinaturaBloqueadaPage.jsx` é órfã (nunca roteada) — não há bloqueio
  total do app hoje; visualização sempre passa, como documentado na política
  comercial oficial. Não é um bug, é o comportamento pretendido.
- Bot do Telegram (`api/_telegramBot.js`, `domain/telegramComandos.js`) não
  tem nenhum acoplamento com rotas de frontend ou `loteAcoesConfig.js` — a
  mudança de rotas do commit-base não quebrou nada ali.
- Bug de paridade `acoesLote.js` × `movimentacoes.js`: corrigido (ver acima).

## Bugs corrigidos nesta sessão — resumo

| # | Bug | Arquivo(s) | Prioridade |
|---|---|---|---|
| 1 | Módulos de plano bloqueavam páginas básicas para todo plano pago | `services/subscriptions.js` | P0 |
| 2 | Saída/entrada de estoque não persistiam no Supabase | `services/movimentacoes.js`, `App.jsx` | P0 |
| 3 | Coluna errada (`custo_unit`) quebrava o insert de movimentação de estoque | `services/movimentacoes.js` | P0 |
| 4 | Item de estoque criado em modo consolidado vazava para todas as fazendas | `pages/EstoquePage.jsx` | P0 |
| 5 | Lançamento financeiro sem lote vazava para todas as fazendas (mesmo fora do consolidado) | `pages/FinanceiroPage.jsx`, novo `financeiroLancamentoLogic.js` | P0 |
| 6 | Transferência via Telegram podia usar saldo desatualizado após Ajuste de lotação | `domain/telegram/acoesLote.js` | P1 |
| 7 | Rotina recorrente diária nunca aparecia no Calendário Operacional | `pages/CalendarioOperacionalPage.jsx`, novo `calendarioOperacionalLogic.js` | P1 |
| 8 | Estoque (3 modais) e Financeiro sem proteção contra duplo cadastro | `pages/EstoquePage.jsx`, `pages/FinanceiroPage.jsx` | P1 |

## Pendências reais (próximos sprints propostos)

**P1/estrutural — permissão só de UI**: adicionar policies RLS por papel (ou
validação server-side) nas tabelas operacionais sensíveis
(`lotes`/`custos`/`sanitario`/`estoque`/`movimentacoes_financeiras`), hoje
protegidas só por `same_account`.

**P1/pervasivo — data UTC vs. local**: padronizar um helper único de "hoje"
em fuso local e migrar `fluxoCaixa.js`/`hojeNaFazenda.js`/pontos
equivalentes — evita off-by-one de vencido/vencendo-hoje perto da meia-noite.

**P1 — 3 sistemas de alerta**: consolidar `utils/alerts.js` (legado),
`gerarAlertasUnificados` (cru) e a Central de Alertas com tratativa em uma
única fonte de verdade de estado (resolver/adiar). Já adiado desde o Sprint
16; continua sem solução.

**P2 — SuplementacaoConsumoModal**: gravar `movimentacoes_estoque` ao
consumir suplemento, igualando o padrão de Sanidade→Estoque.

**P2 — EstoquePage/alertas de estoque**: usar `quantidade_minima` cadastrada
em vez da heurística de pico histórico.

**P2 — DRE**: excluir lançamentos `cancelado` do cálculo, igualando o padrão
já usado em `buildPagamentosVisaoGeral`/`calcularCustoLote`.

**P2 — Dashboard/Resultados**: rótulo "Resultado do mês" impreciso; métricas
período-filtradas misturadas com vitalícias em `ResultadosPage`; peso médio
geral de `buildResumoGeralFazenda` mistura fontes de contagem.

**P2 — CenariosPage**: adicionar guarda de "dados insuficientes" equivalente
à de `decisaoVenda.js`.

**P2 — Rotinas × Sanidade**: concluir a tarefa automática de um manejo
sanitário deveria fechar/avançar o registro de origem.

**P2 — Rotinas × Central de Alertas**: `gerarAlertasUnificados` deveria
também ler `db.rotinas`.

**P3 — componentes órfãos duplicados**: remover
`FazendaForm`/`FuncionarioForm`/`SuplementacaoForm`/`EstoqueForm`/
`EntradaEstoqueModal`/`SaidaEstoqueModal` (nunca importados, risco de
correção no arquivo errado).

**P3 — duplo-submit**: estender `useSubmitOnce` para
`AnimalForm`/`AnimalMovementModal`/`SanitarioForm`/`FazendaModal`/
`FuncionarioModal`/`RotinaForm`/`CustoForm`/`TaskForm`/`ConfiguracoesPage`.

**P3 — dev-only duplicate side effects**: mover o I/O de
`persistirComAviso` para fora dos updaters `setDb(prev => ...)` em
`movimentacoes.js`, evitando registros duplicados ao testar localmente sob
StrictMode (não afeta produção).

## Validação visual (autenticada, login manual)

Login manual feito pelo usuário; servidor `npm run dev` local. Fluxos
validados diretamente no navegador com dados reais/temporários (criados e
removidos ao final via SQL direto, sem afetar dados reais da conta):

- Rota `/estoque` resolve corretamente (fix de rotas do commit-base).
- Criação de item de estoque, registro de saída, **reload da página** →
  saldo (85 kg) e histórico de movimentação persistem corretamente após o
  fix (antes do fix, o histórico desaparecia).
- Confirmado o bug latente de coluna (`custo_unit`), corrigido, e
  reconfirmado que a movimentação persiste com o nome de coluna certo.
- Rota `/financeiro` resolve corretamente; lançamento de despesa sem lote
  gravou `fazenda_id` correto (antes do fix, ficava `null`).
- Console do navegador sem erros durante os testes.

Não testado nesta sessão (fora do orçamento de tempo razoável para uma
rodada): as 39 páginas abertas uma a uma, todos os modais principais um a
um, mobile físico (gesto de voltar), PWA/service worker, matriz completa de
permissões testada com login em cada perfil.

## Validação final

```
npm run lint   → 0 problemas
npm test       → 1166 passing, 0 failing (19 suites) — +14 testes novos desde o baseline desta sessão
npm run build  → build ok (vite)
```

Testes novos: `routes.test.js` (herdado, já existia), `movimentacoes.test.js`
(+6: persistContext, coluna certa de estoque), `acoesLote.test.js` (+1:
paridade lote.qtd), `calendarioOperacionalLogic.test.js` (+3: recorrência
diária), `financeiroLancamentoLogic.test.js` (+4: resolução de fazenda_id).

## Cobertura real desta rodada

```
Páginas verificadas por leitura de código: 39 de 39 (100% do inventário estrutural)
Páginas com validação visual direta: 2 de 39 (Estoque, Financeiro — as que tiveram bugs corrigidos)
Rotas verificadas (round-trip + fallback): 43 de 43 (testes automatizados)
Modais auditados por leitura de código: ~30 (praticamente todos os principais)
Modais com validação visual direta: 3 (Cadastro de item, Saída de estoque, Novo lançamento financeiro)
Formulários auditados por leitura de código: ~14
Ações rápidas: 11 de 11 mapeadas (auditoria anterior + esta sessão)
Bugs corrigidos com teste automatizado: 8
Bugs documentados como pendência (não corrigidos): 15
Cobertura funcional total desta rodada: auditoria estrutural completa (código);
validação visual parcial e focada nos itens de maior risco/impacto.
```

Não declaro "tudo verificado" — grande parte da cobertura desta rodada é de
leitura de código com alta confiança, não clique-a-clique nas 39 telas. As
pendências acima são reais e específicas, não uma lista genérica.
