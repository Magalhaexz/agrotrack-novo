# HERDON — Auditoria Técnica (Sprint 13)

Achados técnicos da auditoria 360°: estrutura, banco de dados, duplicações, testes, performance e segurança. Documento de leitura — nenhum código foi alterado para gerar este relatório, além das correções mínimas registradas na Etapa 0/11 (nenhuma foi necessária: lint/testes/build já estavam verdes).

Ver também: [SPRINT13_AUDITORIA_360_HERDON.md](SPRINT13_AUDITORIA_360_HERDON.md) (resumo executivo), [HERDON_BACKLOG_MESTRE.md](HERDON_BACKLOG_MESTRE.md) (itens priorizados).

## 1. Método

- Leitura estática de `src/pages`, `src/domain`, `src/services`, `src/hooks`, `src/styles`, `api/`, `supabase/migrations/`, `docs/`.
- Schema real consultado via MCP do Supabase (`list_migrations`, `execute_sql` contra `information_schema`/`pg_policy`, `get_advisors`) — não só os arquivos de migration locais.
- Auditoria visual manual (login) via preview do dev server; demais telas autenticadas não puderam ser inspecionadas nesta sessão (sem credencial de teste disponível) — ver §7.

## 2. Estrutura do projeto

**48 páginas** em `src/pages`, **37 módulos de domínio** em `src/domain` (25 com teste, 12 sem), api/ com as funções serverless (Telegram, Asaas), 8 arquivos de migration locais.

### 2.1 Páginas órfãs (sem link na sidebar)

Confirmado que as 7 páginas já apontadas em `docs/FASE0_NAVEGACAO_SIDEBAR_HERDON.md` continuam órfãs: `ComparativoPage`, `RotinaPage`, `AcompanhamentoPesoPage`, `CustosPage`, `EvolucaoRebanhoPage`, `DashboardPremiumPage`, `PlanejamentoPage`. Todas seguem registradas em `pageMap`/`perfis.js`, ou seja, acessíveis por link direto, só não aparecem no menu. Não ficou confirmado se são recursos premium propositalmente escondidos ou esquecimento — decisão de produto pendente.

### 2.2 Duplicação "Equipe" (funcionarios × equipeAcessos)

Ainda presente. `navConfig.js` linka só `equipeAcessos`, mas `FuncionariosPage` continua no `pageMap` do `App.jsx`. Há um comentário no próprio código reconhecendo a dívida ("ver backlog"), mas nada foi limpo.

### 2.3 Duplicações de lógica entre módulos

| Área | Arquivos envolvidos | Problema |
|---|---|---|
| Alertas | `utils/alerts.js` (legado), `alertasInteligentes.js`, `alertasUnificados.js`, `centralAlertas.js` | 4 arquivos formando 3 "sistemas" de alerta coexistentes — ver §6 do backlog / Central de Alertas |
| Custo/lucro por arroba | `domain/arroba.js`, `domain/indicadores.js`, `domain/calculos.js`, `utils/calculations.js`, `domain/resumoLote.js`, `domain/decisaoVenda.js`, `components/VendaLoteModal.jsx`, `domain/indicadoresEstrategicos.js` | **8 lugares** calculam "arroba"/custo-por-arroba com pelo menos 3 definições distintas (ganho, peso vivo atual, peso de carcaça) — o achado técnico mais crítico da auditoria, detalhado no backlog item BM-01 |
| GMD 30 dias | `LotesPage.jsx`, `AcompanhamentoPesoPage.jsx` | Função `calculateGmd30` copiada verbatim nos dois arquivos, não extraída para `domain/` |
| Rateio de custo compartilhado | `pages/CustosCompartilhadosPage.jsx` (prévia, reimplementada inline) vs `domain/rateio.js` + `services/custosCompartilhados.js` (cálculo real, persistido) | A prévia mostrada ao usuário e o valor realmente salvo usam dois caminhos de código diferentes — podem divergir silenciosamente |
| Saída de estoque | `EstoquePage.jsx`'s `SaidaModal.submit()` (inline) vs `services/movimentacoes.js`'s `registrarSaidaEstoque()` | Duas implementações da mesma operação; a inline não valida `tipo` contra uma whitelist como a de serviço faz |
| Resumo/decisão de lote | `resumoLote.js`, `manejoResultado.js`, `decisaoVenda.js`, `relatorioLote.js` | Todos operam sobre o mesmo lote com responsabilidades sobrepostas — não é erro, mas é superfície de manutenção grande para um único conceito |

### 2.4 Código morto identificado

- `src/components/EstoqueForm.jsx` — não importado por nada (confirmado por grep). Contém o campo `alerta_dias_antes` (com default 30) que falta no formulário realmente usado (`EstoquePage.jsx`'s `CadastroItemModal`) — ou seja, o código morto tem a funcionalidade que falta no código vivo.
- `domain/rateio.js` — `ratearPorCabecas`/`ratearPorPeso`/`ratearIgualitario` não encontrados em uso direto nos arquivos lidos (a persistência real passa por `services/custosCompartilhados.js`, que pode ou não chamá-las — confirmar com grep completo do repo antes de remover).
- `utils/calculations.js`'s `calcLote()` calcula seu próprio `custoPorArroba`/`custoPorCabeca` (via tabela legada `custos`, ignorando a reconciliação de `movimentacoes_financeiras`) mas nada consome esses campos — são calculados a cada render sem uso.

### 2.5 Lógica de negócio pesada dentro de JSX

Páginas com funções de cálculo/filtragem definidas localmente em vez de em `domain/`:

| Página | Linhas | Lógica inline notável |
|---|---|---|
| `ResultadosPage.jsx` | 1586 | Ranking e matrizes de decisão construídos no componente |
| `PesagensPage.jsx` | 970 | `buildGraphicsData`, `filterByActiveTab`, cálculo de GMD |
| `FinanceiroPage.jsx` | 923 | `computeDRE()` inteiro vive na página, não em `domain/` |
| `LotesPage.jsx` | 855 | `calculateGmd30`, `filterLotesByActiveFarm`, `buildLoteConsumptionAlert` |
| `EstoquePage.jsx` | 782 | Toda a lógica de estoque (sem módulo de domínio dedicado) |
| `ImportacaoPage.jsx` | 795 | Parsing/validação de CSV sem módulo de domínio |

`App.jsx` (1240 linhas) concentra auth, sync, alertas, navegação, fila offline e write guard — parcialmente extraído para hooks (`useAuth`, `useOperationalData`), mas a orquestração de estado de app ainda mora ali.

## 3. Banco de dados (Supabase — schema real verificado via MCP)

**33 tabelas** em `public`, RLS habilitado em todas. Achados por prioridade no [Backlog Mestre](HERDON_BACKLOG_MESTRE.md) (categoria "dados/banco"); resumo técnico abaixo.

### 3.1 Deriva de migrations (local × remoto)

O remoto tem 2 migrations aplicadas que não existem como arquivo local (`fix_handle_new_user_profile_perfil_constraint`, `backfill_missing_profiles`); o local tem `20260706120000_telegram_multiuser_connections.sql` que não aparece no histórico de migrations do remoto (provavelmente aplicada via `execute_sql` em vez de `apply_migration`). Recomenda-se `supabase db pull` para reconciliar antes do próximo deploy — sem isso, `staging`/local não reproduz fielmente o remoto.

### 3.2 Inconsistências de nomenclatura

- `lotes` e `pastagens` usam `faz_id` (bigint); o resto do schema usa `fazenda_id`. **`pastagens` tem as duas colunas ao mesmo tempo**, tipos diferentes (bigint e uuid) — sobra de uma migração incompleta.
- `customer_subscriptions` tem **tanto** `farm_id` quanto `fazenda_id`.
- `lotes` tem três colunas de peso atual: `p_at`, `peso_atual`, `peso_medio_atual`.
- `usuarios` (tabela tipo roster/CRM) e `profiles` (identidade ligada a `auth.users`) são dois conceitos de "usuário" — não fica claro qual é autoritativo para papel/perfil.
- `custos` usa nomes abreviados (`cat`, `desc`, `val`) enquanto `movimentacoes_financeiras` usa nomes completos (`categoria`, `descricao`, `valor`) para conceitos equivalentes.
- Tabelas de billing (`billing_events`, `checkout_sessions`, `customer_subscriptions`, `subscription_plans`) são as únicas em inglês num schema majoritariamente em português — reflexo da integração Asaas "colada" por fora.

### 3.3 RLS e performance

- Todas as 33 tabelas têm RLS habilitado, mas **92 ocorrências de `multiple_permissive_policies`** (pares `_owner` + `_same_account` por operação) e **97 de `auth_rls_initplan`** (`auth.uid()` não envolvido em `(select auth.uid())`, reavaliado linha a linha em vez de uma vez por query) — dívida de performance já apontada na auditoria de 2026-07-05 e ainda não resolvida.
- `telegram_connection_codes` e `telegram_notification_logs` têm RLS habilitado **sem nenhuma policy** — acesso só funciona via service role; qualquer leitura client-side retorna vazio silenciosamente (provavelmente intencional, mas não documentado).
- 16 chaves estrangeiras sem índice (`billing_events.user_id`, `eventos_operacionais.*`, `telegram_connection_codes.*`, `sanitario.rotina_automatica_id`, entre outras) e 38 índices duplicados (ex.: `fazendas.owner_user_id` tem 3 índices idênticos).

### 3.4 Segurança — status confirmado

Os achados SEC-001 a SEC-005 e o gatilho duplicado de auth documentados em `docs/AUDITORIA_COMPLETA_HERDON.md` (2026-07-05) seguem **resolvidos**, confirmado no advisor ao vivo — nada regrediu. Pendências remanescentes são de **hardening**, não de vulnerabilidade ativa: 5 funções com `search_path` mutável, extensão `citext` fora de um schema dedicado, e a proteção de senha vazada (HaveIBeenPwned) desabilitada nas configurações de Auth do Supabase.

## 4. Cobertura de testes

862 testes, todos passando. 25 de 37 módulos de domínio têm teste (68%). Sem teste: `alertas.js` (legado), `evolucaoRebanho.js`, `guiaCriador.js`, `indicadoresEstrategicos.js`, `insightsFazenda.js`, `ocupacaoPastos.js`, `planos.js`, `relatorios.js`, `resumoLote.js`, `saudeLote.js`, `simuladorCenarios.js`, `unidadeAnimal.js`, `whatsappResumo.js`. Nos serviços, `auditoria.js`, `subscriptions.js`, `accessControl.js` e `telegramConnection.js` (parcialmente) também sem teste dedicado.

Dado que `resumoLote.js` é justamente onde a inconsistência de custo/arroba se materializa (§2.3), a ausência de teste ali é a lacuna de cobertura mais sensível encontrada.

## 5. Bundle e performance de build

Build passa em ~2s. Chunks maiores: `ImportacaoPage` (453KB / 148KB gzip — o maior de longe), `supabase` (196KB), `index` (252KB / 78KB gzip). `ImportacaoPage` concentra parsing de planilha (biblioteca `xlsx`) e validação — candidata a `React.lazy()` mais agressivo ou a mover parsing para um worker, já que a maioria dos usuários nunca abre essa tela.

## 6. Achados novos desta auditoria (não estavam em auditorias anteriores)

1. **Custo por arroba/lucro por arroba com definições divergentes em 8 arquivos** — o achado técnico mais significativo do Sprint 13 (detalhe completo no Backlog Mestre, item BM-01).
2. **Sanidade não decrementa Estoque apesar da UI sugerir que sim** (dropdown de produto vem do estoque, mas a baixa nunca acontece) — BM-02.
3. **Previsão de "dias restantes" do estoque ignora movimentações do tipo `consumo`** (só conta `saida`), cegando a previsão para o fluxo mais comum — BM-03.
4. **Campo `alerta_dias_antes` (alerta de validade próxima) ausente do formulário de cadastro ativo**, presente só no componente morto `EstoqueForm.jsx` — na prática, o alerta de "vencendo em breve" nunca dispara, só o de "já vencido" — BM-04.
5. **Painel de resolver/adiar alertas nunca migrado para a Central unificada** — confirmado que `AlertasPage.jsx` não tem nenhuma ação de tratativa, só o painel legado no Dashboard tem.
6. **Dependência frágil e silenciosa**: criar um lote depende de `buildGrupoAnimaisAutoPatch` gerar um registro sintético em `animais`; se esse auto-patch não disparar (ex. lote importado por outro caminho), financeiro/saúde/decisão de venda mostram "dados insuficientes" sem nenhum erro visível.

## 7. Auditoria visual (Etapa 9)

Login testado no dev server local (`npm run dev`, preview em `localhost:5173`): tela renderiza corretamente em mobile (375px, confirmado por screenshot) e — após uma checagem mais cuidadosa via inspeção de DOM (`getBoundingClientRect`) — também está corretamente centralizada em desktop (1440px); o primeiro screenshot em 1440px parecia mostrar o conteúdo espremido no canto superior esquerdo, mas essa discrepância não se repetiu na inspeção de layout real, indicando artefato da ferramenta de preview e não bug do produto. Sem erros no console, sem requisições de rede falhas.

**Limitação honesta:** não havia credencial de teste/demo disponível nesta sessão, então Dashboard, Central de Alertas, Lotes, Financeiro, Sanitário, Estoque e Simulador **não puderam ser inspecionados visualmente**. A avaliação desses módulos neste documento é 100% baseada em leitura de código, não em uso real da tela. Recomenda-se repetir a Etapa 9 com uma conta de teste em um próximo sprint.
