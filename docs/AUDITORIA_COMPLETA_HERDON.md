# Auditoria Completa — HERDON

> Sprint de diagnóstico (sem grandes implementações). Data: 2026-07-05 · Branch `main` · Banco Supabase `ljpiszxicmmuefbiixui`.
> Método: baseline lint/test/build + leitura cruzada de ~130 docs de sprints anteriores em `docs/` + inspeção direta do código atual (`src/`) + consulta ao Supabase (advisors de segurança/performance, políticas RLS, tabelas) para confirmar o que já foi corrigido e o que ainda está aberto.

---

## 0. Estado do projeto ANTES desta análise (baseline obrigatório)

| Comando | Resultado |
|---|---|
| `npm run lint` | ✅ **Limpo, 0 erros/warnings.** (Docs antigos — `ARCHITECTURE.md`, `ISSUES_RECOMENDADAS.md` de 2026-06-15 — registravam lint quebrado; foi corrigido em sprint posterior e a documentação não foi atualizada.) |
| `npm run test` | ✅ **789/789 testes passando**, 18 suítes, 0 falhas, ~1.9s. |
| `npm run build` | ✅ **Build ok** (Vite, 3.4s). Único aviso: tempo de plugin CSS alto (`vite:css-post`/`vite:css` 84% do build) — não bloqueia, é observação de performance de build. |

**Conclusão da baseline:** o projeto está tecnicamente saudável (lint/testes/build limpos). O maior risco do HERDON hoje não é "está quebrado", é "a documentação de auditorias antigas não reflete mais o estado atual" — várias correções já feitas em sprints recentes (ver §1) não foram refletidas em `ARCHITECTURE.md`/`ROADMAP.md`/`ISSUES_RECOMENDADAS.md`.

---

## 1. O que a auditoria de 2026-06-15 apontou × o que está resolvido agora

O arquivo `docs/ISSUES_RECOMENDADAS.md` (base do `ROADMAP.md` atual) lista 16 issues P0-P3. Verificação direta no banco (políticas RLS via SQL, não apenas leitura de doc) mostra que a maior parte já foi corrigida em sprints posteriores:

| Issue | Status verificado agora |
|---|---|
| **[SEC-001]** `invites` legível por qualquer autenticado | ✅ **Resolvido.** Só existem policies `invites_*_same_account_managers` com `qual: app_can_manage_account(owner_user_id)`. |
| **[SEC-002]** INSERT `{public}` em `alertas_adiados`/`alertas_resolvidos` | ✅ **Resolvido.** Todas as policies hoje são `{authenticated}`. |
| **[SEC-003]** `fazendas` com policy que aceita `owner_user_id IS NULL` | ✅ **Resolvido.** Policies atuais (`fazendas_select_owner`/`_same_account`) não têm essa brecha. |
| **[SEC-004]** `cenario_eventos`/`suplementacao` sem policy `_same_account` | ✅ **Resolvido.** Ambas têm policies `_same_account` completas (select/insert/update/delete). |
| **[SEC-005]** `auditoria` com UPDATE/DELETE (deveria ser append-only) | ✅ **Resolvido.** Só existem policies de INSERT/SELECT — UPDATE/DELETE são negados por ausência de policy (RLS nega por padrão). |
| **[BUG-002]** Lint quebrado | ✅ **Resolvido** (ver §0). |
| **[BUG-003]** Dois triggers conflitantes em `auth.users` | ✅ **Resolvido.** Hoje existe só `on_auth_user_created` → `handle_new_user_profile()`. |
| **[BUG-001]/[ARCH-002]** Resíduo financeiro em `calcLote` | 🔶 **Parcial.** `receitaProjetada`/`margemProjetada` continuam em `src/utils/calculations.js:185-213` — mas isso é projeção zootécnica documentada (não os campos duplicados que o PR #111 removeu). Ver risco novo no §Financeiro. |
| **[ARCH-001]** Saída de estoque via `setDb` direto | Não reverificado nesta sprint (fora do escopo dos agentes desta rodada) — tratar como ainda aberto até confirmação. |

**Achado novo (não estava na auditoria de junho):** os *advisors* do Supabase apontam débito de **performance**, não de segurança crítica:

| Achado | Qtd | Risco |
|---|---|---|
| `auth_rls_initplan` (policies reavaliam `auth.uid()`/função por linha, não por query) | 95 | Baixo hoje (poucas linhas: fazendas=6, lotes=9, animais=8), **alto quando a base crescer** — cada policy deveria envolver a chamada em `(select auth.uid())`. |
| `multiple_permissive_policies` (policies `_owner` e `_same_account` sobrepostas na mesma tabela/comando) | 92 | Custo de avaliação dobrado por query; correto seria consolidar em uma única policy por comando. |
| `unused_index` | 149 | Custo de escrita/manutenção sem benefício de leitura ainda. |
| `duplicate_index` | 38 | Espaço e manutenção duplicados. |
| `unindexed_foreign_keys` | 12 | Joins/consultas por FK sem índice — vai doer em relatórios quando a base crescer. |
| Segurança (WARN, não ERROR): `search_path` mutável em 5 funções, extensão `citext` no schema `public`, 8 funções `SECURITY DEFINER` chamáveis por `anon`/`authenticated` via RPC, proteção de senha vazada desativada | — | Hardening recomendado, não bloqueante para vender. |

Nenhum desses itens é urgente pelo volume atual de dados (banco de piloto: 6 fazendas, 9 lotes, 25 profiles), mas **a consolidação de policies duplicadas (`_owner` + `_same_account`) é uma limpeza de baixo risco e alto retorno** — reduz avaliação de RLS pela metade em quase todas as tabelas.

---

## 2. Mapa do que o HERDON já tem (por área)

| Área | Existe? | Funcional? | Incompleto? | Prioridade de ação |
|---|---|---|---|---|
| **A. Gestão de fazendas** | ✅ | ✅ | Limites por plano aplicados (`canCreateFarm`) | Baixa |
| **B. Gestão de lotes** | ✅ | ✅ | Sem meta de arroba por lote (só GMD meta); sem projeção de venda por data | Média |
| **C. Pesagens e GMD** | ✅ | ✅ | Alerta "sem pesagem há X dias" enterrado no score de saúde, não é notificação própria; sem detecção de pesagem atípica | Média |
| **D. Arrobas e rendimento de carcaça** | ✅ | ✅ | Sem histórico de evolução do rendimento; rendimento fixo (52%) ajustável mas não versionado por lote | Baixa |
| **E. Financeiro** | ✅ | ✅ | Sem UI para lançar `status=previsto`; DRE só consolidado, não por lote+período; migration do modelo competência/caixa ainda não aplicada em produção | **Alta** |
| **F. Custos** | ✅ | ✅ | Rateio de custos compartilhados existe mas é manual/opcional; risco de duplicar `investimento` do lote com movimentação de compra | Média |
| **G. Estoque** | ✅ | ✅ | Previsão de término é heurística (janela fixa de 30 dias), sem sugestão de reposição | Média |
| **H. Sanidade/manejo** | ✅ | 🔶 | **Sem agenda/calendário de vacinação com vencimento** — é o maior buraco funcional da área | **Alta** |
| **I. Dashboard** | ✅ | ✅ | Mais visual que decisório — recomendações acionáveis só aparecem no Assistente (modal) ou em Decisões da Fazenda (outra página) | Média |
| **J. Relatórios** | ✅ | ✅ | PDF via `window.print()` (sem lib dedicada); export Excel não confirmado apesar da dependência `xlsx` estar instalada; sem DRE por lote no relatório financeiro | Média |
| **K. Simulador de cenários** | ✅ | ✅ | Já usa dados reais (não é mock); falta validação de entradas extremas (datas invertidas, % negativo) | Baixa |
| **L. SaaS/planos/assinatura** | ✅ | ✅ | Gate comercial completo (view/write) e testado; RLS não valida assinatura (risco aceito e documentado, único impacto é a própria conta); Asaas ainda em sandbox | **Alta** (ligar Asaas produção é decisão de negócio, não técnica) |
| **M. Usuários/permissões** | ✅ | ✅ | Papéis, convites e limites por plano funcionando (Sprint 6/7) | Baixa |
| **N. Alertas/notificações** | 🔶 | 🔶 | **Dois sistemas de alerta coexistindo** (`buildAlerts` legado × `alertasInteligentes` novo) com contagens divergentes; nenhuma central unificada; nenhuma notificação push/e-mail/WhatsApp automática (só compartilhamento manual) | **Alta** |
| **O. UX/UI** | ✅ | ✅ | CSS com dívida (breakpoints duplicados em `app.css`, 9000+ linhas); estados vazios padronizados em só ~13 de ~28 páginas | Média |
| **P. Banco de dados/Supabase** | ✅ | ✅ | 31 tabelas, todas com RLS habilitado | Baixa (ver §1 para performance) |
| **Q. Segurança/RLS** | ✅ | ✅ | Todos os P0-P2 de segurança da auditoria de junho **já corrigidos** (ver §1); resta hardening WARN-level | Baixa |

---

## 3. O que precisa ser adicionado (avaliado item a item do pedido)

| Item pedido | Situação |
|---|---|
| Central de Alertas unificada | ❌ Ausente — hoje são 2 sistemas paralelos em telas diferentes (aba "Alertas" = legado; "Decisões da Fazenda" = novo) |
| Notificação por WhatsApp | 🔶 Existe só compartilhamento manual (`abrirWhatsApp`, texto pré-formatado) — não é notificação automática/proativa |
| Notificação por e-mail | ❌ Ausente |
| Notificação dentro do app | 🔶 Existe indicador visual (badges, contadores) mas não um centro de notificações persistente/push |
| Agenda operacional da fazenda | 🔶 Existe `CalendarioOperacionalPage`/tarefas, mas sem vínculo com vencimento sanitário (ver H) |
| Contas a pagar/receber com vencimento | 🔶 Modelo de dados existe (`data_vencimento`), mas falta UI para lançar com status diferente de "realizado" |
| Status previsto/realizado/pago/vencido | 🔶 Lógica existe em `financeiroStatus.js`/`fluxoCaixa.js`; falta UI de lançamento e filtro no FinanceiroPage |
| Fluxo de caixa | ✅ Existe (`fluxoCaixa.js` + `FluxoCaixaPage`) |
| Competência x caixa | 🔶 Decidido (D-003) e parcialmente implementado; migration em produção pendente |
| Alertas de vacinação | ❌ Ausente (não há calendário sanitário com vencimento) |
| Alertas de manejo | ✅ Existe (`alertasInteligentes.js`) |
| Alertas de estoque baixo | ✅ Existe, mas heurística simples |
| Alerta de lote sem pesagem | 🔶 Calculado, mas só dentro do score de saúde, não como alerta autônomo |
| Alerta de GMD abaixo da meta | ✅ Existe (`gmdAlerta.js`, `alertasInteligentes.js`) |
| Alerta de custo por arroba acima do esperado | ✅ Existe (`decisaoVenda.js`) |
| Alerta de lote pronto para venda | ✅ Existe (`decisaoVenda.js` — status "pronto avaliar") |
| Projeção de venda do lote | 🔶 Existe decisão vender-hoje-vs-manter, mas não projeção de data futura (quando atingirá peso/arroba alvo) |
| Vender hoje x vender depois | ✅ Existe (`decisaoVenda.js`) |
| Ponto ideal de venda | 🔶 Aproximado pelo status de decisão; não há um "ponto ótimo" calculado (ex: dia de custo/@ mínimo) |
| Relatórios PDF | 🔶 Existe via impressão do navegador, não geração de PDF real |
| Relatórios Excel | ❌ Não confirmado em uso, apesar da lib `xlsx` estar no `package.json` (parece usada só para importação) |
| DRE da fazenda | ✅ Existe (`FinanceiroPage` tab DRE) |
| DRE por lote | 🔶 Só via drill-down manual, não como relatório dedicado com período |
| Perfil operacional da fazenda | ❌ Não identificado (parâmetros por tipo de operação — cria/recria/engorda) |
| Metas por lote | 🔶 Existe meta de GMD; falta meta de arroba/peso final e prazo |
| Parâmetros padrão por fazenda | 🔶 Parcial (rendimento de carcaça ajustável); sem tela central de "parâmetros padrão" |
| Painel de decisão com recomendações claras | ✅ Existe (`DecisoesFazendaPage`) — é a peça mais madura do produto hoje |

---

## 4. O que já existe mas precisa melhorar

- **Dois sistemas de alertas coexistindo** (`utils/alerts.js` legado × `domain/alertasInteligentes.js`) — schemas incompatíveis, contagens divergentes no Dashboard. É o débito técnico de maior visibilidade para o usuário final.
- **DRE só no nível da fazenda** — falta granularidade por lote + período fechado (ex: "ciclo do lote X, de entrada a venda").
- **Nenhuma UI para lançar financeiro com status `previsto`** — tudo entra como realizado, o que invalida a separação previsto/realizado que o modelo de dados já suporta.
- **Rateio de custos compartilhados é manual** — se o produtor não usar a tela específica, energia/arrendamento fica fora do custo real por lote (subestima custo/@).
- **Agenda sanitária sem vencimento** — sanidade registra o que já foi feito, não avisa o que está para vencer (vacina, vermífugo, carência).
- **CSS com débito técnico** (`app.css` 9000+ linhas, breakpoints duplicados/conflitantes) — risco de regressão visual a cada nova página.
- **Onboarding é checklist estático**, não um tour interativo — funciona, mas não guia o primeiro cadastro passo a passo.
- **Estados vazios inconsistentes** — padronizados em ~13 páginas, ainda artesanais em outras ~15.
- **Simulador de Cenários mostra "Viável: SIM/NÃO"** sem explicar o porquê ao produtor (falta contexto de ROI/break-even na própria tela).

Nenhuma duplicação grave de cálculo financeiro foi encontrada (custo/arroba é centralizado em `getResumoLote`); o risco real é o **investimento do lote poder ser contado em dobro** se o produtor lançar a compra tanto como `lote.investimento` quanto como movimentação financeira — vale um alerta de produto (validação ou aviso), não uma reescrita.

---

## 5. Avaliação de produto

**O HERDON hoje é mais um sistema de controle ou já é um sistema de decisão?**
É os dois, em proporções desiguais por módulo. Cadastro/controle (fazendas, lotes, pesagens, estoque, financeiro) está maduro e bem testado. Decisão de verdade já existe e é o ponto mais forte do produto — `DecisoesFazendaPage`, `decisaoVenda.js` e o score de saúde do lote (`saudeLote.js`) são recomendações acionáveis reais, não só dados. O problema é que essa camada de decisão está **isolada em uma página separada** — o Dashboard (a tela que o produtor mais vê) continua sendo majoritariamente KPIs visuais.

**O que falta para virar um app indispensável?**
Unificar alertas em um único lugar, fechar o buraco de sanidade (agenda com vencimento) e trazer a inteligência de "Decisões da Fazenda" para dentro do fluxo principal do Dashboard — hoje ela é descoberta, não empurrada.

**Quais funcionalidades realmente aumentam valor percebido?**
Decisão de venda, score de saúde do lote, DRE e fluxo de caixa. São específicos de pecuária de corte e substituem planilha.

**Quais são "bonitas" mas pouco úteis?**
Assistente HERDON (modal de perguntas pré-prontas) é redundante com Decisões da Fazenda — mesma inteligência, UI diferente, sem valor incremental claro.

**Onde o app pode se diferenciar dos concorrentes?**
Decisão de venda com base em dados reais (custo/@ + GMD + saúde do lote) é o diferencial mais forte — a maioria dos concorrentes brasileiros de gestão pecuária faz cadastro, poucos calculam "vender hoje ou depois" com o rigor que `decisaoVenda.js` já tem.

**O que priorizar para MVP comercial?**
Agenda sanitária com vencimento (P0 de produto — hoje é o gap mais visível para um pecuarista), unificação de alertas, e fechar o ciclo previsto→pago no financeiro.

**O que pode ficar para depois?**
Depreciação/custo de oportunidade/pró-labore no DRE, PDF real (vs. impressão), export Excel, tour interativo de onboarding.

---

## 6. Priorização (P0-P3)

| Funcionalidade | Situação atual | Problema | Impacto no usuário | Complexidade | Prioridade | Recomendação |
|---|---|---|---|---|---|---|
| Ativar Asaas em produção + teste de pagamento ponta a ponta | Sandbox | Nenhuma cobrança real acontece | Bloqueia venda real | Baixa (config) | **P0** | Decisão de negócio + checklist já existe em `PRONTIDAO_COMERCIAL_HERDON.md §7/§8` |
| Agenda sanitária com vencimento (vacina/vermífugo/carência) | Ausente | Sanidade só registra passado | Alto — risco sanitário e de venda (carência) não é avisado | Média | **P0** | Nova tabela de "protocolo sanitário" com data prevista + alerta, reaproveitando `alertasInteligentes.js` |
| Unificar os dois sistemas de alerta | Dois sistemas paralelos | Contagens divergentes, confunde o produtor | Alto — mina confiança no produto | Média | **P0** | Migrar Dashboard/aba Alertas para `alertasInteligentes.js`; aposentar `utils/alerts.js` |
| UI para lançar financeiro com status previsto/pago | Só "realizado" | Modelo de dados pronto, tela não usa | Alto — impede controle real de contas a pagar/receber | Média | **P1** | Adicionar seletor de status no formulário de lançamento existente |
| DRE por lote com período fechado | Só drill-down manual | Produtor não fecha resultado de um ciclo | Médio | Baixa-Média | **P1** | Novo relatório reaproveitando `getResumoLote` + filtro de período |
| Consolidar policies RLS duplicadas (`_owner`+`_same_account`) | 92 ocorrências | Custo de avaliação dobrado | Baixo hoje, cresce com a base | Média | **P1** | Merge das policies por comando/tabela, sem mudar comportamento |
| Rateio de custos compartilhados automático | Manual/opcional | Custo por lote subestimado se não usado | Médio | Média | **P2** | Sugestão automática na tela de lançamento de custo geral |
| Alerta "sem pesagem há X dias" autônomo | Só dentro do score de saúde | Produtor não é avisado de forma direta | Médio | Baixa | **P2** | Extrair `fatorPesagemFrequencia` como alerta próprio |
| Projeção de venda por data (não só hoje x depois) | Ausente | Falta visão de "quando" vender | Médio | Média | **P2** | Extensão de `decisaoVenda.js` com projeção de GMD constante |
| Consolidar CSS (`app.css`) | 9000+ linhas com breakpoints duplicados | Risco de regressão visual | Baixo/Médio | Média-Alta | **P2** | Auditoria de CSS dedicada (fora deste sprint) |
| PDF real (lib dedicada) e export Excel confirmado | `window.print()` | Relatório não é um arquivo de verdade | Médio | Média | **P2** | Avaliar `xlsx` (já instalado) para export; PDF client-side se necessário |
| Onboarding interativo (tour) | Checklist estático | Primeiro uso não é guiado | Baixo-Médio | Média | **P3** | Overlay de passos no primeiro cadastro |
| Hardening WARN do Supabase (search_path, extensão citext, RPCs anon) | Aberto | Superfície de ataque pequena, não crítica | Baixo | Baixa | **P3** | Aplicar `SET search_path`, mover extensão, revisar RPCs expostos |
| Depreciação/custo de oportunidade/pró-labore no DRE | Ausente | DRE não é "contábil completo" | Baixo (nicho avançado) | Alta | **P3** | Fica para uma sprint de "DRE avançado" |

---

## 7. Roadmap proposto

**Fase 1 — Correções essenciais**
Consolidar policies RLS duplicadas · confirmar `ARCH-001` (saída de estoque via service layer) · atualizar `ARCHITECTURE.md`/`ROADMAP.md`/`ISSUES_RECOMENDADAS.md` para refletir o que já foi corrigido (evita retrabalho de auditorias futuras).

**Fase 2 — Decisão e alertas**
Unificar os dois sistemas de alerta em um só · alerta autônomo de "sem pesagem há X dias" · agenda sanitária com vencimento (vacina/vermífugo/carência) · trazer os cards de "Decisões da Fazenda" para dentro do Dashboard principal.

**Fase 3 — Relatórios e inteligência financeira**
UI de lançamento financeiro com status previsto/pago · aplicar migration do modelo competência x caixa em produção · DRE por lote com período fechado · projeção de venda por data.

**Fase 4 — Automação e WhatsApp**
Notificação proativa (não só compartilhamento manual) por WhatsApp/e-mail dos alertas críticos (estoque baixo, vacina vencendo, lote pronto para venda) · central de notificações dentro do app.

**Fase 5 — Produto premium/SaaS avançado**
Ativar Asaas em produção · RLS com validação de assinatura ativa nas escritas operacionais · export PDF/Excel de verdade · onboarding interativo · DRE avançado (depreciação, custo de oportunidade, pró-labore) · perfil operacional por fazenda e parâmetros padrão configuráveis.

---

## 8. Regras técnicas seguidas nesta sprint

- Nenhuma feature grande foi implementada — este documento é o único entregável de código deste sprint.
- Nenhuma migration foi criada ou aplicada.
- Nenhuma policy RLS foi alterada (apenas consultada para diagnóstico).
- Nenhum dado foi alterado ou apagado no banco.
- Nenhum arquivo de código-fonte do app foi modificado.

## 9. Validação final

| Comando | Resultado |
|---|---|
| `npm run lint` | ✅ 0 erros |
| `npm run test` | ✅ 789/789 testes, 0 falhas |
| `npm run build` | ✅ build ok (3.4s) |
| `get_advisors(security)` (Supabase) | 0 ERROR, 9 WARN (hardening, não bloqueante) |
| `get_advisors(performance)` (Supabase) | 386 achados, nenhum ERROR — débito de performance para tratar antes de escalar a base |

**Pendências e próximos passos recomendados:**
1. Atualizar `ARCHITECTURE.md`, `ROADMAP.md` e `ISSUES_RECOMENDADAS.md` — estão desatualizados e fariam uma próxima auditoria repetir trabalho já feito.
2. Confirmar se `ARCH-001` (saída de estoque via `setDb` direto) ainda está aberto — não foi reverificado nesta sprint.
3. Priorizar a Fase 2 do roadmap (§7) como próximo sprint de implementação: é onde está a maior distância entre "o que o produtor precisa ver" e "o que o app já calcula mas não mostra de forma unificada".
