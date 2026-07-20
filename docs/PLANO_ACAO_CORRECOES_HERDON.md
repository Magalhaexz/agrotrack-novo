# Plano de Ação — Correções HERDON (pós Auditoria 360º)

> Baseado nos achados de [AUDITORIA_GERAL_HERDON.md](AUDITORIA_GERAL_HERDON.md) e
> [MATRIZ_TESTES_FUNCIONAIS_HERDON.md](MATRIZ_TESTES_FUNCIONAIS_HERDON.md). IDs entre parênteses
> referenciam a matriz.

## Próxima sequência de sprints (pós Auditoria UX Completa, retomada 4)

Decisão explícita: **não iniciar a persistência de Dietas (Sprint C) antes de fechar os fluxos
críticos já existentes.** Ordem recomendada, do achado mais grave para o mais cosmético:

1. **Sprint E — Sincronizar venda/morte individual com o lote** (UX-P1-1). ✅ **Concluído** (Onda A —
   sprint de integridade, ver detalhes abaixo). Mesma classe de bug já corrigida 3 vezes nesta
   auditoria (venda/ajuste/RPC de lote) — reabria por um 4º caminho de escrita
   (`AnimaisPage.jsx::registrarOperacaoIndividual`), fechado reaproveitando
   `sincronizarAnimaisGrupoDoLote`, já testado.
2. **Sprint F — Financeiro: editar/excluir lançamento + filtro de período no DRE** (UX-FN1, UX-FN3).
   ✅ **UX-FN1 concluído** (editar/excluir manual + estorno rastreável de lançamento automático, ver
   detalhes abaixo). 🔴 **UX-FN3 (filtro de período no DRE) segue pendente** — não fazia parte do
   fechamento desta retomada.
3. **Sprint G — Sanidade: carência real + recorte por fazenda** (UX-SAN1, UX-SAN2). ✅ **UX-SAN1
   concluído** — decisão de produto confirmada com a usuária (bloquear toda venda durante carência
   ativa, tratando toda venda como destino abate, sem novo campo de finalidade) e implementada em
   `registrarSaidaAnimal`/`registrarSaidaAnimalIndividual`. 🔴 **UX-SAN2 (recorte por fazenda em
   `SanitarioPage.jsx`) e o alinhamento do Telegram com a mesma checagem de carência seguem
   pendentes** — ficam para a próxima rodada.
4. **Sprint H — Unificação de categorias e taxonomias** (UX-FN4/FIN-01, mais os campos de
   categorização já divergentes documentados em EST-04). Cross-cutting, toca Financeiro/Custos/
   Suplementação/Estoque ao mesmo tempo — fazer de uma vez para não gerar uma 4ª taxonomia no meio
   do caminho. Não iniciado.
5. **Sprint C (já planejada) — Suplementação/Dietas + redesenho de UI + RLS granular.** Só depois
   dos itens acima, e só com navegador autenticado disponível.

Achados P2/P3 da Auditoria UX Completa (consistência de botões, empty states, exportação
fragmentada, campos redundantes) ficam de backlog contínuo — não bloqueiam nenhuma sprint acima,
mas podem ser encaixados como itens pequenos dentro de qualquer uma delas.

## Onda 0 — Integridade imediata

| Item | Status |
|---|---|
| Venda/morte/transferência não sincronizava `animais.qtd` (VND-01) | ✅ Corrigido |
| RPC `registrar_saida_lote` do Telegram com o mesmo bug (VND-02) | ✅ Corrigido |
| Ajuste de Lotação reabria o mesmo bug (LOT-1) | ✅ Corrigido |
| Escalada de privilégio via auto-atualização de `perfil` (S-01) | ✅ Corrigido |
| **Estoque: tipos "Tratamento"/"Saída" falham silenciosamente (EST-01)** | ✅ **Corrigido** (retomada, mesmo dia) — enum canônico `['consumo','tratamento','ajuste','perda','venda']`, "Saída" removida do formulário, serviço nunca mais falha silenciosamente |
| Entrada de estoque não gera despesa financeira (EST-02) | ✅ **Corrigido** (mesma retomada) — lógica de persistência duplicada removida |
| RLS não reflete a matriz granular de permissões por módulo (S-02) | 🔴 Pendente — requer decisão de escopo (ver Sprint C) |
| Planejamento de suplementação não persiste na nuvem (SUP-01) | 🔴 Pendente — feature incompleta, já avisada na UI |
| **Fazenda com lote encerrado não podia ser excluída nem inativada pela mensagem de erro (CAMPO-01)** | ✅ **Corrigido** (teste de campo) — mensagem orienta inativação (fluxo que já existia); `pastagens`/`tarefas` entraram na checagem de vínculos |
| **Cadastro de lote só mostrava a fazenda ativa em conta multi-fazenda (CAMPO-04)** | ✅ **Corrigido** (teste de campo) — campo virou `<select>` real com todas as fazendas ativas |
| **UA/capacidade de pasto com a mesma causa raiz do bug de venda (CAMPO-02 = PST-1/PST-2)** | ✅ **Corrigido** (teste de campo) |
| **"Transferência de saída" sem campo de lote destino — falhava 100% das vezes (UX-P0-1)** | ✅ **Corrigido** (Auditoria UX Completa) — select de destino adicionado, Telegram já fazia certo |
| **Toast de sucesso da retirada baseado no botão que abriu o modal, não no tipo salvo (UX-P1-2)** | ✅ **Corrigido** |
| **2 modais de movimentação sem trava de duplo-envio (UX-P1-3)** | ✅ **Corrigido** — `useSubmitOnce` adicionado |
| **Exclusão de pasto sem checar lote vinculado (UX-P1-4)** | ✅ **Corrigido** — mesma regra que o bot do Telegram já aplicava |

**Como EST-01 foi resolvido**: em vez de mapear "Tratamento"/"Saída" para tipos já existentes, optei
por um enum canônico explícito e escopado a Estoque (não um refactor de todo o app): "Tratamento"
virou um tipo real de primeira classe (gera despesa própria `tratamento_sanitario` quando vinculado a
um lote); "Saída" foi removida do formulário por ser redundante com o próprio título da tela e não
cobrir nenhum caso de uso que Consumo/Tratamento/Ajuste/Perda já não cobrissem. Documentado em
[AUDITORIA_GERAL_HERDON.md](AUDITORIA_GERAL_HERDON.md) §2.1.

**Por que S-02 não foi corrigido nesta rodada**: fechar a granularidade no RLS (`operador` não pode
gravar em Financeiro/Custos/Funcionários mesmo via API direta) é uma mudança de schema/policies que
toca múltiplas tabelas — maior risco de regressão sem poder validar ao vivo nesta sessão (sem
navegador autenticado, confirmado em duas rodadas). Diferente de S-01 (uma vulnerabilidade isolada e
crítica, corrigida
imediatamente), este é um endurecimento estrutural que merece sua própria sprint com testes de
regressão por perfil.

## Onda 1 — Operações essenciais

- **LOT-2** — Pesagem lançada pelo modal do detalhe do lote (`LotesPage.jsx`) não usa
  `recalcularPesoAtualLote`; uma pesagem retroativa sobrescreve o "peso atual" com um valor mais
  antigo. Unificar os dois caminhos de "registrar pesagem" (`PesagensPage.jsx` e o modal do lote) em
  uma única implementação.
- **PST-1/PST-2** — ✅ corrigidos no teste de campo (CAMPO-02): `calcularUaPorLote`/
  `calcularUaTotalFazenda` agora aceitam a contagem canônica (`lote.qtd`) e filtram lotes
  finalizados/vendidos, com compatibilidade retroativa para quem ainda não passa esse argumento.
- **EST-01/EST-02** — ✅ já corrigidos na Onda 0 (ver acima).
- **CAMPO-01/CAMPO-04** — ✅ já corrigidos no teste de campo (ver Onda 0 acima).
- **SAN/Tarefas/Alertas** — sem achados P0/P1 novos; manter como estão.

## Onda 2 — Simplificação da experiência (Estoque e Suplementação)

Ver diagnóstico completo e fluxo proposto em
[AUDITORIA_UX_ESTOQUE_SUPLEMENTACAO.md](AUDITORIA_UX_ESTOQUE_SUPLEMENTACAO.md). Resumo do que essa
onda deve entregar:
- Unificar a categorização "item nutricional" (EST-04) em uma única fonte de verdade.
- Padronizar a regra de saldo negativo entre Estoque e Suplementação (EST-05) — substituir o
  `window.confirm` nativo por um modal do próprio design system.
- Simplificar o cadastro de item de estoque (unidade como dropdown, não texto livre; campos
  avançados atrás de "Mais informações").
- Adicionar exclusão/estorno de movimentação de estoque geral (EST-03).
- Persistir o planejamento de suplementação (SUP-01) ou remover a aba até estar pronta — hoje é uma
  feature "meio implementada" que a própria UI avisa não funcionar totalmente.

## Onda 3 — Consistência

- **FIN-01** — alinhar as categorias fixas do filtro do Financeiro com os slugs reais gerados por
  Estoque/Suplementação (`compra_estoque`, `consumo_estoque`, `nutricao`), para essas despesas
  pararem de sumir do filtro por categoria.
- **FAZ-2/PST-3/S-03** — padronizar o gate de permissão visual (`disabled` no botão, não só bloqueio
  no clique) em Fazendas, Pastagens e Funcionários, replicando o padrão já correto de
  Tarefas/Sanidade/Lotes.
- **TG-02** — alinhar a ordem de fallback `totalAnimais`/`lote.qtd` entre `respostasConsulta.js` e
  `saudeLote.js` (hoje ambos chegam ao mesmo número, mas por ordens de precedência diferentes —
  arrumar antes que um dia divirjam de verdade).
- **FAZ-1** — remover as ~380 linhas de código morto (`_executarDiagnosticoNuvem`,
  `_reconectarNuvem`, `_sincronizarFazendasComNuvem`) em `FazendasPage.jsx`.

## Onda 4 — Gestão avançada

- **S-02** (se não resolvido antes) — endurecer RLS para refletir a matriz granular de
  `src/auth/perfis.js` por módulo, não só o gate binário visualizador × resto.
- **S-05/S-06** — revisar funções `SECURITY DEFINER` expostas via RPC público (avaliar
  `SECURITY INVOKER` onde possível) e ligar a proteção de senha vazada no painel do Supabase Auth.
- **A-02** — decidir o destino do painel de alertas legado (`alertas_resolvidos`/`alertas_adiados`)
  coexistindo com a Central unificada: migrar ou aposentar formalmente.
- Relatórios/consolidado/equipe/assinatura: sem achados novos de severidade alta nesta rodada — não
  priorizar aqui além do que já está no backlog de sprints anteriores.

## Onda 5 — Piloto real

- Validar com produtores reais os fluxos redesenhados de Estoque/Suplementação (Onda 2).
- Medir tempo por operação e taxa de erro nos 5 cenários do diagnóstico UX
  ([AUDITORIA_UX_ESTOQUE_SUPLEMENTACAO.md](AUDITORIA_UX_ESTOQUE_SUPLEMENTACAO.md) §Cenários de teste).
- **Pré-requisito**: uma sessão de QA com navegador autenticado (credenciais de `.env.e2e`
  funcionando) para validar visualmente tudo o que esta auditoria só confirmou por código —
  especialmente os 8 viewports e 4 perfis do escopo original, que não puderam ser exercidos aqui.

---

## Proposta de sprints

### Sprint A — Estoque: fechar as duas falhas de persistência
**Status: ✅ concluído** (Onda 0, retomada do mesmo dia).
**Objetivo**: nenhuma ação de Estoque falha silenciosamente ou deixa de gerar o lançamento
financeiro esperado.
**Resolveu**: EST-01, EST-02. **Não resolveu**: EST-03 (exclusão/estorno de movimentação geral de
estoque) — fica para uma sprint futura, não fazia parte do P0/P1 original.
**Arquivos alterados**: `src/pages/EstoquePage.jsx`, `src/services/movimentacoes.js`.
**Migrations**: nenhuma (era lógica de aplicação, não schema, como previsto).
**Testes**: 6 testes novos em `movimentacoes.test.js`. **Teste manual dos 5 cenários do diagnóstico
UX não foi feito** — sem navegador autenticado nesta sessão (mesma limitação da rodada anterior).
**Critério de aceite**: atingido por código/testes automatizados; validação visual real fica
pendente para quando houver navegador autenticado.

### Sprint B — Pastagens/Lotes: fonte única de contagem de animais
**Status: parcialmente concluído** (teste de campo, mesmo dia).
**Resolveu**: PST-1, PST-2 (= CAMPO-02) e CAMPO-04 (seletor de fazenda no cadastro de lote), além de
CAMPO-01 (exclusão/inativação de fazenda). **Não resolveu**: LOT-2 (pesagem retroativa pelo modal do
detalhe do lote pode corromper "peso atual") — fica para uma sprint futura, é um achado separado,
não fazia parte do relato de campo desta rodada.
**Arquivos alterados**: `src/domain/unidadeAnimal.js`, `src/domain/ocupacaoPastos.js`,
`src/pages/PastagensPage.jsx`, `src/domain/indicadoresEstrategicos.js`, `src/components/LoteForm.jsx`,
`src/pages/FazendasPage.jsx`.
**Testes**: 3 testes novos em `tests/unidadeAnimal.test.js` (contagem canônica via lote, filtro de
lote finalizado, propagação em `calcularDiagnosticoCapacidade`). **Sem teste automatizado** para
CAMPO-01/CAMPO-04 (mudanças de UI/wiring de React sem infraestrutura de teste de componente no
projeto) — verificado por leitura de código, não por clique real.
**Pendente**: LOT-2, e validação visual real de tudo isto (sem navegador autenticado nesta sessão).

### Sprint C — Suplementação intuitiva, redesenho de UI e RLS granular
**Resolve**: SUP-01 = CAMPO-05 (persistir ou remover Dietas — teste de campo confirmou que **não
existe tabela `dietas` no banco**, é 100% local hoje), EST-04/EST-05 (unificar categorização e regra
de saldo negativo), o redesenho funcional de Estoque/Suplementação (wizard "Registrar Uso"/"Criar
dieta" em etapas, ações rápidas de copiar/repetir/pausar/finalizar dieta, empty states, unidade como
dropdown — ver `AUDITORIA_UX_ESTOQUE_SUPLEMENTACAO.md` §Proposta), e S-02 (RLS granular por módulo).
Persistir Dietas de verdade exigirá uma migration nova (tabela `dietas` + policies RLS), não é só
lógica de aplicação como os itens já corrigidos nesta auditoria.
**Pré-requisito explícito**: sessão de QA com navegador autenticado. Diferente das correções de
lógica pura (Sprint A/B), um redesenho de UI implementado às cegas — sem poder ver o resultado —
arrisca quebrar layouts, estados de loading/erro e responsividade de forma que só apareceria depois,
em produção. As credenciais de `.env.e2e` já falharam em duas tentativas ao longo desta auditoria
(não repetidas nesta 3ª rodada, por não trazerem informação nova).
**Dependências**: decisão de produto sobre o futuro da aba "Dietas"; sessão de QA com navegador
autenticado antes de mexer em RLS (alto risco de regressão de permissão sem poder testar ao vivo).
**Critério de aceite**: um `operador` autenticado, chamando a API diretamente (não só pela UI), não
consegue mais gravar em `movimentacoes_financeiras`/`custos`/`funcionarios`.

### Sprint D — Navegação e limpeza
**Resolve**: FAZ-1 (código morto), FAZ-2/PST-3/S-03 (gate visual de permissão), FIN-01 (categorias),
TG-02 (ordem de fallback).
**Risco**: baixo — mudanças isoladas e bem localizadas.

Nenhuma dessas sprints foi iniciada nesta rodada além do que está listado na Onda 0 como já corrigido.

### Sprint E — Sincronizar venda/morte individual com o lote
**Status: ✅ concluído** (Onda A — sprint de integridade).
**Resolve**: UX-P1-1. `AnimaisPage.jsx::registrarOperacaoIndividual` escrevia direto em
`animais`/`movimentacoes_animais`/`movimentacoes_financeiras` via CRUD genérico e nunca tocava
`lotes.qtd` nem a linha "grupo" do lote — o 4º caminho de escrita com o mesmo bug já corrigido em
`registrarSaidaAnimal` (lote), na RPC do Telegram e no Ajuste de Lotação.
**Solução**: nova função canônica `registrarSaidaAnimalIndividual` em `src/services/movimentacoes.js`,
reaproveitando `sincronizarAnimaisGrupoDoLote`/`mutationsAnimaisDoLote` já testados. Valida animal
existente, pertencimento ao lote, status ativo (bloqueia repetição), carência (venda), decrementa
`lotes.qtd`, sincroniza a linha "grupo" quando existir, cria `movimentacoes_animais` e — só para
venda com valor > 0 — `movimentacoes_financeiras` (receita). `AnimaisPage.jsx` foi reescrito para
chamar essa função com `try/catch` (mesmo padrão de `LotesPage.jsx::handleRetirada`), em vez da lógica
manual antiga — o que também corrigiu de brinde o toast de erro genérico (agora mostra a mensagem real
da validação, ex.: "Este animal já está inativo...").
**Decisão de escopo**: transferência individual (`'transferencia'` → renomeado para `'transferencia_saida'`
no `AnimalMovementModal.jsx`, alinhando o enum com o resto do domínio) continua sem mover o animal
para outro lote de fato — mesmo comportamento de antes (só muda status/lote_id permanece o mesmo),
apenas com a tag correta agora. Implementar a movimentação real entre lotes para o fluxo individual
fica para uma sprint futura (não fazia parte de UX-P1-1).
**Arquivos alterados**: `src/services/movimentacoes.js`, `src/pages/AnimaisPage.jsx`,
`src/components/AnimalMovementModal.jsx`, `src/domain/statusAnimal.js` (novo — `isAnimalIndividualAtivo`
extraído para ser reaproveitado também por `integridadeDados.js`, sem duplicar a lista de status).
**Migrations**: nenhuma.
**Testes**: 11 testes novos em `movimentacoes.test.js` (venda/morte individual, repetição bloqueada,
animal inexistente, sincronização da linha grupo, animal sem lote, tipo inválido, carência).
**Pendente**: validação visual real (sem navegador autenticado nesta sessão).

### Sprint F — Financeiro: editar/excluir lançamento manual + estornar automático
**Status: ✅ concluído** (Onda A — sprint de integridade). Filtro de período no DRE (UX-FN3) **não**
foi feito nesta rodada — ficou fora do escopo fechado desta retomada.
**Resolve**: UX-FN1. A aba "Lançamentos" de `FinanceiroPage.jsx` não tinha nenhuma ação — não dava
para corrigir nem apagar um lançamento digitado errado.
**Solução**: lançamento **manual** (sem `origem_tipo`/`origem`) ganhou Editar/Excluir, replicando o
padrão já existente em `CustosPage.jsx` (`updateOperationalRecord`/`deleteOperationalRecord`,
confirmação via `onConfirmAction`). Lançamento **automático** (`movimentacao_animal`,
`movimentacao_estoque`, `consumo_suplementacao`, `custo`) não pode ser editado/excluído — só
**estornado**: o original nunca é sobrescrito nem apagado (só ganha `estornado_em`), e um NOVO
lançamento é criado com o **tipo invertido** (receita↔despesa, mesmo valor), vinculado via
`origem_tipo: 'estorno'` / `origem_id: <original>`. Como o DRE já soma receita e subtrai despesa sem
nenhuma regra nova, a inversão de tipo neutraliza o efeito automaticamente — nenhuma mudança em
`financeiroDreLogic.js` foi necessária. Motivo do estorno é **obrigatório**, coletado por um modal
dedicado (`EstornoModal`, que é a própria confirmação — o `onConfirmAction` genérico não tem campo de
texto) e gravado na `observacao` do lançamento reverso. Segundo estorno é bloqueado checando
`estornado_em` já preenchido (`podeEstornar`). "Responsável" do estorno fica registrado via
`owner_user_id`, que `createOperationalRecord` já preenche automaticamente a partir da sessão — não
precisou de coluna nova para isso.
**Arquivos alterados**: `src/pages/FinanceiroPage.jsx`, `src/pages/financeiroLancamentoLogic.js`.
**Migration**: `supabase/migrations/20260720202758_add_estorno_financeiro_field.sql` — aditiva, uma
coluna nullable (`movimentacoes_financeiras.estornado_em timestamptz`), aplicada no projeto Supabase
remoto e confirmada via `list_tables`.
**Testes**: 14 testes novos em `financeiroLancamentoLogic.test.js` (`isLancamentoManual`,
`getOrigemLabel`, `podeEstornar`, `construirLancamentoEstorno` — motivo obrigatório, inversão de tipo,
vínculo com o original, herança de lote_id/fazenda_id, segundo estorno bloqueado). A lógica de I/O em
si (`estornarLancamento`/`excluirLancamento`/edição no `NovoLancamentoModal`) roteia inteiramente por
`createOperationalRecord`/`updateOperationalRecord`/`deleteOperationalRecord`, então herda a mesma
cobertura de permissão/paywall/multi-conta que essas funções já têm nos testes de `writeGuard`/matriz
view-write — não foi duplicada uma suíte de papéis específica para Financeiro (mesmo critério já usado
por `CustosPage.jsx`, que também não tem uma).
**Pendente**: filtro de período no DRE (UX-FN3), navegação "Ver origem" (mostra só o rótulo da origem,
não linka de volta para a tela de origem — decisão de escopo para manter o diff pequeno), validação
visual real (sem navegador autenticado nesta sessão).

### Carência sanitária (parte de UX-SAN1, dentro da Onda A)
**Status: ✅ concluído** — a parte de bloqueio de venda. **Recorte por fazenda do Sanidade (UX-SAN2) e
alinhamento com o Telegram ficam para a próxima rodada** (não fechados nesta retomada).
**Decisão de produto confirmada com a usuária**: bloquear **toda** venda durante carência ativa,
tratando toda venda registrada no HERDON como destino abate — sem novo campo de "finalidade da venda".
**Solução**: `verificarCarenciaAtivaLote(sanitarioRegistros, loteId, dataReferencia)` em
`src/domain/agendaSanitaria.js`, extraída da mesma condição que já monta o bucket `emCarencia` da
Agenda Sanitária (não é uma regra nova — é a mesma regra, só reaproveitável por quem precisa
*bloquear*, não só avisar). Usada por `registrarSaidaAnimal` (venda a nível de lote) e por
`registrarSaidaAnimalIndividual` (venda individual) — mesma função, mesma mensagem de erro no formato
"Este animal está em período de carência para abate até DD/MM/AAAA, devido ao tratamento com
PRODUTO.". Morte/perda/descarte não são bloqueados (carência só afeta venda).
**Arquivos alterados**: `src/domain/agendaSanitaria.js`, `src/services/movimentacoes.js`.
**Migrations**: nenhuma (a coluna `sanitario.data_fim_carencia` já existia desde o Sprint 10).
**Testes**: 7 testes novos em `agendaSanitaria.test.js` (`verificarCarenciaAtivaLote` — carência ativa,
vencida, sem registro, data limite exata, mais restritiva entre vários registros, nulos) + 4 testes em
`movimentacoes.test.js` (venda bloqueada, morte não bloqueada, venda liberada após carência,
venda individual bloqueada/morte individual liberada).
**Pendente**: recorte por fazenda em `SanitarioPage.jsx` (UX-SAN2), pré-checagem de carência no bot do
Telegram antes da RPC (`api/_telegramBot.js`) — ambos ficam para a próxima rodada, não fazem parte do
fechamento desta retomada.

### Diagnóstico de integridade — reconciliação lote.qtd × animais (Onda A)
**Status: ✅ concluído.**
**Resolve**: parte 4 da spec da Onda A (não tinha um ID de achado próprio na auditoria anterior —
achado durante a implementação do Sprint E, ao constatar que mesmo depois de sincronizar venda/morte
individual, nada detectava uma divergência residual se ela ocorresse por outro motivo, ex.: edição
direta no banco).
**Solução**: `src/domain/integridadeDados.js` (módulo já existente do Sprint 28, só verificava vínculo
com fazenda) ganhou 4 novos detectores puros — `detectarDivergenciaQuantidadeLote`,
`detectarAnimalEmLoteEncerrado`, `detectarAnimalSemLote`, `detectarVendaSemReceita`/
`detectarMorteComReceita` — agregados em `resumirDivergenciasOperacionais` (função nova, separada de
`resumirProblemasIntegridade` para não alterar o contrato/mensagem já testado daquela). **Não corrige
nada automaticamente** — só diagnostica e mostra um aviso em Configurações (mesmo padrão visual do
aviso de fazenda órfã já existente), para revisão manual do usuário.
**Arquivos alterados**: `src/domain/integridadeDados.js`, `src/pages/ConfiguracoesPage.jsx`,
`src/domain/statusAnimal.js` (novo).
**Migrations**: nenhuma.
**Testes**: 12 testes novos em `integridadeDados.test.js`.
**Pendente**: nenhuma correção automática foi implementada de propósito (decisão de produto: correção
de divergência histórica exige revisão humana, não é um "clique e conserta").
