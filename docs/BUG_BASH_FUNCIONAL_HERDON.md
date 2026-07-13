# Bug Bash Funcional — HERDON

Sprint bloqueador. Base: commit `1c0973d` (confirmado como `HEAD` e `origin/main` no pré-check). Nenhum recurso novo, nenhuma melhoria só visual, nenhum avanço para piloto/produção até P0 e P1 estarem zerados.

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

## Cobertura real desta rodada

```
Módulos com reprodução real em navegador autenticado: Autenticação/cadastro, Fazendas (CRUD),
  Lotes (cadastro + as 7 ações visíveis no card), Pesagens (nova pesagem, GMD),
  Financeiro (receita/despesa/cancelamento/DRE), Estoque (novo item, filtro geral/nutrição),
  Permissões (RLS: visualizador bloqueado, proprietário liberado), Multi-fazenda (isolamento
  confirmado na Central de Alertas)
Módulos NÃO testados nesta rodada: Pastagens, Sanidade, Calendário/Tarefas, Suplementação,
  Central de Alertas (fluxo de resolver/adiar), Assinatura/plano, Telegram, Equipe/convite via UI
  (só via SQL), relatórios/exportação, todos os modais restantes, viewports mobile (320/375/390/
  430/768px), rota-por-rota (refresh/voltar/avançar em cada uma), botão voltar do navegador
Bugs encontrados: 3 (todos P0)
Bugs corrigidos: 3 de 3
P0 abertos: 0 (dos encontrados) — 1 achado residual (FK sem validação de dono) documentado, não corrigido
P1 abertos: 0 (dos encontrados)
Cobertura funcional: parcial — não é possível declarar o app "pronto"; esta rodada não é
  equivalente ao bug bash completo de 30+ etapas descrito no prompt original, dado o volume de
  investigação que os 3 bugs P0 exigiram
```

Não declaro o HERDON pronto para piloto/produção — a varredura completa (todas as rotas, modais, formulários, os 4 perfis, 5 larguras mobile) descrita no escopo original não foi concluída nesta rodada. O que foi encontrado e corrigido são 3 bugs reais e severos; o que falta é largura de cobertura, não correção pendente conhecida.
