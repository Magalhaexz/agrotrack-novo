# HERDON — Backlog Mestre (Sprint 13)

Lista priorizada de tudo que a auditoria 360° encontrou. Prioridade: **P0** (crítico, trava produto/decisão), **P1** (importante, impacta confiança ou operação), **P2** (relevante, mas contorna), **P3** (menor/hardening). Esforço: pequeno / médio / grande.

Ver [SPRINT13_AUDITORIA_360_HERDON.md](SPRINT13_AUDITORIA_360_HERDON.md) para o resumo executivo e [HERDON_ROADMAP_PROXIMOS_SPRINTS.md](HERDON_ROADMAP_PROXIMOS_SPRINTS.md) para o sequenciamento em sprints.

## Bugs críticos / integridade de dados

### BM-01 — Custo por arroba e lucro por arroba usam definições diferentes
- **Problema:** "arroba" tem pelo menos 3 definições concorrentes (ganho de peso, peso vivo atual, peso de carcaça) calculadas em 8 arquivos (`arroba.js`, `indicadores.js`, `calculos.js`, `utils/calculations.js`, `resumoLote.js`, `decisaoVenda.js`, `VendaLoteModal.jsx`, `indicadoresEstrategicos.js`). `resumoLote.js` — a função que alimenta Financeiro, Lotes e o relatório de lote — mistura `custoPorArroba` (base ganho) com `lucroPorArroba` (base carcaça) no mesmo objeto retornado.
- **Impacto para o produtor:** dois números de "por arroba" mostrados lado a lado na mesma tela não são comparáveis entre si; a decisão de vender ou não um lote pode se basear em margem calculada incorretamente.
- **Impacto técnico:** qualquer correção futura em uma das fórmulas não se propaga para as outras; alto risco de regressão ao tocar em qualquer uma.
- **Prioridade:** P1 (não é bug visível óbvio, mas mina a confiabilidade do dado mais citado do produto).
- **Esforço:** médio.
- **Dependências:** nenhuma; comparação de números antes/depois recomendada.
- **Sprint sugerido:** 14.
- **Critério de aceite:** uma única função em `domain/calculos.js` expõe `arrobasProduzidas`, `arrobasCarcaca`, `custoPorArroba` e `lucroPorArroba` com bases documentadas e consistentes; `resumoLote.js`, `calcLote` e `decisaoVenda.js` consomem essa função em vez de recalcular; teste cobrindo a consistência entre os dois números.

### BM-02 — Sanidade não decrementa Estoque apesar da UI sugerir que sim
- **Problema:** ao registrar um manejo/vacina, o formulário de Sanidade oferece um seletor de produto vindo de `db.estoque`, mas a seleção só é salva como `item_estoque_id` em metadata — nenhum código decrementa a quantidade em `estoque` ou cria um `movimentacoes_estoque`.
- **Impacto para o produtor:** o estoque exibido diverge da realidade a cada aplicação; o produtor precisa lembrar de dar baixa manual em outra tela, sem nenhum aviso de que isso é necessário.
- **Impacto técnico:** integração assimétrica (Estoque→Financeiro existe e funciona; Sanidade→Estoque não existe apesar de parecer que sim).
- **Prioridade:** P0 (a UI ativamente sugere um comportamento que não existe — risco de confiança no produto).
- **Esforço:** pequeno-médio.
- **Dependências:** nenhuma.
- **Sprint sugerido:** 15.
- **Critério de aceite:** salvar um registro sanitário com produto selecionado cria uma saída de estoque (`movimentacoes_estoque` tipo consumo/tratamento) e decrementa `quantidade_atual`; teste cobrindo o fluxo completo.

### BM-03 — Previsão de "dias restantes" do estoque ignora consumo do tipo `consumo`
- **Problema:** `detectarEstoqueBaixo()` só conta movimentações com `tipo === 'saida'`; o modal de saída do Estoque usa `consumo` como tipo padrão.
- **Impacto para o produtor:** a previsão de dias restantes fica `null`/cega para o fluxo mais comum de uso do estoque.
- **Impacto técnico:** lógica de previsão e o formulário que gera os dados de entrada não foram atualizados juntos.
- **Prioridade:** P1.
- **Esforço:** pequeno.
- **Dependências:** nenhuma (mais fácil se resolvido junto com BM-02, já que ambos tocam o mesmo fluxo de saída).
- **Sprint sugerido:** 15.
- **Critério de aceite:** previsão de dias restantes considera todos os tipos de saída de estoque (`saida`, `consumo`, `tratamento`); teste com movimentação tipo `consumo` gerando previsão não-nula.

### BM-04 — Alerta de "vencendo em breve" do estoque nunca dispara
- **Problema:** `agruparEstoqueValidade()` depende do campo `alerta_dias_antes` por item, mas o formulário de cadastro ativo (`EstoquePage.jsx`) não tem esse campo — só o componente morto `EstoqueForm.jsx` (não usado em lugar nenhum) o tem, com default 30.
- **Impacto para o produtor:** só recebe alerta quando o item **já venceu**, nunca com antecedência — para vacinas/medicamentos isso é tarde demais para agir.
- **Impacto técnico:** feature meio-implementada; parte do código existe mas está no arquivo errado.
- **Prioridade:** P1.
- **Esforço:** pequeno.
- **Dependências:** nenhuma.
- **Sprint sugerido:** 15.
- **Critério de aceite:** campo `alerta_dias_antes` presente no cadastro/edição de item de estoque com default sensato; item cadastrado com validade próxima gera alerta "próximo do vencimento" antes da data.

### BM-05 — Criação de lote depende de auto-patch silencioso
- **Problema:** `buildGrupoAnimaisAutoPatch` cria um registro sintético em `animais` para que Financeiro/Saúde/Decisão de venda funcionem; se esse patch não disparar (ex. lote criado por outro caminho, como importação), essas telas mostram "dados insuficientes" sem erro visível.
- **Impacto para o produtor:** um lote pode parecer "sem dados" mesmo com pesagens e custos lançados, sem pista do motivo.
- **Impacto técnico:** dependência implícita entre módulos que deveriam ser independentes.
- **Prioridade:** P1.
- **Esforço:** pequeno (validação/log) a médio (garantir em todos os pontos de criação, incluindo Importação).
- **Dependências:** nenhuma.
- **Sprint sugerido:** 15.
- **Critério de aceite:** teste garantindo que todo caminho de criação de lote (manual e importação) gera o registro sintético; se falhar, log explícito (não silencioso).

## Dados/banco

### BM-06 — Migrations locais divergem do schema remoto
- **Problema:** remoto tem 2 migrations não presentes localmente; local tem 1 migration não registrada no histórico do remoto.
- **Impacto para o produtor:** nenhum direto, mas risco de ambiente de staging/local não reproduzir produção.
- **Impacto técnico:** `supabase db pull`/`db push` deixam de ser confiáveis até reconciliar.
- **Prioridade:** P0.
- **Esforço:** pequeno.
- **Sprint sugerido:** 14.
- **Status (Sprint 17):** **parcial.** 3 arquivos com timestamp divergente do remoto foram renomeados (sem mudança de schema). As 2 migrations só-remoto e a 1 só-local-sem-registro seguem pendentes — exigem `supabase` CLI autenticado, não disponível nesta sessão. Plano detalhado em [HERDON_PLANO_RECONCILIACAO_SUPABASE.md](HERDON_PLANO_RECONCILIACAO_SUPABASE.md).
- **Critério de aceite:** `supabase db pull` roda sem gerar diffs inesperados; pasta de migrations reflete exatamente o que está aplicado no remoto.

### BM-07 — `pastagens` tem `faz_id` (bigint) e `fazenda_id` (uuid) simultaneamente
- **Problema:** coluna duplicada de tipos diferentes para o mesmo conceito, sobra de migração incompleta.
- **Impacto técnico:** risco de código ler a coluna errada silenciosamente.
- **Prioridade:** P1. **Esforço:** médio. **Sprint sugerido:** 17.
- **Critério de aceite:** uma só coluna de fazenda em `pastagens`, com backfill validado e RLS/índices atualizados.

### BM-08 — `customer_subscriptions` tem `farm_id` e `fazenda_id`
- Mesmo padrão do BM-07, no módulo de assinatura. **Prioridade:** P2. **Esforço:** pequeno. **Sprint sugerido:** 17.

### BM-09 — `lotes` tem três colunas de peso atual (`p_at`, `peso_atual`, `peso_medio_atual`)
- **Impacto:** confusão sobre fonte da verdade, risco de atualização parcial (uma coluna atualizada, outra não). **Prioridade:** P2. **Esforço:** médio. **Sprint sugerido:** 17.

### BM-10 — Políticas RLS duplicadas e `auth.uid()` não cacheado
- **Problema:** 92 ocorrências de policies permissivas duplicadas (`_owner` + `_same_account`) e 97 de `auth.uid()` reavaliado por linha.
- **Impacto técnico:** custo de query cresce com o volume de dados; hoje mascarado pela escala piloto.
- **Prioridade:** P1. **Esforço:** médio. **Sprint sugerido:** 17.
- **Critério de aceite:** advisor do Supabase sem `multiple_permissive_policies`/`auth_rls_initplan` nas tabelas operacionais principais.

### BM-11 — 16 chaves estrangeiras sem índice, 38 índices duplicados
- **Prioridade:** P2. **Esforço:** pequeno (script de criação/remoção de índices). **Sprint sugerido:** 17.
- **Status (Sprint 17):** **parcial.** As 13 FKs ainda sem índice (a contagem caiu de 16 para 13 nas sprints intermediárias) foram indexadas via migration `20260707161920`. Os ~40 índices duplicados **não foram removidos** — dropar índice é ação de maior risco que criar; plano de remoção segura em [HERDON_PLANO_RECONCILIACAO_SUPABASE.md](HERDON_PLANO_RECONCILIACAO_SUPABASE.md).

### BM-12 — `usuarios` vs `profiles`: duas tabelas de identidade
- **Problema:** não fica claro qual é autoritativa para papel/perfil.
- **Prioridade:** P2. **Esforço:** médio (decisão de arquitetura + migração). **Sprint sugerido:** 18.

### BM-13 — Hardening de segurança (baixo risco, fácil de fechar)
- 5 funções com `search_path` mutável, extensão `citext` fora de schema dedicado, proteção de senha vazada desabilitada.
- **Prioridade:** P3. **Esforço:** pequeno. **Sprint sugerido:** 17 (pode ser feito junto com BM-10/BM-11).
- **Status (Sprint 17):** **concluído** para as 5 funções com `search_path` mutável (migration `20260707161920`, confirmado sem regressão no advisor). `citext` fora de schema dedicado e proteção de senha vazada seguem pendentes (a primeira exige recriar a extensão; a segunda é configuração do painel Auth, não migration SQL).

## Decisão operacional

### BM-14 — Central de Alertas: painel resolver/adiar nunca migrado + 3 sistemas coexistindo
- **Problema:** `AlertasPage.jsx` (tela nova, "Central de Alertas") não tem nenhuma ação de resolver/adiar — isso só existe no painel legado do Dashboard, que usa `utils/alerts.js` (motor antigo), enquanto a Central usa `alertasUnificados.js`/`centralAlertas.js` (motor novo). Além disso, existem 3 janelas de dias diferentes para "vencendo" (3d para carência, 7d para contas/saída de lote).
- **Impacto para o produtor:** não dá pra marcar um alerta como tratado na tela que foi construída pra isso; o produtor precisa voltar ao Dashboard antigo para essa ação, ou o alerta nunca "some".
- **Impacto técnico:** dois motores de alerta ativos ao mesmo tempo é a maior fonte de risco de regressão do produto hoje.
- **Prioridade:** P1. **Esforço:** grande. **Dependências:** nenhuma, mas é pré-requisito para qualquer automação de tratativa (Nível 5).
- **Sprint sugerido:** 16.
- **Critério de aceite:** um único motor de alertas; resolver/adiar funciona na Central; painel do Dashboard usa a mesma fonte; janelas de dias unificadas numa config só.

### BM-15 — DRE só consolidado, não por fazenda
- **Problema:** `computeDRE()` não aceita filtro de fazenda; contas com múltiplas fazendas não conseguem comparar performance entre unidades.
- **Prioridade:** P2. **Esforço:** médio. **Sprint sugerido:** 20.

### BM-16 — Sem "centro de custo" real, só categoria plana
- **Prioridade:** P2. **Esforço:** médio. **Sprint sugerido:** 20.

## Alertas/notificações

### BM-17 — Telegram: sem rate limit, sem logging estruturado, sem painel admin
- **Problema:** nenhum limite de mensagens por chat; cada `/alertas`/`/relatorio` recalcula toda a base da conta; erros só aparecem em `console.error` disperso; nenhuma tela mostra quais contas estão conectadas.
- **Impacto para o produtor:** nenhum direto hoje, mas risco de custo de banco sob uso anômalo e dificuldade de suporte quando algo falha.
- **Prioridade:** P1 (risco operacional, não urgente). **Esforço:** médio. **Sprint sugerido:** 21.
- **Critério de aceite:** rate limit por chat_id; log estruturado consultável; página/seção admin lista conexões ativas.

### BM-18 — Alertas resolvidos/adiados não têm histórico consultável
- **Problema:** não existe "quem resolveu, quando" persistido de forma consultável — pré-requisito para automação (Nível 5).
- **Prioridade:** P2. **Esforço:** médio. **Sprint sugerido:** 22 (depende de BM-14).

## Financeiro

### BM-19 — Financeiro sem exportação (CSV/PDF)
- Ver BM-24 (categoria Relatórios) — mesmo gap, tratado em conjunto no roadmap.

## Sanidade

### BM-20 — Sem histórico por lote na Sanidade (só tabela global filtrável manualmente)
- **Prioridade:** P2. **Esforço:** médio. **Sprint sugerido:** 18.

### BM-21 — Protocolo IATF salvo como texto livre em `obs`
- **Problema:** frágil para consultar/alterar depois; não é dado estruturado.
- **Prioridade:** P2. **Esforço:** médio. **Sprint sugerido:** 18.

### BM-22 — Sem validação de coerência de datas na carência sanitária
- **Problema:** nada impede `data_fim_carencia` anterior à data de aplicação — erro de digitação quebra silenciosamente o alerta de segurança.
- **Prioridade:** P2. **Esforço:** pequeno. **Sprint sugerido:** 15 (fácil, pode entrar junto com BM-02/03/04).

## Estoque

(Ver BM-02, BM-03, BM-04 acima — já cobrem os itens críticos de estoque.)

### BM-23 — Componente morto `EstoqueForm.jsx` e duplicação de saída (`SaidaModal` vs `registrarSaidaEstoque`)
- **Prioridade:** P2. **Esforço:** pequeno. **Sprint sugerido:** 15 (limpeza natural ao mexer em BM-02/BM-04).

## UX/mobile

### BM-24 — 7 páginas órfãs sem link na sidebar
- **Problema:** `ComparativoPage`, `RotinaPage`, `AcompanhamentoPesoPage`, `CustosPage`, `EvolucaoRebanhoPage`, `DashboardPremiumPage`, `PlanejamentoPage` existem e funcionam mas não aparecem no menu.
- **Impacto para o produtor:** funcionalidades possivelmente úteis ficam invisíveis.
- **Prioridade:** P2. **Esforço:** pequeno (decisão + link, ou remoção formal). **Sprint sugerido:** 18.

### BM-25 — Duplicação funcionarios × equipeAcessos não limpa
- **Prioridade:** P2. **Esforço:** pequeno. **Sprint sugerido:** 18.

### BM-26 — `calculateGmd30` duplicado verbatim em 2 páginas
- **Prioridade:** P2. **Esforço:** pequeno. **Sprint sugerido:** 15.

### BM-27 — App.jsx monólito (1240 linhas) e páginas com 900+ linhas de lógica inline
- **Prioridade:** P3 (dívida técnica, não bloqueia usuário). **Esforço:** grande. **Sprint sugerido:** 19+ (contínuo).

### BM-28 — ~31% das páginas sem padrão consistente de loading/empty state
- **Prioridade:** P3. **Esforço:** pequeno, incremental. **Sprint sugerido:** contínuo.

## SaaS/cobrança

### BM-29 — Asaas ainda em sandbox (bloqueio comercial, não técnico)
- **Problema:** cobrança real não está ativa; é decisão/execução comercial, não bug de código.
- **Prioridade:** P1 (bloqueia monetização, não bloqueia uso do produto). **Esforço:** depende de terceiros. **Sprint sugerido:** fora da sequência técnica — decisão de negócio.

### BM-30 — Assinatura não é validada na camada RLS (só client-side)
- **Problema:** `accessControl.js` decide visualização/escrita; RLS restringe por conta (`same_account`) mas não por status de assinatura — uma chamada direta à API teoricamente contorna o bloqueio de escrita (o isolamento entre contas continua garantido).
- **Prioridade:** P2 (risco teórico documentado, não uma brecha ativa conhecida). **Esforço:** grande. **Sprint sugerido:** 18+.

## Segurança/RLS

(Ver BM-10, BM-11, BM-13, BM-30 acima.)

## Relatórios

### BM-24b (renomeado para evitar colisão de ID — ver categoria "Relatórios e exportações" abaixo)

### BM-31 — Nenhuma página de relatório exporta PDF/CSV/impressão
- **Problema:** `RelatoriosGerenciaisPage`, `RelatorioLotePage`, `RelatorioFinanceiroPage`, `RelatorioSanitario` e afins calculam e mostram dados, mas não existe `jsPDF`, `window.print()`/`@media print`, nem exportação CSV/XLSX em nenhuma delas (o pacote `xlsx` já instalado só é usado para **importar** dados, nunca para exportar). Um documento (`RELATORIOS_WHATSAPP_PDF_HERDON.md`) sugere que isso foi planejado, mas não existe implementação correspondente.
- **Impacto para o produtor:** não consegue levar nenhum relatório para fora do app — nem para o contador, nem para o banco, nem para negociar a venda de um lote.
- **Impacto técnico:** nenhum (é ausência de feature, não bug), mas é a lacuna mais afiada encontrada em toda a auditoria.
- **Prioridade:** P0.
- **Esforço:** grande (escolha de biblioteca, layout de PDF, ou no mínimo `@media print` + CSV nos relatórios principais).
- **Dependências:** nenhuma, pode começar imediatamente.
- **Sprint sugerido:** 19.
- **Critério de aceite:** Financeiro/DRE, Relatório de Lote e Relatório Sanitário têm export CSV e/ou PDF funcional testado manualmente; bundle de export carregado sob demanda (lazy), não no chunk principal.

## Integrações

### BM-32 — WhatsApp: não implementado (confirmado)
- **Problema:** nenhuma integração real existe; só um utilitário de compartilhamento de link e testes de formatação de texto.
- **Impacto:** nenhum débito técnico ativo — é greenfield.
- **Prioridade:** P3 (não priorizar até que Telegram e Central de Alertas estejam consolidados — replicar a mesma dívida em dois canais seria pior que não ter o segundo canal).
- **Esforço:** grande. **Sprint sugerido:** 23 (fundação), conceitual apenas até lá.

## IA/recomendações futuras

### BM-33 — Simulador sem recomendação textual nem histórico de cenários salvos
- **Problema:** ROI/break-even calculados corretamente, mas sem uma frase de recomendação nem persistência para comparar cenários ao longo do tempo.
- **Prioridade:** P3. **Esforço:** médio. **Sprint sugerido:** 24.

### BM-34 — Nenhum alerta ou simulação tem uma camada de recomendação determinística citável
- **Problema:** pré-requisito de confiança antes de qualquer IA generativa: cada alerta crítico/simulação deveria expor a regra usada para a recomendação, de forma auditável.
- **Prioridade:** P3 (estratégico, não urgente). **Esforço:** grande. **Sprint sugerido:** 24.

---

## Top 15 por prioridade (leitura rápida)

| # | Item | Prioridade | Sprint |
|---|---|---|---|
| 1 | BM-31 — Relatórios sem exportação | P0 | 19 |
| 2 | BM-02 — Sanidade não decrementa Estoque | P0 | 15 |
| 3 | BM-06 — Migrations locais divergem do remoto | P0 | 14 |
| 4 | BM-01 — Custo/lucro por arroba inconsistente | P1 | 14 |
| 5 | BM-14 — Central de Alertas: resolver/adiar não migrado, 3 motores | P1 | 16 |
| 6 | BM-03 — Previsão de estoque cega para "consumo" | P1 | 15 |
| 7 | BM-04 — Alerta de validade próxima nunca dispara | P1 | 15 |
| 8 | BM-05 — Criação de lote depende de auto-patch silencioso | P1 | 15 |
| 9 | BM-10 — RLS com policies duplicadas / auth.uid() não cacheado | P1 | 17 |
| 10 | BM-17 — Telegram sem rate limit/observabilidade/admin | P1 | 21 |
| 11 | BM-29 — Asaas em sandbox (bloqueio comercial) | P1 | negócio |
| 12 | BM-07 — pastagens com fazenda_id duplicado | P1 | 17 |
| 13 | BM-11 — FKs sem índice / índices duplicados | P2 | 17 |
| 14 | BM-24 — 7 páginas órfãs sem link | P2 | 18 |
| 15 | BM-12 — usuarios vs profiles ambíguo | P2 | 18 |
