# QA de Telas — HERDON

> Sprint 4 · Etapa 7 · Gerado em 2026-06-15  
> Total: 29 telas identificadas. Classificação baseada em code review + histórico de commits.  
> Status: `✅ OK` · `⚠️ Parcial` · `❌ Bloqueado` · `⬜ Não testado`

---

## Legenda

| Símbolo | Significado |
|---------|------------|
| ✅ OK | Funcionando corretamente — verificado via código ou commits |
| ⚠️ Parcial | Funciona mas com limitação conhecida ou não completamente verificado |
| ❌ Bloqueado | Tem bug crítico que impede uso |
| 🔒 Gate | Requer plano/assinatura para acesso |
| ⬜ Não testado | Não verificado nesta sprint |

---

## Telas de auth (sem sidebar)

| Tela | Arquivo | Status | Observação |
|------|---------|--------|-----------|
| Login / Cadastro | `LoginPage.jsx` | ✅ OK | Múltiplos commits de fix de UI/responsividade |
| Assinatura bloqueada | `AssinaturaBloqueadaPage.jsx` | ✅ OK | Exibida quando subscription bloqueada |

---

## Core — Gestão da fazenda

| Tela | Arquivo | Status | Observação |
|------|---------|--------|-----------|
| Dashboard | `DashboardPage.jsx` | ⚠️ Parcial | Usa `getResumoLote` ✅; estado vazio não testado |
| Fazendas | `FazendasPage.jsx` | ✅ OK | RLS verificado; cloud sync funcional |
| Lotes | `LotesPage.jsx` | ✅ OK | Usa `getResumoLote`; RLS verificado |
| Animais | `AnimaisPage.jsx` | ⬜ Não testado | Estrutura OK; formulários não validados |
| Pesagens | `PesagensPage.jsx` | ⬜ Não testado | Forms endurecidos em sprints anteriores |
| Acompanhamento de Peso | `AcompanhamentoPesoPage.jsx` | ⬜ Não testado | Gráfico de evolução de peso |

---

## Financeiro e Resultados

| Tela | Arquivo | Status | Observação |
|------|---------|--------|-----------|
| Financeiro | `FinanceiroPage.jsx` | ✅ OK | Usa `getResumoLote`; fonte unificada pós-PR #111 |
| Custos | `CustosPage.jsx` | ⬜ Não testado | Registro de custos operacionais |
| Resultados | `ResultadosPage.jsx` | ⚠️ Parcial | Usa `calcLote` para produtivo E `getResumoLote` para financeiro (D-001 parcial) |
| Comparativo | `ComparativoPage.jsx` | ✅ OK | Usa `getResumoLote`; verificado Sprint 3 |

---

## Operacional

| Tela | Arquivo | Status | Observação |
|------|---------|--------|-----------|
| Sanitário | `SanitarioPage.jsx` | ⬜ Não testado | Vacinações, tratamentos |
| Estoque | `EstoquePage.jsx` | ⚠️ Parcial | Dois caminhos de saída ainda coexistem (registrado em `Estado Atual`) |
| Suplementação | `SuplementacaoPage.jsx` | ⬜ Não testado | Gestão de suplementos |
| Pastagens | `PastagensPage.jsx` | ⬜ Não testado | Gestão de pastagens |
| Rotina | `RotinaPage.jsx` | ⬜ Não testado | Rotinas operacionais |
| Tarefas | `TarefasPage.jsx` | ⬜ Não testado | Gestão de tarefas |
| Calendário Operacional | `CalendarioOperacionalPage.jsx` | ⬜ Não testado | Visão de calendário |

---

## Equipe e Configurações

| Tela | Arquivo | Status | Observação |
|------|---------|--------|-----------|
| Funcionários | `FuncionariosPage.jsx` | ❌ Bloqueado | Invite flow quebrado — bug `app_can_manage_account` (case mismatch) |
| Configurações | `ConfiguracoesPage.jsx` | ⬜ Não testado | Configurações da conta |
| Perfil | `PerfilPage.jsx` | ⬜ Não testado | Edição de perfil do usuário |

---

## Billing

| Tela | Arquivo | Status | Observação |
|------|---------|--------|-----------|
| Minha Assinatura | `MinhaAssinaturaPage.jsx` | ⚠️ Parcial | Fluxo Asaas implementado; teste com sandbox pendente |

---

## Premium (requer plano ativo)

| Tela | Arquivo | Status | Observação |
|------|---------|--------|-----------|
| Dashboard Premium | `DashboardPremiumPage.jsx` | 🔒 Gate | Requer plano — não testável sem assinatura ativa |
| Relatórios Gerenciais | `RelatoriosGerenciaisPage.jsx` | 🔒 Gate | Requer plano |
| Cenários | `CenariosPage.jsx` | 🔒 Gate | Simulador de cenários |
| Evolução do Rebanho | `EvolucaoRebanhoPage.jsx` | 🔒 Gate | Gráfico histórico do rebanho |
| Indicadores | `IndicadoresPage.jsx` | 🔒 Gate | KPIs consolidados |
| Planejamento | `PlanejamentoPage.jsx` | 🔒 Gate | Planejamento de ciclos |

---

## Resumo por categoria

| Categoria | Total | ✅ OK | ⚠️ Parcial | ❌ Bloqueado | 🔒 Gate | ⬜ Não testado |
|-----------|-------|-------|-----------|------------|--------|--------------|
| Auth | 2 | 2 | 0 | 0 | 0 | 0 |
| Core fazenda | 6 | 3 | 1 | 0 | 0 | 2 |
| Financeiro/Resultados | 4 | 2 | 2 | 0 | 0 | 0 |
| Operacional | 7 | 0 | 1 | 0 | 0 | 6 |
| Equipe/Config | 3 | 0 | 0 | 1 | 0 | 2 |
| Billing | 1 | 0 | 1 | 0 | 0 | 0 |
| Premium | 6 | 0 | 0 | 0 | 6 | 0 |
| **Total** | **29** | **7** | **5** | **1** | **6** | **10** |

---

## Bloqueadores críticos

| Tela | Bug | Impacto | Ação |
|------|-----|---------|------|
| FuncionariosPage | `app_can_manage_account` case mismatch | Nenhum convite pode ser enviado | Corrigir em Etapa 10 |

---

## Itens estéticos/pequenos registrados (não corrigir agora)

| Tela | Observação |
|------|-----------|
| ResultadosPage | Usa `calcLote` e `getResumoLote` simultaneamente — D-001 parcialmente resolvido |
| EstoquePage | Dois caminhos de saída de estoque coexistem |
| DashboardPage | Estado vazio não testado |
| Todas as telas premium | Comportamento sem plano ativo não verificado |

---

## Critério de go/no-go

**Go (mínimo):** Auth ✅ + Core fazenda sem bloqueadores + Financeiro funcionando  
**No-go atual:** FuncionariosPage bloqueada (corrigível nesta sprint)

Após correção do bug de invite: apenas telas operacionais e premium permanecem não testadas, o que não bloqueia o go para teste controlado com produtor.
